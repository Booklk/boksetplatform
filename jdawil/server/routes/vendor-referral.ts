import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { vendorReferrals, vendors, activityFeed } from '../db/schema.js';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// REFERRAL STATUS FLOW:
//   pending     → التاجر المُحيل أنشأ الكود ولم يستخدمه أحد بعد
//   registered  → تاجر جديد سجّل باستخدام الكود (فترة تجربة)
//   converted   → التاجر المُحال اشترك فعلياً (دفع) — يتم تلقائياً
//   rewarded    → المكافأة (شهر مجاني) تم منحها للمُحيل
//   expired     → انتهت التجربة ولم يشترك المُحال
//
// المكافأة تُمنح فقط عند "converted" — أي بعد الدفع الفعلي
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/vendor-referral/generate — Generate a referral code for this vendor
router.post('/generate', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    // Check if vendor already has an active pending code
    const existing = await db.select().from(vendorReferrals)
      .where(and(
        eq(vendorReferrals.referrerVendorId, vendorId),
        eq(vendorReferrals.status, 'pending'),
      ))
      .limit(1);

    if (existing.length > 0) {
      const domain = process.env.DOMAIN ? `https://${process.env.DOMAIN}` : 'http://localhost:5173';
      return res.json({
        code: existing[0].referralCode,
        link: `${domain}/onboard?ref=${existing[0].referralCode}`,
        whatsappMessage: buildWhatsAppMessage(existing[0].referralCode, domain),
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
      whatsappMessage: buildWhatsAppMessage(code, domain),
    });
  } catch (err) {
    console.error('[Vendor Referral generate]', err);
    return res.status(500).json({ error: 'فشل في إنشاء كود الإحالة' });
  }
});

function buildWhatsAppMessage(code: string, domain: string): string {
  return `جرّب Jdawil — أنشئ موقع حجوزات لمشروعك!\n\nأنا أستخدمه وفعلاً سهّل شغلي.\nسجّل مجاناً من هنا وجرّب 14 يوم:\n\n${domain}/onboard?ref=${code}\n\nكود الإحالة: ${code}`;
}

// GET /api/vendor-referral/my-referrals — Get vendor's referral stats
router.get('/my-referrals', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const referrals = await db.select({
      id: vendorReferrals.id,
      code: vendorReferrals.referralCode,
      status: vendorReferrals.status,
      rewardType: vendorReferrals.rewardType,
      rewardGranted: vendorReferrals.rewardGranted,
      referredVendorName: vendors.nameAr,
      referredVendorSubStatus: vendors.subscriptionStatus,
      convertedAt: vendorReferrals.convertedAt,
      rewardedAt: vendorReferrals.rewardedAt,
      createdAt: vendorReferrals.createdAt,
    })
      .from(vendorReferrals)
      .leftJoin(vendors, eq(vendorReferrals.referredVendorId, vendors.id))
      .where(eq(vendorReferrals.referrerVendorId, vendorId))
      .orderBy(desc(vendorReferrals.createdAt));

    const stats = {
      total: referrals.length,
      registered: referrals.filter(r => r.status === 'registered').length,
      converted: referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length,
      rewardsEarned: referrals.filter(r => r.rewardGranted).length,
      pendingReward: referrals.filter(r => r.status === 'registered').length,
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
      note: 'اللي أحالك يحصل على شهر مجاني بعد ما تشترك',
    });
  } catch (err) {
    return res.json({ valid: false });
  }
});

// POST /api/vendor-referral/mark-registered — Called after new vendor signs up with referral code
// Moves referral from "pending" → "registered" (trial, not paid yet)
router.post('/mark-registered', async (req, res) => {
  try {
    const { code, referredVendorId } = req.body;
    if (!code || !referredVendorId) return res.status(400).json({ error: 'بيانات ناقصة' });

    const [referral] = await db.select().from(vendorReferrals)
      .where(and(
        eq(vendorReferrals.referralCode, code.toUpperCase()),
        eq(vendorReferrals.status, 'pending'),
      ))
      .limit(1);

    if (!referral) return res.status(404).json({ error: 'كود الإحالة غير صالح' });

    await db.update(vendorReferrals).set({
      referredVendorId,
      status: 'registered', // trial — NOT converted yet
    }).where(eq(vendorReferrals.id, referral.id));

    return res.json({ success: true, message: 'تم تسجيل الإحالة. المكافأة تُمنح بعد الاشتراك الفعلي.' });
  } catch (err) {
    console.error('[Vendor Referral mark-registered]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRON FUNCTION: Check if referred vendors have subscribed (paid)
// Called from server/index.ts cron job
// ═══════════════════════════════════════════════════════════════════════════════
export async function processReferralConversions() {
  try {
    // Find all "registered" referrals where the referred vendor now has active subscription
    const pendingReferrals = await db.select({
      referralId: vendorReferrals.id,
      referrerVendorId: vendorReferrals.referrerVendorId,
      referredVendorId: vendorReferrals.referredVendorId,
      referredSubStatus: vendors.subscriptionStatus,
      referredVendorName: vendors.nameAr,
    })
      .from(vendorReferrals)
      .leftJoin(vendors, eq(vendorReferrals.referredVendorId, vendors.id))
      .where(eq(vendorReferrals.status, 'registered'));

    let converted = 0;
    for (const ref of pendingReferrals) {
      if (!ref.referredVendorId) continue;

      // Only convert if the referred vendor has PAID (active subscription)
      if (ref.referredSubStatus === 'active') {
        // Mark as converted
        await db.update(vendorReferrals).set({
          status: 'converted',
          convertedAt: new Date(),
        }).where(eq(vendorReferrals.id, ref.referralId));

        // Grant reward: extend referrer's subscription by 1 month
        const [referrerVendor] = await db.select({
          id: vendors.id,
          subEndDate: vendors.subscriptionEndDate,
          nameAr: vendors.nameAr,
        }).from(vendors).where(eq(vendors.id, ref.referrerVendorId));

        if (referrerVendor) {
          const currentEnd = referrerVendor.subEndDate
            ? new Date(referrerVendor.subEndDate)
            : new Date();
          const newEnd = new Date(currentEnd);
          newEnd.setMonth(newEnd.getMonth() + 1); // +1 month free

          await db.update(vendors).set({
            subscriptionEndDate: newEnd,
          }).where(eq(vendors.id, ref.referrerVendorId));

          // Mark reward as granted
          await db.update(vendorReferrals).set({
            status: 'rewarded',
            rewardGranted: true,
            rewardedAt: new Date(),
            rewardValue: '1', // 1 month
          }).where(eq(vendorReferrals.id, ref.referralId));

          // Log to activity feed
          await db.insert(activityFeed).values({
            type: 'vendor_joined',
            message: `${ref.referredVendorName ?? 'متجر جديد'} اشتركت عبر إحالة`,
            city: null,
          });

          converted++;
          console.log(`[Referral] Reward granted: ${referrerVendor.nameAr} gets +1 month (referred ${ref.referredVendorName})`);
        }
      }

      // Check if trial expired without subscribing → mark as expired
      if (ref.referredSubStatus === 'expired' || ref.referredSubStatus === 'suspended') {
        await db.update(vendorReferrals).set({
          status: 'expired',
        }).where(eq(vendorReferrals.id, ref.referralId));
      }
    }

    if (converted > 0) console.log(`[Referral Cron] Processed ${converted} conversions`);
  } catch (err) {
    console.error('[Referral Cron]', err);
  }
}

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
