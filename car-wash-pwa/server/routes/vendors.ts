import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { db } from '../db/index.js';
import { vendors, users, vendorSubscriptionPayments, services, packages, fleetVehicles, bookings, loyaltyPrograms, payrollRecords } from '../db/schema.js';
import { eq, desc, sql, and, isNotNull, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { encrypt, decrypt } from '../lib/crypto.js';

function signToken(user: { id: number; role: string; phone: string; vendorId?: number | null }) {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone, vendorId: user.vendorId ?? undefined },
    process.env.JWT_SECRET!,
    { expiresIn: '30d' }
  );
}

function autoSlug(nameAr: string, phone: string) {
  // Build a unique slug: transliterated prefix + last 6 digits of phone + timestamp
  const prefix = phone.replace(/\D/g, '').slice(-6);
  const ts = Date.now().toString(36);
  return `bk-${prefix}-${ts}`;
}

const router = Router();

const vendorSchema = z.object({
  nameAr: z.string().min(2),
  nameEn: z.string().optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'الـ slug يقبل أحرف إنجليزية صغيرة وأرقام وشرطة'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  serviceAreas: z.array(z.string()).optional(),
  descriptionAr: z.string().optional(),
  primaryColor: z.string().optional(),
  subscriptionPlan: z.enum(['basic', 'pro', 'enterprise']).optional(),
});

// GET /api/vendors — Super Admin: list all vendors
router.get('/', requireAuth, requireRole('super_admin'), async (_req, res) => {
  try {
    const all = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      phone: vendors.phone,
      subscriptionStatus: vendors.subscriptionStatus,
      subscriptionPlan: vendors.subscriptionPlan,
      subscriptionEndDate: vendors.subscriptionEndDate,
      isActive: vendors.isActive,
      rating: vendors.rating,
      reviewsCount: vendors.reviewsCount,
      createdAt: vendors.createdAt,
    }).from(vendors).orderBy(desc(vendors.createdAt));
    return res.json(all);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/industries — List all available industries
router.get('/industries', async (_req, res) => {
  try {
    const { getIndustriesList } = await import('../lib/industries.js');
    return res.json(getIndustriesList());
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/public — Public marketplace listing
router.get('/public', async (req, res) => {
  try {
    const industryFilter = req.query.industry as string | undefined;

    const list = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      coverImageUrl: vendors.coverImageUrl,
      primaryColor: vendors.primaryColor,
      descriptionAr: vendors.descriptionAr,
      city: vendors.city,
      serviceAreas: vendors.serviceAreas,
      rating: vendors.rating,
      reviewsCount: vendors.reviewsCount,
      phone: vendors.phone,
      industry: vendors.industry,
      createdAt: vendors.createdAt,
      minPrice: sql<string | null>`(
        SELECT MIN(p.price::numeric)
        FROM packages p
        INNER JOIN services s ON p.service_id = s.id
        WHERE s.vendor_id = ${vendors.id}
          AND p.is_active = true
          AND s.is_active = true
      )`,
    }).from(vendors)
      .where(and(
        eq(vendors.isActive, true),
        eq(vendors.showInMarketplace, true),
        ...(industryFilter ? [eq(vendors.industry, industryFilter)] : []),
      ))
      .orderBy(desc(vendors.rating));
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/public/:slug/reviews — Real reviews for vendor landing page
// MUST come before /public/:slug to avoid slug matching "something/reviews"
router.get('/public/:slug/reviews', async (req, res) => {
  try {
    const [vendor] = await db.select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.slug, req.params.slug), eq(vendors.isActive, true)))
      .limit(1);
    if (!vendor) return res.status(404).json({ error: 'غير موجود' });

    const rows = await db.select({
      id: bookings.id,
      rating: bookings.rating,
      comment: bookings.ratingComment,
      ratedAt: bookings.ratedAt,
      customerName: users.name,
    })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(and(
        eq(bookings.vendorId, vendor.id),
        eq(bookings.status, 'completed'),
        isNotNull(bookings.rating),
      ))
      .orderBy(desc(bookings.ratedAt))
      .limit(20);

    // Mask customer name: show first 2 chars + "***" for privacy
    const reviews = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      ratedAt: r.ratedAt,
      customerName: r.customerName
        ? r.customerName.length > 2
          ? r.customerName.slice(0, 2) + '***'
          : r.customerName
        : 'عميل',
    }));

    return res.json(reviews);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/public/:slug — Public vendor page
router.get('/public/:slug', async (req, res) => {
  try {
    const [vendor] = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      coverImageUrl: vendors.coverImageUrl,
      primaryColor: vendors.primaryColor,
      descriptionAr: vendors.descriptionAr,
      city: vendors.city,
      serviceAreas: vendors.serviceAreas,
      phone: vendors.phone,
      rating: vendors.rating,
      reviewsCount: vendors.reviewsCount,
      settings: vendors.settings,
    }).from(vendors)
      .where(eq(vendors.slug, req.params.slug))
      .limit(1);

    if (!vendor) return res.status(404).json({ error: 'غير موجود' });
    return res.json(vendor);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors — Super Admin: create vendor
router.post('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const data = vendorSchema.parse(req.body);

    // Check slug uniqueness
    const existing = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, data.slug)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: 'الـ slug مستخدم مسبقاً' });

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days trial
    const [vendor] = await db.insert(vendors).values({
      ...data,
      subscriptionStatus: 'trial',
      trialEndsAt,
    }).returning();

    return res.status(201).json(vendor);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/count/registered — Public: founding member seats remaining
router.get('/count/registered', async (_req, res) => {
  try {
    const [{ total }] = await db.select({ total: count() }).from(vendors);
    const totalNum = Number(total);
    return res.json({ total: totalNum, remaining: Math.max(0, 100 - totalNum) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/onboard — Self-service vendor registration (creates vendor + vendor_admin user)
router.post('/onboard', async (req, res) => {
  try {
    const { nameAr, nameEn, phone, email, city, address, plan, password, ownerName, industry } = req.body;

    if (!nameAr?.trim()) return res.status(400).json({ error: 'اسم المنشأة مطلوب' });
    if (!phone?.trim()) return res.status(400).json({ error: 'رقم الجوال مطلوب' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

    // Check phone uniqueness (vendor admins share the global users table)
    const existingUser = await db.select({ id: users.id }).from(users)
      .where(eq(users.phone, phone)).limit(1);
    if (existingUser.length > 0) return res.status(409).json({ error: 'رقم الجوال مسجل مسبقاً' });

    const slug = autoSlug(nameAr, phone);
    const passwordHash = await bcrypt.hash(password, 10);
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Check if this registration qualifies as a founding member (first 100)
    const [{ total: vendorCount }] = await db.select({ total: count() }).from(vendors);
    const isFoundingMember = Number(vendorCount) < 100;
    const now = new Date();

    // 1. Create vendor record
    const vendorIndustry = industry || 'other';
    const [vendor] = await db.insert(vendors).values({
      nameAr,
      nameEn: nameEn || null,
      slug,
      phone,
      email: email || null,
      city: city || null,
      address: address || null,
      industry: vendorIndustry,
      subscriptionStatus: 'trial',
      subscriptionPlan: plan === 'bike_solo' ? 'basic' : plan === 'fleet' || plan === 'branches_2_3' ? 'enterprise' : 'pro',
      isActive: true,
      trialEndsAt,
      isFoundingMember,
      foundingMemberSince: isFoundingMember ? now : undefined,
    }).returning();

    // 2. Create vendor_admin user linked to the new vendor
    const [user] = await db.insert(users).values({
      name: ownerName?.trim() || nameAr,
      phone,
      email: email || null,
      passwordHash,
      role: 'vendor_admin',
      vendorId: vendor.id,
    }).returning();

    const token = signToken(user);

    // 3. Auto-seed default services & packages from industry template
    try {
      const { INDUSTRIES } = await import('../lib/industries.js');
      const template = INDUSTRIES[vendorIndustry as keyof typeof INDUSTRIES];
      if (template?.defaultServices?.length) {
        for (const svc of template.defaultServices) {
          const [createdService] = await db.insert(services).values({
            vendorId: vendor.id,
            name: svc.nameAr,
            icon: svc.icon ?? null,
            isActive: true,
          }).returning();

          // Add packages for this service
          const svcPackages = template.defaultPackages?.filter(p => p.serviceName === svc.nameAr) ?? [];
          for (const pkg of svcPackages) {
            await db.insert(packages).values({
              vendorId: vendor.id,
              serviceId: createdService.id,
              name: pkg.nameAr,
              basePrice: String(pkg.price),
              duration: pkg.duration,
              features: pkg.features ?? [],
              isActive: true,
            });
          }
        }
      }
    } catch (_e) {
      console.error('[onboard template seed]', _e);
      // Non-blocking — vendor can create services manually
    }

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        vendorId: user.vendorId,
      },
      vendor,
      message: 'تم إنشاء حسابك بنجاح! مرحباً بك في Jdawil.',
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/public-by-id/:id — Public vendor lookup by numeric ID (no auth)
router.get('/public-by-id/:id', async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    if (isNaN(vendorId)) return res.status(400).json({ error: 'معرف غير صحيح' });

    const [vendor] = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      coverImageUrl: vendors.coverImageUrl,
      primaryColor: vendors.primaryColor,
      descriptionAr: vendors.descriptionAr,
      city: vendors.city,
      serviceAreas: vendors.serviceAreas,
      phone: vendors.phone,
      rating: vendors.rating,
      reviewsCount: vendors.reviewsCount,
      isActive: vendors.isActive,
    }).from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) return res.status(404).json({ error: 'غير موجود' });
    return res.json(vendor);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/qr — Vendor: download QR code PNG for their store/booking page
router.get('/qr', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(404).json({ error: 'ليس حساب تاجر' });

    const [vendor] = await db.select({ slug: vendors.slug, nameAr: vendors.nameAr })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor?.slug) return res.status(404).json({ error: 'غير موجود' });

    const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';
    const url = `https://${DOMAIN}/store/${vendor.slug}`;
    const format = (req.query.format as string) ?? 'png';

    if (format === 'dataurl') {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512, margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });
      return res.json({ dataUrl, url, vendorName: vendor.nameAr });
    }

    // Default: return raw PNG
    const buffer = await QRCode.toBuffer(url, {
      width: 512, margin: 2,
      color: { dark: '#1e3a8a', light: '#ffffff' },
      type: 'png',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${vendor.slug}-qr.png"`);
    return res.send(buffer);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في توليد الباركود' });
  }
});

// GET /api/vendors/me — Vendor admin: get own vendor details by auth context
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(404).json({ error: 'ليس حساب تاجر' });
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'غير موجود' });
    const { whatsappToken, whatsappPhoneId, paymentConfig, ...safe } = vendor;
    return res.json({
      ...safe,
      hasWhatsapp: !!whatsappToken,
      hasPayment: !!paymentConfig,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/notification-preferences — Save notification prefs to vendor settings
router.post('/notification-preferences', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(404).json({ error: 'ليس حساب تاجر' });
    const prefs = req.body;
    const [vendor] = await db.select({ settings: vendors.settings }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const updatedSettings = { ...(vendor?.settings ?? {}), notificationPrefs: prefs };
    await db.update(vendors).set({ settings: updatedSettings, updatedAt: new Date() }).where(eq(vendors.id, vendorId));
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/setup-checklist — MUST come before /:id
router.get('/setup-checklist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    const [
      servicesCount,
      employeesCount,
      vehiclesCount,
      hasBooking,
      hasLoyalty,
    ] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(services).where(and(eq(services.vendorId, vendorId), eq(services.isActive, true))),
      db.select({ c: sql<number>`count(*)` }).from(users).where(and(eq(users.vendorId, vendorId), eq(users.role, 'employee'), eq(users.isActive, true))),
      db.select({ c: sql<number>`count(*)` }).from(fleetVehicles).where(and(eq(fleetVehicles.vendorId, vendorId), eq(fleetVehicles.isActive, true))),
      db.select({ c: sql<number>`count(*)` }).from(bookings).where(eq(bookings.vendorId, vendorId)),
      db.select({ c: sql<number>`count(*)` }).from(loyaltyPrograms).where(and(eq(loyaltyPrograms.vendorId, vendorId), eq(loyaltyPrograms.isActive, true))),
    ]);

    const steps = [
      { id: 'profile', label: 'أكمل بيانات مغسلتك', done: true, path: '/vendor/setup', desc: 'اسم المغسلة والموقع وطريقة التواصل' },
      { id: 'services', label: 'أضف خدماتك وأسعارها', done: Number(servicesCount[0]?.c) > 0, path: '/admin/services', desc: 'حتى تتمكن العملاء من الحجز' },
      { id: 'employees', label: 'أضف أول موظف', done: Number(employeesCount[0]?.c) > 0, path: '/vendor/employees', desc: 'أضف سائقيك وفنييك' },
      { id: 'vehicle', label: 'أضف سيارتك الأولى', done: Number(vehiclesCount[0]?.c) > 0, path: '/vendor/fleet', desc: 'ليبدأ نظام التوزيع التلقائي' },
      { id: 'booking', label: 'استقبل أول حجز', done: Number(hasBooking[0]?.c) > 0, path: '/admin/bookings', desc: 'شارك رابطك مع عميل' },
      { id: 'loyalty', label: 'فعّل برنامج الولاء', done: Number(hasLoyalty[0]?.c) > 0, path: '/vendor/branding', desc: 'بطاقة مخرّمة أو نقاط للعملاء المتكررين' },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const percent = Math.round((completedCount / steps.length) * 100);
    return res.json({ steps, completedCount, totalSteps: steps.length, percent, isComplete: completedCount === steps.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/activity — MUST come before /:id
router.get('/activity', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });
    const limit = Number(req.query.limit) || 20;

    const [recentBookings, recentPayroll] = await Promise.all([
      db.select({
        id: bookings.id,
        type: sql<string>`'booking'`,
        description: sql<string>`concat('حجز جديد #', ${bookings.bookingNumber}, ' — ', coalesce(${bookings.address}, 'بدون عنوان'))`,
        status: bookings.status,
        createdAt: bookings.createdAt,
      }).from(bookings)
      .where(eq(bookings.vendorId, vendorId))
      .orderBy(desc(bookings.createdAt))
      .limit(limit),

      db.select({
        id: payrollRecords.id,
        type: sql<string>`'payroll'`,
        description: sql<string>`concat('رواتب شهر ', ${payrollRecords.month}, '/', ${payrollRecords.year}, ' — ', ${payrollRecords.status})`,
        status: payrollRecords.status,
        createdAt: payrollRecords.createdAt,
      }).from(payrollRecords)
      .where(eq(payrollRecords.vendorId, vendorId))
      .orderBy(desc(payrollRecords.createdAt))
      .limit(5),
    ]);

    const activities = [...recentBookings, ...recentPayroll]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({ activities });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/vendors/:id — Vendor admin: get own vendor details
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    // Vendor admin can only see their own vendor
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'غير موجود' });

    // Strip encrypted credentials before sending
    const { whatsappToken, whatsappPhoneId, paymentConfig, ...safe } = vendor;
    return res.json({
      ...safe,
      hasWhatsapp: !!whatsappToken,
      hasPayment: !!paymentConfig,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/vendors/:id — Vendor admin: update vendor
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const allowed = z.object({
      nameAr: z.string().optional(),
      nameEn: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      serviceAreas: z.array(z.string()).optional(),
      descriptionAr: z.string().optional(),
      primaryColor: z.string().optional(),
      logoUrl: z.string().optional(),
      coverImageUrl: z.string().optional(),
      appIconUrl: z.string().optional(),
      customDomain: z.string().optional(),
      googleReviewLink: z.string().url().nullable().optional(),
      settings: z.record(z.unknown()).optional(),
      // Business identity (الهوية التجارية)
      crNumber: z.string().optional(),
      vatNumber: z.string().optional(),
      nationalAddress: z.string().optional(),
      bankName: z.string().optional(),
      bankIban: z.string().optional(),
      ownerName: z.string().optional(),
      businessType: z.string().optional(),
      maroofNumber: z.string().optional(),
      industry: z.string().optional(),
      industryLabel: z.string().optional(),
      showInMarketplace: z.boolean().optional(),
      // BYOC — only update if provided
      whatsappPhoneId: z.string().optional(),
      whatsappToken: z.string().optional(),
      paymentConfig: z.object({
        provider: z.enum(['stcpay', 'checkout', 'tabby', 'tamara', 'moyasar']),
        merchantId: z.string().optional(),
        apiKey: z.string().optional(),
        secretKey: z.string().optional(),
        sandboxMode: z.boolean().optional(),
      }).optional(),
    }).parse(req.body);

    // Encrypt sensitive fields if provided
    const updateData: Record<string, unknown> = { ...allowed, updatedAt: new Date() };
    if (allowed.whatsappToken) updateData.whatsappToken = encrypt(allowed.whatsappToken);
    if (allowed.whatsappPhoneId) updateData.whatsappPhoneId = encrypt(allowed.whatsappPhoneId);
    if (allowed.paymentConfig) {
      updateData.paymentConfig = {
        provider: allowed.paymentConfig.provider,
        merchantId: allowed.paymentConfig.merchantId,
        apiKey: allowed.paymentConfig.apiKey ? encrypt(allowed.paymentConfig.apiKey) : undefined,
        secretKey: allowed.paymentConfig.secretKey ? encrypt(allowed.paymentConfig.secretKey) : undefined,
        sandboxMode: allowed.paymentConfig.sandboxMode,
      };
    }

    const [updated] = await db.update(vendors).set(updateData as any).where(eq(vendors.id, vendorId)).returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/:id/activate — Super Admin: activate vendor
router.post('/:id/activate', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const { plan = 'yearly' } = req.body;
    const prices: Record<string, number> = { basic: 2400, pro: 4800, enterprise: 9600 };
    const amount = prices[plan] ?? 4800;
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const [vendor] = await db.update(vendors).set({
      isActive: true,
      subscriptionStatus: 'active',
      subscriptionPlan: plan,
      subscriptionAmount: String(amount),
      subscriptionStartDate: new Date(),
      subscriptionEndDate: endDate,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId)).returning();

    return res.json(vendor);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/vendors/:id/suspend — Super Admin: suspend vendor
router.post('/:id/suspend', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const [vendor] = await db.update(vendors).set({
      subscriptionStatus: 'suspended',
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId)).returning();
    return res.json(vendor);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/:id/extend — Super Admin: extend subscription by N days
router.post('/:id/extend', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const { days = 30 } = req.body;

    const [existing] = await db.select({ subscriptionEndDate: vendors.subscriptionEndDate })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    const base = existing?.subscriptionEndDate && new Date(existing.subscriptionEndDate) > new Date()
      ? new Date(existing.subscriptionEndDate)
      : new Date();

    base.setDate(base.getDate() + Number(days));

    const [vendor] = await db.update(vendors).set({
      subscriptionEndDate: base,
      subscriptionStatus: 'active',
      isActive: true,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId)).returning();

    return res.json(vendor);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/:id/payment-config — Save Moyasar key (encrypted)
router.post('/:id/payment-config', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const { apiKey, sandboxMode } = req.body;
    if (!apiKey || !apiKey.startsWith('sk_')) {
      return res.status(400).json({ error: 'مفتاح API غير صالح — يجب أن يبدأ بـ sk_' });
    }

    const paymentConfig = {
      provider: 'moyasar' as const,
      apiKey: encrypt(apiKey),
      sandboxMode: sandboxMode ?? true,
    };

    await db.update(vendors).set({ paymentConfig, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    return res.json({ success: true, message: 'تم حفظ بوابة الدفع بنجاح' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vendors/:id/test-whatsapp — Test WhatsApp credentials
router.post('/:id/test-whatsapp', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const { phoneId, token } = req.body;
    if (!phoneId || !token) {
      return res.status(400).json({ error: 'Phone Number ID والـ Token مطلوبان' });
    }

    // Save credentials first
    await db.update(vendors).set({
      whatsappPhoneId: encrypt(phoneId),
      whatsappToken: encrypt(token),
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    // Send test message to vendor's own phone
    const [vendor] = await db.select({ phone: vendors.phone }).from(vendors)
      .where(eq(vendors.id, vendorId)).limit(1);

    const testPhone = vendor?.phone?.replace(/^0/, '+966') ?? '';
    if (!testPhone) {
      return res.status(400).json({ error: 'لا يوجد رقم هاتف مسجّل للمغسلة' });
    }

    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: testPhone,
        type: 'text',
        text: { body: '✅ تم ربط واتساب بنجاح مع منصة Jdawil! رسائل المغسلة ستصل الآن من هذا الرقم.' },
      }),
    });

    if (response.ok) return res.json({ success: true, phone: testPhone });
    const err = await response.json() as { error?: { message?: string } };
    return res.status(400).json({ error: `فشل: ${err.error?.message ?? 'خطأ في الاتصال'}` });
  } catch {
    return res.status(500).json({ error: 'تعذّر الاتصال بـ WhatsApp API' });
  }
});

// GET /api/vendors/:id/stats — Vendor stats for super admin
router.get('/:id/stats', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const [stats] = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM bookings WHERE vendor_id = ${vendorId}) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE vendor_id = ${vendorId} AND status = 'completed') as completed_bookings,
        (SELECT COALESCE(SUM(total_price), 0) FROM bookings WHERE vendor_id = ${vendorId} AND status = 'completed') as total_revenue,
        (SELECT COUNT(*) FROM users WHERE vendor_id = ${vendorId} AND role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE vendor_id = ${vendorId} AND role = 'employee') as total_employees
    `);
    return res.json(stats);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /api/vendors/:id/platform-subscribe ────────────────────────────────
// Self-service: vendor initiates platform subscription payment via Moyasar.
// Returns { redirectUrl } — vendor is redirected to Moyasar hosted payment page.
// On success Moyasar hits the callback URL which calls /platform-subscribe/verify.

const PLAN_PRICES: Record<string, { annual: number; label: string }> = {
  basic:      { annual: 2400,  label: 'خطة أساسية سنوية' },
  pro:        { annual: 4800,  label: 'خطة احترافية سنوية' },
  enterprise: { annual: 9600,  label: 'خطة مؤسسية سنوية' },
  basic_m:    { annual: 249,   label: 'خطة أساسية شهرية' },
  pro_m:      { annual: 449,   label: 'خطة احترافية شهرية' },
  enterprise_m:{ annual: 849,  label: 'خطة مؤسسية شهرية' },
};

router.post('/:id/platform-subscribe', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    if (req.user!.role !== 'super_admin' && req.user!.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const { plan = 'pro', billingCycle = 'annual' } = req.body;
    const planKey = billingCycle === 'monthly' ? `${plan}_m` : plan;
    const planInfo = PLAN_PRICES[planKey];
    if (!planInfo) return res.status(400).json({ error: 'خطة غير صالحة' });

    const apiKey = process.env.MOYASAR_API_KEY ?? '';
    if (!apiKey) {
      return res.status(503).json({ error: 'بوابة الدفع غير مهيأة بعد، تواصل مع فريق Jdawil على واتساب.' });
    }

    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001';
    const callbackUrl = `${baseUrl}/api/vendors/${vendorId}/platform-subscribe/verify?plan=${plan}&cycle=${billingCycle}`;

    const response = await fetch('https://api.moyasar.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: planInfo.annual * 100, // halalah
        currency: 'SAR',
        description: planInfo.label + ` - مغسلة #${vendorId}`,
        callback_url: callbackUrl,
        source: { type: 'creditcard' },
      }),
    });

    const result: any = await response.json();
    if (!response.ok || result.errors) {
      console.error('[platform-subscribe]', result);
      return res.status(502).json({ error: 'فشل في إنشاء جلسة الدفع. حاول مرة أخرى.' });
    }

    return res.json({
      paymentId: result.id,
      redirectUrl: result.source?.transaction_url ?? result.url ?? '',
      amount: planInfo.annual,
      plan: planKey,
    });
  } catch (e) {
    console.error('[platform-subscribe]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/vendors/:id/platform-subscribe/verify ──────────────────────────
// Moyasar callback — verifies payment and activates subscription.

router.get('/:id/platform-subscribe/verify', async (req, res) => {
  try {
    const vendorId = parseInt(req.params.id);
    const { plan = 'pro', cycle = 'annual', id: paymentId, status } = req.query as Record<string, string>;
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

    if (status === 'failed' || !paymentId) {
      return res.redirect(`${clientUrl}/vendor/platform-sub?payment=failed`);
    }

    // Verify with Moyasar
    const apiKey = process.env.MOYASAR_API_KEY ?? '';
    const verifyRes = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}` },
    });
    const payment: any = await verifyRes.json();

    if (payment.status !== 'paid') {
      return res.redirect(`${clientUrl}/vendor/platform-sub?payment=failed`);
    }

    // Activate / extend subscription
    const isMonthly = cycle === 'monthly';
    const days = isMonthly ? 31 : 365;

    const [existing] = await db.select({ subscriptionEndDate: vendors.subscriptionEndDate })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    const base = existing?.subscriptionEndDate && new Date(existing.subscriptionEndDate) > new Date()
      ? new Date(existing.subscriptionEndDate)
      : new Date();
    base.setDate(base.getDate() + days);

    // Map plan key to subscription plan name
    const planName = plan.replace('_m', '');

    await db.update(vendors).set({
      subscriptionStatus: 'active',
      subscriptionPlan: planName,
      subscriptionEndDate: base,
      subscriptionStartDate: new Date(),
      isActive: true,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    // Record payment
    if (vendorSubscriptionPayments) {
      try {
        await db.insert(vendorSubscriptionPayments).values({
          vendorId,
          amount: String(payment.amount / 100),
          currency: 'SAR',
          status: 'paid',
          plan: planName,
          billingCycle: cycle,
          gatewayRef: paymentId,
          description: `اشتراك ${planName} - ${cycle === 'monthly' ? 'شهري' : 'سنوي'}`,
        } as any);
      } catch { /* non-critical */ }
    }

    return res.redirect(`${clientUrl}/vendor/platform-sub?payment=success&plan=${planName}`);
  } catch (e) {
    console.error('[platform-subscribe/verify]', e);
    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';
    return res.redirect(`${clientUrl}/vendor/platform-sub?payment=error`);
  }
});

export default router;
