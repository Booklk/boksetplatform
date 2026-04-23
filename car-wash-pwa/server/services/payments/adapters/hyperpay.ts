import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

/**
 * HyperPay / Mada Integrated Solution (COPYandPAY).
 * Uses entityId per payment brand — default is mada. Vendors that want
 * credit cards too would add the VISA/MASTER entity in `extra.entityIdCard`.
 */
function entity(creds: PaymentCredentials): string {
  return creds.extra?.entityId ?? creds.merchantId ?? '';
}

function base(creds: PaymentCredentials) {
  return creds.sandboxMode
    ? 'https://eu-test.oppwa.com/v1'
    : 'https://eu-prod.oppwa.com/v1';
}

function authHeader(creds: PaymentCredentials) {
  return { Authorization: `Bearer ${creds.secretKey ?? ''}`, 'Content-Type': 'application/x-www-form-urlencoded' };
}

function mapResult(code: string): PaymentStatus {
  // HyperPay result codes — https://hyperpay.docs.oppwa.com/reference/resultCodes
  if (/^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.0|000\.400\.100)/.test(code)) return 'paid';
  if (/^(000\.200)/.test(code))                                                    return 'pending';
  if (/^(800\.400\.5|100\.400\.500)/.test(code))                                    return 'pending';
  return 'failed';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.id ?? data.merchantTransactionId ?? ''),
    status: mapResult(String(data.result?.code ?? '')),
    amountSar: Number(data.amount ?? 0),
    paidAt: data.timestamp ? new Date(String(data.timestamp)) : undefined,
    failureReason: data.result?.description,
    metadata: (data.customParameters ?? {}) as Record<string, string>,
  };
}

export const hyperpay: PaymentAdapter = {
  slug: 'hyperpay',
  labelAr: 'HyperPay',
  descriptionAr: 'بوابة بنكية سعودية — مدى + فيزا + ماستركارد. شائعة في البنوك المحلية.',
  supportedMethods: ['mada', 'credit_card', 'apple_pay', 'stc_pay'],
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',    labelAr: 'Access Token',  type: 'password' },
    { key: 'merchantId',   labelAr: 'Entity ID',     type: 'text', helpAr: 'رقم الجهة الخاص بمدى أو الفيزا' },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك',  type: 'password', optional: true },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const body = new URLSearchParams();
    body.set('entityId', entity(creds));
    body.set('amount', input.amountSar.toFixed(2));
    body.set('currency', 'SAR');
    body.set('paymentType', 'DB');
    body.set('merchantTransactionId', input.metadata.bookingId ?? `m_${Date.now()}`);
    for (const [k, v] of Object.entries(input.metadata)) {
      body.set(`customParameters[${k}]`, v);
    }
    const res = await fetch(`${base(creds)}/checkouts`, {
      method: 'POST', headers: authHeader(creds), body: body.toString(),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.id) throw new Error(json?.result?.description ?? 'HyperPay checkout failed');
    return {
      providerRef: String(json.id),
      redirectUrl: `${input.returnUrl}?checkoutId=${json.id}`,
    };
  },

  async fetchPayment(creds, providerRef) {
    const url = `${base(creds)}/checkouts/${encodeURIComponent(providerRef)}/payment?entityId=${encodeURIComponent(entity(creds))}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.secretKey ?? ''}` } });
    const json = (await res.json()) as any;
    if (!res.ok) throw new Error('HyperPay fetch failed');
    return normalize(json);
  },

  verifyWebhook(creds, rawBody, _headers): WebhookVerification {
    // HyperPay uses AES-GCM encrypted payload; for HMAC fallback we just
    // hash the body and compare to a header the vendor configures.
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('hex');
      const provided = _headers['x-signature'] ?? _headers['X-Signature'] ?? '';
      if (provided && provided !== expected) return { verified: false };
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    const payload = parsed?.payload ?? parsed;
    if (!payload?.id) return { verified: false };
    return { verified: true, eventType: String(parsed.type ?? 'PAYMENT'), payment: normalize(payload) };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const body = new URLSearchParams();
    body.set('entityId', entity(creds));
    body.set('paymentType', 'RF');
    if (amountSar !== undefined) body.set('amount', amountSar.toFixed(2));
    body.set('currency', 'SAR');
    const res = await fetch(`${base(creds)}/payments/${encodeURIComponent(providerRef)}`, {
      method: 'POST', headers: authHeader(creds), body: body.toString(),
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { success: false, error: json?.result?.description ?? 'refund failed' };
    return { success: true, refundRef: String(json.id) };
  },

  async testConnection(creds) {
    if (!creds.secretKey) return { ok: false, message: 'Access Token مطلوب' };
    if (!entity(creds))   return { ok: false, message: 'Entity ID مطلوب' };
    // HyperPay doesn't have a cheap "ping" — try a tiny dry checkout.
    const body = new URLSearchParams({ entityId: entity(creds), amount: '1.00', currency: 'SAR', paymentType: 'DB' });
    const res = await fetch(`${base(creds)}/checkouts`, { method: 'POST', headers: authHeader(creds), body: body.toString() });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'المفاتيح غير صحيحة' };
    return { ok: res.ok, message: res.ok ? 'الاتصال ناجح ✓' : `فشل الاختبار (${res.status})` };
  },
};
