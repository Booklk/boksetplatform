/**
 * Generic inbound payment webhook.
 *
 * URL shape: /api/payment-gateway/webhook/:vendorSlug
 *
 * The right adapter is resolved from the vendor's stored config and its
 * verifyWebhook() checks the signature. We never trust the URL alone —
 * a rogue POST with a vendor's slug and no valid signature is rejected.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { vendors, vendorSubscriptionPayments } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getAdapter, decryptCreds, StoredPaymentConfig } from '../services/payments/index.js';

const router = Router();

interface RawRequest extends Request { rawBody?: string }

// Raw-body parser — HMAC verification needs the exact bytes the provider signed.
router.use('/', (req: RawRequest, _res: Response, next) => {
  let buf = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { buf += chunk; });
  req.on('end', () => { req.rawBody = buf; next(); });
});

router.post('/:vendorSlug', async (req: RawRequest, res: Response) => {
  const { vendorSlug } = req.params;

  const [vendor] = await db.select({
    id: vendors.id,
    paymentConfig: vendors.paymentConfig,
  }).from(vendors).where(eq(vendors.slug, vendorSlug)).limit(1);

  // Always respond 200 within a reasonable window so providers don't retry
  // while we work. Bad requests we still 200 for but log loudly.
  const ack = (ok = true) => res.status(ok ? 200 : 400).json({ ok });

  if (!vendor) { console.warn('[payment webhook] unknown vendor slug', vendorSlug); return ack(false); }

  const config = (vendor.paymentConfig ?? null) as StoredPaymentConfig | null;
  if (!config?.provider) return ack(false);
  const adapter = getAdapter(config.provider);
  if (!adapter) return ack(false);

  // Flatten headers to lowercase for adapter consumption.
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k.toLowerCase()] = v;
  }

  const verification = adapter.verifyWebhook(
    decryptCreds(config),
    req.rawBody ?? '',
    headers,
  );

  if (!verification.verified || !verification.payment) {
    console.warn('[payment webhook] invalid signature for', vendorSlug, adapter.slug);
    return res.status(401).json({ ok: false });
  }

  res.json({ ok: true });

  // Post-ack work: persist the event so finance / reconciliation have a
  // record, then let vendor-specific listeners (bookings, subscriptions)
  // react. Kept in a try/catch so provider retries don't cascade.
  try {
    const p = verification.payment;
    await db.insert(vendorSubscriptionPayments).values({
      vendorId: vendor.id,
      amount: String(p.amountSar),
      plan: 'external',
      status: p.status,
      paidAt: p.status === 'paid' ? (p.paidAt ?? new Date()) : null,
      notes: p.failureReason ?? null,
      ...({ gatewayRef: p.providerRef, billingCycle: 'one_time' } as any),
    });

    // If the metadata included a bookingId, the bookings module can pick
    // it up from here. We dispatch via event emitter to keep this file
    // free of booking-specific logic.
    const { bookingPaymentEvents } = await import('../services/payments/events.js');
    bookingPaymentEvents.emit(p.status, {
      vendorId: vendor.id,
      provider: adapter.slug,
      payment: p,
      metadata: p.metadata,
    });
  } catch (e) {
    console.error('[payment webhook persist]', e);
  }
});

export default router;
