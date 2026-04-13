import { Router } from 'express';
import { db } from '../db/index.js';
import { vendors, users, bookings, financials, vendorSubscriptionPayments } from '../db/schema.js';
import { eq, sql, count, sum, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/super-admin/stats — Platform-wide statistics
router.get('/stats', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const [vendorCount] = await db.select({ count: count() }).from(vendors);
    const [activeVendors] = await db.select({ count: count() }).from(vendors).where(eq(vendors.isActive, true));
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalBookings] = await db.select({ count: count() }).from(bookings);
    const [completedBookings] = await db.select({ count: count() }).from(bookings).where(eq(bookings.status, 'completed'));
    const [totalRevenue] = await db.select({ total: sum(vendorSubscriptionPayments.amount) }).from(vendorSubscriptionPayments).where(eq(vendorSubscriptionPayments.status, 'paid'));

    return res.json({
      totalVendors: vendorCount.count,
      activeVendors: activeVendors.count,
      totalUsers: totalUsers.count,
      totalBookings: totalBookings.count,
      completedBookings: completedBookings.count,
      platformRevenue: totalRevenue.total ?? '0',
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/super-admin/vendors — All vendors with stats
router.get('/vendors', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const list = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      phone: vendors.phone,
      subscriptionStatus: vendors.subscriptionStatus,
      subscriptionPlan: vendors.subscriptionPlan,
      subscriptionEndDate: vendors.subscriptionEndDate,
      isActive: vendors.isActive,
      rating: vendors.rating,
      createdAt: vendors.createdAt,
    }).from(vendors).orderBy(desc(vendors.createdAt));
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/super-admin/revenue — Platform subscription revenue
router.get('/revenue', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const payments = await db.select({
      id: vendorSubscriptionPayments.id,
      vendorId: vendorSubscriptionPayments.vendorId,
      amount: vendorSubscriptionPayments.amount,
      period: vendorSubscriptionPayments.period,
      plan: vendorSubscriptionPayments.plan,
      status: vendorSubscriptionPayments.status,
      paidAt: vendorSubscriptionPayments.paidAt,
      vendorName: vendors.nameAr,
    })
      .from(vendorSubscriptionPayments)
      .leftJoin(vendors, eq(vendorSubscriptionPayments.vendorId, vendors.id))
      .orderBy(desc(vendorSubscriptionPayments.createdAt))
      .limit(100);

    return res.json(payments);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/super-admin/bookings-trend — Last 12 months booking counts per vendor
router.get('/bookings-trend', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM bookings
      WHERE created_at > NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month
    `);
    return res.json(result ?? []);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/super-admin/vendor-payments?vendorId=X
// Super admin: all payments | vendor_admin: own payments only
router.get('/vendor-payments', requireAuth, requireRole('super_admin', 'vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const requestedVendorId = req.query.vendorId ? Number(req.query.vendorId) : null;
    const role = req.user!.role;

    // vendor_admin can only see their own payments
    const vendorId = role === 'super_admin'
      ? requestedVendorId
      : req.user!.vendorId ?? null;

    if (!vendorId) {
      return res.status(400).json({ error: 'vendorId مطلوب' });
    }

    // Security: vendor_admin cannot view another vendor's payments
    if (role !== 'super_admin' && vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const payments = await db.select({
      id: vendorSubscriptionPayments.id,
      vendorId: vendorSubscriptionPayments.vendorId,
      amount: vendorSubscriptionPayments.amount,
      period: vendorSubscriptionPayments.period,
      plan: vendorSubscriptionPayments.plan,
      status: vendorSubscriptionPayments.status,
      paidAt: vendorSubscriptionPayments.paidAt,
      notes: vendorSubscriptionPayments.notes,
      createdAt: vendorSubscriptionPayments.createdAt,
    })
      .from(vendorSubscriptionPayments)
      .where(eq(vendorSubscriptionPayments.vendorId, vendorId))
      .orderBy(desc(vendorSubscriptionPayments.createdAt));

    return res.json({ payments });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
