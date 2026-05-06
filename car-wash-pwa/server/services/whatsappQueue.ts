/**
 * WhatsApp send queue.
 *
 * Why this exists: every customer-facing action (booking confirm, status
 * change, completion, rating request) needs to send a WhatsApp message.
 * If we await Meta synchronously and Meta is slow (seconds, not milliseconds
 * — happens routinely), the API response to the vendor / customer hangs
 * for the same duration. With 300K+ events/day post-launch, a 2-second
 * Meta blip stacks up fast.
 *
 * Two execution paths:
 *   1. **In-memory** (default) — bounded concurrency, exponential backoff,
 *      drops oldest jobs if the queue overflows. Fast and lock-free, but
 *      anything still in the queue at restart is lost.
 *   2. **Redis-backed** (set `REDIS_URL` + `WHATSAPP_QUEUE_PERSIST=1`) —
 *      every enqueued payload is also pushed onto a Redis list. On boot
 *      we drain that list back into the in-memory queue so a deploy/crash
 *      doesn't drop pending notifications.
 *
 * The fn that actually sends is built inline and not serializable — Redis
 * persistence is only for *jobs we know how to reconstruct* (the standard
 * notify functions). Raw queueing of arbitrary closures uses memory only.
 */
import { cacheBackend } from './cache.js';
import Redis from 'ioredis';

interface QueueJob {
  id: string;
  fn: () => Promise<unknown>;
  attempts: number;
  enqueuedAt: number;
  description: string;
  /** Set when this job was reconstructed from a persisted payload. */
  persistKey?: string;
}

const QUEUE_MAX_CONCURRENT = Number(process.env.WHATSAPP_QUEUE_CONCURRENT ?? 8);
const QUEUE_MAX_ATTEMPTS = 3;
const QUEUE_BACKOFF_MS = [500, 2000, 8000];
const PERSIST = process.env.WHATSAPP_QUEUE_PERSIST === '1' && !!process.env.REDIS_URL;
const REDIS_LIST_KEY = 'wa:queue:pending';

const queue: QueueJob[] = [];
let activeCount = 0;
let nextId = 1;

let stats = { enqueued: 0, succeeded: 0, failed: 0, retried: 0, dropped: 0, restored: 0 };

let redisClient: Redis | null = null;
function persistRedis(): Redis | null {
  if (!PERSIST) return null;
  if (redisClient) return redisClient;
  redisClient = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 2 });
  redisClient.connect().catch(() => { redisClient = null; });
  return redisClient;
}

/** Enqueue a fire-and-forget WhatsApp send. Returns immediately. */
export function enqueueSend(description: string, fn: () => Promise<unknown>): void {
  if (queue.length > 5000) {
    // Queue is overloaded — drop the oldest pending jobs to keep memory
    // bounded. Customer-facing transactional sends are best-effort; if
    // Meta is down badly enough to back up 5000 jobs, dropping is the
    // correct failure mode.
    const dropped = queue.splice(0, 1000);
    stats.dropped += dropped.length;
    console.warn(`[WhatsApp:queue] dropped ${dropped.length} oldest jobs (queue overloaded)`);
  }
  queue.push({ id: `wa_${nextId++}`, fn, attempts: 0, enqueuedAt: Date.now(), description });
  stats.enqueued++;
  drain();
}

/**
 * Enqueue a job whose payload can be reconstructed after a restart.
 * Use this for the standard notify helpers — `payload` is JSON-stringified
 * and pushed onto a Redis list as a recovery hint. The actual run still
 * happens through the in-memory queue.
 */
export async function enqueuePersistedSend(
  description: string,
  payload: PersistedJobPayload,
  fn: () => Promise<unknown>,
): Promise<void> {
  const r = persistRedis();
  let persistKey: string | undefined;
  if (r) {
    try {
      const serialized = JSON.stringify(payload);
      // Use rpush so order is preserved on restore; the key holds {id, payload}
      // pairs so we can selectively remove a job once it succeeds.
      persistKey = `wa:job:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await r.hset(persistKey, { payload: serialized, enqueuedAt: Date.now() });
      await r.expire(persistKey, 24 * 60 * 60); // GC after 24h regardless
      await r.rpush(REDIS_LIST_KEY, persistKey);
    } catch {
      persistKey = undefined;
    }
  }

  if (queue.length > 5000) {
    const dropped = queue.splice(0, 1000);
    stats.dropped += dropped.length;
  }
  queue.push({
    id: `wa_${nextId++}`,
    fn,
    attempts: 0,
    enqueuedAt: Date.now(),
    description,
    persistKey,
  });
  stats.enqueued++;
  drain();
}

/** Persistable payload — must be JSON-serialisable. */
export interface PersistedJobPayload {
  kind: 'raw' | 'transactional';
  phone: string;
  message: string;
  vendorId?: number | null;
  event?: string;
}

function drain() {
  while (activeCount < QUEUE_MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    if (!job) break;
    activeCount++;
    runJob(job).finally(() => {
      activeCount--;
      drain();
    });
  }
}

async function runJob(job: QueueJob): Promise<void> {
  job.attempts++;
  try {
    await job.fn();
    stats.succeeded++;
    if (job.persistKey) await releasePersist(job.persistKey);
  } catch (e) {
    if (job.attempts < QUEUE_MAX_ATTEMPTS) {
      stats.retried++;
      const backoff = QUEUE_BACKOFF_MS[job.attempts - 1] ?? 8000;
      setTimeout(() => {
        queue.push(job);
        drain();
      }, backoff);
    } else {
      stats.failed++;
      console.error(`[WhatsApp:queue] ${job.description} failed after ${job.attempts} attempts:`, e instanceof Error ? e.message : e);
      if (job.persistKey) await releasePersist(job.persistKey);
    }
  }
}

async function releasePersist(persistKey: string) {
  const r = persistRedis();
  if (!r) return;
  try {
    await r.lrem(REDIS_LIST_KEY, 1, persistKey);
    await r.del(persistKey);
  } catch {/* best-effort */}
}

/**
 * Restore persisted jobs from Redis after a restart. Called once during
 * server boot. Reconstruction is delegated to the caller because the
 * notify functions live elsewhere (avoid cyclic imports).
 */
export async function restorePersistedJobs(
  reconstruct: (payload: PersistedJobPayload) => (() => Promise<unknown>) | null,
): Promise<number> {
  const r = persistRedis();
  if (!r) return 0;
  let restored = 0;
  try {
    const keys = await r.lrange(REDIS_LIST_KEY, 0, -1);
    for (const key of keys) {
      const data = await r.hget(key, 'payload');
      if (!data) {
        await r.lrem(REDIS_LIST_KEY, 1, key);
        continue;
      }
      try {
        const payload = JSON.parse(data) as PersistedJobPayload;
        const fn = reconstruct(payload);
        if (!fn) {
          await releasePersist(key);
          continue;
        }
        queue.push({
          id: `wa_restored_${nextId++}`,
          fn,
          attempts: 0,
          enqueuedAt: Date.now(),
          description: `restored:${payload.kind}:${(payload.phone ?? '').slice(-4)}`,
          persistKey: key,
        });
        restored++;
      } catch {
        await releasePersist(key);
      }
    }
    stats.restored += restored;
    if (restored > 0) {
      console.log(`[WhatsApp:queue] restored ${restored} persisted jobs`);
      drain();
    }
  } catch (e) {
    console.warn('[WhatsApp:queue] restore failed:', e instanceof Error ? e.message : e);
  }
  return restored;
}

export function getQueueStats() {
  return {
    ...stats,
    pending: queue.length,
    active: activeCount,
    oldestEnqueuedMs: queue[0] ? Date.now() - queue[0].enqueuedAt : 0,
    persistMode: PERSIST ? 'redis' : 'memory',
    cacheBackend: cacheBackend(),
  };
}

/** For tests + graceful shutdown. */
export async function drainQueueForShutdown(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((queue.length > 0 || activeCount > 0) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
}
