import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

const API = 'https://api.moyasar.com/v1';

function auth(creds: PaymentCredentials): string {
  const key = creds.secretKey ?? '';
  return 'Basic ' + Buffer.from(key + ':').toString('base64');
}

function mapStatus(s: string): PaymentStatus {
  switch (s) {
    case 'paid':       return 'paid';
    case 'authorized': return 'authorized';
    case 'initiated':
    case 'pending':    return 'pending';
    case 'refunded':   return 'refunded';
    case 'expired':    return 'expired';
    default:           return 'failed';
  }
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.id),
    status: mapStatus(String(data.status ?? '')),
    amountSar: Number(data.amount ?? 0) / 100,
    paidAt: data.created_at ? new Date(String(data.created_at)) : undefined,
    failureReason: data.source?.message ?? undefined,
    metadata: (data.metadata ?? {}) as Record<string, string>,
  };
}

export const moyasar: PaymentAdapter = {
  slug: 'moyasar',
  labelAr: 'ميسر (Moyasar)',
  descriptionAr: 'بطاقات مدى والائتمان وآبل باي. شائع في السوق السعودي.',
  supportsWebhook: true,
  requiredFields: [
    { key: 'publicKey',     labelAr: 'المفتاح العام (Publishable)', type: 'text',     helpAr: 'يبدأ عادة بـ pk_live_ أو pk_test_' },
    { key: 'secretKey',     labelAr: 'المفتاح السري (Secret)',     type: 'password', helpAr: 'يبدأ عادة بـ sk_live_ أو sk_test_' },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك',                 type: 'password', optional: true, helpAr: 'اختياري — لتأكيد هوية الإشعارات' },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${API}/payments`, {
      method: 'POST',
      headers: { Authorization: auth(creds), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(input.amountSar * 100),
        currency: 'SAR',
        description: input.description,
        callback_url: input.returnUrl,
        source: { type: 'creditcard' },
        metadata: input.metadata,
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok || body.errors) {
      throw new Error(body?.message ?? 'Moyasar checkout failed');
    }
    return {
      providerRef: String(body.id),
      redirectUrl: body.source?.transaction_url ?? body.url ?? '',
    };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${API}/payments/${encodeURIComponent(providerRef)}`, {
      headers: { Authorization: auth(creds) },
    });
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error(body?.message ?? 'Moyasar fetch failed');
    return normalize(body);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    const provided = headers['x-moyasar-signature'] ?? headers['X-Moyasar-Signature'] ?? '';
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('hex');
      let ok = false;
      try {
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch { ok = false; }
      if (!ok) return { verified: false };
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    const data = parsed?.data ?? parsed;
    if (!data?.id) return { verified: false };
    return {
      verified: true,
      eventType: String(parsed.type ?? 'payment'),
      payment: normalize(data),
    };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const res = await fetch(`${API}/payments/${encodeURIComponent(providerRef)}/refund`, {
      method: 'POST',
      headers: { Authorization: auth(creds), 'Content-Type': 'application/json' },
      body: amountSar ? JSON.stringify({ amount: Math.round(amountSar * 100) }) : undefined,
    });
    const body = (await res.json()) as any;
    if (!res.ok) return { success: false, error: body?.message ?? 'refund failed' };
    return { success: true, refundRef: String(body.id) };
  },

  async testConnection(creds) {
    if (!creds.secretKey) return { ok: false, message: 'المفتاح السري مطلوب' };
    const res = await fetch(`${API}/payments?limit=1`, { headers: { Authorization: auth(creds) } });
    if (res.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    if (res.status === 401) return { ok: false, message: 'المفتاح غير صحيح' };
    return { ok: false, message: `الاختبار فشل (${res.status})` };
  },
};
