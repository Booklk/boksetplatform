import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { vendors, users, bookings, financials, vendorSubscriptionPayments, auditLogs, inAppNotifications, platformPlans } from '../db/schema.js';
import { eq, sql, count, sum, desc, gte, like, or, asc, and } from 'drizzle-orm';
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
// NOTE: uses Postgres-specific DATE_TRUNC / INTERVAL. If we ever move to a
// non-Postgres engine this query and the cohort query below need rewriting.
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

// ═══════════════════════════════════════════════════════════════════════════════
// USERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/users — All users with filters
router.get('/users', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit ?? 50)));
    const offset = (page - 1) * limit;

    let query = db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
      vendorId: users.vendorId,
      isActive: users.isActive,
      createdAt: users.createdAt,
      vendorName: vendors.nameAr,
    })
      .from(users)
      .leftJoin(vendors, eq(users.vendorId, vendors.id))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // Type-safe filtering would require dynamic query building
    // For simplicity, we fetch and filter
    const allUsers = await query;
    let filtered = allUsers;
    if (role) filtered = filtered.filter(u => u.role === role);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(s) ||
        u.phone?.includes(s) ||
        u.email?.toLowerCase().includes(s)
      );
    }

    const [total] = await db.select({ count: count() }).from(users);

    return res.json({ users: filtered, total: total.count, page, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /api/super-admin/users/:id/toggle — Activate/deactivate user
router.patch('/users/:id/toggle', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const [user] = await db.select({ isActive: users.isActive }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    await db.update(users).set({ isActive: !user.isActive }).where(eq(users.id, userId));
    return res.json({ success: true, isActive: !user.isActive });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM HEALTH
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/health — System health metrics
router.get('/health', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    // Database check
    let dbStatus = 'connected';
    try { await db.execute(sql`SELECT 1`); } catch { dbStatus = 'disconnected'; }

    // Counts
    const [vendorCount] = await db.select({ count: count() }).from(vendors).where(eq(vendors.isActive, true));
    const [userCount] = await db.select({ count: count() }).from(users);

    // Today's bookings
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [todayBookings] = await db.select({ count: count() }).from(bookings).where(gte(bookings.createdAt, today));

    // Pending support tickets
    const [openTickets] = await db.select({ count: count() }).from(
      db.select().from(sql`support_tickets`).where(sql`status = 'open' OR status = 'in_progress'`).as('t')
    ).catch(() => [{ count: 0 }]);

    return res.json({
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      database: dbStatus,
      version: '4.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'development',
      activeVendors: vendorCount.count,
      totalUsers: userCount.count,
      todayBookings: todayBookings.count,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ status: 'error', error: 'فشل فحص النظام' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS — Send notification to all vendors
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/super-admin/announce — Send announcement to all active vendors
router.post('/announce', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const { title, body, type } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'العنوان والمحتوى مطلوبة' });

    // Get all vendor admin users
    const vendorAdmins = await db.select({ id: users.id, vendorId: users.vendorId })
      .from(users)
      .where(eq(users.role, 'vendor_admin'));

    let sent = 0;
    for (const admin of vendorAdmins) {
      await db.insert(inAppNotifications).values({
        userId: admin.id,
        vendorId: admin.vendorId,
        title,
        body,
        type: type ?? 'system',
        link: null,
      });
      sent++;
    }

    return res.json({ success: true, sent });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الإرسال' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROWTH FUNNEL & COHORTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/funnel — signup → activation → paid conversion snapshot
router.get('/funnel', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const [signed] = await db.select({ count: count() }).from(vendors);
    const [trialing] = await db.select({ count: count() }).from(vendors)
      .where(eq(vendors.subscriptionStatus, 'trial'));
    // "activated" = has at least 1 booking OR at least 1 service
    const activated = await db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT v.id)::int AS count
      FROM vendors v
      WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.vendor_id = v.id)
    `);
    const paid = await db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT v.id)::int AS count
      FROM vendors v
      WHERE v.subscription_status = 'active'
        AND v.subscription_plan IN ('pro', 'enterprise', 'basic')
    `);
    const churned = await db.execute<{ count: number }>(sql`
      SELECT COUNT(DISTINCT v.id)::int AS count
      FROM vendors v
      WHERE v.subscription_plan = 'free'
        AND v.subscription_end_date IS NOT NULL
        AND v.subscription_end_date < NOW()
    `);

    const row = (x: any) => Number((x as any).rows?.[0]?.count ?? (Array.isArray(x) ? x[0]?.count : 0)) || 0;
    return res.json({
      signups: signed.count,
      trialing: trialing.count,
      activated: row(activated),
      paid: row(paid),
      churned: row(churned),
    });
  } catch (e) {
    console.error('[super-admin/funnel]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/super-admin/cohorts — monthly signup cohorts with retention
router.get('/cohorts', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const result = await db.execute<{
      cohort: string; signups: number; still_active: number; upgraded_to_pro: number;
    }>(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS cohort,
        COUNT(*)::int AS signups,
        SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS still_active,
        SUM(CASE WHEN subscription_plan IN ('pro','enterprise','basic') THEN 1 ELSE 0 END)::int AS upgraded_to_pro
      FROM vendors
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1 DESC
    `);
    return res.json((result as any).rows ?? result ?? []);
  } catch (e) {
    console.error('[super-admin/cohorts]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG VIEWER
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/audit-logs — View audit logs
router.get('/audit-logs', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = 50;

    const logs = await db.select({
      id: auditLogs.id,
      vendorId: auditLogs.vendorId,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resource: auditLogs.resource,
      method: auditLogs.method,
      ip: auditLogs.ip,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      vendorName: vendors.nameAr,
    })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .leftJoin(vendors, eq(auditLogs.vendorId, vendors.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [total] = await db.select({ count: count() }).from(auditLogs);

    return res.json({ logs, total: total.count, page, limit });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC PLANS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/plans — List all plans
router.get('/plans', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const plans = await db.select().from(platformPlans).orderBy(asc(platformPlans.sortOrder));
    return res.json(plans);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/super-admin/plans — Create a plan
router.post('/plans', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const { slug, nameAr, nameEn, description, price, maxEmployees, maxBranches, features, featureGates, isPopular, sortOrder, trialDays } = req.body;
    if (!slug || !nameAr || !price) return res.status(400).json({ error: 'البيانات ناقصة' });

    const [plan] = await db.insert(platformPlans).values({
      slug, nameAr, nameEn, description,
      price: String(price),
      maxEmployees: maxEmployees ?? -1,
      maxBranches: maxBranches ?? 1,
      features: features ?? [],
      featureGates: featureGates ?? {},
      isPopular: isPopular ?? false,
      sortOrder: sortOrder ?? 0,
      trialDays: trialDays ?? 14,
    }).returning();

    return res.json(plan);
  } catch (e: any) {
    if (e?.code === '23505') return res.status(409).json({ error: 'هذا الـ slug مستخدم مسبقاً' });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/super-admin/plans/:id — Update a plan
router.put('/plans/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nameAr, nameEn, description, price, maxEmployees, maxBranches, features, featureGates, isPopular, isActive, sortOrder, trialDays } = req.body;

    const [updated] = await db.update(platformPlans).set({
      ...(nameAr !== undefined && { nameAr }),
      ...(nameEn !== undefined && { nameEn }),
      ...(description !== undefined && { description }),
      ...(featureGates !== undefined && { featureGates }),
      ...(price !== undefined && { price: String(price) }),
      ...(maxEmployees !== undefined && { maxEmployees }),
      ...(maxBranches !== undefined && { maxBranches }),
      ...(features !== undefined && { features }),
      ...(isPopular !== undefined && { isPopular }),
      ...(isActive !== undefined && { isActive }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(trialDays !== undefined && { trialDays }),
      updatedAt: new Date(),
    }).where(eq(platformPlans.id, id)).returning();

    if (!updated) return res.status(404).json({ error: 'الباقة غير موجودة' });
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/super-admin/plans/:id — Delete a plan
router.delete('/plans/:id', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    await db.delete(platformPlans).where(eq(platformPlans.id, Number(req.params.id)));
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/super-admin/export/vendors — Export vendors as JSON (for Excel conversion on frontend)
router.get('/export/vendors', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const list = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      phone: vendors.phone,
      email: vendors.email,
      city: vendors.city,
      industry: vendors.industry,
      subscriptionStatus: vendors.subscriptionStatus,
      subscriptionPlan: vendors.subscriptionPlan,
      subscriptionEndDate: vendors.subscriptionEndDate,
      isActive: vendors.isActive,
      createdAt: vendors.createdAt,
    }).from(vendors).orderBy(desc(vendors.createdAt));

    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في التصدير' });
  }
});

// GET /api/super-admin/export/users — Export all users
router.get('/export/users', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const list = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      vendorName: vendors.nameAr,
      createdAt: users.createdAt,
    })
      .from(users)
      .leftJoin(vendors, eq(users.vendorId, vendors.id))
      .orderBy(desc(users.createdAt));

    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في التصدير' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// IMPERSONATION — super admin steps into a vendor_admin's shoes for support
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/super-admin/impersonate/:vendorId
// Returns a short-lived JWT that authenticates as the given vendor's
// vendor_admin. The token carries impersonatedBy + impersonation=true so
// every downstream request is auditable back to the real super admin.
router.post('/impersonate/:vendorId', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = Number(req.params.vendorId);
    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return res.status(400).json({ error: 'معرّف المتجر غير صحيح' });
    }
    const adminId = req.user!.id;

    const [vendor] = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      slug: vendors.slug,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    const [admin] = await db.select({
      id: users.id, name: users.name, phone: users.phone, role: users.role,
    }).from(users)
      .where(and(eq(users.vendorId, vendorId), eq(users.role, 'vendor_admin')))
      .limit(1);
    if (!admin) return res.status(404).json({ error: 'لا يوجد مالك لهذا المتجر' });

    // Short-lived (30 min) token with impersonation flag. The server
    // uses this flag (see middleware/auth.ts) to tag audit entries.
    const token = jwt.sign(
      {
        id: admin.id,
        role: admin.role,
        phone: admin.phone,
        vendorId,
        impersonation: true,
        impersonatedBy: adminId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '30m', algorithm: 'HS256' },
    );

    // Unconditionally log the action — even if something fails afterwards.
    try {
      await db.insert(auditLogs).values({
        vendorId,
        userId: adminId,
        action: 'super_admin.impersonate',
        resource: `/super-admin/impersonate/${vendorId}`,
        resourceId: vendorId,
        method: 'POST',
        metadata: { targetUser: admin.id, vendorName: vendor.nameAr },
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      });
    } catch (e) { console.error('[impersonate audit]', e); }

    return res.json({
      token,
      expiresInSeconds: 30 * 60,
      user: { id: admin.id, name: admin.name, phone: admin.phone, role: admin.role, vendorId },
      vendor,
    });
  } catch (e) {
    console.error('[impersonate]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
