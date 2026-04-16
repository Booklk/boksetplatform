import 'dotenv/config';
import { validateEnv } from './lib/validate-env.js';
validateEnv();
const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cron from 'node-cron';
import { db, closeDatabase } from './db/index.js';
import { bookings, users, notifications, maintenanceSettings, fleetVehicles, vendors, bonusRules, inventory, suppliers, supplierOrders, automationWorkflows, automationSteps, automationExecutions, automationStepLogs, abandonedBookings, customerScores, customerSegments, customerSegmentMembers, customers } from './db/schema.js';
import { eq, and, gte, lte, sql, count, or } from 'drizzle-orm';
import { notifyAppointmentReminder, notifyRatingRequest, sendRawWhatsAppMessage } from './services/whatsapp.js';
import { detectVendorDomain } from './middleware/domain.js';
import { requireAuth } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.js';
import servicesRoutes from './routes/services.js';
import bookingsRoutes from './routes/bookings.js';
import customersRoutes from './routes/customers.js';
import employeesRoutes from './routes/employees.js';
import inventoryRoutes from './routes/inventory.js';
import financialsRoutes from './routes/financials.js';
import uploadsRoutes from './routes/uploads.js';
import reportsRoutes from './routes/reports.js';
// New SaaS routes
import vendorsRoutes from './routes/vendors.js';
import vehiclesRoutes from './routes/vehicles.js';
import loyaltyRoutes from './routes/loyalty.js';
import trackingRoutes from './routes/tracking.js';
import photosRoutes from './routes/photos.js';
import promosRoutes from './routes/promos.js';
import exportsRoutes from './routes/exports.js';
import pushRoutes from './routes/push.js';
import superAdminRoutes from './routes/super-admin.js';
import paymentsRoutes from './routes/payments.js';
import invoicesRoutes from './routes/invoices.js';
import corporateRoutes from './routes/corporate.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import achievementsRoutes from './routes/achievements.js';
import manifestRoutes from './routes/manifest.js';
import weatherRoutes from './routes/weather.js';
import fleetRoutes from './routes/fleet.js';
import queueRoutes from './routes/queue.js';
import posRoutes from './routes/pos.js';
import appointmentsRoutes from './routes/appointments.js';
import payrollRoutes from './routes/payroll.js';
import vatReportRoutes from './routes/vatReport.js';
import shiftsRoutes from './routes/shifts.js';
import supportRoutes from './routes/support.js';
import dispatchRoutes from './routes/dispatch.js';
import operationsRoutes from './routes/operations.js';
import summaryRoutes from './routes/summary.js';
import suppliersRoutes from './routes/suppliers.js';
import costFactorsRoutes from './routes/costFactors.js';
import referralsRoutes from './routes/referrals.js';
import brandKitRoutes from './routes/brand-kit.js';
import campaignsRoutes from './routes/campaigns.js';
import timeBlocksRoutes from './routes/time-blocks.js';
import giftCardsRoutes from './routes/gift-cards.js';
import shopRoutes from './routes/shop.js';
// Phase 1: Customer Acquisition + Security
import automationsRoutes from './routes/automations.js';
import segmentsRoutes from './routes/segments.js';
import financialStatementsRoutes from './routes/financial-statements.js';
import crmRoutes from './routes/crm.js';
import recurringBookingsRoutes from './routes/recurring-bookings.js';
import notificationCenterRoutes from './routes/notification-center.js';
import aiAdvisorRoutes from './routes/ai-advisor.js';
import gamificationRoutes from './routes/gamification.js';
import vendorReferralRoutes from './routes/vendor-referral.js';
import onboardingTemplatesRoutes from './routes/onboarding-templates.js';
import webhooksRoutes from './routes/webhooks.js';
import customerImportRoutes from './routes/customer-import.js';
import vendorDataExportRoutes from './routes/vendor-data-export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ?? 3001;

// ─── WEBSOCKET SERVER (GPS Real-Time Tracking) ────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

// rooms: Map<roomId, Set<WebSocket>>
const rooms = new Map<string, Set<WebSocket>>();

function joinRoom(roomId: string, ws: WebSocket) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(ws);
}

function leaveAllRooms(ws: WebSocket) {
  for (const [roomId, clients] of rooms) {
    clients.delete(ws);
    if (clients.size === 0) rooms.delete(roomId);
  }
}

function broadcastToRoom(roomId: string, data: unknown, sender?: WebSocket) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'join':
          // { type: 'join', room: 'booking:123' | 'vendor:456' }
          joinRoom(msg.room, ws);
          break;

        case 'location':
          // { type: 'location', room: 'booking:123', lat, lng, heading, speed }
          broadcastToRoom(msg.room, msg, ws);
          break;

        case 'ping':
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => leaveAllRooms(ws));
  ws.on('error', () => leaveAllRooms(ws));
});

// ─── REQUEST ID MIDDLEWARE (tracing) ─────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
});

// ─── EXPRESS MIDDLEWARE ───────────────────────────────────────────────────────
app.use(detectVendorDomain);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Dynamic CORS: support platform domains + vendor custom domains
const platformDomains = (process.env.PLATFORM_DOMAINS ?? 'jdawil.sa,localhost,127.0.0.1')
  .split(',').map(d => d.trim());
const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      // Allow known platform domains
      if (platformDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
        return callback(null, true);
      }
      // Allow exact client URL
      if (origin === clientUrl) return callback(null, true);
      // Allow localhost for development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return callback(null, true);
      }
      // Reject unknown origins in production
      return callback(null, false);
    } catch {
      return callback(null, false);
    }
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── RATE LIMITING ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  message: { error: 'محاولات كثيرة. حاول مرة ثانية بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { error: 'طلبات كثيرة. حاول بعد شوي' },
  standardHeaders: true,
  legacyHeaders: false,
});

const campaignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 campaigns per hour
  message: { error: 'وصلت للحد الأقصى من الحملات. حاول بعد ساعة' },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'محاولات كثيرة لدخول لوحة الإدارة. حاول بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/admin-login', adminLoginLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/campaigns', campaignLimiter);

const onboardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registrations per hour per IP
  message: { error: 'محاولات تسجيل كثيرة. حاول بعد ساعة' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/vendors/onboard', onboardLimiter);

app.use('/api/', apiLimiter);

// Serve uploaded files with caching
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
}));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/reports', reportsRoutes);
// New
app.use('/api/vendors', vendorsRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/photos', photosRoutes);
app.use('/api/promos', promosRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/manifest', manifestRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/fleet', requireAuth, fleetRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/pos', posRoutes);
// Appointments: /config GET + /available GET are public; rest require auth via router-level guards
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/vat-report', vatReportRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/dispatch', requireAuth, dispatchRoutes);
app.use('/api/operations', requireAuth, operationsRoutes);
app.use('/api/summary', requireAuth, summaryRoutes);
app.use('/api/suppliers', requireAuth, suppliersRoutes);
app.use('/api/cost-factors', requireAuth, costFactorsRoutes);
app.use('/api/referrals', requireAuth, referralsRoutes);
app.use('/api/brand-kit', requireAuth, brandKitRoutes);
app.use('/api/campaigns', requireAuth, campaignsRoutes);
app.use('/api/time-blocks', requireAuth, timeBlocksRoutes);
app.use('/api/gift-cards', requireAuth, giftCardsRoutes);
app.use('/api/shop', shopRoutes);
// Phase 1: Customer Acquisition + Security
app.use('/api/automations', requireAuth, automationsRoutes);
app.use('/api/segments', requireAuth, segmentsRoutes);
app.use('/api/financial-statements', requireAuth, financialStatementsRoutes);
app.use('/api/crm', requireAuth, crmRoutes);
app.use('/api/recurring-bookings', requireAuth, recurringBookingsRoutes);
app.use('/api/notification-center', requireAuth, notificationCenterRoutes);
app.use('/api/ai-advisor', requireAuth, aiAdvisorRoutes);
app.use('/api/gamification', requireAuth, gamificationRoutes);
app.use('/api/vendor-referral', vendorReferralRoutes);
app.use('/api/onboarding-templates', onboardingTemplatesRoutes);
app.use('/api/webhooks', requireAuth, webhooksRoutes);
app.use('/api/customer-import', requireAuth, customerImportRoutes);
app.use('/api/vendor-data', requireAuth, vendorDataExportRoutes);

// Public: Get active platform plans (for pricing page + onboarding)
app.get('/api/plans', async (_req, res) => {
  try {
    const { platformPlans } = await import('./db/schema.js');
    const { asc } = await import('drizzle-orm');
    const plans = await db.select().from(platformPlans)
      .where(eq(platformPlans.isActive, true))
      .orderBy(asc(platformPlans.sortOrder));
    return res.json(plans);
  } catch {
    // Fallback if table doesn't exist yet
    return res.json([
      { id: 1, slug: 'free', nameAr: 'مجاني', price: '0', features: ['موقع حجز خاص', 'حتى 30 حجز/شهر', 'إشعارات واتساب', '3 ثيمات'], isPopular: false, maxEmployees: 1, trialDays: 0, featureGates: {} },
      { id: 2, slug: 'pro', nameAr: 'Pro', price: '99', features: ['حجوزات غير محدودة', 'موظفون غير محدودون', 'GPS + كاشير + مدفوعات', 'CRM + ولاء + AI', 'كل الثيمات', 'تقارير VAT + رواتب'], isPopular: true, maxEmployees: -1, trialDays: 14, featureGates: {} },
    ]);
  }
});

// Health check
app.get('/api/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    time: new Date(),
    uptime: process.uptime(),
    version: '4.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  };

  // Check DB connectivity
  try {
    await db.execute(sql`SELECT 1`);
    health.database = 'connected';
  } catch {
    health.database = 'disconnected';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  return res.status(statusCode).json(health);
});

// ─── SITEMAP.XML (dynamic — includes all active vendor stores) ────────────────
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const activeVendors = await db.select({
      slug: vendors.slug,
      updatedAt: vendors.updatedAt,
    }).from(vendors).where(eq(vendors.isActive, true)).limit(500);

    const now = new Date().toISOString().split('T')[0];
    const blogSlugs = [
      'mobile-car-wash-startup-cost',
      'how-to-manage-mobile-car-wash-employees',
      'car-wash-booking-system-benefits',
      'car-wash-quality-standards',
      'fixed-vs-mobile-car-wash',
      'car-wash-inventory-management',
    ];
    const citySlugs = [
      'الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'الخبر', 'الطائف', 'تبوك',
    ];
    const staticUrls = [
      { loc: `https://${DOMAIN}/`, priority: '1.0', changefreq: 'weekly' },
      { loc: `https://${DOMAIN}/marketplace`, priority: '0.9', changefreq: 'daily' },
      { loc: `https://${DOMAIN}/blog`, priority: '0.9', changefreq: 'weekly' },
      { loc: `https://${DOMAIN}/onboard`, priority: '0.8', changefreq: 'monthly' },
      { loc: `https://${DOMAIN}/demo`, priority: '0.7', changefreq: 'monthly' },
      { loc: `https://${DOMAIN}/privacy`, priority: '0.3', changefreq: 'yearly' },
      { loc: `https://${DOMAIN}/terms`, priority: '0.3', changefreq: 'yearly' },
      ...blogSlugs.map(s => ({ loc: `https://${DOMAIN}/blog/${s}`, priority: '0.8', changefreq: 'monthly' })),
      ...citySlugs.map(c => ({ loc: `https://${DOMAIN}/city/${encodeURIComponent(c)}`, priority: '0.9', changefreq: 'monthly' })),
    ];

    const vendorUrls = activeVendors
      .filter(v => v.slug)
      .map(v => ({
        loc: `https://${DOMAIN}/store/${v.slug}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: v.updatedAt ? new Date(v.updatedAt).toISOString().split('T')[0] : now,
      }));

    const allUrls = [...staticUrls, ...vendorUrls];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${(u as any).lastmod ?? now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${u.loc}"/>
  </url>`).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600'); // cache 1 hour
    return res.send(xml);
  } catch (e) {
    console.error('[sitemap]', e);
    return res.status(500).send('');
  }
});

// Custom domain detection endpoint — frontend calls this on load
// When on a custom domain, all routes serve the SPA
// The frontend reads ?vendor= or uses Host header via /api/domain/detect
app.get('/api/domain/detect', (req: any, res) => {
  res.json({ vendorSlug: req.detectedVendorSlug ?? null });
});

// Serve client build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  // Hashed assets get long-term cache; HTML is never cached
  app.use('/assets', express.static(path.join(clientDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));
  app.use(express.static(clientDist, {
    maxAge: '1h',
    etag: true,
  }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ─── CRON JOBS ────────────────────────────────────────────────────────────────

// Every hour: send reminder for bookings 24h away
cron.schedule('0 * * * *', async () => {
  try {
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const in25h = new Date(Date.now() + 25 * 60 * 60 * 1000);

    const upcoming = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      scheduledAt: bookings.scheduledAt,
      customerId: bookings.customerId,
      phone: users.phone,
    })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(and(gte(bookings.scheduledAt, in24h), lte(bookings.scheduledAt, in25h), eq(bookings.status, 'confirmed')));

    for (const b of upcoming) {
      if (!b.phone) continue;
      await notifyAppointmentReminder(b.phone, b.bookingNumber, b.scheduledAt);
      await db.insert(notifications).values({
        bookingId: b.id,
        userId: b.customerId,
        type: 'reminder',
        phone: b.phone,
        message: `تذكير موعد #${b.bookingNumber}`,
        status: 'sent',
        sentAt: new Date(),
      });
    }
  } catch (e) {
    console.error('[Cron reminder]', e);
  }
});

// Every hour at :30 — rating requests for completed bookings
cron.schedule('30 * * * *', async () => {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const needsRating = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      phone: users.phone,
    })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(and(
        eq(bookings.status, 'completed'),
        sql`${bookings.rating} IS NULL`,
        gte(bookings.updatedAt, threeHoursAgo),
        lte(bookings.updatedAt, twoHoursAgo),
      ));

    for (const b of needsRating) {
      if (!b.phone) continue;
      await notifyRatingRequest(b.phone, b.bookingNumber);
    }
  } catch (e) {
    console.error('[Cron rating]', e);
  }
});

// Every day at midnight: expire trial vendors
cron.schedule('0 0 * * *', async () => {
  try {
    await db.execute(sql`
      UPDATE vendors
      SET subscription_status = 'expired', is_active = false
      WHERE subscription_status = 'trial'
        AND trial_ends_at < NOW()
    `);
  } catch (e) {
    console.error('[Cron trial expiry]', e);
  }
});

// Daily at 8:00 AM: check vehicles due for maintenance
cron.schedule('0 8 * * *', async () => {
  try {
    const settings = await db
      .select({
        setting: maintenanceSettings,
        vehicle: fleetVehicles,
        vendorPhone: vendors.phone,
        vendorName: vendors.nameAr,
        vendorId: vendors.id,
      })
      .from(maintenanceSettings)
      .innerJoin(fleetVehicles, eq(maintenanceSettings.vehicleId, fleetVehicles.id))
      .innerJoin(vendors, eq(fleetVehicles.vendorId, vendors.id))
      .where(and(
        eq(maintenanceSettings.isActive, true),
        eq(fleetVehicles.isActive, true),
      ));

    for (const { setting, vehicle, vendorPhone, vendorName, vendorId } of settings) {
      let shouldAlert = false;
      let alertMsg = '';

      // Mileage check
      if (setting.nextServiceMileage && vehicle.currentMileage != null) {
        const kmRemaining = setting.nextServiceMileage - vehicle.currentMileage;
        if (kmRemaining <= (setting.alertAtKmBefore ?? 500)) {
          shouldAlert = true;
          alertMsg = kmRemaining <= 0
            ? `⚠️ ${vehicle.nameAr} — تجاوزت موعد الصيانة! (${Math.abs(kmRemaining)} كم مضى)`
            : `🔧 ${vehicle.nameAr} — الصيانة بعد ${kmRemaining} كم فقط`;
        }
      }

      // Time check
      if (setting.nextServiceDate) {
        const daysLeft = Math.ceil((new Date(setting.nextServiceDate).getTime() - Date.now()) / 86400000);
        if (daysLeft <= 7) {
          shouldAlert = true;
          alertMsg = daysLeft <= 0
            ? `⚠️ ${vehicle.nameAr} — موعد الصيانة تجاوز ${Math.abs(daysLeft)} يوم`
            : `🔧 ${vehicle.nameAr} — موعد الصيانة بعد ${daysLeft} يوم`;
        }
      }

      if (shouldAlert && vendorPhone) {
        // Don't send same alert twice in 24h
        const lastSent = setting.lastAlertSentAt;
        if (lastSent && Date.now() - new Date(lastSent).getTime() < 23 * 60 * 60 * 1000) continue;

        if (setting.notifyViaWhatsapp) {
          await notifyAppointmentReminder(vendorPhone, alertMsg, new Date());
        }

        // Insert notification
        await db.insert(notifications).values({
          userId: null,
          vendorId,
          type: 'maintenance_alert',
          message: alertMsg,
          phone: vendorPhone,
          status: 'sent',
          sentAt: new Date(),
        });

        // Update lastAlertSentAt
        await db.update(maintenanceSettings)
          .set({ lastAlertSentAt: new Date() })
          .where(eq(maintenanceSettings.vehicleId, vehicle.id));
      }
    }
    console.log('[Cron maintenance] Check complete');
  } catch (e) {
    console.error('[Cron maintenance]', e);
  }
});

// Every day at 7 AM: check low stock and auto-notify suppliers
cron.schedule('0 7 * * *', async () => {
  try {
    // Only process vendors with autoReorderEnabled = true
    const vendorsWithAutoReorder = await db.select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.isActive, true), eq(vendors.autoReorderEnabled, true)));

    const vendorIds = vendorsWithAutoReorder.map(v => v.id);
    if (vendorIds.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lowStockItems = await (db as any)
      .select({
        item: inventory,
        supplier: suppliers,
        vendorName: vendors.nameAr,
      })
      .from(inventory)
      .innerJoin(suppliers, eq(inventory.supplierId, suppliers.id))
      .innerJoin(vendors, eq(inventory.vendorId, vendors.id))
      .where(
        and(
          eq(inventory.isActive, true),
          eq(inventory.autoReorderEnabled, true),
          eq(suppliers.isActive, true),
          sql`CAST(${inventory.quantity} AS DECIMAL) <= CAST(${inventory.minQuantity} AS DECIMAL)`,
          sql`${inventory.vendorId} IN (${sql.join(vendorIds.map(id => sql`${id}`), sql`, `)})`,
        )
      );

    for (const { item, supplier, vendorName } of lowStockItems) {
      // Check for existing pending order (avoid duplicate)
      const [existing] = await db.select({ id: supplierOrders.id })
        .from(supplierOrders)
        .where(
          and(
            eq(supplierOrders.inventoryItemId, item.id),
            or(
              eq(supplierOrders.status, 'sent'),
              eq(supplierOrders.status, 'confirmed'),
            )
          )
        );

      if (existing) continue;

      const qty = item.reorderQuantity ?? '10';
      const msg = `\u0645\u0631\u062d\u0628\u0627\u064b ${supplier.contactPerson ?? supplier.nameAr}\u060c\n\n\u0637\u0644\u0628 \u062a\u0648\u0631\u064a\u062f \u0639\u0627\u062c\u0644 \u0645\u0646 *${vendorName}*:\n\n\ud83d\udce6 *${item.name}*\n\u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: ${qty} ${item.unit}\n\n\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0623\u0642\u0631\u0628 \u0648\u0642\u062a \u0645\u0645\u0643\u0646.\n\u0634\u0643\u0631\u0627\u064b \ud83d\ude4f`;

      await notifyAppointmentReminder(supplier.phone, msg, new Date());

      await db.insert(supplierOrders).values({
        vendorId: item.vendorId,
        supplierId: supplier.id,
        inventoryItemId: item.id,
        itemName: item.name,
        quantityRequested: qty,
        unit: item.unit,
        status: 'sent',
        whatsappSent: true,
      });

      console.log(`[Cron reorder] Sent order to ${supplier.nameAr} for ${item.name}`);
    }
  } catch (e) {
    console.error('[Cron reorder]', e);
  }
});

// Daily 9 PM Saudi (UTC+3) = 18:00 UTC — send end-of-day summary to all active vendors
cron.schedule('0 18 * * *', async () => {
  try {
    const activeVendors = await db.select({
      id: vendors.id,
      phone: vendors.phone,
      nameAr: vendors.nameAr,
    })
      .from(vendors)
      .where(eq(vendors.isActive, true));

    for (const vendor of activeVendors) {
      if (!vendor.phone) continue;

      const today = new Date();
      const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

      const [completedToday] = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(
          eq(bookings.vendorId, vendor.id),
          eq(bookings.status, 'completed'),
          gte(bookings.updatedAt, startOfDay),
          lte(bookings.updatedAt, endOfDay),
        ));

      const [revenueToday] = await db.select({ total: sql<number>`coalesce(sum(${bookings.totalPrice}), 0)` })
        .from(bookings)
        .where(and(
          eq(bookings.vendorId, vendor.id),
          eq(bookings.status, 'completed'),
          gte(bookings.updatedAt, startOfDay),
          lte(bookings.updatedAt, endOfDay),
        ));

      const completedCount = Number(completedToday?.count ?? 0);
      const revenue = Number(revenueToday?.total ?? 0);

      if (completedCount === 0) continue; // Skip vendors with no activity today

      const msg = `📊 *ملخص يومك — ${vendor.nameAr}*\n\n✅ ${completedCount} غسلة مكتملة\n💰 ${revenue.toFixed(0)} ر.س دخل اليوم\n\n_${vendor.nameAr} — تقرير يومي_`;

      await sendRawWhatsAppMessage(vendor.phone, msg);
    }
    console.log('[Cron daily-summary] Sent to active vendors');
  } catch (e) {
    console.error('[Cron daily-summary]', e);
  }
});

// Every day 10 AM Saudi (07:00 UTC) — proactive wash reminders
cron.schedule('0 7 * * *', async () => {
  try {
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find customers whose last completed booking was 21+ days ago
    // and haven't been reminded in the last 7 days
    const customersToRemind = await db
      .select({
        customerId: bookings.customerId,
        lastWash: sql<Date>`MAX(${bookings.updatedAt})`,
        vendorId: bookings.vendorId,
        customerName: users.name,
        customerPhone: users.phone,
        lastReminderSentAt: users.lastReminderSentAt,
        vendorName: vendors.nameAr,
        vendorSlug: vendors.slug,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(vendors, eq(bookings.vendorId, vendors.id))
      .where(and(
        eq(bookings.status, 'completed'),
        eq(vendors.isActive, true),
      ))
      .groupBy(
        bookings.customerId,
        bookings.vendorId,
        users.name,
        users.phone,
        users.lastReminderSentAt,
        vendors.nameAr,
        vendors.slug,
      )
      .having(sql`MAX(${bookings.updatedAt}) < ${twentyOneDaysAgo}`);

    let sent = 0;
    for (const c of customersToRemind) {
      if (!c.customerPhone) continue;
      // Throttle: skip if reminded within last 7 days
      if (c.lastReminderSentAt && new Date(c.lastReminderSentAt) > sevenDaysAgo) continue;

      const bookingLink = c.vendorSlug
        ? `https://${DOMAIN}/store/${c.vendorSlug}/book`
        : `https://${DOMAIN}`;

      const msg = `🚗 *${c.vendorName}*\n\nمرحباً ${c.customerName}،\n\nمرّت 3 أسابيع على آخر غسلة لسيارتك! 🤔\n\nهل تريد حجز موعد الآن؟ نحن جاهزون لخدمتك 💧\n\n👇 احجز الآن:\n${bookingLink}`;

      await sendRawWhatsAppMessage(c.customerPhone, msg);

      // Update lastReminderSentAt
      await db.update(users)
        .set({ lastReminderSentAt: new Date() })
        .where(eq(users.id, c.customerId));

      sent++;
    }
    console.log(`[Cron wash-reminder] Sent ${sent} proactive reminders`);
  } catch (e) {
    console.error('[Cron wash-reminder]', e);
  }
});

// ─── PHASE 1: AUTOMATION CRON JOBS ──────────────────────────────────────────

// Process automation queue every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const { processAutomationQueue } = await import('./services/automationEngine.js');
    await processAutomationQueue();
  } catch (e) {
    console.error('[Cron automation-queue]', e);
  }
});

// Check for abandoned bookings every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  try {
    const { recoverAbandonedBookings } = await import('./services/automationEngine.js');
    await recoverAbandonedBookings();
  } catch (e) {
    console.error('[Cron abandoned-bookings]', e);
  }
});

// Every 6 hours: check if referred vendors have paid → grant rewards
cron.schedule('0 */6 * * *', async () => {
  try {
    const { processReferralConversions } = await import('./routes/vendor-referral.js');
    await processReferralConversions();
  } catch (e) {
    console.error('[Cron referral-conversions]', e);
  }
});

// Auto-generate recurring bookings daily at 6 AM
cron.schedule('0 6 * * *', async () => {
  try {
    const { recurringBookings: rb, bookings: bk, packages: pk } = await import('./db/schema.js');
    const now = new Date();
    const activeRecurring = await db.select().from(rb)
      .where(and(eq(rb.isActive, true), lte(rb.nextScheduledAt, now)));

    let created = 0;
    for (const rec of activeRecurring) {
      try {
        // Create booking from recurring template
        const bookingNumber = `BK${Date.now().toString(36).toUpperCase()}`;
        const [newBooking] = await db.insert(bk).values({
          vendorId: rec.vendorId,
          customerId: rec.customerId,
          packageId: rec.packageId,
          bookingNumber,
          status: 'pending',
          address: rec.address ?? '',
          lat: rec.lat,
          lng: rec.lng,
          vehicleType: rec.vehicleType,
          vehiclePlate: rec.vehiclePlate,
          notes: rec.notes ? `${rec.notes} (حجز متكرر)` : 'حجز متكرر تلقائي',
          scheduledAt: rec.nextScheduledAt,
        } as any).returning();

        // Calculate next scheduled date
        const next = new Date(rec.nextScheduledAt!);
        if (rec.frequency === 'weekly') next.setDate(next.getDate() + 7);
        else if (rec.frequency === 'biweekly') next.setDate(next.getDate() + 14);
        else next.setMonth(next.getMonth() + 1);

        await db.update(rb).set({
          nextScheduledAt: next,
          lastBookingId: newBooking.id,
          totalBookingsCreated: sql`${rb.totalBookingsCreated} + 1`,
          updatedAt: new Date(),
        }).where(eq(rb.id, rec.id));

        created++;
      } catch (e) { console.error(`[Cron recurring] Error for ID ${rec.id}:`, e); }
    }
    if (created > 0) console.log(`[Cron recurring] Created ${created} bookings from recurring templates`);
  } catch (e) { console.error('[Cron recurring]', e); }
});

// Recalculate customer scores nightly at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const allVendors = await db.select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.isActive, true));

    for (const v of allVendors) {
      try {
        // Get all customers for this vendor
        const vendorCustomers = await db.select({ id: customers.id })
          .from(customers)
          .where(eq(customers.vendorId, v.id));

        for (const c of vendorCustomers) {
          // Aggregate booking data
          const [stats] = await db.select({
            totalSpend: sql<string>`COALESCE(SUM(CAST(${bookings.totalPrice} AS numeric)), 0)`,
            bookingCount: count(bookings.id),
            avgRating: sql<string>`COALESCE(AVG(${bookings.rating}), 0)`,
            lastBookingAt: sql<Date>`MAX(${bookings.createdAt})`,
          }).from(bookings).where(and(
            eq(bookings.customerId, c.id),
            eq(bookings.vendorId, v.id),
            eq(bookings.status, 'completed'),
          ));

          const daysSinceLast = stats?.lastBookingAt
            ? Math.floor((Date.now() - new Date(stats.lastBookingAt).getTime()) / (1000 * 60 * 60 * 24))
            : 365;

          const bCount = Number(stats?.bookingCount ?? 0);
          const tSpend = parseFloat(stats?.totalSpend ?? '0');
          const aRating = parseFloat(stats?.avgRating ?? '0');

          // Calculate churn risk (0-1): higher days since last = higher risk
          const churnRisk = Math.min(1, daysSinceLast / 90);

          // LTV estimate: avg monthly spend × 12
          const monthlySpend = bCount > 0 ? tSpend / Math.max(1, bCount) : 0;
          const ltvEstimate = monthlySpend * 12;

          // Composite score (0-100)
          const spendScore = Math.min(30, (tSpend / 1000) * 30);
          const freqScore = Math.min(25, (bCount / 12) * 25);
          const recencyScore = Math.max(0, 25 - (daysSinceLast / 90) * 25);
          const ratingScore = (aRating / 5) * 20;
          const score = Math.round(spendScore + freqScore + recencyScore + ratingScore);

          const tier = score >= 90 ? 'platinum' : score >= 70 ? 'gold' : score >= 40 ? 'silver' : 'bronze';

          // Upsert score
          const existing = await db.select({ id: customerScores.id })
            .from(customerScores)
            .where(and(eq(customerScores.vendorId, v.id), eq(customerScores.customerId, c.id)))
            .limit(1);

          if (existing.length > 0) {
            await db.update(customerScores).set({
              totalSpend: tSpend.toFixed(2),
              bookingCount: bCount,
              avgRating: aRating.toFixed(2),
              lastBookingAt: stats?.lastBookingAt ?? null,
              daysSinceLastBooking: daysSinceLast,
              churnRisk: churnRisk.toFixed(4),
              ltvEstimate: ltvEstimate.toFixed(2),
              score,
              tier,
              updatedAt: new Date(),
            }).where(eq(customerScores.id, existing[0].id));
          } else {
            await db.insert(customerScores).values({
              vendorId: v.id,
              customerId: c.id,
              totalSpend: tSpend.toFixed(2),
              bookingCount: bCount,
              avgRating: aRating.toFixed(2),
              lastBookingAt: stats?.lastBookingAt ?? null,
              daysSinceLastBooking: daysSinceLast,
              churnRisk: churnRisk.toFixed(4),
              ltvEstimate: ltvEstimate.toFixed(2),
              score,
              tier,
            });
          }
        }
        console.log(`[Cron scores] Recalculated scores for vendor ${v.id} (${vendorCustomers.length} customers)`);
      } catch (e) {
        console.error(`[Cron scores] Error for vendor ${v.id}:`, e);
      }
    }
  } catch (e) {
    console.error('[Cron scores]', e);
  }
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).requestId ?? 'unknown';
  console.error(`[ERROR] ${req.method} ${req.path} [${requestId}]`, err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);

  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً'
    : err.message;

  res.status(500).json({
    error: message,
    requestId,
  });
});

// ─── 404 HANDLER (API only) ─────────────────────────────────────────────────
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'المسار غير موجود',
    path: req.originalUrl,
  });
});

// ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    console.log('✅ HTTP server closed');

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server shutting down');
      }
    });
    console.log('✅ WebSocket connections closed');

    try {
      await closeDatabase();
      console.log('✅ Database connections drained');
    } catch (e) {
      console.error('⚠️ Error closing database:', e);
    }

    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT EXCEPTION]', error);
  gracefulShutdown('uncaughtException');
});

server.listen(PORT, () => {
  console.log(`🚗 Jdawil SaaS Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}/ws`);
  console.log(`📡 Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
