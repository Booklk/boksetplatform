import { Router } from 'express';
import { db } from '../db/index.js';
import { bookings, vendorSubscriptionPayments, vendors, users } from '../db/schema.js';
import { eq, and, sql, sum, count, gte, isNotNull } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Vendor ROI dashboard data — shows the merchant exactly what they
 * got back for their subscription dollars. The biggest churn-killer
 * in SMB SaaS: making the dollar-value of the platform visible.
 *
 * Numbers are best-effort estimates from real platform data:
 *   - bookings via system  = bookings rows where vendor_id = X
 *   - no-shows prevented   = bookings with deposit > 0
 *   - time saved           = bookings × ~15 min admin per booking
 *   - SAR paid             = sum of completed subscription payments
 *
 * Multiplier = (estimated value created) / (subscription paid).
 * Anything ≥ 3× is exceptional; we expect 8-15× for active vendors.
 */
router.get('/me', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    // Vendor signup window — limit calcs to "since you joined".
    const [v] = await db.select({
      createdAt: vendors.createdAt,
      subscriptionPlan: vendors.subscriptionPlan,
      subscriptionStatus: vendors.subscriptionStatus,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v) return res.status(404).json({ error: 'المتجر غير موجود' });

    const since = v.createdAt ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    // Bookings + revenue + deposits.
    const [bookingStats] = await db.select({
      total: count(bookings.id),
      revenue: sum(bookings.totalPrice),
      depositsCollected: sum(bookings.depositAmount),
      depositsCount: sql<number>`COUNT(*) FILTER (WHERE ${bookings.depositAmount}::numeric > 0)`,
    }).from(bookings)
      .where(and(eq(bookings.vendorId, vendorId), gte(bookings.createdAt, since)));

    const totalBookings = Number(bookingStats?.total ?? 0);
    const grossRevenue = Number(bookingStats?.revenue ?? 0);
    const depositsCollected = Number(bookingStats?.depositsCollected ?? 0);
    const depositsCount = Number(bookingStats?.depositsCount ?? 0);

    // Estimate: each deposit-protected booking would have had a 25%
    // chance of being a no-show. Each no-show ≈ avg booking value lost.
    const avgBookingValue = totalBookings > 0 ? grossRevenue / totalBookings : 0;
    const estNoShowsPrevented = Math.round(depositsCount * 0.25);
    const noShowSavingsSar = Math.round(estNoShowsPrevented * avgBookingValue);

    // Subscriptions paid so far.
    const [{ paid = '0' } = { paid: '0' }] = await db.select({
      paid: sum(vendorSubscriptionPayments.amount),
    }).from(vendorSubscriptionPayments)
      .where(and(
        eq(vendorSubscriptionPayments.vendorId, vendorId),
        eq(vendorSubscriptionPayments.status, 'completed'),
      ));
    const totalPaidToJdawil = Number(paid ?? 0);

    // Time saved estimate: 15 min admin per booking × hourly value 30 SAR
    const adminMinutesPerBooking = 15;
    const hourlyValueSar = 30;
    const adminHoursSaved = Math.round((totalBookings * adminMinutesPerBooking) / 60);
    const timeSavingsSar = adminHoursSaved * hourlyValueSar;

    // Unique customers via system (an estimate for "customers reached").
    const [{ uniqueCustomers = 0 }] = await db.select({
      uniqueCustomers: sql<number>`COUNT(DISTINCT ${bookings.customerId})`,
    }).from(bookings)
      .where(and(eq(bookings.vendorId, vendorId), isNotNull(bookings.customerId)));
    const customerReach = Number(uniqueCustomers ?? 0);

    // Total estimated value the platform delivered.
    const totalValueDelivered = grossRevenue + noShowSavingsSar + timeSavingsSar;
    const roiMultiplier = totalPaidToJdawil > 0
      ? Number((totalValueDelivered / totalPaidToJdawil).toFixed(1))
      : null;

    return res.json({
      since: since.toISOString(),
      currency: 'SAR',
      totals: {
        bookings: totalBookings,
        grossRevenue,
        depositsCollected,
        depositsCount,
        estNoShowsPrevented,
        noShowSavingsSar,
        adminHoursSaved,
        timeSavingsSar,
        customerReach,
        totalValueDelivered,
      },
      cost: {
        totalPaidToJdawil,
        plan: v.subscriptionPlan,
        status: v.subscriptionStatus,
      },
      roiMultiplier,
      assumptions: {
        adminMinutesPerBooking,
        hourlyValueSar,
        depositNoShowReductionRate: 0.25,
      },
    });
  } catch (e) {
    console.error('[roi/me]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
