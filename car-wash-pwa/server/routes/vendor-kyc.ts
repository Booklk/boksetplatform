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
 * KYC documents are PII (owner name, national address, CR number) and are
 * always written through the storage abstraction with `private: true`.
 *   - local provider: stored under uploads/kyc/, served only via this
 *     auth-gated endpoint (never the public /uploads/ static mount).
 *   - s3 provider:    stored without public-read ACL; the document
 *     endpoint redirects callers to a 1h signed URL.
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, auditLogs } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { putObject, getSignedReadUrl, currentProvider } from '../services/storage.js';

const router = Router();

const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

const upload = multer({
  storage: multer.memoryStorage(),
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

      // Private upload — KYC docs MUST NOT be world-readable. The key is
      // what we store; readers of the document endpoint get a signed URL
      // (s3) or a streamed response (local).
      const { key } = await putObject(req.file.buffer, req.file.originalname, {
        contentType: req.file.mimetype,
        folder: 'kyc',
        private: true,
      });

      await db.update(vendors).set({
        kycDocumentType:     data.documentType,
        kycDocumentNumber:   data.documentNumber,
        kycDocumentUrl:      key,
        kycDocumentMimeType: req.file.mimetype,
        kycStatus:           'submitted',
        kycRejectionReason:  null,
        kycSubmittedAt:      new Date(),
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

// GET /api/vendor-kyc/document — auth-gated KYC file access. For s3, redirect
// to a 1h signed URL. For local, stream from disk (never the public
// /uploads/ mount).
router.get('/document', requireAuth, async (req: AuthRequest, res) => {
  try {
    const targetId = req.user!.role === 'super_admin' && req.query.vendorId
      ? Number(req.query.vendorId)
      : req.user!.vendorId;
    if (!targetId) return res.status(400).json({ error: 'لا يوجد متجر' });
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== targetId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const [row] = await db.select({
      key:  vendors.kycDocumentUrl,
      mime: vendors.kycDocumentMimeType,
    }).from(vendors).where(eq(vendors.id, targetId)).limit(1);
    if (!row?.key) return res.status(404).json({ error: 'لا توجد وثيقة مرفوعة' });

    if (currentProvider() === 's3') {
      const signed = await getSignedReadUrl(row.key, 3600);
      return res.redirect(302, signed);
    }

    // Local: legacy uploads were stored as "uploads/kyc/<file>"; new ones
    // through the abstraction are stored as "kyc/<file>". Support both.
    const localKey = row.key.replace(/^uploads\//, '');
    const safe = path.normalize(localKey);
    if (safe.includes('..')) return res.status(400).json({ error: 'مسار غير صحيح' });
    const abs = path.join(process.cwd(), 'uploads', safe);
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
