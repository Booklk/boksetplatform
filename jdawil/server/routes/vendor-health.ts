/**
 * Per-vendor health endpoint — what *this* vendor needs to know about
 * their own infrastructure footprint.
 *
 * The platform-wide /system-status/health is for the public marketing
 * page. This endpoint is private + scoped to one vendor: their plan,
 * quotas, WhatsApp connection state, recent errors. The vendor dashboard
 * reads it to render the "Health" card on the home screen.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { getAllQuotas } from '../services/usageGuard.js';
import { getQueueStats } from '../services/whatsappQueue.js';
import { setNoCache } from '../lib/httpCache.js';

const router = Router();

router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    setNoCache(res);

    const [v] = await db.select({
      plan: vendors.subscriptionPlan,
      status: vendors.subscriptionStatus,
      whatsappProvider: vendors.whatsappProvider,
      whatsappStatus: vendors.whatsappStatus,
      whatsappLastError: vendors.whatsappLastError,
      whatsappPlan: vendors.whatsappPlan,
      whatsappMessagesUsed: vendors.whatsappMessagesUsed,
      whatsappMessagesQuota: vendors.whatsappMessagesQuota,
      whatsappQuotaResetAt: vendors.whatsappQuotaResetAt,
      kycStatus: vendors.kycStatus,
      moneyBackUntil: vendors.moneyBackUntil,
      paymentConfig: vendors.paymentConfig,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    if (!v) return res.status(404).json({ error: 'لم يتم العثور على المتجر' });

    const quotas = await getAllQuotas(vendorId);
    const queue = getQueueStats();

    // Vendor-scoped derived signals for the dashboard widget.
    const checks = {
      subscription:    v.status === 'active' || v.status === 'trial',
      kycVerified:     v.kycStatus === 'approved',
      paymentGateway:  !!v.paymentConfig,
      whatsappActive:  v.whatsappStatus === 'active',
      noRecentError:   !v.whatsappLastError,
    };
    const ready = Object.values(checks).every(Boolean);
    const readinessPercent = Math.round(
      (Object.values(checks).filter(Boolean).length / Object.keys(checks).length) * 100,
    );

    return res.json({
      ready,
      readinessPercent,
      checks,
      subscription: {
        plan: v.plan,
        status: v.status,
        moneyBackUntil: v.moneyBackUntil,
      },
      whatsapp: {
        provider: v.whatsappProvider,
        status: v.whatsappStatus,
        lastError: v.whatsappLastError,
        plan: v.whatsappPlan,
        used: v.whatsappMessagesUsed,
        quota: v.whatsappMessagesQuota,
        resetAt: v.whatsappQuotaResetAt,
        // Whether the vendor's transactional sends are queueing up
        // (proxy for Meta/BSP backpressure).
        queueDepth: queue.pending,
        queueOldestMs: queue.oldestEnqueuedMs,
      },
      quotas,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[vendor-health]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
