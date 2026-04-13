import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { promoCodes, promoCodeUsages } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const promoSchema = z.object({
  code: z.string().min(2).max(20).toUpperCase(),
  descriptionAr: z.string().optional(),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.string(),
  minOrderAmount: z.string().optional(),
  maxUses: z.number().optional(),
  validFrom: z.string().optional().transform(s => s ? new Date(s) : undefined),
  validUntil: z.string().optional().transform(s => s ? new Date(s) : undefined),
  isActive: z.boolean().optional(),
});

// GET /api/promos — Vendor admin: list promo codes
router.get('/', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(promoCodes)
      .where(eq(promoCodes.vendorId, vendorId))
      .orderBy(desc(promoCodes.createdAt));
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/promos — Create promo code
router.post('/', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const data = promoSchema.parse(req.body);
    const vendorId = req.user!.vendorId!;

    const [promo] = await db.insert(promoCodes).values({
      vendorId,
      ...data,
      createdBy: req.user!.id,
    }).returning();
    return res.status(201).json(promo);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/promos/:id — Update promo code
router.put('/:id', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const data = promoSchema.partial().parse(req.body);
    const vendorId = req.user!.vendorId!;
    const [updated] = await db.update(promoCodes).set(data)
      .where(and(eq(promoCodes.id, parseInt(req.params.id)), eq(promoCodes.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'الكود غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/promos/:id
router.delete('/:id', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    await db.update(promoCodes).set({ isActive: false })
      .where(and(eq(promoCodes.id, parseInt(req.params.id)), eq(promoCodes.vendorId, vendorId)));
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/promos/validate — Customer: validate a promo code
router.post('/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code, orderAmount } = z.object({
      code: z.string(),
      orderAmount: z.number().positive(),
    }).parse(req.body);

    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const [promo] = await db.select().from(promoCodes)
      .where(and(eq(promoCodes.code, code.toUpperCase()), eq(promoCodes.vendorId, vendorId), eq(promoCodes.isActive, true)))
      .limit(1);

    if (!promo) return res.status(404).json({ error: 'كود الخصم غير صحيح أو منتهي الصلاحية' });

    const now = new Date();
    if (promo.validFrom && new Date(promo.validFrom) > now) {
      return res.status(400).json({ error: 'كود الخصم لم يبدأ بعد' });
    }
    if (promo.validUntil && new Date(promo.validUntil) < now) {
      return res.status(400).json({ error: 'كود الخصم منتهي الصلاحية' });
    }
    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ error: 'تم استنفاد كود الخصم' });
    }
    if (promo.minOrderAmount && orderAmount < parseFloat(String(promo.minOrderAmount))) {
      return res.status(400).json({ error: `الحد الأدنى للطلب ${promo.minOrderAmount} ريال` });
    }

    let discountAmount = 0;
    if (promo.discountType === 'percent') {
      discountAmount = (orderAmount * parseFloat(String(promo.discountValue))) / 100;
    } else {
      discountAmount = Math.min(parseFloat(String(promo.discountValue)), orderAmount);
    }

    return res.json({
      valid: true,
      promoCodeId: promo.id,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      descriptionAr: promo.descriptionAr,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
