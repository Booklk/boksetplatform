import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

/**
 * Tamara — Saudi-founded BNPL.
 *
 * API docs: https://docs.tamara.co/reference
 * Base URLs:
 *   sandbox : https://api-sandbox.tamara.co
 *   prod    : https://api.tamara.co
 *
 * Flow:
 *   1. POST /checkout → returns `order_id` and `checkout_url`
 *   2. Buyer redirected to checkout_url, completes or fails
 *   3. Tamara POSTs webhook events (authorise, capture, cancel, refund)
 *      signed with the webhook secret (tamara-signature header)
 *   4. Capture (for authorised orders) : POST /payments/capture
 *   5. Refund                           : POST /payments/simplified-refund/{order_id}
 *
 * Required credentials:
 *   - secretKey     (API token from the Tamara merchant portal)
 *   - webhookSecret (Notification Key / webhook secret)
 *   - sandboxMode   (bool — start in sandbox until verified)
 */

function baseFor(creds: PaymentCredentials) {
  return creds.sandboxMode ? 'https://api-sandbox.tamara.co' : 'https://api.tamara.co';
}

function mapStatus(s: string): PaymentStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'approved' || v === 'authorised' || v === 'authorized') return 'authorized';
  if (v === 'captured' || v === 'paid' || v === 'fully_captured')   return 'paid';
  if (v === 'new' || v === 'pending')                               return 'pending';
  if (v === 'canceled' || v === 'cancelled' || v === 'declined')    return 'failed';
  if (v === 'refunded' || v === 'fully_refunded')                   return 'refunded';
  if (v === 'expired')                                              return 'expired';
  return 'pending';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  const amt = data.total_amount?.amount ?? data.amount?.amount ?? data.amount ?? 0;
  return {
    providerRef: String(data.order_id ?? data.id ?? ''),
    status: mapStatus(String(data.status ?? data.order_status ?? '')),
    amountSar: Number(amt),
    paidAt: data.captured_at ? new Date(String(data.captured_at)) : undefined,
    failureReason: data.rejection_reason ?? undefined,
    metadata: (data.merchant_meta ?? data.meta ?? {}) as Record<string, string>,
  };
}

function headersFor(creds: PaymentCredentials) {
  return {
    Authorization: `Bearer ${creds.secretKey ?? ''}`,
    'Content-Type': 'application/json',
  };
}

function money(n: number, currency = 'SAR') {
  return { amount: Number(n.toFixed(2)), currency };
}

export const tamara: PaymentAdapter = {
  slug: 'tamara',
  labelAr: 'تمارا (Tamara)',
  descriptionAr: 'قسّم الدفعة أو ادفع لاحقاً — سعودي المنشأ، مقبول في كل القطاعات.',
  supportedMethods: ['bnpl_4x', 'bnpl_later'],
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',     labelAr: 'API Token', type: 'password' },
    { key: 'webhookSecret', labelAr: 'Notification Key (سر الويبهوك)', type: 'password' },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const buyer = input.customer ?? {};
    if (!buyer.phone || !buyer.name) {
      throw new Error('تمارا تحتاج اسم وجوال العميل لإتمام الطلب');
    }
    // Split "محمد أحمد" into first/last to keep Tamara happy.
    const [firstName, ...rest] = (buyer.name ?? 'Customer').split(/\s+/).filter(Boolean);
    const lastName = rest.join(' ') || firstName;

    const items = (input.items && input.items.length > 0)
      ? input.items.map((i, idx) => ({
          name: i.name,
          type: 'Service',
          reference_id: i.reference ?? `item_${idx}`,
          sku: i.reference ?? `sku_${idx}`,
          quantity: i.quantity,
          total_amount: money(i.unitPriceSar * i.quantity),
          unit_price: money(i.unitPriceSar),
          tax_amount: money(0),
          discount_amount: money(0),
        }))
      : [{
          name: input.description,
          type: 'Service',
          reference_id: input.metadata.bookingId ?? 'item',
          sku: 'single',
          quantity: 1,
          total_amount: money(input.amountSar),
          unit_price: money(input.amountSar),
          tax_amount: money(0),
          discount_amount: money(0),
        }];

    const orderRef = input.metadata.bookingId ?? `bk_${Date.now()}`;
    const body = {
      order_reference_id: orderRef,
      total_amount: money(input.amountSar),
      description: input.description,
      country_code: buyer.country ?? 'SA',
      payment_type: 'PAY_BY_INSTALMENTS',
      instalments: 3,
      locale: 'ar_SA',
      items,
      consumer: {
        first_name: firstName || 'Customer',
        last_name: lastName,
        phone_number: buyer.phone,
        email: buyer.email ?? `${buyer.phone}@example.com`,
      },
      shipping_address: {
        first_name: firstName || 'Customer',
        last_name: lastName,
        phone_number: buyer.phone,
        line1: buyer.addressLine ?? 'N/A',
        city: buyer.city ?? 'Riyadh',
        country_code: buyer.country ?? 'SA',
      },
      billing_address: {
        first_name: firstName || 'Customer',
        last_name: lastName,
        phone_number: buyer.phone,
        line1: buyer.addressLine ?? 'N/A',
        city: buyer.city ?? 'Riyadh',
        country_code: buyer.country ?? 'SA',
      },
      merchant_url: {
        success:       input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tamara=success',
        failure:       input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tamara=failure',
        cancel:        input.returnUrl + (input.returnUrl.includes('?') ? '&' : '?') + 'tamara=cancel',
        notification:  input.returnUrl.replace(/\/callback.*$/, '/webhook'),
      },
      merchant_meta: input.metadata,
      platform: 'jadawel',
      is_mobile: false,
    };

    const res = await fetch(`${baseFor(creds)}/checkout`, {
      method: 'POST', headers: headersFor(creds), body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.order_id) {
      throw new Error(json?.message ?? json?.errors?.[0]?.error_code ?? 'Tamara checkout failed');
    }
    return { providerRef: String(json.order_id), redirectUrl: String(json.checkout_url) };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${baseFor(creds)}/orders/${encodeURIComponent(providerRef)}`, {
      headers: headersFor(creds),
    });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error('Tamara fetch failed');
    return normalize(json);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    const provided = headers['tamara-signature'] ?? headers['Tamara-Signature'] ?? '';
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('base64');
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
        if (!ok) return { verified: false };
      } catch { return { verified: false }; }
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    if (!parsed?.order_id) return { verified: false };
    return {
      verified: true,
      eventType: String(parsed.event_type ?? 'order'),
      payment: normalize(parsed),
    };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    // Tamara simplified-refund endpoint takes the order id + amount.
    const res = await fetch(`${baseFor(creds)}/payments/simplified-refund/${encodeURIComponent(providerRef)}`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify({
        total_amount: money(amountSar ?? 0),
        comment: 'Jadawel refund',
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json?.message ?? 'refund failed' };
    return { success: true, refundRef: String(json.refund_id ?? providerRef) };
  },

  async testConnection(creds) {
    if (!creds.secretKey) return { ok: false, message: 'API Token مطلوب' };
    // Lightweight ping: check the merchant settings endpoint.
    const res = await fetch(`${baseFor(creds)}/merchants/me`, { headers: headersFor(creds) });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'API Token غير صحيح' };
    if (res.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    // Some merchant-portal tokens can't call /merchants/me; fall back to
    // the BNPL-availability endpoint which accepts the same auth.
    const res2 = await fetch(`${baseFor(creds)}/checkout/payment-types?country=SA`, {
      headers: headersFor(creds),
    });
    if (res2.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    return { ok: false, message: `فشل الاختبار (${res.status})` };
  },
};
