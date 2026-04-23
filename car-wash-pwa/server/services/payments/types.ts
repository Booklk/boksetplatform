/**
 * Payment gateway abstraction.
 *
 * Goal: vendors can plug in any supported provider by entering API keys
 * in the dashboard — no engineering work per vendor. The rest of the
 * codebase (bookings, POS, invoices) talks to `PaymentAdapter` only.
 *
 * To add a new provider:
 *   1. Implement `PaymentAdapter` in `adapters/<slug>.ts`
 *   2. Register it in `./index.ts` under the same slug
 *   3. Add a UI row in `PaymentGatewaySettings.tsx` with the fields you need
 *
 * All amounts are in SAR (the minor-unit — halalah — conversion is the
 * adapter's responsibility). Currency support is SAR-first; other currencies
 * may be added later without changing this contract.
 */

export type ProviderSlug =
  | 'moyasar'
  | 'tap'
  | 'hyperpay'
  | 'paytabs'
  | 'stcpay'
  | 'tabby'
  | 'tamara'
  | 'manual'; // cash / bank transfer — recorded, not charged

export interface PaymentCredentials {
  /** Public/merchant id (safe to surface in the dashboard for confirmation). */
  publicKey?: string;
  /** Secret API key (AES-encrypted at rest). */
  secretKey?: string;
  /** Webhook verification secret (AES-encrypted at rest). */
  webhookSecret?: string;
  /** Provider-specific merchant id, entity id, profile id, etc. */
  merchantId?: string;
  /** True until the vendor flips sandbox off after a successful test. */
  sandboxMode?: boolean;
  /** Any provider-specific extras we don't want to bake into the type. */
  extra?: Record<string, string>;
}

export interface CheckoutInput {
  amountSar: number;            // e.g. 99.00
  description: string;
  /** Where the provider should bounce the user back to after payment. */
  returnUrl: string;
  /** Opaque data we want back on every webhook for this payment. */
  metadata: Record<string, string>;
  /** Optional saved-card reference for recurring charges. */
  savedSourceId?: string;
  /** Buyer details — required by BNPL providers (Tabby/Tamara), optional
   *  for credit-card gateways that collect the info on the hosted page. */
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    /** Address is mandatory for Tamara; keep both street and city when available. */
    addressLine?: string;
    city?: string;
    country?: string; // defaults to "SA"
  };
  /** Line items — BNPL providers itemise the purchase. */
  items?: Array<{
    name: string;
    quantity: number;
    /** Unit price in SAR (not halalah). */
    unitPriceSar: number;
    reference?: string;
  }>;
}

export interface CheckoutResult {
  providerRef: string;          // payment id used by the provider
  redirectUrl: string;          // where the UI should send the user
  expiresAt?: Date;
}

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'expired';

export interface NormalizedPayment {
  providerRef: string;
  status: PaymentStatus;
  amountSar: number;
  paidAt?: Date;
  failureReason?: string;
  metadata: Record<string, string>;
  /** Optional source id that the adapter can reuse for recurring charges. */
  savedSourceId?: string;
}

export interface WebhookVerification {
  verified: boolean;
  /** Normalized payment derived from the webhook body. */
  payment?: NormalizedPayment;
  /** Raw event type the provider reported, for audit. */
  eventType?: string;
}

export interface RefundResult {
  success: boolean;
  refundRef?: string;
  error?: string;
}

export interface PaymentAdapter {
  slug: ProviderSlug;
  /** Arabic label shown in the dashboard. */
  labelAr: string;
  /** Short explainer shown under the label. */
  descriptionAr: string;
  /** Which credential fields this provider needs. UI renders these dynamically. */
  requiredFields: Array<{
    key: keyof PaymentCredentials | `extra.${string}`;
    labelAr: string;
    type: 'text' | 'password';
    helpAr?: string;
    optional?: boolean;
  }>;
  /** Some providers don't use per-vendor webhooks (e.g. Manual). */
  supportsWebhook: boolean;

  /** Create a hosted checkout session. */
  createCheckout(creds: PaymentCredentials, input: CheckoutInput): Promise<CheckoutResult>;
  /** Fetch the current status of a payment by its provider ref. */
  fetchPayment(creds: PaymentCredentials, providerRef: string): Promise<NormalizedPayment>;
  /** Validate + parse an inbound webhook. Must be pure — no DB writes. */
  verifyWebhook(creds: PaymentCredentials, rawBody: string, headers: Record<string, string>): WebhookVerification;
  /** Issue a full or partial refund. */
  refund(creds: PaymentCredentials, providerRef: string, amountSar?: number): Promise<RefundResult>;
  /** Quick "are these keys valid" check — used by the Test button. */
  testConnection(creds: PaymentCredentials): Promise<{ ok: boolean; message: string }>;
}
