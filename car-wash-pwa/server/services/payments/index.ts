import { db } from '../../db/index.js';
import { vendors } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt, encrypt } from '../../lib/crypto.js';
import type { PaymentAdapter, PaymentCredentials, ProviderSlug } from './types.js';

import { moyasar }   from './adapters/moyasar.js';
import { tap }       from './adapters/tap.js';
import { hyperpay }  from './adapters/hyperpay.js';
import { paytabs }   from './adapters/paytabs.js';
import { stcpay }    from './adapters/stcpay.js';
import { tabby }     from './adapters/tabby.js';
import { tamara }    from './adapters/tamara.js';
import { manual }    from './adapters/manual.js';

const REGISTRY: Record<ProviderSlug, PaymentAdapter> = {
  moyasar, tap, hyperpay, paytabs, stcpay,
  tabby, tamara,
  manual,
};

/** List every provider for the dashboard picker. Excludes aliases. */
export function listProviders(): Array<{
  slug: ProviderSlug;
  labelAr: string;
  descriptionAr: string;
  supportsWebhook: boolean;
  requiredFields: PaymentAdapter['requiredFields'];
}> {
  const seen = new Set<string>();
  const result: ReturnType<typeof listProviders> = [];
  for (const adapter of Object.values(REGISTRY)) {
    if (seen.has(adapter.slug)) continue;
    seen.add(adapter.slug);
    result.push({
      slug: adapter.slug,
      labelAr: adapter.labelAr,
      descriptionAr: adapter.descriptionAr,
      supportsWebhook: adapter.supportsWebhook,
      requiredFields: adapter.requiredFields,
    });
  }
  return result;
}

export function getAdapter(slug: string | undefined | null): PaymentAdapter | null {
  if (!slug) return null;
  return REGISTRY[slug as ProviderSlug] ?? null;
}

// ─── Stored vendor credentials ─────────────────────────────────────────────

/** Shape we store in vendors.paymentConfig. Sensitive fields are encrypted. */
export interface StoredPaymentConfig {
  provider: ProviderSlug | null;
  enabled: boolean;
  /** Last time "Test connection" succeeded — shown to the vendor. */
  lastVerifiedAt?: string;
  credentials: {
    publicKey?: string;
    /** AES-GCM base64. */
    secretKeyEnc?: string;
    /** AES-GCM base64. */
    webhookSecretEnc?: string;
    merchantId?: string;
    sandboxMode?: boolean;
    extra?: Record<string, string>;
  };
}

export function decryptCreds(stored: StoredPaymentConfig | null | undefined): PaymentCredentials {
  if (!stored) return {};
  const c = stored.credentials ?? {};
  return {
    publicKey:     c.publicKey,
    secretKey:     c.secretKeyEnc     ? safeDecrypt(c.secretKeyEnc)     : undefined,
    webhookSecret: c.webhookSecretEnc ? safeDecrypt(c.webhookSecretEnc) : undefined,
    merchantId:    c.merchantId,
    sandboxMode:   c.sandboxMode,
    extra:         c.extra,
  };
}

/** Redacted view safe to return to the dashboard. */
export function redactForClient(stored: StoredPaymentConfig | null | undefined) {
  if (!stored) return null;
  const c = stored.credentials ?? {};
  return {
    provider: stored.provider,
    enabled: stored.enabled,
    lastVerifiedAt: stored.lastVerifiedAt ?? null,
    credentials: {
      publicKey:       c.publicKey ?? '',
      merchantId:      c.merchantId ?? '',
      sandboxMode:     c.sandboxMode ?? false,
      secretKeySet:    Boolean(c.secretKeyEnc),
      webhookSecretSet: Boolean(c.webhookSecretEnc),
      extra:           c.extra ?? {},
    },
  };
}

export interface SaveCredsInput {
  provider: ProviderSlug;
  enabled?: boolean;
  credentials: {
    publicKey?: string;
    secretKey?: string;       // plain — will be encrypted
    webhookSecret?: string;   // plain — will be encrypted
    merchantId?: string;
    sandboxMode?: boolean;
    extra?: Record<string, string>;
  };
}

/** Upsert a vendor's payment config, encrypting secrets. When the vendor
 *  doesn't send a new secret, the previous encrypted value is preserved. */
export async function savePaymentConfig(vendorId: number, input: SaveCredsInput): Promise<void> {
  const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const prev = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;

  const next: StoredPaymentConfig = {
    provider: input.provider,
    enabled:  input.enabled ?? prev?.enabled ?? false,
    lastVerifiedAt: prev?.lastVerifiedAt,
    credentials: {
      publicKey:   input.credentials.publicKey   ?? prev?.credentials?.publicKey,
      merchantId:  input.credentials.merchantId  ?? prev?.credentials?.merchantId,
      sandboxMode: input.credentials.sandboxMode ?? prev?.credentials?.sandboxMode ?? true,
      extra:       input.credentials.extra       ?? prev?.credentials?.extra,
      secretKeyEnc:     input.credentials.secretKey
        ? encrypt(input.credentials.secretKey)
        : prev?.credentials?.secretKeyEnc,
      webhookSecretEnc: input.credentials.webhookSecret
        ? encrypt(input.credentials.webhookSecret)
        : prev?.credentials?.webhookSecretEnc,
    },
  };

  await db.update(vendors)
    .set({ paymentConfig: next as any, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
}

export async function markVerified(vendorId: number): Promise<void> {
  const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const prev = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;
  if (!prev) return;
  const next = { ...prev, lastVerifiedAt: new Date().toISOString() };
  await db.update(vendors)
    .set({ paymentConfig: next as any, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
}

export async function setEnabled(vendorId: number, enabled: boolean): Promise<void> {
  const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const prev = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;
  if (!prev) return;
  await db.update(vendors)
    .set({ paymentConfig: { ...prev, enabled } as any, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
}

/** Resolve a vendor's adapter + creds in one shot. Returns null if the
 *  vendor hasn't finished setting up payments yet. */
export async function getVendorPayment(vendorId: number): Promise<{ adapter: PaymentAdapter; creds: PaymentCredentials; config: StoredPaymentConfig } | null> {
  const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const config = (row?.paymentConfig ?? null) as StoredPaymentConfig | null;
  if (!config?.provider || !config.enabled) return null;
  const adapter = getAdapter(config.provider);
  if (!adapter) return null;
  return { adapter, creds: decryptCreds(config), config };
}

function safeDecrypt(s: string): string | undefined {
  try { return decrypt(s); } catch { return undefined; }
}
