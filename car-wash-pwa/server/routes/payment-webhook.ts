/**
 * Per-provider webhook receiver.
 *
 * URL shape: /api/payment-gateway/webhook/:vendorSlug/:providerSlug
 *
 * Each provider dashboard gets its own unique URL so the vendor can paste
 * the right one in the right place:
 *   https://jadawel.sa/api/payment-gateway/webhook/abc123/moyasar
 *   https://jadawel.sa/api/payment-gateway/webhook/abc123/tabby
 *   https://jadawel.sa/api/payment-gateway/webhook/abc123/tamara
 *
 * We verify signatures with that specific provider's credentials and
 * never trust the URL alone.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { vendors, vendorSubscriptionPayments } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  getAdapter, decryptCreds, getStoredConfig,
} from '../services/payments/index.js';
import type { ProviderSlug } from '../services/payments/types.js';

const router = Router();

interface RawRequest extends Request { rawBody?: string }

// Raw-body parser — HMAC verification needs exact bytes.
router.use('/', (req: RawRequest, _res: Response, next) => {
  let buf = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => { buf += chunk; });
  req.on('end', () => { req.rawBody = buf; next(); });
});

// Back-compat: some providers already configured with the old single-
// segment URL (/webhook/:vendorSlug) fall through to the vendor's
// defaultProvider automatically.
router.post('/:vendorSlug', (req, res) => handleWebhook(req as RawRequest, res, undefined));
router.post('/:vendorSlug/:providerSlug', (req, res) => handleWebhook(req as RawRequest, res, req.params.providerSlug as ProviderSlug));

async function handleWebhook(req: RawRequest, res: Response, providerSlug: ProviderSlug | undefined) {
  const { vendorSlug } = req.params as { vendorSlug: string };

  const [vendor] = await db.select({ id: vendors.id })
    .from(vendors).where(eq(vendors.slug, vendorSlug)).limit(1);
  if (!vendor) {
    console.warn('[payment webhook] unknown vendor slug', vendorSlug);
    return res.status(400).json({ ok: false });
  }

  const cfg = await getStoredConfig(vendor.id);
  const slug = providerSlug ?? cfg.defaultProvider ?? undefined;
  if (!slug) {
    console.warn('[payment webhook] no provider slug, no default', vendorSlug);
    return res.status(400).json({ ok: false });
  }
  const entry = cfg.providers[slug];
  if (!entry) {
    console.warn('[payment webhook] provider not configured', vendorSlug, slug);
    return res.status(400).json({ ok: false });
  }
  const adapter = getAdapter(slug);
  if (!adapter) return res.status(400).json({ ok: false });

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers[k.toLowerCase()] = v;
  }

  const verification = adapter.verifyWebhook(
    decryptCreds(entry),
    req.rawBody ?? '',
    headers,
  );

  if (!verification.verified || !verification.payment) {
    console.warn('[payment webhook] signature failed', vendorSlug, slug);
    return res.status(401).json({ ok: false });
  }

  res.json({ ok: true });

  try {
    const p = verification.payment;
    await db.insert(vendorSubscriptionPayments).values({
      vendorId: vendor.id,
      amount: String(p.amountSar),
      plan: 'external',
      status: p.status,
      paidAt: p.status === 'paid' ? (p.paidAt ?? new Date()) : null,
      notes: p.failureReason ?? null,
      ...({ gatewayRef: `${slug}:${p.providerRef}`, billingCycle: 'one_time' } as any),
    });
    const { bookingPaymentEvents } = await import('../services/payments/events.js');
    bookingPaymentEvents.emit(p.status, {
      vendorId: vendor.id,
      provider: slug,
      payment: p,
      metadata: p.metadata,
    });
  } catch (e) {
    console.error('[payment webhook persist]', e);
  }
}

export default router;
