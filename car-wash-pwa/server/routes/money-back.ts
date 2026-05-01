import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, vendorSubscriptionPayments, auditLogs } from '../db/schema.js';
import { eq, and, sum } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/money-back/status
//   Tells the dashboard whether the vendor still qualifies for the
//   60-day full-refund window, and how many days remain.
router.get('/status', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const [v] = await db.select({
      moneyBackUntil: vendors.moneyBackUntil,
      moneyBackUsed: vendors.moneyBackUsed,
      createdAt: vendors.createdAt,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v) return res.status(404).json({ error: 'المتجر غير موجود' });

    const now = new Date();
    const eligible = !v.moneyBackUsed && v.moneyBackUntil instanceof Date && now <= v.moneyBackUntil;
    const daysRemaining = v.moneyBackUntil instanceof Date
      ? Math.max(0, Math.ceil((v.moneyBackUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Total paid so far — that's the refundable amount.
    const [{ paid = '0' } = { paid: '0' }] = await db.select({
      paid: sum(vendorSubscriptionPayments.amount),
    }).from(vendorSubscriptionPayments)
      .where(and(
        eq(vendorSubscriptionPayments.vendorId, vendorId),
        eq(vendorSubscriptionPayments.status, 'completed'),
      ));

    return res.json({
      eligible,
      used: v.moneyBackUsed,
      until: v.moneyBackUntil,
      daysRemaining,
      refundableAmount: Number(paid ?? 0),
      windowDays: 60,
    });
  } catch (e) {
    console.error('[money-back/status]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/money-back/request
//   Triggers the cancel-with-refund flow. We mark the vendor as
//   inactive + flag moneyBackUsed so they can't request twice. The
//   actual gateway refund (Moyasar / PayTabs) is handed off to a
//   manual super-admin step today; the queued request is enough for
//   the vendor's UX.
const requestSchema = z.object({
  reason: z.string().min(3, 'اكتب سبب الإلغاء (3 أحرف على الأقل)').max(500),
  feedback: z.string().max(2000).optional(),
});

router.post('/request', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = requestSchema.parse(req.body);

    const [v] = await db.select({
      moneyBackUntil: vendors.moneyBackUntil,
      moneyBackUsed: vendors.moneyBackUsed,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v) return res.status(404).json({ error: 'المتجر غير موجود' });

    const now = new Date();
    if (v.moneyBackUsed) {
      return res.status(409).json({ error: 'تم استخدام ضمان الاسترداد سابقًا' });
    }
    if (!(v.moneyBackUntil instanceof Date) || now > v.moneyBackUntil) {
      return res.status(403).json({
        error: 'انتهت فترة ضمان الاسترداد (60 يوم من التسجيل). يمكنك إلغاء الاشتراك بدون استرداد.',
      });
    }

    // Mark and deactivate.
    await db.update(vendors).set({
      moneyBackUsed: true,
      isActive: false,
      subscriptionStatus: 'cancelled',
      updatedAt: now,
    }).where(eq(vendors.id, vendorId));

    // Audit trail — super-admin uses this list to issue the gateway refund.
    await db.insert(auditLogs).values({
      vendorId,
      userId: req.user!.id,
      action: 'money_back.requested',
      resource: `/api/money-back/request`,
      method: 'POST',
      metadata: { reason: data.reason, feedback: data.feedback ?? null },
      ip: req.ip ?? 'unknown',
    });

    return res.json({
      success: true,
      message: 'تم استلام طلب الاسترداد. سيتم تحويل المبلغ كاملاً خلال 7 أيام عمل.',
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[money-back/request]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
