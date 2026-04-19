import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Require a real encryption key — fail loudly if missing
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === 'default-32-byte-key-change-me!!') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY must be set in production. Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  console.warn('⚠️  ENCRYPTION_KEY not set — using dev-only fallback. Do NOT use in production.');
}
const KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? 'dev-only-key-not-for-production!', 'utf8').slice(0, 32);

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
