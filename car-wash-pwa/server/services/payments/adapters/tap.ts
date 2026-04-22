import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

const API = 'https://api.tap.company/v2';

function mapStatus(s: string): PaymentStatus {
  const v = String(s ?? '').toUpperCase();
  if (v === 'CAPTURED')                           return 'paid';
  if (v === 'AUTHORIZED')                         return 'authorized';
  if (v === 'INITIATED' || v === 'IN_PROGRESS')   return 'pending';
  if (v === 'REFUNDED')                           return 'refunded';
  if (v === 'EXPIRED')                            return 'expired';
  return 'failed';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.id),
    status: mapStatus(String(data.status ?? '')),
    amountSar: Number(data.amount ?? 0),
    paidAt: data.transaction?.created ? new Date(Number(data.transaction.created)) : undefined,
    failureReason: data.response?.message ?? undefined,
    metadata: (data.metadata ?? {}) as Record<string, string>,
  };
}

function headersFor(creds: PaymentCredentials) {
  return {
    Authorization: `Bearer ${creds.secretKey ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export const tap: PaymentAdapter = {
  slug: 'tap',
  labelAr: 'تاب (Tap Payments)',
  descriptionAr: 'مدى، فيزا، ماستركارد، آبل باي، KNET. منتشر خليجياً.',
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',     labelAr: 'المفتاح السري (sk_live_...)', type: 'password' },
    { key: 'publicKey',     labelAr: 'المفتاح العام (pk_live_...)', type: 'text',     optional: true },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك',                  type: 'password', optional: true },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${API}/charges`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify({
        amount: input.amountSar,
        currency: 'SAR',
        description: input.description,
        statement_descriptor: 'Jadawel',
        metadata: input.metadata,
        source: { id: 'src_all' },
        redirect: { url: input.returnUrl },
        post: { url: input.returnUrl.replace(/\/callback.*$/, '/webhook') },
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok || !body?.id) throw new Error(body?.errors?.[0]?.description ?? 'Tap checkout failed');
    return {
      providerRef: String(body.id),
      redirectUrl: body.transaction?.url ?? '',
    };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${API}/charges/${encodeURIComponent(providerRef)}`, {
      headers: headersFor(creds),
    });
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error('Tap fetch failed');
    return normalize(body);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    // Tap signs webhooks with hashstring — spec at
    // https://developers.tap.company/docs/webhook
    const provided = headers['hashstring'] ?? headers['Hashstring'] ?? '';
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('hex');
      if (provided !== expected) return { verified: false };
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    if (!parsed?.id) return { verified: false };
    return { verified: true, eventType: 'charge', payment: normalize(parsed) };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const res = await fetch(`${API}/refunds`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify({
        charge_id: providerRef,
        amount: amountSar,
        currency: 'SAR',
        reason: 'requested_by_customer',
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) return { success: false, error: body?.errors?.[0]?.description ?? 'refund failed' };
    return { success: true, refundRef: String(body.id) };
  },

  async testConnection(creds) {
    if (!creds.secretKey) return { ok: false, message: 'المفتاح السري مطلوب' };
    const res = await fetch(`${API}/charges/ch_test_does_not_exist`, { headers: headersFor(creds) });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'المفتاح غير صحيح' };
    // 404 = key valid but charge missing = what we want
    if (res.status === 404 || res.status === 200) return { ok: true, message: 'الاتصال ناجح ✓' };
    return { ok: false, message: `الاختبار فشل (${res.status})` };
  },
};
