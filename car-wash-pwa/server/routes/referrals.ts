import { Router } from 'express';
import { db } from '../db/index.js';
import { referrals, users, vendors } from '../db/schema.js';
import { eq, and, count, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/referrals/my-code — get or generate referral code for current customer
router.get('/my-code', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    // Check for existing code
    const [existing] = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, req.user!.id), eq(referrals.vendorId, vendorId)))
      .limit(1);

    if (existing) {
      const vendor = await db.select({ nameAr: vendors.nameAr, slug: vendors.slug })
        .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      return res.json({
        code: existing.referralCode,
        vendorName: vendor[0]?.nameAr ?? 'المتجر',
        vendorSlug: vendor[0]?.slug ?? '',
      });
    }

    // Generate unique code
    let code = generateReferralCode();
    let attempts = 0;
    while (attempts < 10) {
      const [dup] = await db.select({ id: referrals.id })
        .from(referrals).where(eq(referrals.referralCode, code)).limit(1);
      if (!dup) break;
      code = generateReferralCode();
      attempts++;
    }

    const [created] = await db.insert(referrals).values({
      vendorId,
      referrerId: req.user!.id,
      referralCode: code,
    }).returning();

    const vendor = await db.select({ nameAr: vendors.nameAr, slug: vendors.slug })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    return res.json({
      code: created.referralCode,
      vendorName: vendor[0]?.nameAr ?? 'المتجر',
      vendorSlug: vendor[0]?.slug ?? '',
    });
  } catch (e) {
    console.error('[referrals/my-code]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/referrals/stats — how many referred, converted, total rewards
router.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const rows = await db
      .select()
      .from(referrals)
      .where(and(eq(referrals.referrerId, req.user!.id), eq(referrals.vendorId, vendorId)));

    const totalReferred = rows.length;
    const totalConverted = rows.filter(r => r.status === 'converted' || r.status === 'rewarded').length;
    const totalRewards = rows
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + parseFloat(r.rewardAmount ?? '0'), 0);

    return res.json({
      totalReferred,
      totalConverted,
      totalRewards: totalRewards.toFixed(2),
    });
  } catch (e) {
    console.error('[referrals/stats]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/referrals/apply — new customer applies a referral code at registration
router.post('/apply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'كود الإحالة مطلوب' });
    }

    const vendorId = req.user!.vendorId;

    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, code.toUpperCase().trim()))
      .limit(1);

    if (!referral) return res.status(404).json({ error: 'كود الإحالة غير صالح' });
    if (referral.referrerId === req.user!.id) {
      return res.status(400).json({ error: 'لا يمكنك استخدام كودك الخاص' });
    }
    if (referral.referredId) {
      return res.status(400).json({ error: 'هذا الكود مستخدم مسبقاً' });
    }

    // Mark referral as converted
    await db.update(referrals)
      .set({
        referredId: req.user!.id,
        status: 'converted',
        convertedAt: new Date(),
      })
      .where(eq(referrals.id, referral.id));

    return res.json({ ok: true, message: 'تم تطبيق كود الإحالة بنجاح! ستحصل على خصم في حجزك القادم.' });
  } catch (e) {
    console.error('[referrals/apply]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
