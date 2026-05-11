/**
 * Moyasar webhook — receives payment events from Moyasar and keeps
 * vendor subscriptions in sync regardless of whether the browser
 * callback actually completed. Idempotent: re-receiving the same event
 * is a no-op.
 *
 * Configure in the Moyasar dashboard:
 *   URL:     https://<domain>/api/moyasar-webhook
 *   Events:  payment.paid, payment.failed, payment.refunded
 *   Secret:  set MOYASAR_WEBHOOK_SECRET (HMAC-SHA256 of raw body)
 *
 * We use a dedicated raw-body parser on this router so HMAC verification
 * sees the exact bytes Moyasar signed — the app-level express.json() at
 * /api/* would otherwise strip whitespace and break the signature.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { vendors, vendorSubscriptionPayments } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { sendPlatformWhatsApp } from '../services/whatsapp.js';

const router = Router();

interface RawRequest extends Request { rawBody?: string }

router.use('/', (req: RawRequest, _res: Response, next) => {
  let buf = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { buf += chunk; });
  req.on('end', () => {
    req.rawBody = buf;
    try { req.body = buf ? JSON.parse(buf) : {}; }
    catch { req.body = {}; }
    next();
  });
});

function verifySignature(req: RawRequest): boolean {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret) {
    // In production a missing secret means the webhook accepts anything,
    // which would let an attacker forge `payment.paid` events. Refuse.
    if (process.env.NODE_ENV === 'production') {
      console.error('[moyasar-webhook] MOYASAR_WEBHOOK_SECRET missing — rejecting in production');
      return false;
    }
    // Dev: allow so local testing without ngrok+secret keeps working.
    return true;
  }
  const provided = req.header('x-moyasar-signature') ?? '';
  const expected = crypto.createHmac('sha256', secret).update(req.rawBody ?? '').digest('hex');
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface MoyasarPayment {
  id?: string;
  amount?: number;
  metadata?: Record<string, string>;
  source?: { message?: string };
}

function resolveVendor(payment: MoyasarPayment): { vendorId: number; plan: string; cycle: string } | null {
  const md = payment.metadata ?? {};
  const vendorId = Number(md.vendorId ?? md.vendor_id);
  if (!Number.isFinite(vendorId) || vendorId <= 0) return null;
  return {
    vendorId,
    plan: String(md.plan ?? 'pro'),
    cycle: String(md.cycle ?? 'annual'),
  };
}

router.post('/', async (req: RawRequest, res: Response) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'invalid signature' });
  }

  const event = req.body as { type?: string; data?: MoyasarPayment };
  const type = event.type;
  const payment = event.data ?? {};
  const paymentId = String(payment.id ?? '');

  // Ack immediately so Moyasar doesn't retry while we work.
  res.json({ ok: true });

  try {
    const resolved = resolveVendor(payment);
    if (!resolved) {
      console.warn('[moyasar webhook] no vendor metadata on', paymentId, 'type=', type);
      return;
    }
    const { vendorId, plan, cycle } = resolved;

    const [vendor] = await db.select({
      phone: vendors.phone,
      nameAr: vendors.nameAr,
      subscriptionEndDate: vendors.subscriptionEndDate,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return;
    const notifyPhone = vendor.phone ?? '';

    // Idempotency: if we already recorded this gateway ref, bail.
    const already = await db.select({ id: vendorSubscriptionPayments.id })
      .from(vendorSubscriptionPayments)
      .where(and(
        eq(vendorSubscriptionPayments.vendorId, vendorId),
        // `gatewayRef` is schema-defined as text — cast via `as any` to avoid
        // a drizzle typing mismatch while the column is being migrated.
        eq((vendorSubscriptionPayments as any).gatewayRef, paymentId),
      ))
      .limit(1);

    const amountSar = Number(payment.amount ?? 0) / 100; // halalah → SAR

    if (type === 'payment.paid') {
      if (already.length > 0) return; // already handled via browser callback
      const isMonthly = cycle === 'monthly';
      const days = isMonthly ? 31 : 365;
      const base = vendor.subscriptionEndDate && vendor.subscriptionEndDate > new Date()
        ? new Date(vendor.subscriptionEndDate)
        : new Date();
      base.setDate(base.getDate() + days);
      await db.update(vendors).set({
        subscriptionStatus: 'active',
        subscriptionPlan: plan,
        subscriptionEndDate: base,
        subscriptionStartDate: new Date(),
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(vendors.id, vendorId));
      await db.insert(vendorSubscriptionPayments).values({
        vendorId,
        amount: String(amountSar),
        plan,
        status: 'paid',
        paidAt: new Date(),
        ...({ gatewayRef: paymentId, billingCycle: cycle } as any),
      });
      if (notifyPhone) await sendPlatformWhatsApp(
        notifyPhone,
        `✅ تم تفعيل اشتراكك في جداول — باقة ${plan}.\nأهلاً ${vendor.nameAr}!`,
      );
      return;
    }

    if (type === 'payment.failed') {
      await db.insert(vendorSubscriptionPayments).values({
        vendorId,
        amount: String(amountSar),
        plan,
        status: 'failed',
        notes: payment.source?.message ?? 'failed',
        ...({ gatewayRef: paymentId, billingCycle: cycle } as any),
      });
      if (notifyPhone) await sendPlatformWhatsApp(
        notifyPhone,
        `⚠️ فشل خصم اشتراك جداول. ممكن تحدّث بطاقتك من: https://jdawil.sa/vendor/platform-sub`,
      );
      return;
    }

    if (type === 'payment.refunded') {
      // Refund → downgrade to free, keep the record.
      await db.update(vendors).set({
        subscriptionStatus: 'active',
        subscriptionPlan: 'free',
        updatedAt: new Date(),
      }).where(eq(vendors.id, vendorId));
      await db.insert(vendorSubscriptionPayments).values({
        vendorId,
        amount: String(-amountSar),
        plan,
        status: 'refunded',
        ...({ gatewayRef: paymentId + ':refund', billingCycle: cycle } as any),
      });
      return;
    }
  } catch (e) {
    console.error('[moyasar webhook handler]', e);
  }
});

export default router;
