import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  loyaltyPoints, loyaltyPrograms, loyaltyTiers,
  punchCards, bookings,
} from '../db/schema.js';
import { eq, and, sum, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/loyalty/program — Get vendor's loyalty program config
router.get('/program', requireAuth, async (req: AuthRequest, res) => {
  try {
    // vendor_admin gets their own; customers pass ?vendorId=X from booking context
    const vendorId = (req.user!.vendorId) ?? (Number(req.query.vendorId) || null);
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const [program] = await db.select().from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.vendorId, vendorId)).limit(1);

    if (!program) return res.json({ programType: 'disabled', isActive: false });
    return res.json(program);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/loyalty/program — Vendor admin: configure loyalty program
router.put('/program', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      programType: z.enum(['points', 'punch_card', 'disabled']),
      pointsPerSAR: z.string().optional(),
      pointsValueInSAR: z.string().optional(),
      minRedeemPoints: z.number().optional(),
      washesRequired: z.number().optional(),
      freeWashPackageId: z.number().optional(),
      freeWashDescription: z.string().optional(),
      isActive: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const vendorId = req.user!.vendorId!;

    const existing = await db.select().from(loyaltyPrograms)
      .where(eq(loyaltyPrograms.vendorId, vendorId)).limit(1);

    if (existing.length > 0) {
      const [updated] = await db.update(loyaltyPrograms).set({ ...data, updatedAt: new Date() })
        .where(eq(loyaltyPrograms.vendorId, vendorId)).returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(loyaltyPrograms).values({ vendorId, ...data }).returning();
      return res.status(201).json(created);
    }
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/loyalty/balance — Customer: get point balance for this vendor
router.get('/balance', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = (req.user!.vendorId) ?? (Number(req.query.vendorId) || null);
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const result = await db.select({
      total: sum(loyaltyPoints.points),
    }).from(loyaltyPoints).where(
      and(
        eq(loyaltyPoints.customerId, req.user!.id),
        eq(loyaltyPoints.vendorId, vendorId)
      )
    );

    const balance = Number(result[0]?.total ?? 0);
    return res.json({ balance });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/loyalty/history — Points transaction history
router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = (req.user!.vendorId) ?? (Number(req.query.vendorId) || null);
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const history = await db.select().from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.customerId, req.user!.id), eq(loyaltyPoints.vendorId, vendorId)))
      .orderBy(desc(loyaltyPoints.createdAt))
      .limit(50);

    return res.json(history);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/loyalty/tiers — Get loyalty tiers for this vendor
router.get('/tiers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = (req.user!.vendorId) ?? (Number(req.query.vendorId) || null);
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const tiers = await db.select().from(loyaltyTiers)
      .where(eq(loyaltyTiers.vendorId, vendorId))
      .orderBy(loyaltyTiers.sortOrder);

    return res.json(tiers);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/loyalty/punch-card — Customer: get active punch card
router.get('/punch-card', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = (req.user!.vendorId) ?? (Number(req.query.vendorId) || null);
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const [card] = await db.select().from(punchCards)
      .where(and(
        eq(punchCards.customerId, req.user!.id),
        eq(punchCards.vendorId, vendorId),
        eq(punchCards.isRedeemed, false)
      ))
      .orderBy(desc(punchCards.createdAt))
      .limit(1);

    return res.json(card ?? null);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/loyalty/redeem — Customer: redeem points
router.post('/redeem', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { points } = z.object({ points: z.number().positive() }).parse(req.body);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    // Check balance
    const result = await db.select({ total: sum(loyaltyPoints.points) }).from(loyaltyPoints)
      .where(and(eq(loyaltyPoints.customerId, req.user!.id), eq(loyaltyPoints.vendorId, vendorId)));
    const balance = Number(result[0]?.total ?? 0);

    if (balance < points) {
      return res.status(400).json({ error: `رصيد النقاط غير كافٍ. رصيدك الحالي: ${balance} نقطة` });
    }

    await db.insert(loyaltyPoints).values({
      vendorId,
      customerId: req.user!.id,
      transactionType: 'redeem',
      points: -points,
      description: `استبدال ${points} نقطة`,
    });

    return res.json({ ok: true, newBalance: balance - points });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
