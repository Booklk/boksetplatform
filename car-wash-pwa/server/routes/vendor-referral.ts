import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { vendorReferrals, vendors, activityFeed } from '../db/schema.js';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// POST /api/vendor-referral/generate — Generate a referral code for this vendor
router.post('/generate', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    // Check if vendor already has a code
    const [existing] = await db.select().from(vendorReferrals)
      .where(and(eq(vendorReferrals.referrerVendorId, vendorId), eq(vendorReferrals.status, 'pending')))
      .limit(1);

    if (existing) {
      return res.json({
        code: existing.referralCode,
        link: `${process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'http://localhost:5173'}/onboard?ref=${existing.referralCode}`,
      });
    }

    // Generate unique code
    const code = `BK${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    await db.insert(vendorReferrals).values({
      referrerVendorId: vendorId,
      referralCode: code,
    });

    const domain = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'http://localhost:5173';

    return res.json({
      code,
      link: `${domain}/onboard?ref=${code}`,
      whatsappMessage: `🚗 جرّب Bokset — نظام إدارة المغاسل الأذكى!\n\nأنا أستخدمه لإدارة مغسلتي وفعلاً غيّر شغلي.\nسجّل مجاناً من هنا وجرّب 14 يوم:\n\n${domain}/onboard?ref=${code}\n\nاستخدم كود الإحالة: ${code}`,
    });
  } catch (err) {
    console.error('[Vendor Referral generate]', err);
    return res.status(500).json({ error: 'فشل في إنشاء كود الإحالة' });
  }
});

// GET /api/vendor-referral/my-referrals — Get vendor's referral stats
router.get('/my-referrals', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    const referrals = await db.select({
      id: vendorReferrals.id,
      code: vendorReferrals.referralCode,
      status: vendorReferrals.status,
      rewardType: vendorReferrals.rewardType,
      rewardGranted: vendorReferrals.rewardGranted,
      referredVendorName: vendors.nameAr,
      convertedAt: vendorReferrals.convertedAt,
      createdAt: vendorReferrals.createdAt,
    })
      .from(vendorReferrals)
      .leftJoin(vendors, eq(vendorReferrals.referredVendorId, vendors.id))
      .where(eq(vendorReferrals.referrerVendorId, vendorId))
      .orderBy(desc(vendorReferrals.createdAt));

    const stats = {
      total: referrals.length,
      converted: referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length,
      rewardsEarned: referrals.filter(r => r.rewardGranted).length,
    };

    return res.json({ referrals, stats });
  } catch (err) {
    console.error('[Vendor Referral my-referrals]', err);
    return res.status(500).json({ error: 'فشل في جلب البيانات' });
  }
});

// POST /api/vendor-referral/validate — Validate a referral code (used during onboarding)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ valid: false });

    const [referral] = await db.select({
      id: vendorReferrals.id,
      referrerVendorId: vendorReferrals.referrerVendorId,
      referrerName: vendors.nameAr,
    })
      .from(vendorReferrals)
      .leftJoin(vendors, eq(vendorReferrals.referrerVendorId, vendors.id))
      .where(and(
        eq(vendorReferrals.referralCode, code.toUpperCase()),
        eq(vendorReferrals.status, 'pending'),
      ))
      .limit(1);

    if (!referral) return res.json({ valid: false });

    return res.json({
      valid: true,
      referrerName: referral.referrerName,
      benefit: 'تحصل على 7 أيام إضافية مجانية على فترة التجربة!',
    });
  } catch (err) {
    return res.json({ valid: false });
  }
});

// ─── Social Proof: Recent Activity Feed ─────────────────────────────────────

// GET /api/vendor-referral/activity-feed — Public feed of recent platform activity
router.get('/activity-feed', async (_req, res) => {
  try {
    const feed = await db.select().from(activityFeed)
      .orderBy(desc(activityFeed.createdAt))
      .limit(10);

    return res.json(feed);
  } catch {
    return res.json([]);
  }
});

export default router;
