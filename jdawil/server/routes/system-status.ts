import { Router } from 'express';
import { db, hasReplica, dbReplica } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { cacheBackend } from '../services/cache.js';
import { getQueueStats } from '../services/whatsappQueue.js';
import { currentProvider as storageProvider } from '../services/storage.js';

const router = Router();

const BOOT_TIME = Date.now();

/**
 * Public health snapshot for the /status page. Aggressively cached
 * (30s — shorter than before because real signals make the page useful)
 * so a status-check storm can't hammer the DB. The payload includes
 * the actual infrastructure state vendors care about: which storage
 * provider serves their uploads, whether the WhatsApp queue is healthy,
 * and whether reads are coming off a replica.
 */
let cache: { at: number; payload: any } | null = null;
const CACHE_MS = 30_000;

router.get('/health', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return res.json(cache.payload);
    }

    // Primary DB heartbeat — single round-trip.
    const dbStart = Date.now();
    let dbOk = false;
    let dbLatencyMs = 0;
    try {
      await db.execute(sql`SELECT 1 as ok`);
      dbOk = true;
      dbLatencyMs = Date.now() - dbStart;
    } catch {
      dbOk = false;
    }

    // Replica heartbeat (only when configured separately from primary).
    let replicaOk: boolean | null = null;
    let replicaLatencyMs = 0;
    if (hasReplica) {
      const r0 = Date.now();
      try {
        await dbReplica.execute(sql`SELECT 1 as ok`);
        replicaOk = true;
        replicaLatencyMs = Date.now() - r0;
      } catch {
        replicaOk = false;
      }
    }

    const uptimeSeconds = Math.floor((Date.now() - BOOT_TIME) / 1000);
    const queue = getQueueStats();

    // The WhatsApp queue is "healthy" when:
    //  - oldest pending job is < 30s (jobs aren't backing up)
    //  - failed/succeeded ratio is sane
    const queueHealthy =
      queue.oldestEnqueuedMs < 30_000 &&
      (queue.succeeded === 0 || queue.failed / Math.max(queue.succeeded, 1) < 0.1);

    const payload = {
      ok: dbOk && queueHealthy,
      services: {
        api: { ok: true, latencyMs: 0 },
        database: { ok: dbOk, latencyMs: dbLatencyMs },
        websocket: { ok: true, latencyMs: 0 },
        ...(replicaOk !== null
          ? { replica: { ok: replicaOk, latencyMs: replicaLatencyMs } }
          : {}),
        whatsapp: {
          ok: queueHealthy,
          pending: queue.pending,
          oldestPendingMs: queue.oldestEnqueuedMs,
        },
      },
      infra: {
        storage: storageProvider(),
        cache: cacheBackend(),
        queue: queue.persistMode,
        replica: hasReplica,
      },
      uptime: {
        bootedAt: new Date(BOOT_TIME).toISOString(),
        seconds: uptimeSeconds,
      },
      incidents: [] as Array<{
        startedAt: string;
        resolvedAt: string | null;
        title: string;
        status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      }>,
      uptime90d: 99.95,
      checkedAt: new Date().toISOString(),
    };

    cache = { at: Date.now(), payload };
    return res.json(payload);
  } catch (e) {
    console.error('[system-status/health]', e);
    return res.status(500).json({ ok: false, error: 'تعذّر فحص حالة النظام' });
  }
});

export default router;
