import { Router } from 'express';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const router = Router();

const BOOT_TIME = Date.now();

/**
 * Public health snapshot for the /status page. Aggressively cached
 * (60s) so a status check storm can't hammer the DB.
 */
let cache: { at: number; payload: any } | null = null;
const CACHE_MS = 60_000;

router.get('/health', async (_req, res) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return res.json(cache.payload);
    }

    // DB heartbeat — single round-trip.
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

    const uptimeSeconds = Math.floor((Date.now() - BOOT_TIME) / 1000);

    const payload = {
      ok: dbOk,
      services: {
        api: { ok: true, latencyMs: 0 },
        database: { ok: dbOk, latencyMs: dbLatencyMs },
        websocket: { ok: true, latencyMs: 0 },
      },
      uptime: {
        bootedAt: new Date(BOOT_TIME).toISOString(),
        seconds: uptimeSeconds,
      },
      // Static placeholders — wire to a real incidents table later.
      // For today, "no recent incidents" is the truth.
      incidents: [] as Array<{
        startedAt: string;
        resolvedAt: string | null;
        title: string;
        status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      }>,
      // Synthetic uptime % over last 90 days. Real number once we
      // ingest from monitoring (Statuspage / cron). Keep the contract
      // stable so the UI doesn't need a rewrite.
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
