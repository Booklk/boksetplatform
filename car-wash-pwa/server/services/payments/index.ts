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
  moyasar, tap, hyperpay, paytabs, stcpay, tabby, tamara, manual,
};

// Providers fall into two buyer-facing buckets — used for UI grouping
// ("ادفع بالبطاقة" vs "قسّم على دفعات").
const BNPL_SLUGS: readonly ProviderSlug[] = ['tabby', 'tamara'];
export const PROVIDER_KINDS: Record<ProviderSlug, 'card' | 'bnpl' | 'wallet' | 'manual'> = {
  moyasar: 'card', tap: 'card', hyperpay: 'card', paytabs: 'card',
  stcpay:  'wallet',
  tabby:   'bnpl', tamara:  'bnpl',
  manual:  'manual',
};

export function listProviders() {
  const seen = new Set<string>();
  const result: Array<{
    slug: ProviderSlug;
    labelAr: string;
    descriptionAr: string;
    supportsWebhook: boolean;
    requiredFields: PaymentAdapter['requiredFields'];
    kind: 'card' | 'bnpl' | 'wallet' | 'manual';
    supportedMethods: PaymentAdapter['supportedMethods'];
  }> = [];
  for (const adapter of Object.values(REGISTRY)) {
    if (seen.has(adapter.slug)) continue;
    seen.add(adapter.slug);
    result.push({
      slug: adapter.slug,
      labelAr: adapter.labelAr,
      descriptionAr: adapter.descriptionAr,
      supportsWebhook: adapter.supportsWebhook,
      requiredFields: adapter.requiredFields,
      kind: PROVIDER_KINDS[adapter.slug],
      supportedMethods: adapter.supportedMethods,
    });
  }
  return result;
}

export function getAdapter(slug: string | undefined | null): PaymentAdapter | null {
  if (!slug) return null;
  return REGISTRY[slug as ProviderSlug] ?? null;
}

// ─── Stored vendor credentials ─────────────────────────────────────────────

export interface ProviderEntry {
  enabled: boolean;
  lastVerifiedAt?: string;
  credentials: {
    publicKey?: string;
    secretKeyEnc?: string;
    webhookSecretEnc?: string;
    merchantId?: string;
    sandboxMode?: boolean;
    extra?: Record<string, string>;
  };
}

export interface StoredPaymentConfig {
  /** Which provider should be used by default (e.g. for platform-initiated
   *  recurring charges). If null, checkout requires an explicit provider. */
  defaultProvider: ProviderSlug | null;
  /** Each configured provider with its own credentials + enable toggle.
   *  One vendor can run Moyasar + Tabby + Tamara simultaneously. */
  providers: Partial<Record<ProviderSlug, ProviderEntry>>;
}

/** Migrate the old single-provider shape
 *      { provider, enabled, credentials, lastVerifiedAt }
 *  into the new multi-provider map. Safe to call on every read. */
function coerce(raw: unknown): StoredPaymentConfig {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  // New shape path
  if (r.providers && typeof r.providers === 'object') {
    return {
      defaultProvider: r.defaultProvider ?? null,
      providers: r.providers,
    };
  }
  // Legacy shape path
  if (r.provider && r.credentials) {
    const slug = r.provider as ProviderSlug;
    return {
      defaultProvider: slug,
      providers: {
        [slug]: {
          enabled: Boolean(r.enabled),
          lastVerifiedAt: r.lastVerifiedAt,
          credentials: r.credentials ?? {},
        },
      },
    };
  }
  return { defaultProvider: null, providers: {} };
}

export function decryptCreds(entry: ProviderEntry | undefined | null): PaymentCredentials {
  if (!entry) return {};
  const c = entry.credentials ?? {};
  return {
    publicKey:     c.publicKey,
    secretKey:     c.secretKeyEnc     ? safeDecrypt(c.secretKeyEnc)     : undefined,
    webhookSecret: c.webhookSecretEnc ? safeDecrypt(c.webhookSecretEnc) : undefined,
    merchantId:    c.merchantId,
    sandboxMode:   c.sandboxMode,
    extra:         c.extra,
  };
}

/** Redacted view safe to return to the dashboard. Never contains
 *  plaintext secrets — just "set or not" booleans. */
export function redactForClient(stored: StoredPaymentConfig): {
  defaultProvider: ProviderSlug | null;
  providers: Array<{
    slug: ProviderSlug;
    kind: 'card' | 'bnpl' | 'wallet' | 'manual';
    enabled: boolean;
    lastVerifiedAt: string | null;
    publicKey: string;
    merchantId: string;
    sandboxMode: boolean;
    secretKeySet: boolean;
    webhookSecretSet: boolean;
    extra: Record<string, string>;
  }>;
} {
  return {
    defaultProvider: stored.defaultProvider,
    providers: Object.entries(stored.providers).map(([slug, entry]) => ({
      slug: slug as ProviderSlug,
      kind: PROVIDER_KINDS[slug as ProviderSlug],
      enabled: Boolean(entry?.enabled),
      lastVerifiedAt: entry?.lastVerifiedAt ?? null,
      publicKey:       entry?.credentials?.publicKey ?? '',
      merchantId:      entry?.credentials?.merchantId ?? '',
      sandboxMode:     entry?.credentials?.sandboxMode ?? false,
      secretKeySet:    Boolean(entry?.credentials?.secretKeyEnc),
      webhookSecretSet: Boolean(entry?.credentials?.webhookSecretEnc),
      extra:           entry?.credentials?.extra ?? {},
    })),
  };
}

export interface SaveProviderInput {
  enabled?: boolean;
  credentials: {
    publicKey?: string;
    secretKey?: string;       // plain — encrypted on write
    webhookSecret?: string;   // plain — encrypted on write
    merchantId?: string;
    sandboxMode?: boolean;
    extra?: Record<string, string>;
  };
}

async function readConfig(vendorId: number): Promise<StoredPaymentConfig> {
  const [row] = await db.select({ paymentConfig: vendors.paymentConfig })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return coerce(row?.paymentConfig);
}

async function writeConfig(vendorId: number, cfg: StoredPaymentConfig) {
  await db.update(vendors)
    .set({ paymentConfig: cfg as any, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
}

/** Insert-or-update one provider. When the caller sends an empty
 *  secret field, we preserve the previous encrypted value — so the UI
 *  can safely render "●●●●" without leaking the secret. */
export async function saveProvider(
  vendorId: number,
  slug: ProviderSlug,
  input: SaveProviderInput,
): Promise<void> {
  const cfg = await readConfig(vendorId);
  const prev = cfg.providers[slug];
  const next: ProviderEntry = {
    enabled: input.enabled ?? prev?.enabled ?? false,
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
  cfg.providers[slug] = next;
  // First provider added becomes default automatically.
  if (!cfg.defaultProvider) cfg.defaultProvider = slug;
  await writeConfig(vendorId, cfg);
}

export async function removeProvider(vendorId: number, slug: ProviderSlug): Promise<void> {
  const cfg = await readConfig(vendorId);
  delete cfg.providers[slug];
  if (cfg.defaultProvider === slug) {
    const remaining = Object.keys(cfg.providers) as ProviderSlug[];
    cfg.defaultProvider = remaining[0] ?? null;
  }
  await writeConfig(vendorId, cfg);
}

export async function setProviderEnabled(
  vendorId: number, slug: ProviderSlug, enabled: boolean,
): Promise<void> {
  const cfg = await readConfig(vendorId);
  const entry = cfg.providers[slug];
  if (!entry) return;
  entry.enabled = enabled;
  await writeConfig(vendorId, cfg);
}

export async function setDefaultProvider(vendorId: number, slug: ProviderSlug | null): Promise<void> {
  const cfg = await readConfig(vendorId);
  if (slug && !cfg.providers[slug]) return; // can't default to unconfigured
  cfg.defaultProvider = slug;
  await writeConfig(vendorId, cfg);
}

export async function markVerified(vendorId: number, slug: ProviderSlug): Promise<void> {
  const cfg = await readConfig(vendorId);
  const entry = cfg.providers[slug];
  if (!entry) return;
  entry.lastVerifiedAt = new Date().toISOString();
  await writeConfig(vendorId, cfg);
}

export async function getStoredConfig(vendorId: number): Promise<StoredPaymentConfig> {
  return readConfig(vendorId);
}

/** Resolve one specific provider for a vendor (adapter + decrypted creds). */
export async function getVendorProvider(
  vendorId: number, slug: ProviderSlug,
): Promise<{ adapter: PaymentAdapter; creds: PaymentCredentials; entry: ProviderEntry } | null> {
  const cfg = await readConfig(vendorId);
  const entry = cfg.providers[slug];
  if (!entry?.enabled) return null;
  const adapter = getAdapter(slug);
  if (!adapter) return null;
  return { adapter, creds: decryptCreds(entry), entry };
}

/** All enabled providers for a vendor — what the storefront picker renders. */
export async function getEnabledProviders(vendorId: number): Promise<Array<{
  slug: ProviderSlug;
  kind: 'card' | 'bnpl' | 'wallet' | 'manual';
  labelAr: string;
  descriptionAr: string;
}>> {
  const cfg = await readConfig(vendorId);
  return (Object.entries(cfg.providers)
    .filter(([, e]) => e?.enabled)
    .map(([slug]) => {
      const adapter = REGISTRY[slug as ProviderSlug];
      if (!adapter) return null;
      return {
        slug: adapter.slug,
        kind: PROVIDER_KINDS[adapter.slug],
        labelAr: adapter.labelAr,
        descriptionAr: adapter.descriptionAr,
      };
    })
    .filter(Boolean)) as any;
}

function safeDecrypt(s: string): string | undefined {
  try { return decrypt(s); } catch { return undefined; }
}

/**
 * High-level: take a bookingId, return a hosted-checkout URL using the
 * vendor's default (or explicitly chosen) payment provider.
 *
 * Used by the WhatsApp bot to send deposit links to customers after a
 * booking is created — the same logic the storefront uses, just without
 * the HTTP layer in between.
 */
export async function createBookingCheckoutUrl(
  bookingId: number,
  opts: {
    amountSar?: number;          // override; defaults to booking.totalPrice
    providerSlug?: ProviderSlug; // override; defaults to vendor's default
    returnUrl?: string;
    description?: string;
  } = {},
): Promise<{ url: string; provider: ProviderSlug; amountSar: number } | null> {
  const { bookings, users, vendors: vendorsTable, packages, services } =
    await import('../../db/schema.js');

  const [booking] = await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    vendorId: bookings.vendorId,
    customerId: bookings.customerId,
    packageId: bookings.packageId,
    address: bookings.address,
    totalPrice: bookings.totalPrice,
  }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) return null;

  const cfg = await readConfig(booking.vendorId);
  const chosen = opts.providerSlug ?? cfg.defaultProvider;
  if (!chosen) return null;
  const vp = await getVendorProvider(booking.vendorId, chosen);
  if (!vp) return null;

  const [customer] = await db.select({
    name: users.name, phone: users.phone, email: users.email,
  }).from(users).where(eq(users.id, booking.customerId!)).limit(1);
  const [vendor] = await db.select({ city: vendorsTable.city })
    .from(vendorsTable).where(eq(vendorsTable.id, booking.vendorId)).limit(1);
  const [pkg] = booking.packageId ? await db.select({
    name: packages.name, serviceName: services.name,
  })
    .from(packages)
    .leftJoin(services, eq(services.id, packages.serviceId))
    .where(eq(packages.id, booking.packageId))
    .limit(1) : [null];

  const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').replace(/\/$/, '');
  const returnUrl = opts.returnUrl ?? `${clientUrl}/booking/${booking.id}/payment-return`;
  const amountSar = opts.amountSar ?? Number(booking.totalPrice ?? 0);
  if (!(amountSar > 0)) return null;
  const itemName = [pkg?.serviceName, pkg?.name].filter(Boolean).join(' — ')
    || `حجز #${booking.bookingNumber}`;

  const checkout = await vp.adapter.createCheckout(vp.creds, {
    amountSar,
    description: opts.description ?? `حجز #${booking.bookingNumber}`,
    returnUrl,
    metadata: {
      bookingId: String(booking.id),
      vendorId: String(booking.vendorId),
      provider: chosen,
    },
    customer: {
      name:        customer?.name ?? undefined,
      phone:       customer?.phone ?? undefined,
      email:       customer?.email ?? undefined,
      addressLine: booking.address ?? undefined,
      city:        vendor?.city ?? 'الرياض',
      country:     'SA',
    },
    items: [{
      name: itemName,
      quantity: 1,
      unitPriceSar: amountSar,
      reference: booking.bookingNumber,
    }],
  });

  if (!checkout?.url) return null;
  return { url: checkout.url, provider: chosen, amountSar };
}
