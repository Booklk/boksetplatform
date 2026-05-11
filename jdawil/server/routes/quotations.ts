/**
 * Quotations & Proposals — vendor creates a quote, sends share link to
 * customer, customer views + signs (typed name) → accepted.
 *
 * Public read via share token; everything else is vendor-scoped + auth.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { quotations, vendors, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

function generateQuoteNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `Q-${ts}-${rand}`;
}

function recompute(items: Array<{ quantity: number; unitPriceSar: number }>) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPriceSar, 0);
  const vat = Math.round(subtotal * 0.15 * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;
  return { subtotal, vat, total };
}

// ─── Vendor list ──────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const status = (req.query.status as string) || null;
    const rows = await db.select().from(quotations)
      .where(and(
        eq(quotations.vendorId, vendorId),
        ...(status ? [eq(quotations.status, status)] : []),
      ))
      .orderBy(desc(quotations.createdAt))
      .limit(200);
    return res.json(rows);
  } catch (e) {
    console.error('[quotations list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Single (vendor) ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [row] = await db.select().from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.vendorId, vendorId)))
      .limit(1);
    if (!row) return res.status(404).json({ error: 'العرض غير موجود' });
    return res.json(row);
  } catch (e) {
    console.error('[quotations get]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Create ───────────────────────────────────────────────────────────────
const itemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPriceSar: z.number().min(0),
  totalSar: z.number().min(0),
});
const createSchema = z.object({
  recipientName: z.string().min(2).max(200),
  recipientPhone: z.string().max(30).optional(),
  recipientEmail: z.string().email().optional(),
  customerId: z.number().int().positive().optional(),
  title: z.string().min(2).max(200),
  scope: z.string().min(5).max(8000),
  items: z.array(itemSchema).min(1),
  validUntil: z.string().datetime().optional(),
  termsText: z.string().max(8000).optional(),
  notesToCustomer: z.string().max(2000).optional(),
});

router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = createSchema.parse(req.body);

    const { subtotal, vat, total } = recompute(data.items);
    const [row] = await db.insert(quotations).values({
      vendorId,
      createdById: req.user!.id,
      customerId: data.customerId ?? null,
      recipientName: data.recipientName,
      recipientPhone: data.recipientPhone ?? null,
      recipientEmail: data.recipientEmail ?? null,
      quoteNumber: generateQuoteNumber(),
      title: data.title,
      scope: data.scope,
      items: data.items,
      subtotalSar: String(subtotal),
      vatSar: String(vat),
      totalSar: String(total),
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      termsText: data.termsText ?? null,
      notesToCustomer: data.notesToCustomer ?? null,
      status: 'draft',
      publicShareToken: randomBytes(24).toString('hex'),
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[quotations post]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Update (vendor, while not yet accepted) ──────────────────────────────
router.patch('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = createSchema.partial().parse(req.body);

    const [existing] = await db.select().from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.vendorId, vendorId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'العرض غير موجود' });
    if (existing.status === 'accepted') return res.status(409).json({ error: 'لا يمكن تعديل عرض مقبول' });

    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.items) {
      const { subtotal, vat, total } = recompute(data.items);
      updates.subtotalSar = String(subtotal);
      updates.vatSar = String(vat);
      updates.totalSar = String(total);
    }
    if (data.validUntil) updates.validUntil = new Date(data.validUntil);

    const [row] = await db.update(quotations).set(updates).where(eq(quotations.id, id)).returning();
    return res.json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[quotations patch]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Send (mark as sent + return shareable URL) ───────────────────────────
router.post('/:id/send', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [existing] = await db.select().from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.vendorId, vendorId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'العرض غير موجود' });
    if (existing.status !== 'draft' && existing.status !== 'sent') {
      return res.status(400).json({ error: `لا يمكن إرسال عرض في حالة ${existing.status}` });
    }

    const [row] = await db.update(quotations)
      .set({ status: 'sent', sentAt: new Date(), updatedAt: new Date() })
      .where(eq(quotations.id, id))
      .returning();

    const clientUrl = (process.env.CLIENT_URL ?? 'https://jdawil.sa').replace(/\/$/, '');
    const publicUrl = `${clientUrl}/quote/${row.publicShareToken}`;

    // Auto-WhatsApp the recipient if we have a phone.
    if (row.recipientPhone) {
      try {
        const { sendRawWhatsAppMessage } = await import('../services/whatsapp.js');
        const [v] = await db.select({ nameAr: vendors.nameAr })
          .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
        await sendRawWhatsAppMessage(
          row.recipientPhone,
          `📋 عرض سعر من ${v?.nameAr ?? 'شركتنا'}\n\n${row.title}\nالمبلغ: ${row.totalSar} ر.س\n\nراجع العرض ووقّعه إلكترونياً:\n${publicUrl}`,
          vendorId,
        ).catch(() => {});
      } catch { /* non-blocking */ }
    }

    return res.json({ ...row, publicUrl });
  } catch (e) {
    console.error('[quotations send]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Public read by token (customer view) ─────────────────────────────────
router.get('/public/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const [row] = await db.select({
      id: quotations.id,
      quoteNumber: quotations.quoteNumber,
      title: quotations.title,
      scope: quotations.scope,
      items: quotations.items,
      subtotalSar: quotations.subtotalSar,
      vatSar: quotations.vatSar,
      totalSar: quotations.totalSar,
      validUntil: quotations.validUntil,
      termsText: quotations.termsText,
      notesToCustomer: quotations.notesToCustomer,
      status: quotations.status,
      recipientName: quotations.recipientName,
      acceptedSignatureName: quotations.acceptedSignatureName,
      acceptedAt: quotations.acceptedAt,
      vendorNameAr: vendors.nameAr,
      vendorPhone: vendors.phone,
      vendorLogoUrl: vendors.logoUrl,
    })
      .from(quotations)
      .leftJoin(vendors, eq(vendors.id, quotations.vendorId))
      .where(eq(quotations.publicShareToken, token))
      .limit(1);
    if (!row) return res.status(404).json({ error: 'العرض غير موجود' });

    // Mark as viewed once.
    if (row.status === 'sent') {
      await db.update(quotations)
        .set({ status: 'viewed', viewedAt: new Date(), updatedAt: new Date() })
        .where(eq(quotations.publicShareToken, token));
    }

    return res.json(row);
  } catch (e) {
    console.error('[quotations public]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Public accept (digital signature) ────────────────────────────────────
const acceptSchema = z.object({
  signatureName: z.string().min(2).max(200),
});
router.post('/public/:token/accept', async (req, res) => {
  try {
    const token = req.params.token;
    const { signatureName } = acceptSchema.parse(req.body);

    const [existing] = await db.select().from(quotations)
      .where(eq(quotations.publicShareToken, token))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'العرض غير موجود' });
    if (existing.status === 'accepted') return res.status(409).json({ error: 'العرض مقبول مسبقاً' });
    if (existing.status === 'rejected' || existing.status === 'expired') {
      return res.status(400).json({ error: 'لا يمكن قبول هذا العرض' });
    }
    if (existing.validUntil && new Date(existing.validUntil) < new Date()) {
      await db.update(quotations).set({ status: 'expired' }).where(eq(quotations.id, existing.id));
      return res.status(410).json({ error: 'انتهت صلاحية العرض' });
    }

    const [row] = await db.update(quotations)
      .set({
        status: 'accepted',
        acceptedSignatureName: signatureName.trim(),
        acceptedAt: new Date(),
        acceptedIp: req.ip ?? null,
        acceptedUserAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(quotations.id, existing.id))
      .returning();

    // Notify the vendor.
    try {
      const { sendRawWhatsAppMessage } = await import('../services/whatsapp.js');
      const [v] = await db.select({ phone: vendors.phone })
        .from(vendors).where(eq(vendors.id, existing.vendorId)).limit(1);
      if (v?.phone) {
        await sendRawWhatsAppMessage(
          v.phone,
          `✅ عرض السعر #${existing.quoteNumber} تم قبوله\n👤 ${existing.recipientName}\n💰 ${existing.totalSar} ر.س\n\nادخل لوحة التحكم لمتابعة التنفيذ.`,
          existing.vendorId,
        ).catch(() => {});
      }
    } catch { /* non-blocking */ }

    return res.json({ success: true, quote: row });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[quotations accept]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const rejectSchema = z.object({
  reason: z.string().max(500).optional(),
});
router.post('/public/:token/reject', async (req, res) => {
  try {
    const token = req.params.token;
    const { reason } = rejectSchema.parse(req.body ?? {});

    const [existing] = await db.select().from(quotations)
      .where(eq(quotations.publicShareToken, token))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'العرض غير موجود' });
    if (existing.status === 'accepted') return res.status(409).json({ error: 'العرض مقبول — لا يمكن رفضه' });

    await db.update(quotations)
      .set({ status: 'rejected', rejectedAt: new Date(), rejectionReason: reason ?? null, updatedAt: new Date() })
      .where(eq(quotations.id, existing.id));
    return res.json({ success: true });
  } catch (e) {
    console.error('[quotations reject]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
