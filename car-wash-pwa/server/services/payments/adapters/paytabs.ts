import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

// PayTabs — Saudi region endpoint. Non-Saudi profiles would need a different
// base; left as an `extra.region` escape hatch.
function baseFor(creds: PaymentCredentials) {
  const region = (creds.extra?.region ?? 'SAU').toUpperCase();
  const map: Record<string, string> = {
    SAU: 'https://secure.paytabs.sa',
    ARE: 'https://secure.paytabs.com',
    EGY: 'https://secure-egypt.paytabs.com',
    JOR: 'https://secure-jordan.paytabs.com',
  };
  return map[region] ?? map.SAU;
}

function mapStatus(s: string): PaymentStatus {
  const v = String(s ?? '').toLowerCase();
  if (v === 'a' || v === 'authorised') return 'authorized';
  if (v === 'p' || v === 'paid' || v === 'completed') return 'paid';
  if (v === 'h' || v === 'hold' || v === 'pending')   return 'pending';
  if (v === 'r' || v === 'refunded')                  return 'refunded';
  if (v === 'e' || v === 'expired')                   return 'expired';
  return 'failed';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.tran_ref ?? data.cart_id ?? ''),
    status: mapStatus(String(data.payment_result?.response_status ?? data.payment_result?.response_code ?? '')),
    amountSar: Number(data.cart_amount ?? data.amount ?? 0),
    failureReason: data.payment_result?.response_message,
    metadata: (data.user_defined ?? {}) as Record<string, string>,
  };
}

export const paytabs: PaymentAdapter = {
  slug: 'paytabs',
  labelAr: 'PayTabs',
  descriptionAr: 'بوابة خليجية — مدى، فيزا، آبل باي، STC Pay عبر PayTabs.',
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',   labelAr: 'Server Key',   type: 'password' },
    { key: 'merchantId',  labelAr: 'Profile ID',   type: 'text' },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك (Client Key)', type: 'password', optional: true },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${baseFor(creds)}/payment/request`, {
      method: 'POST',
      headers: { Authorization: creds.secretKey ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: creds.merchantId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: input.metadata.bookingId ?? `m_${Date.now()}`,
        cart_currency: 'SAR',
        cart_amount: input.amountSar,
        cart_description: input.description,
        callback: input.returnUrl.replace(/\/callback.*$/, '/webhook'),
        return: input.returnUrl,
        user_defined: input.metadata,
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok || !body?.tran_ref) throw new Error(body?.message ?? 'PayTabs checkout failed');
    return { providerRef: String(body.tran_ref), redirectUrl: body.redirect_url };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${baseFor(creds)}/payment/query`, {
      method: 'POST',
      headers: { Authorization: creds.secretKey ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: creds.merchantId, tran_ref: providerRef }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error('PayTabs fetch failed');
    return normalize(body);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    // PayTabs signs with Server Key via HMAC-SHA256 in the `signature` header.
    const provided = headers['signature'] ?? headers['Signature'] ?? '';
    if (creds.secretKey) {
      const expected = crypto.createHmac('sha256', creds.secretKey).update(rawBody).digest('hex');
      if (provided && provided !== expected) return { verified: false };
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    if (!parsed?.tran_ref) return { verified: false };
    return { verified: true, eventType: 'transaction', payment: normalize(parsed) };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const res = await fetch(`${baseFor(creds)}/payment/request`, {
      method: 'POST',
      headers: { Authorization: creds.secretKey ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile_id: creds.merchantId,
        tran_type: 'refund',
        tran_class: 'ecom',
        tran_ref: providerRef,
        cart_currency: 'SAR',
        cart_amount: amountSar ?? undefined,
        cart_description: 'Refund',
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) return { success: false, error: body?.message ?? 'refund failed' };
    return { success: true, refundRef: String(body.tran_ref) };
  },

  async testConnection(creds) {
    if (!creds.secretKey || !creds.merchantId) {
      return { ok: false, message: 'Server Key و Profile ID مطلوبين' };
    }
    // Query a known-missing transaction — a valid key returns a structured
    // "not found" response; an invalid one returns 401/403.
    const res = await fetch(`${baseFor(creds)}/payment/query`, {
      method: 'POST',
      headers: { Authorization: creds.secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: creds.merchantId, tran_ref: 'TST0000000000' }),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'المفاتيح غير صحيحة' };
    return { ok: true, message: 'الاتصال ناجح ✓' };
  },
};
