/**
 * Vendor-facing payment gateway routes — multi-provider edition.
 *
 * Each vendor can run any number of providers in parallel (Moyasar + Tabby
 * + Tamara + STC Pay, …). Endpoints are scoped by provider slug in the URL.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, bookings, users, packages, services } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  listProviders, getAdapter, redactForClient, getStoredConfig,
  saveProvider, removeProvider, setProviderEnabled, setDefaultProvider,
  markVerified, decryptCreds, getVendorProvider, getEnabledProviders,
} from '../services/payments/index.js';
import type { ProviderSlug } from '../services/payments/types.js';

const router = Router();

const SLUGS: ProviderSlug[] = ['moyasar', 'tap', 'hyperpay', 'paytabs', 'stcpay', 'tabby', 'tamara', 'manual'];
const slugEnum = z.enum(SLUGS as [ProviderSlug, ...ProviderSlug[]]);

// ── Provider catalogue (authenticated, any role) ──────────────────────────
router.get('/providers', requireAuth, async (_req: AuthRequest, res: Response) => {
  return res.json({ providers: listProviders() });
});

// ─── Vendor-scoped writes ─────────────────────────────────────────────────
router.use('/config', requireAuth, requireRole('vendor_admin', 'admin'));
router.use('/enabled', requireAuth, requireRole('vendor_admin', 'admin'));

// GET /api/payment-gateway/config — full config + per-provider webhook URLs.
router.get('/config', async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const [row] = await db.select({ slug: vendors.slug })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const cfg = await getStoredConfig(vendorId);
    const redacted = redactForClient(cfg);
    const base = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const webhookBase = row?.slug ? `${base}/api/payment-gateway/webhook/${row.slug}` : null;
    const withUrls = redacted.providers.map((p) => ({
      ...p,
      webhookUrl: webhookBase ? `${webhookBase}/${p.slug}` : null,
    }));
    return res.json({
      defaultProvider: redacted.defaultProvider,
      providers: withUrls,
    });
  } catch (e) {
    console.error('[payment-gateway/config GET]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/payment-gateway/config/:slug — create or update one provider.
const saveSchema = z.object({
  enabled: z.boolean().optional(),
  credentials: z.object({
    publicKey: z.string().optional(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
    merchantId: z.string().optional(),
    sandboxMode: z.boolean().optional(),
    extra: z.record(z.string()).optional(),
  }),
});

router.put('/config/:slug', async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const slug = slugEnum.parse(req.params.slug);
    const data = saveSchema.parse(req.body);
    await saveProvider(vendorId, slug, data);
    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/config PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/payment-gateway/config/:slug
router.delete('/config/:slug', async (req: AuthRequest, res: Response) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const slug = slugEnum.parse(req.params.slug);
  await removeProvider(vendorId, slug);
  return res.json({ success: true });
});

// POST /api/payment-gateway/config/:slug/test — probe the stored keys.
router.post('/config/:slug/test', async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const slug = slugEnum.parse(req.params.slug);
    const cfg = await getStoredConfig(vendorId);
    const entry = cfg.providers[slug];
    if (!entry) return res.status(400).json({ ok: false, message: 'المزوّد غير مضاف' });
    const adapter = getAdapter(slug);
    if (!adapter) return res.status(400).json({ ok: false, message: 'المزوّد غير مدعوم' });
    const result = await adapter.testConnection(decryptCreds(entry));
    if (result.ok) await markVerified(vendorId, slug);
    return res.json(result);
  } catch (e) {
    console.error('[payment-gateway/config test]', e);
    return res.status(500).json({ ok: false, message: 'فشل الاختبار' });
  }
});

// POST /api/payment-gateway/config/:slug/enable { enabled: true|false }
router.post('/config/:slug/enable', async (req: AuthRequest, res: Response) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const slug = slugEnum.parse(req.params.slug);
  const enabled = Boolean(req.body?.enabled);
  await setProviderEnabled(vendorId, slug, enabled);
  return res.json({ success: true, enabled });
});

// POST /api/payment-gateway/config/default { provider: slug | null }
router.post('/config/default', async (req: AuthRequest, res: Response) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const provider = req.body?.provider ? slugEnum.parse(req.body.provider) : null;
  await setDefaultProvider(vendorId, provider);
  return res.json({ success: true, defaultProvider: provider });
});

// ─── Customer-facing: which providers can I pay with for this vendor? ──────
router.get('/enabled/:vendorId', async (req, res) => {
  const vendorId = Number(req.params.vendorId);
  if (!Number.isFinite(vendorId) || vendorId <= 0) {
    return res.status(400).json({ error: 'vendorId غير صحيح' });
  }
  const providers = await getEnabledProviders(vendorId);
  res.set('Cache-Control', 'public, max-age=30');
  return res.json({ providers });
});

// ─── Checkout for a booking — customer picks which provider to use ────────
const checkoutSchema = z.object({
  bookingId: z.number().int().positive(),
  provider: slugEnum.optional(),
  returnUrl: z.string().url().optional(),
});

router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = checkoutSchema.parse(req.body);
    const [booking] = await db.select({
      id: bookings.id, vendorId: bookings.vendorId, customerId: bookings.customerId,
      total: bookings.totalPrice, bookingNumber: bookings.bookingNumber,
      packageId: bookings.packageId, address: bookings.address,
    }).from(bookings).where(eq(bookings.id, data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Tenant + ownership checks.
    if (req.user!.role !== 'customer' && req.user!.vendorId !== booking.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (req.user!.role === 'customer' && req.user!.id !== booking.customerId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Pick a provider: explicit param → default → nothing.
    const cfg = await getStoredConfig(booking.vendorId);
    const chosen = data.provider ?? cfg.defaultProvider;
    if (!chosen) return res.status(409).json({ error: 'المتجر لم يفعّل أي بوابة دفع' });
    const vp = await getVendorProvider(booking.vendorId, chosen);
    if (!vp) return res.status(409).json({ error: 'هذا المزوّد غير مفعّل لدى المتجر' });

    const [customer] = await db.select({
      name: users.name, phone: users.phone, email: users.email,
    }).from(users).where(eq(users.id, booking.customerId)).limit(1);
    const [vendor] = await db.select({ city: vendors.city })
      .from(vendors).where(eq(vendors.id, booking.vendorId)).limit(1);
    const [pkg] = await db.select({
      name: packages.name, serviceName: services.name,
    })
      .from(packages)
      .leftJoin(services, eq(services.id, packages.serviceId))
      .where(eq(packages.id, booking.packageId))
      .limit(1);

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const returnUrl = data.returnUrl ?? `${clientUrl}/booking/${booking.id}/payment-return`;
    const amount = Number(booking.total ?? 0);
    const itemName = [pkg?.serviceName, pkg?.name].filter(Boolean).join(' — ')
      || `حجز #${booking.bookingNumber}`;

    const checkout = await vp.adapter.createCheckout(vp.creds, {
      amountSar: amount,
      description: `حجز #${booking.bookingNumber}`,
      returnUrl,
      metadata: {
        bookingId: String(booking.id),
        vendorId:  String(booking.vendorId),
        provider:  chosen,
      },
      customer: {
        name:        customer?.name ?? undefined,
        phone:       customer?.phone ?? undefined,
        email:       customer?.email ?? undefined,
        addressLine: booking.address ?? undefined,
        city:        vendor?.city ?? 'الرياض',
        country:     'SA',
      },
      items: [{
        name: itemName,
        quantity: 1,
        unitPriceSar: amount,
        reference: booking.bookingNumber,
      }],
    });
    return res.json({
      provider: chosen,
      providerRef: checkout.providerRef,
      redirectUrl: checkout.redirectUrl,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/checkout]', e);
    return res.status(500).json({ error: e?.message ?? 'تعذّر بدء عملية الدفع' });
  }
});

// Refund a previous payment through a specific provider.
const refundSchema = z.object({
  provider: slugEnum,
  providerRef: z.string().min(1),
  amountSar: z.number().positive().optional(),
});

router.post('/refund', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const data = refundSchema.parse(req.body);
    const vp = await getVendorProvider(vendorId, data.provider);
    if (!vp) return res.status(409).json({ error: 'المزوّد غير مفعّل' });
    const out = await vp.adapter.refund(vp.creds, data.providerRef, data.amountSar);
    return res.json(out);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/refund]', e);
    return res.status(500).json({ error: 'فشل الاسترجاع' });
  }
});

export default router;
