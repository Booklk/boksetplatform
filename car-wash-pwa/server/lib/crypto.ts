import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Known weak / default values we never accept — even outside prod we
// reject so a developer doesn't drag a bad key into staging unnoticed.
const KNOWN_DEFAULTS = new Set([
  'default-32-byte-key-change-me!!',
  'change_this_32_char_hex_key_for_aes256',
  'change_this_in_production',
  'dev-only-key-not-for-production!',
]);

const RAW = process.env.ENCRYPTION_KEY ?? '';
const isProd = process.env.NODE_ENV === 'production';
const looksHex = /^[0-9a-fA-F]{64}$/.test(RAW); // 32 bytes hex

if (!RAW || KNOWN_DEFAULTS.has(RAW)) {
  if (isProd) {
    throw new Error(
      'ENCRYPTION_KEY must be set in production (64 hex chars). ' +
      'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  console.warn('⚠️  ENCRYPTION_KEY not set — using dev-only fallback. Do NOT use in production.');
} else if (isProd && !looksHex) {
  // In prod we strictly require 64 hex chars (32 bytes). Anything else
  // might be a passphrase that slice(0,32) silently truncates to a
  // low-entropy key.
  throw new Error(
    'ENCRYPTION_KEY in production must be exactly 64 hex characters (32 bytes). ' +
    'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

const KEY: Buffer = looksHex
  ? Buffer.from(RAW, 'hex')                                        // 32 bytes from hex
  : Buffer.from(RAW || 'dev-only-key-not-for-production!', 'utf8').slice(0, 32);

/** Encrypt a string (AES-256-GCM). Returns base64 ciphertext with IV + tag prepended. */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decrypt a base64 string produced by encrypt(). */
export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const ciphertext = buf.slice(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
