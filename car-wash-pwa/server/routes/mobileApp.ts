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

export default router;
