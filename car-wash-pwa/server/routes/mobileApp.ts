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

    // Audit
    try {
      const { billingAudit } = await import('../db/schema.js');
      await db.insert(billingAudit).values({
        vendorId,
        event: 'mobile_app_order_created',
        resource: plan.id,
        amount: String(plan.priceSar),
        metadata: { orderId: order.id, planName: plan.nameAr, bundleId },
      });
    } catch {/* noop */}

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

export default router;
