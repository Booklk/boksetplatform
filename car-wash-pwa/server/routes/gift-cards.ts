import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { giftCards } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { randomBytes } from 'crypto';

const router = Router();

function generateCode(): string {
  // Format: GC-XXXX-XXXX (16 chars total)
  const part = () => randomBytes(2).toString('hex').toUpperCase();
  return `GC-${part()}-${part()}`;
}

// GET /api/gift-cards — list all for vendor
router.get('/', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(giftCards)
      .where(eq(giftCards.vendorId, vendorId))
      .orderBy(desc(giftCards.createdAt));
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/gift-cards/check/:code — check gift card balance (public, used at checkout)
router.get('/check/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [card] = await db.select({
      id: giftCards.id,
      code: giftCards.code,
      currentBalance: giftCards.currentBalance,
      status: giftCards.status,
      expiresAt: giftCards.expiresAt,
    }).from(giftCards).where(eq(giftCards.code, code)).limit(1);

    if (!card) return res.status(404).json({ error: 'بطاقة الهدية غير موجودة' });
    if (card.status === 'redeemed') return res.status(400).json({ error: 'البطاقة مستخدمة مسبقاً', balance: 0 });
    if (card.status === 'expired' || (card.expiresAt && new Date(card.expiresAt) < new Date())) {
      return res.status(400).json({ error: 'البطاقة منتهية الصلاحية', balance: 0 });
    }
    return res.json({ id: card.id, code: card.code, balance: card.currentBalance, status: card.status });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// POST /api/gift-cards — issue new gift card
router.post('/', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = z.object({
      amount: z.number().min(10).max(10000),
      issuedTo: z.string().optional(),
      issuedToPhone: z.string().optional(),
      expiresInDays: z.number().min(1).max(365).default(365),
    }).parse(req.body);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000);

    const [card] = await db.insert(giftCards).values({
      vendorId,
      code,
      originalAmount: String(data.amount),
      currentBalance: String(data.amount),
      issuedTo: data.issuedTo,
      issuedToPhone: data.issuedToPhone,
      status: 'active',
      expiresAt,
      purchasedByUserId: req.user!.id,
    }).returning();

    return res.status(201).json(card);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/gift-cards/:id/redeem — redeem gift card against a booking
router.post('/:id/redeem', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const cardId = Number(req.params.id);
    const { bookingId, amount } = z.object({
      bookingId: z.number(),
      amount: z.number().min(1),
    }).parse(req.body);

    const [card] = await db.select().from(giftCards)
      .where(and(eq(giftCards.id, cardId), eq(giftCards.vendorId, vendorId))).limit(1);
    if (!card) return res.status(404).json({ error: 'بطاقة الهدية غير موجودة' });
    if (card.status === 'redeemed') return res.status(400).json({ error: 'البطاقة مستخدمة مسبقاً' });
    if (card.expiresAt && new Date(card.expiresAt) < new Date()) return res.status(400).json({ error: 'البطاقة منتهية الصلاحية' });

    const balance = Number(card.currentBalance);
    const deduct = Math.min(amount, balance);
    const newBalance = balance - deduct;
    const newStatus = newBalance <= 0 ? 'redeemed' : 'partially_used';

    const [updated] = await db.update(giftCards).set({
      currentBalance: String(newBalance),
      status: newStatus,
      redeemedBookingId: bookingId,
      redeemedAt: newBalance <= 0 ? new Date() : undefined,
    } as any).where(eq(giftCards.id, cardId)).returning();

    return res.json({ deducted: deduct, remainingBalance: newBalance, card: updated });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
