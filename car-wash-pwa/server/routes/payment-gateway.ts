/**
 * Vendor-facing payment gateway routes.
 *
 * Flow: vendor picks a provider → pastes API keys → copies the webhook
 * URL we generate and pastes it in the provider dashboard → clicks
 * "Enable". From that point on the rest of the app (bookings, POS, etc.)
 * calls `POST /api/payment-gateway/checkout` and the right adapter runs.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, bookings } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  listProviders, getAdapter, savePaymentConfig, redactForClient,
  markVerified, setEnabled, getVendorPayment, decryptCreds,
  StoredPaymentConfig,
} from '../services/payments/index.js';

const router = Router();

// ─── GET /api/payment-gateway/providers ──────────────────────────────────────
// Public-ish (authenticated vendors only) list of supported providers
// used to populate the picker.
router.get('/providers', requireAuth, async (_req: AuthRequest, res: Response) => {
  return res.json({ providers: listProviders() });
});

// ─── GET /api/payment-gateway/config ─────────────────────────────────────────
// Returns the current vendor's config with secrets REDACTED.
router.get('/config', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const [row] = await db.select({ slug: vendors.slug, paymentConfig: vendors.paymentConfig })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const config = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;
    const base = (process.env.BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const webhookUrl = row?.slug ? `${base}/api/payment-gateway/webhook/${row.slug}` : null;
    return res.json({ config: redactForClient(config), webhookUrl });
  } catch (e) {
    console.error('[payment-gateway/config]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /api/payment-gateway/config ─────────────────────────────────────────
// Save provider + creds. Secret values omitted from the payload preserve
// whatever was stored previously (so the dashboard can render "●●●●" safely).
const saveSchema = z.object({
  provider: z.enum(['moyasar', 'tap', 'hyperpay', 'paytabs', 'stcpay', 'tabby', 'tamara', 'manual']),
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

router.put('/config', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const data = saveSchema.parse(req.body);
    await savePaymentConfig(vendorId, data);
    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/config PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /api/payment-gateway/test ──────────────────────────────────────────
// "Test connection" button. Decrypts the stored keys and calls the
// adapter's lightweight ping. Only marks verified on success.
router.post('/test', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const config = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;
    if (!config?.provider) return res.status(400).json({ error: 'اختر مزوّد الدفع أولاً' });
    const adapter = getAdapter(config.provider);
    if (!adapter) return res.status(400).json({ error: 'المزوّد غير مدعوم' });
    const result = await adapter.testConnection(decryptCreds(config));
    if (result.ok) await markVerified(vendorId);
    return res.json(result);
  } catch (e) {
    console.error('[payment-gateway/test]', e);
    return res.status(500).json({ ok: false, message: 'فشل الاتصال' });
  }
});

// ─── POST /api/payment-gateway/enable ────────────────────────────────────────
router.post('/enable', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
  const enabled = Boolean(req.body?.enabled);
  await setEnabled(vendorId, enabled);
  return res.json({ success: true, enabled });
});

// ─── POST /api/payment-gateway/checkout ──────────────────────────────────────
// Kick off a checkout for a given booking. Amount + description come from
// the booking; metadata always carries bookingId so webhooks can match it.
const checkoutSchema = z.object({
  bookingId: z.number().int().positive(),
  returnUrl: z.string().url().optional(),
});

router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = checkoutSchema.parse(req.body);
    const [booking] = await db.select({
      id: bookings.id, vendorId: bookings.vendorId, customerId: bookings.customerId,
      total: bookings.totalPrice, bookingNumber: bookings.bookingNumber,
    }).from(bookings).where(eq(bookings.id, data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Tenant check — non-customer actors must belong to the same vendor.
    if (req.user!.role !== 'customer' && req.user!.vendorId !== booking.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    // Customers can only pay for their own bookings.
    if (req.user!.role === 'customer' && req.user!.id !== booking.customerId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const vp = await getVendorPayment(booking.vendorId);
    if (!vp) return res.status(409).json({ error: 'المتجر لم يفعّل بوابة الدفع بعد' });

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
    const returnUrl = data.returnUrl ?? `${clientUrl}/booking/${booking.id}/payment-return`;

    const checkout = await vp.adapter.createCheckout(vp.creds, {
      amountSar: Number(booking.total ?? 0),
      description: `حجز #${booking.bookingNumber}`,
      returnUrl,
      metadata: {
        bookingId: String(booking.id),
        vendorId:  String(booking.vendorId),
      },
    });
    return res.json({
      provider: vp.config.provider,
      providerRef: checkout.providerRef,
      redirectUrl: checkout.redirectUrl,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/checkout]', e);
    return res.status(500).json({ error: e?.message ?? 'تعذّر بدء عملية الدفع' });
  }
});

// ─── POST /api/payment-gateway/refund ────────────────────────────────────────
const refundSchema = z.object({
  providerRef: z.string().min(1),
  amountSar: z.number().positive().optional(),
});

router.post('/refund', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const data = refundSchema.parse(req.body);
    const vp = await getVendorPayment(vendorId);
    if (!vp) return res.status(409).json({ error: 'بوابة الدفع غير مفعّلة' });
    const out = await vp.adapter.refund(vp.creds, data.providerRef, data.amountSar);
    return res.json(out);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payment-gateway/refund]', e);
    return res.status(500).json({ error: 'فشل الاسترجاع' });
  }
});

export default router;
