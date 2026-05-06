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
 * Solution: in-process queue with bounded concurrency. The route handler
 * enqueues and returns immediately; this module drains the queue at a
 * controlled rate and retries with exponential backoff. Failures are
 * logged but never thrown back to the caller.
 *
 * Trade-off vs. Redis/BullMQ: we lose durability across process restarts.
 * Acceptable for transactional notifications (the customer can re-trigger
 * by checking their booking) but NOT for marketing campaigns — those
 * stay synchronous through services/campaigns which has its own retry
 * persistence.
 */

interface QueueJob {
  id: string;
  fn: () => Promise<unknown>;
  attempts: number;
  enqueuedAt: number;
  description: string;
}

const QUEUE_MAX_CONCURRENT = Number(process.env.WHATSAPP_QUEUE_CONCURRENT ?? 8);
const QUEUE_MAX_ATTEMPTS = 3;
const QUEUE_BACKOFF_MS = [500, 2000, 8000];

const queue: QueueJob[] = [];
let activeCount = 0;
let nextId = 1;

let stats = { enqueued: 0, succeeded: 0, failed: 0, retried: 0, dropped: 0 };

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
    }
  }
}

export function getQueueStats() {
  return {
    ...stats,
    pending: queue.length,
    active: activeCount,
    oldestEnqueuedMs: queue[0] ? Date.now() - queue[0].enqueuedAt : 0,
  };
}

/** For tests + graceful shutdown. */
export async function drainQueueForShutdown(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while ((queue.length > 0 || activeCount > 0) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
}
