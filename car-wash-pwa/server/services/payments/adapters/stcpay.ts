import crypto from 'crypto';
import type {
  PaymentAdapter, PaymentCredentials, CheckoutInput, CheckoutResult,
  NormalizedPayment, PaymentStatus, WebhookVerification, RefundResult,
} from '../types.js';

// STC Pay Merchant API — the real endpoints live behind NDA and vary per
// onboarding. We code against the public spec shape so vendors onboarded
// directly with STC can drop their credentials in without code changes.
const API = 'https://api.stcpay.com.sa/merchantPay/v1';

function headersFor(creds: PaymentCredentials) {
  return {
    Authorization: `Bearer ${creds.secretKey ?? ''}`,
    'Content-Type': 'application/json',
    'x-merchant-id': creds.merchantId ?? '',
  };
}

function mapStatus(s: string): PaymentStatus {
  const v = String(s ?? '').toUpperCase();
  if (v === 'PAID' || v === 'CAPTURED')  return 'paid';
  if (v === 'AUTHORIZED')                return 'authorized';
  if (v === 'PENDING' || v === 'OPEN')   return 'pending';
  if (v === 'REFUNDED')                  return 'refunded';
  if (v === 'EXPIRED')                   return 'expired';
  return 'failed';
}

function normalize(data: Record<string, any>): NormalizedPayment {
  return {
    providerRef: String(data.paymentId ?? data.stcPayPaymentReference ?? ''),
    status: mapStatus(String(data.status ?? '')),
    amountSar: Number(data.amount ?? 0),
    paidAt: data.paidAt ? new Date(String(data.paidAt)) : undefined,
    failureReason: data.errorMessage,
    metadata: (data.metadata ?? {}) as Record<string, string>,
  };
}

export const stcpay: PaymentAdapter = {
  slug: 'stcpay',
  labelAr: 'STC Pay',
  descriptionAr: 'المحفظة السعودية — دفع مباشر من تطبيق STC Pay.',
  supportedMethods: ['stc_pay'],
  supportsWebhook: true,
  requiredFields: [
    { key: 'secretKey',     labelAr: 'Access Key',     type: 'password' },
    { key: 'merchantId',    labelAr: 'Merchant ID',    type: 'text' },
    { key: 'webhookSecret', labelAr: 'سر الويبهوك',    type: 'password', optional: true },
  ],

  async createCheckout(creds, input: CheckoutInput): Promise<CheckoutResult> {
    const res = await fetch(`${API}/payments`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify({
        amount: input.amountSar,
        currency: 'SAR',
        description: input.description,
        callbackUrl: input.returnUrl,
        metadata: input.metadata,
      }),
    });
    const body = (await res.json()) as any;
    if (!res.ok || !body?.paymentId) throw new Error(body?.message ?? 'STC Pay checkout failed');
    return { providerRef: String(body.paymentId), redirectUrl: body.redirectUrl ?? body.paymentUrl ?? '' };
  },

  async fetchPayment(creds, providerRef) {
    const res = await fetch(`${API}/payments/${encodeURIComponent(providerRef)}`, { headers: headersFor(creds) });
    const body = (await res.json()) as any;
    if (!res.ok) throw new Error('STC Pay fetch failed');
    return normalize(body);
  },

  verifyWebhook(creds, rawBody, headers): WebhookVerification {
    const provided = headers['x-stcpay-signature'] ?? headers['X-STCPay-Signature'] ?? '';
    if (creds.webhookSecret) {
      const expected = crypto.createHmac('sha256', creds.webhookSecret).update(rawBody).digest('hex');
      if (provided !== expected) return { verified: false };
    }
    let parsed: any;
    try { parsed = JSON.parse(rawBody); } catch { return { verified: false }; }
    if (!parsed?.paymentId) return { verified: false };
    return { verified: true, eventType: String(parsed.eventType ?? 'payment'), payment: normalize(parsed) };
  },

  async refund(creds, providerRef, amountSar): Promise<RefundResult> {
    const res = await fetch(`${API}/payments/${encodeURIComponent(providerRef)}/refund`, {
      method: 'POST',
      headers: headersFor(creds),
      body: JSON.stringify({ amount: amountSar ?? undefined, currency: 'SAR' }),
    });
    const body = (await res.json()) as any;
    if (!res.ok) return { success: false, error: body?.message ?? 'refund failed' };
    return { success: true, refundRef: String(body.refundId) };
  },

  async testConnection(creds) {
    if (!creds.secretKey || !creds.merchantId) {
      return { ok: false, message: 'Access Key و Merchant ID مطلوبين' };
    }
    const res = await fetch(`${API}/health`, { headers: headersFor(creds) });
    if (res.status === 401 || res.status === 403) return { ok: false, message: 'المفاتيح غير صحيحة' };
    if (res.ok) return { ok: true, message: 'الاتصال ناجح ✓' };
    return { ok: false, message: `فشل الاختبار (${res.status})` };
  },
};
