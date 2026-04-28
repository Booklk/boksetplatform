import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, users, bookings, financials, vendorSubscriptionPayments, auditLogs, inAppNotifications, platformPlans } from '../db/schema.js';
import { eq, sql, count, sum, desc, gte, like, or, asc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  getAllSettingsForUI,
  setSetting,
  PlatformSettingKey,
  SECRET_PLACEHOLDER,
} from '../services/platformSettings.js';

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

// ─── PLATFORM SETTINGS ──────────────────────────────────────────────────────
//
// GET  /api/super-admin/settings           — list all settings (encrypted
//                                             values shown as ••••••••)
// PUT  /api/super-admin/settings           — bulk update; entries equal to
//                                             ••••••••  are ignored (kept as-is)
// POST /api/super-admin/settings/test/:key — verify the saved credential
//                                             actually works (Moyasar/WhatsApp)

const ALLOWED_KEYS: PlatformSettingKey[] = [
  'platform.platformName',
  'platform.domain',
  'platform.trialDays',
  'platform.supportPhone',
  'platform.supportEmail',
  'moyasar.apiKey',
  'whatsapp.defaultToken',
  'whatsapp.defaultPhoneId',
  'vapid.publicKey',
  'vapid.privateKey',
  'vapid.email',
  'sentry.dsn',
  'firebase.config',
  'openai.apiKey',
  'openai.model',
];

router.get('/settings', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const settings = await getAllSettingsForUI();
    return res.json(settings);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.put('/settings', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const body = z.record(z.string(), z.union([z.string(), z.null()])).parse(req.body);
    const updatedBy = req.user!.id;
    const updates: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key as PlatformSettingKey)) continue;
      // Skip placeholder — means "keep existing encrypted value"
      if (value === SECRET_PLACEHOLDER) continue;
      await setSetting(key as PlatformSettingKey, value, updatedBy);
      updates.push(key);
    }

    return res.json({ ok: true, updated: updates });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Quick health-check for a saved credential (no plaintext exposure).
router.post('/settings/test/:key', requireAuth, requireRole('super_admin'), async (req, res) => {
  const { key } = req.params;
  try {
    const { getSetting } = await import('../services/platformSettings.js');

    if (key === 'moyasar.apiKey') {
      const apiKey = await getSetting('moyasar.apiKey');
      if (!apiKey) return res.status(400).json({ ok: false, error: 'لم يتم ضبط مفتاح Moyasar' });
      const r = await fetch('https://api.moyasar.com/v1/payments?per=1', {
        headers: { Authorization: 'Basic ' + Buffer.from(apiKey + ':').toString('base64') },
      });
      return res.json({ ok: r.ok, status: r.status });
    }

    if (key === 'whatsapp.defaultToken') {
      const token = await getSetting('whatsapp.defaultToken');
      const phoneId = await getSetting('whatsapp.defaultPhoneId');
      if (!token || !phoneId) return res.status(400).json({ ok: false, error: 'بيانات واتساب غير مكتملة' });
      const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json({ ok: r.ok, status: r.status });
    }

    if (key === 'vapid.publicKey') {
      const pub = await getSetting('vapid.publicKey');
      const priv = await getSetting('vapid.privateKey');
      return res.json({ ok: !!(pub && priv) });
    }

    return res.status(400).json({ ok: false, error: 'هذا الإعداد لا يدعم الفحص' });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message ?? 'فشل الفحص' });
  }
});

// GET /api/super-admin/profitability — per-vendor revenue/cost/margin
router.get('/profitability', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const { computeAllProfitability } = await import('../services/profitability.js');
    const result = await computeAllProfitability();
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
