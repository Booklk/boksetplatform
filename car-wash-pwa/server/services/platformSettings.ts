/**
 * Platform settings service — DB-backed config the super-admin manages from
 * the UI. Replaces hard-coded process.env reads in the runtime hot path.
 *
 * Encrypted values are stored AES-256-GCM. Reads are cached for 30s to keep
 * push/payments/sentry calls cheap. Writes invalidate the cache.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { platformSettings } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/crypto.js';

export type PlatformSettingKey =
  | 'moyasar.apiKey'
  | 'whatsapp.defaultToken'
  | 'whatsapp.defaultPhoneId'
  | 'vapid.publicKey'
  | 'vapid.privateKey'
  | 'vapid.email'
  | 'sentry.dsn'
  | 'firebase.config'
  | 'openai.apiKey'
  | 'openai.model'
  | 'platform.domain'
  | 'platform.trialDays'
  | 'platform.supportPhone'
  | 'platform.supportEmail'
  | 'platform.platformName';

const ENCRYPTED_KEYS: Set<PlatformSettingKey> = new Set([
  'moyasar.apiKey',
  'whatsapp.defaultToken',
  'whatsapp.defaultPhoneId',
  'vapid.privateKey',
  'openai.apiKey',
]);

export const SECRET_PLACEHOLDER = '••••••••';

interface CacheEntry {
  value: string | null;
  expires: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000;

function envFallback(key: PlatformSettingKey): string | null {
  const map: Record<PlatformSettingKey, string | undefined> = {
    'moyasar.apiKey':          process.env.MOYASAR_API_KEY,
    'whatsapp.defaultToken':   process.env.WHATSAPP_TOKEN,
    'whatsapp.defaultPhoneId': process.env.WHATSAPP_PHONE_ID,
    'vapid.publicKey':         process.env.VAPID_PUBLIC_KEY,
    'vapid.privateKey':        process.env.VAPID_PRIVATE_KEY,
    'vapid.email':             process.env.VAPID_EMAIL,
    'sentry.dsn':              process.env.SENTRY_DSN,
    'firebase.config':         process.env.FIREBASE_CONFIG,
    'openai.apiKey':           process.env.OPENAI_API_KEY,
    'openai.model':            process.env.OPENAI_MODEL,
    'platform.domain':         process.env.DOMAIN,
    'platform.trialDays':      process.env.TRIAL_DAYS,
    'platform.supportPhone':   process.env.SUPPORT_PHONE,
    'platform.supportEmail':   process.env.SUPPORT_EMAIL,
    'platform.platformName':   process.env.PLATFORM_NAME,
  };
  return map[key] ?? null;
}

/**
 * Read a setting. Returns the DB value (decrypted if needed), or the env
 * fallback if not set in DB, or `null` if neither exists.
 */
export async function getSetting(key: PlatformSettingKey): Promise<string | null> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value: string | null = null;
  try {
    const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    if (row?.value) {
      value = row.isEncrypted ? decrypt(row.value) : row.value;
    }
  } catch (e) {
    // DB might be down or migrations not applied yet — fall through to env
  }

  if (value == null) value = envFallback(key);

  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
  return value;
}

/** Read multiple settings in parallel. */
export async function getSettings(keys: PlatformSettingKey[]): Promise<Record<string, string | null>> {
  const entries = await Promise.all(keys.map(async (k) => [k, await getSetting(k)] as const));
  return Object.fromEntries(entries);
}

/** Set/update a single setting. Encrypts based on the key's classification. */
export async function setSetting(
  key: PlatformSettingKey,
  value: string | null,
  updatedBy: number | null = null,
): Promise<void> {
  const encrypted = ENCRYPTED_KEYS.has(key);
  const stored = value == null || value === '' ? null : (encrypted ? encrypt(value) : value);

  const [existing] = await db.select({ id: platformSettings.id }).from(platformSettings)
    .where(eq(platformSettings.key, key)).limit(1);

  if (existing) {
    await db.update(platformSettings)
      .set({ value: stored, isEncrypted: encrypted, updatedBy, updatedAt: new Date() })
      .where(eq(platformSettings.id, existing.id));
  } else {
    await db.insert(platformSettings).values({
      key,
      value: stored,
      isEncrypted: encrypted,
      updatedBy,
    });
  }

  cache.delete(key);
}

/**
 * Returns ALL settings for the super-admin UI. Encrypted values are returned
 * as a placeholder so they're never exposed in plaintext over the wire.
 */
export async function getAllSettingsForUI(): Promise<
  Array<{ key: string; value: string | null; isEncrypted: boolean; isSet: boolean; updatedAt: Date | null }>
> {
  const rows = await db.select().from(platformSettings);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const allKeys: PlatformSettingKey[] = [
    'platform.platformName',
    'platform.domain',
    'platform.trialDays',
    'platform.supportPhone',
    'platform.supportEmail',
    'moyasar.apiKey',
    'whatsapp.defaultToken',
    'whatsapp.defaultPhoneId',
    'vapid.publicKey',
    'vapid.privateKey',
    'vapid.email',
    'sentry.dsn',
    'firebase.config',
    'openai.apiKey',
    'openai.model',
  ];

  return allKeys.map((key) => {
    const row = byKey.get(key);
    const isEncrypted = ENCRYPTED_KEYS.has(key);
    const isSet = !!(row?.value) || envFallback(key) != null;
    let value: string | null = null;
    if (isEncrypted) {
      value = isSet ? SECRET_PLACEHOLDER : null;
    } else {
      value = row?.value ?? envFallback(key);
    }
    return {
      key,
      value,
      isEncrypted,
      isSet,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Invalidate the entire cache (used on bulk writes). */
export function invalidateSettingsCache() {
  cache.clear();
}
