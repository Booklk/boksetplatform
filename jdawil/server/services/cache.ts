/**
 * Cache abstraction — Redis when REDIS_URL is set, in-memory otherwise.
 *
 * Why two backends: dev & single-instance prod can run without Redis. The
 * moment we run two app processes (autoscaling, blue/green deploy, multi-az)
 * the in-memory cache becomes a correctness hazard — different processes
 * see stale vendor info or queue marketing messages they shouldn't. Setting
 * REDIS_URL flips the whole platform onto a shared cache transparently.
 *
 * Use cases this covers today:
 *   - Vendor lookup by slug for the storefront (`vendor:slug:<slug>`)
 *   - Plan-level quotas resolved per vendor
 *   - Rate-limit counters (express-rate-limit can use this via store)
 *
 * Not used for: anything that must be authoritative (subscription status,
 * money). Those still hit the DB directly.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

class MemoryCache {
  private store = new Map<string, MemoryEntry>();
  private lastSweep = 0;

  async get(key: string): Promise<string | null> {
    this.maybeSweep();
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }

  async set(key: string, value: string, ttlSec: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  }

  async del(...keys: string[]): Promise<void> {
    for (const k of keys) this.store.delete(k);
  }

  async incr(key: string, ttlSec: number): Promise<number> {
    const e = this.store.get(key);
    const now = Date.now();
    if (!e || e.expiresAt < now) {
      this.store.set(key, { value: '1', expiresAt: now + ttlSec * 1000 });
      return 1;
    }
    const n = Number(e.value) + 1;
    e.value = String(n);
    return n;
  }

  /** Periodic cleanup so the in-memory map doesn't grow unbounded. */
  private maybeSweep() {
    const now = Date.now();
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [k, v] of this.store) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }

  size() { return this.store.size; }
}

let redis: Redis | null = null;
const memory = new MemoryCache();

if (REDIS_URL) {
  redis = new Redis(REDIS_URL, {
    // Don't ever block the process from exiting on Redis-side dangling
    // connections. Lazy-connect so misconfigured env doesn't crash boot.
    lazyConnect: true,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 2,
  });
  redis.connect().catch((e) => {
    console.error('[cache] Redis connect failed, falling back to memory:', e?.message ?? e);
    redis = null;
  });
  redis.on('error', (e) => {
    console.warn('[cache] Redis error:', e?.message ?? e);
  });
}

/** Get a string by key. Returns null if missing or expired. */
export async function cacheGet(key: string): Promise<string | null> {
  try {
    if (redis) return await redis.get(key);
  } catch { /* fall through to memory */ }
  return memory.get(key);
}

/** Set a string with TTL in seconds. */
export async function cacheSet(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    if (redis) {
      await redis.set(key, value, 'EX', ttlSec);
      return;
    }
  } catch { /* fall through */ }
  await memory.set(key, value, ttlSec);
}

/** Delete one or many keys. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    if (redis) {
      await redis.del(...keys);
      return;
    }
  } catch { /* fall through */ }
  await memory.del(...keys);
}

/**
 * Atomic counter — increments, sets TTL on first write. Used by rate
 * limiters and per-vendor abuse heuristics. Returns the new value.
 */
export async function cacheIncr(key: string, ttlSec: number): Promise<number> {
  try {
    if (redis) {
      const v = await redis.incr(key);
      if (v === 1) await redis.expire(key, ttlSec);
      return v;
    }
  } catch { /* fall through */ }
  return memory.incr(key, ttlSec);
}

/**
 * Read-through helper — common pattern for vendor lookups by slug.
 * Caches the JSON-stringified result; pass through the loader on miss.
 */
export async function cacheRemember<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet(key);
  if (hit) {
    try { return JSON.parse(hit) as T; } catch { /* corrupted, refetch */ }
  }
  const value = await loader();
  if (value !== undefined && value !== null) {
    await cacheSet(key, JSON.stringify(value), ttlSec);
  }
  return value;
}

export function cacheBackend(): 'redis' | 'memory' {
  return redis ? 'redis' : 'memory';
}

export async function closeCache(): Promise<void> {
  if (redis) {
    try { await redis.quit(); } catch { /* ignore */ }
  }
}
