/**
 * Mobile App Builder routes — vendor orders + super-admin fulfillment.
 *
 * Vendor side:
 *   GET  /api/mobile-app/plans                      public catalog
 *   POST /api/mobile-app/orders                     create new order (returns Moyasar payment URL)
 *   GET  /api/mobile-app/orders/me                  list vendor's orders
 *   GET  /api/mobile-app/orders/:id                 single order with deliverables
 *   POST /api/mobile-app/orders/:id/cancel          cancel pending-payment order
 *
 * Super-admin side:
 *   GET   /api/super-admin/mobile-app-orders        all orders, sortable
 *   PATCH /api/super-admin/mobile-app-orders/:id    update status/deliverables
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { mobileAppOrders, vendors } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { getPlan, listOneTimePlans, MOBILE_APP_PLANS, MobileAppPlanId } from '../services/mobileAppPlans.js';

const router = Router();

// ─── Public catalog ─────────────────────────────────────────────────────────

router.get('/plans', (_req, res) => {
  res.json(listOneTimePlans());
});

// ─── Vendor: create order ───────────────────────────────────────────────────

const createOrderSchema = z.object({
  planId: z.enum(['android', 'ios', 'both', 'support_hour']),
  appName: z.string().min(2).max(100).optional(),
  iconUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().max(2000).optional(),
  keywords: z.string().max(500).optional(),
  privacyPolicyUrl: z.string().url().optional(),
});

router.post('/orders', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const data = createOrderSchema.parse(req.body);
    const plan = getPlan(data.planId);
    if (!plan) return res.status(400).json({ error: 'الخطة غير موجودة' });

    // For one-time plans, require the branding inputs. For support hours,
    // skip — those don't need an icon/name.
    if (plan.category === 'one_time') {
      if (!data.appName)  return res.status(400).json({ error: 'اسم التطبيق مطلوب' });
      if (!data.iconUrl)  return res.status(400).json({ error: 'رابط شعار التطبيق مطلوب' });
    }

    // Get vendor slug for bundle ID
    const [vendor] = await db.select({ slug: vendors.slug })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const safeSlug = (vendor?.slug ?? `v${vendorId}`).replace(/[^a-z0-9]/g, '');
    const bundleId = `com.jdawil.${safeSlug}`;

    const [order] = await db.insert(mobileAppOrders).values({
      vendorId,
      planId: plan.id,
      pricePaidSar: String(plan.priceSar),
      status: 'pending_payment',
      appName: data.appName,
      iconUrl: data.iconUrl,
      primaryColor: data.primaryColor,
      description: data.description,
      keywords: data.keywords,
      privacyPolicyUrl: data.privacyPolicyUrl,
      bundleId,
      supportHoursIncluded: plan.supportHoursIncluded,
    }).returning();

    return res.status(201).json({ order, plan });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Vendor: list/read orders ───────────────────────────────────────────────

router.get('/orders/me', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const orders = await db.select()
      .from(mobileAppOrders)
      .where(eq(mobileAppOrders.vendorId, vendorId))
      .orderBy(desc(mobileAppOrders.createdAt));
    // Enrich with plan details
    const enriched = orders.map((o) => ({ ...o, plan: getPlan(o.planId) }));
    return res.json(enriched);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.get('/orders/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const id = Number(req.params.id);
    const [order] = await db.select()
      .from(mobileAppOrders)
      .where(and(eq(mobileAppOrders.id, id), eq(mobileAppOrders.vendorId, vendorId)))
      .limit(1);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    return res.json({ ...order, plan: getPlan(order.planId) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/mobile-app/orders/:id/manual.html — printable submission guide
// Vendor opens it in browser → "Print to PDF". Auto-fills with their
// bundle ID, app name, and per-platform steps based on plan.
router.get('/orders/:id/manual.html', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).send('no vendor');
    const id = Number(req.params.id);
    const [order] = await db.select()
      .from(mobileAppOrders)
      .where(and(eq(mobileAppOrders.id, id), eq(mobileAppOrders.vendorId, vendorId)))
      .limit(1);
    if (!order) return res.status(404).send('not found');

    const plan = getPlan(order.planId);
    const includesAndroid = plan?.id === 'android' || plan?.id === 'both';
    const includesIos = plan?.id === 'ios' || plan?.id === 'both';

    const html = renderManualHtml({
      appName: order.appName ?? '',
      bundleId: order.bundleId ?? '',
      iconUrl: order.iconUrl ?? '',
      includesAndroid,
      includesIos,
      planName: plan?.nameAr ?? '',
      orderId: order.id,
    });
    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error(e);
    return res.status(500).send('error');
  }
});

router.post('/orders/:id/cancel', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const id = Number(req.params.id);
    const [order] = await db.select()
      .from(mobileAppOrders)
      .where(and(eq(mobileAppOrders.id, id), eq(mobileAppOrders.vendorId, vendorId)))
      .limit(1);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ error: 'يمكن إلغاء الطلب فقط قبل الدفع' });
    }
    const [updated] = await db.update(mobileAppOrders)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(mobileAppOrders.id, id))
      .returning();
    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Printable manual ───────────────────────────────────────────────────────

function renderManualHtml(d: {
  appName: string; bundleId: string; iconUrl: string;
  includesAndroid: boolean; includesIos: boolean;
  planName: string; orderId: number;
}): string {
  const androidSteps = d.includesAndroid ? `
    <h2>📱 نشر على Google Play (Android)</h2>
    <ol>
      <li>سجّل حساب مطوّر في <a href="https://play.google.com/console">Google Play Console</a> ($25 لمرة واحدة)</li>
      <li>افتح Console → Create app → اختر "Application"</li>
      <li>اسم التطبيق: <code>${escapeHtml(d.appName)}</code></li>
      <li>اللغة الافتراضية: العربية</li>
      <li>التطبيق مجاني / مدفوع: مجاني (الحجوزات تتم داخل التطبيق)</li>
      <li>وافق على Play Console policies</li>
      <li>في "Internal testing" → Create release</li>
      <li>ارفع ملف <code>app-release.aab</code> الذي استلمته منا</li>
      <li>أكمل بقية التبويبات: Store listing / Content rating / Privacy / Pricing</li>
      <li>اطلب المراجعة — Google يرد خلال ١-٧ أيام</li>
    </ol>
  ` : '';

  const iosSteps = d.includesIos ? `
    <h2>🍎 نشر على App Store (iOS)</h2>
    <ol>
      <li>سجّل في <a href="https://developer.apple.com">Apple Developer Program</a> ($99/سنة)</li>
      <li>تحتاج D-U-N-S Number لاسم منشأتك (احصل عليه مجاناً من <a href="https://developer.apple.com/enroll/duns-lookup/">هنا</a> — أسبوع للمعالجة)</li>
      <li>افتح <a href="https://appstoreconnect.apple.com">App Store Connect</a> → My Apps → +</li>
      <li>Bundle ID: <code>${escapeHtml(d.bundleId)}</code></li>
      <li>افتح المشروع <code>App.xcworkspace</code> في Xcode</li>
      <li>Select Team → اختر فريقك</li>
      <li>Product → Archive</li>
      <li>Distribute App → App Store Connect</li>
      <li>عُد لـ App Store Connect → اختر الـ build المرفوع</li>
      <li>أكمل: Description / Keywords / Screenshots / Privacy</li>
      <li>اضغط "Submit for Review" — Apple يرد خلال ٢٤-٧٢ ساعة</li>
    </ol>
  ` : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>دليل نشر تطبيق ${escapeHtml(d.appName)}</title>
  <style>
    body { font-family: 'Cairo', 'Tahoma', Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.7; color: #1f2937; }
    h1 { color: #111827; border-bottom: 3px solid #f97316; padding-bottom: 10px; }
    h2 { color: #1f2937; margin-top: 36px; padding: 8px 0; border-right: 4px solid #f97316; padding-right: 12px; }
    .header { display: flex; gap: 16px; align-items: center; margin-bottom: 30px; }
    .header img { width: 80px; height: 80px; border-radius: 16px; }
    .meta { background: #f3f4f6; border-radius: 12px; padding: 16px; margin: 20px 0; }
    .meta div { margin: 4px 0; }
    code { background: #fff7ed; color: #c2410c; padding: 2px 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.9em; }
    a { color: #f97316; }
    ol li { margin: 8px 0; }
    .warning { background: #fef3c7; border-right: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 20px 0; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 0.85em; }
    @media print {
      body { margin: 20px; }
      h2 { page-break-before: auto; page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${d.iconUrl ? `<img src="${escapeHtml(d.iconUrl)}" alt="logo">` : ''}
    <div>
      <h1 style="margin: 0; border: none; padding: 0;">دليل نشر تطبيقك</h1>
      <p style="margin: 4px 0 0; color: #6b7280;">${escapeHtml(d.appName)} — ${escapeHtml(d.planName)}</p>
    </div>
  </div>

  <div class="meta">
    <div><strong>اسم التطبيق:</strong> ${escapeHtml(d.appName)}</div>
    <div><strong>Bundle ID:</strong> <code>${escapeHtml(d.bundleId)}</code></div>
    <div><strong>رقم الطلب:</strong> #${d.orderId}</div>
    <div><strong>الباقة:</strong> ${escapeHtml(d.planName)}</div>
  </div>

  <h2>قبل ما تبدأ</h2>
  <p>استلمت ملفات المشروع جاهزة. مهمتك الآن: رفع التطبيق على المتجر/المتاجر تحت حسابك. هذا الدليل يأخذك خطوة بخطوة.</p>

  <div class="warning">
    <strong>تنبيه:</strong> رسوم Apple ($99/سنة) و Google ($25 مرة) تدفعها أنت مباشرة لـ Apple/Google. لسنا وسطاء فيها.
  </div>

  ${androidSteps}
  ${iosSteps}

  <h2>📞 الدعم</h2>
  <p>لو احتجت مساعدة في أي خطوة، تواصل معنا. عندك ساعات دعم مجانية مضمنة في باقتك. أي ساعة إضافية بـ ٣٠٠ ر.س.</p>

  <div class="footer">
    دليل نشر تطبيق <strong>${escapeHtml(d.appName)}</strong> — مولّد تلقائياً من المنصة<br>
    تم تطوير التطبيق بواسطة منصة جداول · ${new Date().toLocaleDateString('ar-SA')}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── Build pipeline ─────────────────────────────────────────────────────────
//
// Three endpoints turn a paid order into a real native build:
//
//   POST /orders/:id/build          — vendor (or super-admin) kicks off the
//                                     project generation. Customised
//                                     Capacitor source is zipped and made
//                                     downloadable. If GITHUB_BUILD_TOKEN
//                                     is set, we also fire repository_dispatch
//                                     so the workflow builds the APK
//                                     remotely.
//   GET  /orders/:id/download       — signed URL to the source ZIP.
//   POST /orders/:id/build-complete — webhook the GitHub workflow hits
//                                     when the APK is ready (auth-gated
//                                     by JDAWIL_BUILD_TOKEN).

router.post('/orders/:id/build', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    const orderId = parseInt(req.params.id, 10);
    if (!Number.isFinite(orderId)) return res.status(400).json({ error: 'معرّف الطلب غير صالح' });

    const [order] = await db.select().from(mobileAppOrders).where(eq(mobileAppOrders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

    // Tenant guard — vendor can only build their own orders.
    if (req.user!.role !== 'super_admin' && order.vendorId !== vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    if (order.status !== 'paid' && order.status !== 'in_production') {
      return res.status(400).json({
        error: `الطلب لا يمكن بناؤه في هذي الحالة (${order.status}). يجب أن يكون مدفوعاً أولاً.`,
      });
    }

    // Flip to in_production immediately so the UI shows progress.
    await db.update(mobileAppOrders).set({
      status: 'in_production',
      updatedAt: new Date(),
    }).where(eq(mobileAppOrders.id, orderId));

    // Generate the customised project + ZIP it. This is fast (< 30s).
    const { generateVendorProject } = await import('../services/mobileAppBuilder.js');
    const result = await generateVendorProject(orderId);

    // Optionally fire a remote APK build via GitHub Actions. Without the
    // env vars set, the vendor just gets the source ZIP and builds the
    // APK themselves (or via concierge).
    const ghToken = process.env.GITHUB_BUILD_TOKEN;
    const ghRepo  = process.env.GITHUB_BUILD_REPO; // e.g. booklk/boksetplatform
    if (ghToken && ghRepo) {
      try {
        await fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({
            event_type: 'build-vendor-app',
            client_payload: {
              orderId,
              zipKey:    result.zipKey,
              bundleId:  result.bundleId,
              appName:   result.appName,
            },
          }),
        });
      } catch (e) {
        console.warn('[mobile-app/build] dispatch failed:', e instanceof Error ? e.message : e);
      }
    }

    return res.json({
      ok: true,
      orderId,
      sourceZipUrl: result.zipUrl,
      bundleId: result.bundleId,
      remoteBuildTriggered: !!(ghToken && ghRepo),
      message: ghToken
        ? 'تم بناء المشروع. سيُجهز ملف APK خلال 10-20 دقيقة وستصلك رسالة عند الجاهزية.'
        : 'تم تجهيز مصدر التطبيق. حمّله من الرابط أعلاه. سيتولّى فريق الدعم بناء APK وإرساله لك.',
    });
  } catch (e) {
    console.error('[mobile-app/build]', e);
    return res.status(500).json({ error: 'تعذّر بناء التطبيق — تواصل مع الدعم' });
  }
});

router.get('/orders/:id/download', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const [order] = await db.select().from(mobileAppOrders).where(eq(mobileAppOrders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (req.user!.role !== 'super_admin' && order.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    // The "githubRepoUrl" column was repurposed to hold the storage key
    // for the generated source ZIP (see services/mobileAppBuilder).
    const key = order.githubRepoUrl;
    if (!key) return res.status(404).json({ error: 'لم يُبنى المشروع بعد. اضغط "ابدأ البناء" أولاً.' });

    const { getSignedReadUrl } = await import('../services/storage.js');
    const url = await getSignedReadUrl(key, 3600);
    return res.json({ url, expiresInSec: 3600 });
  } catch (e) {
    console.error('[mobile-app/download]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Webhook fired by the GitHub Actions workflow once the APK + AAB are
// uploaded. Auth-gated by JDAWIL_BUILD_TOKEN (set as a repo secret).
router.post('/orders/:id/build-complete', async (req, res) => {
  try {
    const expected = process.env.JDAWIL_BUILD_TOKEN;
    const provided = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!expected || provided !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const orderId = parseInt(req.params.id, 10);
    const body = z.object({
      apkKey: z.string().min(3),
      aabKey: z.string().min(3).optional(),
    }).parse(req.body);

    const { getSignedReadUrl } = await import('../services/storage.js');
    const apkUrl = await getSignedReadUrl(body.apkKey, 7 * 24 * 3600);

    await db.update(mobileAppOrders).set({
      androidApkUrl: apkUrl,
      status: 'ready',
      updatedAt: new Date(),
    }).where(eq(mobileAppOrders.id, orderId));

    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[mobile-app/build-complete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
