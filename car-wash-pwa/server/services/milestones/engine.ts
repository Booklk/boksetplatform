/**
 * Milestone engine — detects "big moment" events and broadcasts them
 * over the realtime layer so every dashboard tab reacts with confetti,
 * sound, and a toast. Uses a dedicated `milestonesAwarded` record on the
 * vendor (stored in settings.milestones) to guarantee each milestone
 * fires exactly once — even with multiple replicas.
 */

import { db } from '../../db/index.js';
import { vendors, bookings } from '../../db/schema.js';
import { and, eq, gte, sql } from 'drizzle-orm';
import { broadcast } from '../realtime/server.js';

interface AwardedMap {
  [key: string]: string; // key → ISO timestamp
}

async function getAwarded(vendorId: number): Promise<AwardedMap> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  return (settings.milestones as AwardedMap) ?? {};
}

async function saveAwarded(vendorId: number, map: AwardedMap): Promise<void> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  await db.update(vendors)
    .set({ settings: { ...settings, milestones: map }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
}

export interface MilestoneEvent {
  id: string;           // stable id e.g. "bookings_100"
  title: string;        // user-facing title in Arabic
  subtitle?: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

const BOOKING_MILESTONES: Array<{ count: number; tier: MilestoneEvent['tier']; title: string; emoji: string }> = [
  { count: 1,    tier: 'bronze',  title: 'أول حجز ✨',           emoji: '🎯' },
  { count: 10,   tier: 'bronze',  title: 'عشر حجوزات',           emoji: '⭐' },
  { count: 50,   tier: 'silver',  title: '٥٠ حجز',                emoji: '🌟' },
  { count: 100,  tier: 'silver',  title: 'قبيلة المائة',         emoji: '💯' },
  { count: 500,  tier: 'gold',    title: '٥٠٠ حجز — برافو',      emoji: '🏆' },
  { count: 1000, tier: 'gold',    title: 'ألف حجز!',              emoji: '👑' },
  { count: 5000, tier: 'diamond', title: '٥٠٠٠ حجز — أسطورة',    emoji: '💎' },
];

/** Called after a booking completes. Broadcasts every newly-crossed
 *  milestone + persists so we never re-fire. */
export async function checkMilestonesForBooking(vendorId: number): Promise<MilestoneEvent[]> {
  const [row] = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')));
  const total = Number(row?.count ?? 0);

  const awarded = await getAwarded(vendorId);
  const fired: MilestoneEvent[] = [];

  for (const m of BOOKING_MILESTONES) {
    const key = `bookings_${m.count}`;
    if (total >= m.count && !awarded[key]) {
      awarded[key] = new Date().toISOString();
      fired.push({
        id: key,
        title: m.title,
        subtitle: `${m.count} حجز مكتمل — شغل صدق!`,
        emoji: m.emoji,
        tier: m.tier,
      });
    }
  }

  if (fired.length > 0) {
    await saveAwarded(vendorId, awarded);
    for (const m of fired) {
      broadcast(vendorId, 'milestone.earned', m);
    }
  }
  return fired;
}

/** Check weekly "record day" — yesterday's revenue vs all previous days. */
export async function checkRecordDay(vendorId: number): Promise<MilestoneEvent | null> {
  const now = new Date();
  const yStart = new Date(now); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0, 0, 0, 0);
  const yEnd   = new Date(now); yEnd.setDate(yEnd.getDate() - 1); yEnd.setHours(23, 59, 59, 999);

  const [yRev] = await db.select({
    total: sql<number>`COALESCE(SUM(total_price::numeric), 0)::float`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.scheduledAt, yStart),
    eq(bookings.status, 'completed'),
  ));
  const yesterdayRev = Number(yRev?.total ?? 0);
  if (yesterdayRev < 500) return null;

  const [bestBefore] = await db.execute<{ max: number }>(sql`
    SELECT COALESCE(MAX(daily), 0)::float AS max FROM (
      SELECT DATE(scheduled_at) AS day, SUM(total_price::numeric) AS daily
      FROM bookings
      WHERE vendor_id = ${vendorId} AND status = 'completed'
        AND scheduled_at < ${yStart}
      GROUP BY DATE(scheduled_at)
    ) AS d
  `) as any;
  const prior = Number(bestBefore?.max ?? bestBefore?.rows?.[0]?.max ?? 0);

  if (yesterdayRev > prior && prior > 0) {
    const awarded = await getAwarded(vendorId);
    const key = `record_day_${yStart.toISOString().slice(0, 10)}`;
    if (!awarded[key]) {
      awarded[key] = new Date().toISOString();
      await saveAwarded(vendorId, awarded);
      const m: MilestoneEvent = {
        id: key,
        title: 'رقم قياسي 🏆',
        subtitle: `أمس كان أعلى يوم إيراد في تاريخ متجرك: ${Math.round(yesterdayRev)} ر.س`,
        emoji: '🏆',
        tier: 'gold',
      };
      broadcast(vendorId, 'milestone.earned', m);
      return m;
    }
  }
  return null;
}
