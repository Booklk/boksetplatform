import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { payments, bookings, vendors, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { decrypt } from '../lib/crypto.js';

const router = Router();

const initiateSchema = z.object({
  bookingId: z.number({ required_error: 'رقم الحجز مطلوب' }),
  method: z.enum(['stcpay', 'mada', 'visa', 'apple_pay', 'cash'], {
    errorMap: () => ({ message: 'طريقة الدفع غير صالحة' }),
  }),
  customerPhone: z.string().optional(), // for STC Pay
});

const verifySchema = z.object({
  reference: z.string({ required_error: 'الرقم المرجعي مطلوب' }).min(1),
  bookingId: z.number({ required_error: 'رقم الحجز مطلوب' }),
});

// ─── Moyasar helpers ──────────────────────────────────────────────────────────

interface MoyasarPaymentResult {
  id: string;
  status: string;
  url?: string;
  source?: Record<string, unknown>;
  amount?: number;
}

async function initiateMoyasarPayment(opts: {
  apiKey: string;
  amount: number; // SAR
  description: string;
  method: string;
  customerPhone?: string;
  callbackUrl: string;
  bookingId: number;
}): Promise<MoyasarPaymentResult> {
  const sourceType =
    opts.method === 'stcpay' ? 'stcpay'
    : opts.method === 'apple_pay' ? 'applepay'
    : 'creditcard';

  const source: Record<string, string> = { type: sourceType };
  if (sourceType === 'stcpay' && opts.customerPhone) {
    source.mobile = opts.customerPhone.replace(/^0/, '+966');
  }

  const auth = Buffer.from(`${opts.apiKey}:`).toString('base64');

  const response = await fetch('https://api.moyasar.com/v1/payments', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(opts.amount * 100), // convert to halalas
      currency: 'SAR',
      description: opts.description,
      callback_url: opts.callbackUrl,
      source,
      metadata: { bookingId: opts.bookingId },
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<MoyasarPaymentResult>;
}

async function fetchMoyasarPayment(apiKey: string, paymentId: string): Promise<MoyasarPaymentResult> {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const response = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Basic ${auth}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<MoyasarPaymentResult>;
}

// ─── POST /api/payments/initiate ──────────────────────────────────────────────

router.post('/initiate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = initiateSchema.parse(req.body);

    // Fetch booking
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, data.bookingId)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Authorization: customer can only pay for their own bookings; employees/admins can pay for any booking in their vendor
    const role = req.user!.role;
    if (role === 'customer' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح — هذا الحجز ليس لك' });
    }
    if ((role === 'employee' || role === 'vendor_admin') && booking.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح — الحجز لا ينتمي لمغسلتك' });
    }

    // Fetch vendor payment config
    const [vendor] = await db
      .select({ paymentConfig: vendors.paymentConfig, nameAr: vendors.nameAr })
      .from(vendors)
      .where(eq(vendors.id, booking.vendorId))
      .limit(1);
    if (!vendor) return res.status(404).json({ error: 'المورد غير موجود' });

    // Decrypt payment config if it exists
    let paymentConfig: Record<string, unknown> | null = null;
    if (vendor.paymentConfig) {
      try {
        const raw = vendor.paymentConfig as unknown as string;
        if (typeof raw === 'string') {
          paymentConfig = JSON.parse(decrypt(raw));
        } else {
          paymentConfig = vendor.paymentConfig as unknown as Record<string, unknown>;
        }
      } catch {
        paymentConfig = vendor.paymentConfig as unknown as Record<string, unknown>;
      }
    }

    // Handle cash payments immediately
    if (data.method === 'cash') {
      const [payment] = await db
        .insert(payments)
        .values({
          bookingId: data.bookingId,
          vendorId: booking.vendorId,
          amount: booking.totalPrice ?? '0',
          currency: 'SAR',
          method: 'cash',
          status: 'paid',
          paidAt: new Date(),
        })
        .returning();

      await db
        .update(bookings)
        .set({ paymentStatus: 'paid', paymentMethod: 'cash', updatedAt: new Date() })
        .where(eq(bookings.id, data.bookingId));

      return res.json({ success: true, method: 'cash', paymentId: payment.id });
    }

    // Resolve Moyasar API key: vendor's own key or platform default
    const apiKey =
      (paymentConfig?.apiKey as string | undefined) ??
      process.env.MOYASAR_API_KEY ??
      '';

    if (!apiKey) {
      return res.status(503).json({ error: 'بوابة الدفع غير مهيأة. يرجى التواصل مع الدعم.' });
    }

    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3001';
    const callbackUrl = `${baseUrl}/api/payments/callback?bookingId=${data.bookingId}`;
    const amountSAR = parseFloat(booking.totalPrice ?? '0');
    const description = `حجز #${booking.bookingNumber} - ${vendor.nameAr}`;

    // Initiate Moyasar payment
    const moyasarResult = await initiateMoyasarPayment({
      apiKey,
      amount: amountSAR,
      description,
      method: data.method,
      customerPhone: data.customerPhone,
      callbackUrl,
      bookingId: data.bookingId,
    });

    // Determine redirect URL from Moyasar response
    const redirectUrl: string =
      (moyasarResult.url as string | undefined) ??
      (moyasarResult.source as any)?.transaction_url ??
      '';

    // Insert payment record
    const [payment] = await db
      .insert(payments)
      .values({
        bookingId: data.bookingId,
        vendorId: booking.vendorId,
        amount: booking.totalPrice ?? '0',
        currency: 'SAR',
        method: data.method,
        status: 'processing',
        gatewayRef: moyasarResult.id,
        gatewayResponse: moyasarResult as unknown as Record<string, unknown>,
      })
      .returning();

    return res.json({
      paymentId: payment.id,
      moyasarId: moyasarResult.id,
      redirectUrl,
      status: moyasarResult.status,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payments/initiate]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /api/payments/verify ────────────────────────────────────────────────
// Verify payment by fetching from Moyasar and confirming status + amount

router.post('/verify', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = verifySchema.parse(req.body);

    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.gatewayRef, data.reference),
          eq(payments.bookingId, data.bookingId),
        ),
      )
      .limit(1);

    if (!payment) return res.status(404).json({ error: 'سجل الدفع غير موجود' });
    if (payment.status === 'paid') return res.json(payment);

    // Resolve API key for verification
    const [vendor] = await db
      .select({ paymentConfig: vendors.paymentConfig })
      .from(vendors)
      .where(eq(vendors.id, payment.vendorId))
      .limit(1);

    let apiKey = process.env.MOYASAR_API_KEY ?? '';
    if (vendor?.paymentConfig) {
      try {
        const raw = vendor.paymentConfig as unknown as string;
        const cfg = typeof raw === 'string'
          ? JSON.parse(decrypt(raw))
          : vendor.paymentConfig as unknown as Record<string, unknown>;
        if (cfg?.apiKey) apiKey = cfg.apiKey as string;
      } catch { /* use platform key */ }
    }

    // Fetch live status from Moyasar
    let moyasarStatus = 'unknown';
    let verifiedAmount = 0;
    if (apiKey && data.reference) {
      try {
        const moyasarPayment = await fetchMoyasarPayment(apiKey, data.reference);
        moyasarStatus = moyasarPayment.status;
        verifiedAmount = (moyasarPayment.amount ?? 0) / 100; // halalas → SAR
      } catch (fetchErr) {
        console.warn('[payments/verify] Moyasar fetch failed:', fetchErr);
      }
    }

    // Only confirm if Moyasar says paid
    if (moyasarStatus !== 'paid') {
      return res.status(402).json({
        error: 'لم يتم تأكيد الدفع بعد',
        moyasarStatus,
      });
    }

    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'paid',
        paidAt: new Date(),
        gatewayResponse: {
          ...(payment.gatewayResponse as Record<string, unknown> ?? {}),
          verifiedAt: new Date().toISOString(),
          moyasarStatus,
          verifiedAmount,
        },
      })
      .where(eq(payments.id, payment.id))
      .returning();

    await db
      .update(bookings)
      .set({ paymentStatus: 'paid', updatedAt: new Date() })
      .where(eq(bookings.id, data.bookingId));

    // Record in financials for financial reports
    try {
      const { financials } = await import('../db/schema.js');
      await db.insert(financials).values({
        vendorId: payment.vendorId,
        type: 'income',
        category: 'payment',
        amount: payment.amount,
        description: `دفعة حجز #${payment.bookingId}`,
        referenceId: payment.id,
        referenceType: 'payment',
        date: new Date(),
        createdBy: req.user?.id ?? null,
      });
    } catch (_e) { console.error('[payment-financials]', _e); }

    // Notify vendor of received payment
    try {
      const { createNotification } = await import('./notification-center.js');
      const [vendorAdmin] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.vendorId, payment.vendorId), eq(users.role, 'vendor_admin')))
        .limit(1);
      if (vendorAdmin) {
        await createNotification(vendorAdmin.id, 'دفعة جديدة 💰', `تم استلام ${payment.amount} ر.س`, 'payment', '/vendor/invoices', payment.vendorId);
      }
    } catch (_e) { console.error('[payment-notification]', _e); }

    return res.json(updatedPayment);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[payments/verify]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/payments/callback ───────────────────────────────────────────────
// Moyasar redirects here after payment (GET with query params)

router.get('/callback', async (req, res) => {
  const { id: moyasarId, status, bookingId } = req.query as Record<string, string>;

  if (!moyasarId || !bookingId) {
    return res.redirect('/app/bookings?payment=error');
  }

  try {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.gatewayRef, moyasarId))
      .limit(1);

    if (payment && status === 'paid' && payment.status !== 'paid') {
      await db.update(payments)
        .set({ status: 'paid', paidAt: new Date() })
        .where(eq(payments.id, payment.id));
      await db.update(bookings)
        .set({ paymentStatus: 'paid', updatedAt: new Date() })
        .where(eq(bookings.id, payment.bookingId));
    }
  } catch (e) {
    console.error('[payments/callback]', e);
  }

  const redirectPath = status === 'paid'
    ? `/app/booking/${bookingId}?payment=success`
    : `/app/booking/${bookingId}?payment=failed`;

  return res.redirect(redirectPath);
});

// ─── POST /api/payments/refund/:id ────────────────────────────────────────────

router.post(
  '/refund/:id',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرّف الدفع غير صالح' });

      const { note } = z
        .object({ note: z.string().optional() })
        .parse(req.body);

      const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
      if (!payment) return res.status(404).json({ error: 'سجل الدفع غير موجود' });
      if (payment.status === 'refunded')
        return res.status(400).json({ error: 'تم استرداد هذه المدفوعات مسبقاً' });
      if (payment.status !== 'paid')
        return res.status(400).json({ error: 'لا يمكن استرداد مبلغ غير مدفوع' });

      // Tenant isolation — vendor_admin can only refund their own payments
      if (
        req.user!.role === 'vendor_admin' &&
        payment.vendorId !== req.user!.vendorId
      ) {
        return res.status(403).json({ error: 'غير مصرح لك بهذا الإجراء' });
      }

      const existingResponse = (payment.gatewayResponse as Record<string, unknown>) ?? {};
      const [updated] = await db
        .update(payments)
        .set({
          status: 'refunded',
          gatewayResponse: {
            ...existingResponse,
            refundNote: note ?? '',
            refundedAt: new Date().toISOString(),
          },
        })
        .where(eq(payments.id, id))
        .returning();

      await db
        .update(bookings)
        .set({ paymentStatus: 'refunded', updatedAt: new Date() })
        .where(eq(bookings.id, payment.bookingId));

      return res.json(updated);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// ─── GET /api/payments/booking/:id ────────────────────────────────────────────

router.get('/booking/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'معرّف الحجز غير صالح' });

    const [booking] = await db.select({ id: bookings.id, customerId: bookings.customerId, vendorId: bookings.vendorId })
      .from(bookings).where(eq(bookings.id, bookingId)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Customers can only see their own bookings
    if (req.user!.role === 'customer' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    // Vendor staff can only see their vendor's bookings
    if (req.user!.role === 'vendor_admin' && booking.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const result = await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .limit(1);

    if (!result.length) return res.status(404).json({ error: 'لا يوجد سجل دفع لهذا الحجز' });
    return res.json(result[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
