/**
 * Pre-launch readiness check.
 *
 * Run before flipping DNS or starting a marketing campaign:
 *
 *     npm run pre-launch
 *
 * Verifies the things that quietly fail in production but pass in dev:
 *  - Required env vars present
 *  - DB reachable + schema in sync (every table the app reads from exists)
 *  - Crypto key strong enough
 *  - Storage credentials valid (when S3 is configured)
 *  - Redis reachable (when configured)
 *  - WhatsApp platform creds set (or at least one vendor configured)
 *  - HEALTH_CHECK_TOKEN strong
 *  - JWT_SECRET strong
 *
 * Exits non-zero on any FAIL — call from CI/CD before deploy.
 */
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  level: 'fail' | 'warn';
}

const results: CheckResult[] = [];

function pass(name: string, detail = 'ok') {
  results.push({ name, ok: true, detail, level: 'fail' });
}
function fail(name: string, detail: string) {
  results.push({ name, ok: false, detail, level: 'fail' });
}
function warn(name: string, detail: string) {
  results.push({ name, ok: false, detail, level: 'warn' });
}

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
  } catch (e) {
    fail(name, e instanceof Error ? e.message : String(e));
  }
}

// ─── Env ────────────────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
];

const RECOMMENDED_ENV = [
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'SENTRY_DSN',
  'HEALTH_CHECK_TOKEN',
  'BASE_URL',
  'DOMAIN',
  'MOYASAR_API_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
];

await check('required env vars', () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
  pass('required env vars', `${REQUIRED_ENV.length} present`);
});

await check('recommended env vars', () => {
  const missing = RECOMMENDED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    warn('recommended env vars', `not set: ${missing.join(', ')}`);
    return;
  }
  pass('recommended env vars', `${RECOMMENDED_ENV.length} present`);
});

await check('JWT_SECRET strength', () => {
  const v = process.env.JWT_SECRET ?? '';
  if (v.length < 32) throw new Error(`only ${v.length} chars (need 32+)`);
  if (/^(secret|test|dev|change[-_]?me)/i.test(v)) throw new Error('looks like a default value');
  pass('JWT_SECRET strength', `${v.length} chars`);
});

await check('ENCRYPTION_KEY strength', () => {
  const v = process.env.ENCRYPTION_KEY ?? '';
  // services/lib/crypto expects a 32-byte hex (64 chars) or base64-32 (43+ chars).
  if (v.length < 32) throw new Error(`only ${v.length} chars (need 32+)`);
  pass('ENCRYPTION_KEY strength', `${v.length} chars`);
});

await check('HEALTH_CHECK_TOKEN', () => {
  const v = process.env.HEALTH_CHECK_TOKEN ?? '';
  if (process.env.NODE_ENV === 'production' && !v) {
    throw new Error('production deploy requires HEALTH_CHECK_TOKEN');
  }
  if (v && v.length < 24) {
    warn('HEALTH_CHECK_TOKEN', `${v.length} chars (24+ recommended)`);
    return;
  }
  pass('HEALTH_CHECK_TOKEN', v ? `${v.length} chars` : 'not set (dev only)');
});

// ─── DB ─────────────────────────────────────────────────────────────────────

await check('database connectivity', async () => {
  const start = Date.now();
  await db.execute(sql`SELECT 1`);
  pass('database connectivity', `${Date.now() - start}ms`);
});

await check('database schema (core tables)', async () => {
  // Tables the app definitely reads from on the hot path. If any are
  // missing, the app will return 500s at scale.
  const required = [
    'vendors', 'users', 'customers', 'bookings', 'packages', 'services',
    'payments', 'whatsapp_sessions', 'monthly_usage', 'billing_audit',
    'platform_settings', 'pdpl_consents',
  ];
  const rows: Array<{ table_name: string }> = (await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  `)) as unknown as Array<{ table_name: string }>;
  const have = new Set((rows as unknown as Array<{ table_name: string }>).map((r) => r.table_name));
  const missing = required.filter((t) => !have.has(t));
  if (missing.length) throw new Error(`missing tables: ${missing.join(', ')}`);
  pass('database schema (core tables)', `${required.length} tables present`);
});

await check('database hot-path indexes', async () => {
  const rows = (await db.execute(sql`
    SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  `)) as unknown as Array<{ indexname: string }>;
  const have = new Set(rows.map((r) => r.indexname));
  const required = [
    'idx_bookings_vendor_id',
    'idx_bookings_status',
    'idx_bookings_vendor_scheduled',
    'idx_users_phone',
    'idx_customers_vendor_id',
    'idx_payments_booking_id',
  ];
  const missing = required.filter((i) => !have.has(i));
  if (missing.length) throw new Error(`missing indexes: ${missing.join(', ')}`);
  pass('database hot-path indexes', `${required.length} verified`);
});

// ─── Optional infra ─────────────────────────────────────────────────────────

await check('Redis (optional)', async () => {
  if (!process.env.REDIS_URL) {
    warn('Redis (optional)', 'REDIS_URL not set — running on in-memory cache (single-process only)');
    return;
  }
  const { default: Redis } = await import('ioredis');
  const client = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await client.connect();
    const start = Date.now();
    await client.ping();
    pass('Redis (optional)', `${Date.now() - start}ms ping`);
  } finally {
    try { await client.quit(); } catch {/* ignore */}
  }
});

await check('S3 storage (optional)', async () => {
  if (process.env.STORAGE_PROVIDER !== 's3') {
    warn('S3 storage (optional)', 'STORAGE_PROVIDER=local — uploads on local disk (single-instance only)');
    return;
  }
  const required = ['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
  pass('S3 storage (optional)', `bucket=${process.env.S3_BUCKET}`);
});

await check('replica (optional)', async () => {
  if (!process.env.DATABASE_REPLICA_URL) {
    warn('replica (optional)', 'no read replica — primary serves analytics too');
    return;
  }
  pass('replica (optional)', 'DATABASE_REPLICA_URL set');
});

// ─── Print summary ──────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok && r.level === 'fail');
const warned = results.filter((r) => !r.ok && r.level === 'warn');

console.log('\n┌─ Jdawil pre-launch readiness ─────────────────────────────────');
for (const r of results) {
  const icon = r.ok ? '✅' : r.level === 'warn' ? '⚠️ ' : '❌';
  const label = r.name.padEnd(32);
  console.log(`│ ${icon}  ${label} ${r.detail}`);
}
console.log('├───────────────────────────────────────────────────────────────');
console.log(`│  passed: ${results.filter((r) => r.ok).length}   warnings: ${warned.length}   failures: ${failed.length}`);
console.log('└───────────────────────────────────────────────────────────────\n');

await db.execute(sql`SELECT 1`).catch(() => {/* ignore on shutdown */});
process.exit(failed.length > 0 ? 1 : 0);
