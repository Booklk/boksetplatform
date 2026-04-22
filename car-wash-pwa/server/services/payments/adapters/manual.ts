import type {
  PaymentAdapter, CheckoutInput, CheckoutResult,
  NormalizedPayment, WebhookVerification, RefundResult,
} from '../types.js';

/**
 * Manual "gateway" — for vendors who only accept cash, bank transfer, or
 * in-person card readers. No external API is called; the checkout step
 * just records the intent and marks it paid when the vendor confirms in
 * the dashboard. Keeps the same contract so the rest of the system
 * doesn't care whether a real gateway is configured.
 */
export const manual: PaymentAdapter = {
  slug: 'manual',
  labelAr: 'يدوي (نقد / تحويل / مكينة POS)',
  descriptionAr: 'بدون بوابة إلكترونية — تسجّل المدفوعات يدوياً من لوحة التحكم.',
  supportsWebhook: false,
  requiredFields: [],

  async createCheckout(_creds, input: CheckoutInput): Promise<CheckoutResult> {
    // Generate a deterministic-ish ref so refunds can reuse the same id.
    const ref = `manual_${input.metadata.bookingId ?? Date.now()}`;
    return { providerRef: ref, redirectUrl: input.returnUrl };
  },

  async fetchPayment(_creds, providerRef): Promise<NormalizedPayment> {
    return { providerRef, status: 'pending', amountSar: 0, metadata: {} };
  },

  verifyWebhook(): WebhookVerification {
    return { verified: false };
  },

  async refund(_creds, _providerRef): Promise<RefundResult> {
    // Manual refunds are a bookkeeping entry — success by default.
    return { success: true };
  },

  async testConnection() {
    return { ok: true, message: 'لا يحتاج اختبار — التسجيل اليدوي دائماً شغّال' };
  },
};
