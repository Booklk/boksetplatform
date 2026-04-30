/**
 * Vendor KYC — submit + status + document download.
 *
 * Saudi market reality: two document types are accepted.
 *   - السجل التجاري (CR) — commercial registration for companies
 *   - وثيقة العمل الحر — freelance permit for individuals
 *
 * Both are usually downloaded as PDF from المركز السعودي للأعمال
 * والتنافسية — so we accept application/pdf as well as jpeg/png.
 *
 * Files live under `uploads/kyc/` (auth-gated download only, never
 * served via the plain `/uploads/` static mount) because the PDF
 * contains PII (owner name, national address, CR number, etc.).
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, auditLogs } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Upload storage ────────────────────────────────────────────────────────
const KYC_DIR = path.join(process.cwd(), 'uploads', 'kyc');
if (!fs.existsSync(KYC_DIR)) fs.mkdirSync(KYC_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, KYC_DIR),
  filename: (_req, file, cb) => {
    const raw = path.extname(file.originalname).toLowerCase();
    const ext = /^\.(pdf|jpg|jpeg|png)$/.test(raw) ? raw : '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — PDFs from the gov portal
  fileFilter: (_req, file, cb) => {
    if (!ACCEPTED_MIME.has(file.mimetype)) {
      cb(new Error('نوع الملف غير مدعوم — يقبل PDF أو صورة JPG/PNG فقط'));
      return;
    }
    cb(null, true);
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/vendor-kyc/status — current KYC state for the authenticated vendor
router.get('/status', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const [row] = await db.select({
    kycDocumentType:    vendors.kycDocumentType,
    kycDocumentNumber:  vendors.kycDocumentNumber,
    kycStatus:          vendors.kycStatus,
    kycRejectionReason: vendors.kycRejectionReason,
    kycSubmittedAt:     vendors.kycSubmittedAt,
    kycVerifiedAt:      vendors.kycVerifiedAt,
    hasDocument:        vendors.kycDocumentUrl,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return res.json({
    documentType:    row?.kycDocumentType ?? null,
    documentNumber:  row?.kycDocumentNumber ?? null,
    status:          row?.kycStatus ?? 'not_started',
    rejectionReason: row?.kycRejectionReason ?? null,
    submittedAt:     row?.kycSubmittedAt ?? null,
    verifiedAt:      row?.kycVerifiedAt ?? null,
    hasDocument:     Boolean(row?.hasDocument),
  });
});

// POST /api/vendor-kyc/submit — multipart: file + documentType + documentNumber
const submitSchema = z.object({
  documentType:   z.enum(['cr', 'freelance']),
  documentNumber: z.string().min(4, 'الرقم قصير').max(30),
});

router.post('/submit',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  upload.single('document'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
      if (!req.file) return res.status(400).json({ error: 'يرجى إرفاق ملف الوثيقة' });

      const data = submitSchema.parse({
        documentType:   req.body.documentType,
        documentNumber: req.body.documentNumber,
      });

      // Freelance permits from the gov portal are 10-digit numbers;
      // CR numbers are typically 10 digits too. Accept 4-30 for safety
      // but light-validate shape here as a smoke-check.
      if (!/^\d{4,30}$/.test(data.documentNumber)) {
        // Not a hard error — some formats include dashes. Warn only.
      }

      const docUrl = path.posix.join('uploads', 'kyc', req.file.filename);
      await db.update(vendors).set({
        kycDocumentType:     data.documentType,
        kycDocumentNumber:   data.documentNumber,
        kycDocumentUrl:      docUrl,
        kycDocumentMimeType: req.file.mimetype,
        kycStatus:           'submitted',
        kycRejectionReason:  null,
        kycSubmittedAt:      new Date(),
        // Also populate the legacy crNumber field so the existing
        // invoice/VAT workflow keeps working without extra plumbing.
        ...(data.documentType === 'cr' ? { crNumber: data.documentNumber } : {}),
        updatedAt:           new Date(),
      }).where(eq(vendors.id, vendorId));

      await db.insert(auditLogs).values({
        vendorId,
        userId: req.user!.id,
        action: 'kyc.submitted',
        resource: '/api/vendor-kyc/submit',
        method: 'POST',
        metadata: { documentType: data.documentType, mimeType: req.file.mimetype },
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      });

      return res.status(201).json({ success: true, status: 'submitted' });
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error('[vendor-kyc/submit]', e);
      return res.status(500).json({ error: e?.message ?? 'تعذّر رفع الوثيقة' });
    }
  });

// GET /api/vendor-kyc/document — streams the KYC file for the vendor's own
// review OR a super_admin. Auth-gated (doc stays off the public /uploads).
router.get('/document', requireAuth, async (req: AuthRequest, res) => {
  try {
    // Super admin can pass ?vendorId=N to fetch any vendor's doc.
    const targetId = req.user!.role === 'super_admin' && req.query.vendorId
      ? Number(req.query.vendorId)
      : req.user!.vendorId;
    if (!targetId) return res.status(400).json({ error: 'لا يوجد متجر' });
    // Tenant guard.
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== targetId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const [row] = await db.select({
      url:  vendors.kycDocumentUrl,
      mime: vendors.kycDocumentMimeType,
    }).from(vendors).where(eq(vendors.id, targetId)).limit(1);
    if (!row?.url) return res.status(404).json({ error: 'لا توجد وثيقة مرفوعة' });
    // Prevent path traversal: the stored URL must live under uploads/kyc/.
    const safe = path.normalize(row.url);
    if (!safe.startsWith(path.join('uploads', 'kyc'))) {
      return res.status(400).json({ error: 'مسار غير صحيح' });
    }
    const abs = path.join(process.cwd(), safe);
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'الملف غير موجود' });
    res.set('Content-Type', row.mime ?? 'application/octet-stream');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'private, no-store');
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error('[vendor-kyc/document]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
