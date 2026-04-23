import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

/**
 * Tabby — "Buy now, pay later" integration.
 *
 * API docs: https://docs.tabby.ai
 * Base URL: https://api.tabby.ai
 *
 * Flow:
 *   1. createCheckout  → POST /api/v2/checkout (session). Response includes
 *      `configuration.available_products.installments[0].web_url` which we
 *      redirect the buyer to. Session id is what we track as providerRef.
 *   2. The buyer completes (or fails) on Tabby's page → hits our returnUrl.
 *   3. Tabby also POSTs the canonical event to our webhook with a HMAC
 *      signature we verify.
 *   4. refund → POST /api/v1/payments/{payment_id}/refunds
 *
 * Credentials required:
 *   - secretKey     (sk_live_... / sk_test_...)
 *   - merchantId    (merchant_code assigned by Tabby)
 *   - webhookSecret (HMAC key from the Tabby dashboard)
 */

const API = 'https://api.tabby.ai';

function mapStatus(s: string): PaymentStatus {
  const v = String(s ?? '').toUpperCase();
  if (v === 'AUTHORIZED')                           return 'authorized';
  if (v === 'CLOSED' || v === 'CAPTURED' || v === 'PAID') return 'paid';
  if (v === 'CREATED' || v === 'PENDING')           return 'pending';
  if (v === 'REFUNDED')                             return 'refunded';
  if (v === 'EXPIRED')                              return 'expired';
  return 'failed';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.id ?? ''),
    status:      mapStatus(String(data.status ?? '')),
    amountSar:   Number(data.amount ?? 0),
    paidAt:      data.captured_at ? new Date(String(data.captured_at)) : undefined,
    failureReason: data.rejection_reason ?? data.error?.message,
    metadata:    (data.meta ?? {}) as Record<string, string>,
  };
}

function headersFor(creds: PaymentCredentials, usePublic = false) {
  const key = usePublic ? creds.publicKey : creds.secretKey;
  return {
    Authorization: `Bearer ${key ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export const tabby: PaymentAdapter = {
  slug: 'tabby',
  labelAr: 'تابي (Tabby)',
  descriptionAr: 'قسّم الدفعة على 4 دفعات بدون فوائد — شائع جداً في السعودية.',
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',     labelAr: 'المفتاح السري (sk_live_...)',    type: 'password' },
    { key: 'publicKey',     labelAr: 'المفتاح العام (pk_live_...)',     type: 'text',     optional: true },
    { key: 'merchantId',    labelAr: 'رمز التاجر (Merchant Code)',       type: 'text' },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك',                       type: 'password', optional: true },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const buyer = input.customer ?? {};
    const phone = buyer.phone ?? '';
    const email = buyer.email ?? '';
    const name  = buyer.name ?? 'Customer';
    if (!email || !phone) {
      // Tabby requires both for risk assessment. Fail early with a clear msg.
      throw new Error('تابي يحتاج اسم، إيميل، وجوال العميل لإتمام التقسيط');
    }

    const items = (input.items && input.items.length > 0)
      ? input.items.map((i) => ({
          title: i.name,
          quantity: i.quantity,
          unit_price: String(i.unitPriceSar.toFixed(2)),
          category: 'service',
          reference_id: i.reference ?? '',
        }))
      : [{
          title: input.description,
          quantity: 1,
          unit_price: String(input.amountSar.toFixed(2)),
          category: 'service',
          reference_id: input.metadata.bookingId ?? '',
        }];

    const body = {
      payment: {
        amount: String(input.amountSar.toFixed(2)),
        currency: 'SAR',
        description: input.description,
        buyer: { phone, email, name },
        shipping_address: {
          city:    buyer.city ?? 'Riyadh',
          address: buyer.addressLine ?? 'N/A',
          zip:     '00000',
        },
        order: {
          reference_id: input.metadata.bookingId ?? `bk_${Date.now()}`,
          items,
        },
        meta: input.metadata,
      },
      merchant_code: creds.merchantId ?? '',
      lang: 'ar',
      merchant_urls: {
        success: input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tabby=success',
        cancel:  input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tabby=cancel',
        failure: input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tabby=failure',
      },
    };

    const res = await fetch(`${API}/api/v2/checkout`, {
      method: 'POST', headers: headersFor(creds), body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.id) {
      throw new Error(json?.error?.message ?? json?.message ?? 'Tabby checkout failed');
    }

    // Tabby returns an array of products; pay_in_installments is the common one.
    const available = json.configuration?.available_products?.installments?.[0];
    const redirectUrl = available?.web_url ?? json.configuration?.available_products?.pay_later?.[0]?.web_url ?? '';
    if (!redirectUrl) {
      // Rejected for risk — tell the caller so the UI can fall back to cards.
      throw new Error(json.configuration?.products?.installments?.rejection_reason ?? 'Tabby رفض طلب التقسيط لهذا المستخدم');
    }

    return { providerRef: String(json.id), redirectUrl };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${API}/api/v2/checkout/${encodeURIComponent(providerRef)}`, {
      headers: headersFor(creds),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error('Tabby fetch failed');
    // The checkout object wraps a payment; normalise either shape.
    return normalize(json.payment ?? json);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    const provided = headers['x-tabby-signature'] ?? headers['X-Tabby-Signature'] ?? '';
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('hex');
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
        if (!ok) return { verified: false };
      } catch { return { verified: false }; }
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    if (!parsed?.id) return { verified: false };
    return {
      verified: true,
      eventType: String(parsed.event_type ?? parsed.type ?? 'payment'),
      payment: normalize(parsed),
    };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const res = await fetch(`${API}/api/v1/payments/${encodeURIComponent(providerRef)}/refunds`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify(amountSar !== undefined ? { amount: String(amountSar.toFixed(2)) } : {}),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json?.error?.message ?? 'refund failed' };
    return { success: true, refundRef: String(json.id) };
  },

  async testConnection(creds) {
    if (!creds.secretKey)  return { ok: false, message: 'المفتاح السري مطلوب' };
    if (!creds.merchantId) return { ok: false, message: 'رمز التاجر مطلوب' };
    // /api/v2/me returns the merchant profile when authed. Good ping.
    const res = await fetch(`${API}/api/v2/me`, { headers: headersFor(creds) });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'المفاتيح غير صحيحة' };
    if (res.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    // /api/v2/me sometimes 404s on certain keys — fall back to a
    // configuration endpoint as a secondary ping.
    const res2 = await fetch(`${API}/api/v1/installments/available`, { headers: headersFor(creds) });
    if (res2.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    return { ok: false, message: `فشل الاختبار (${res.status})` };
  },
};
