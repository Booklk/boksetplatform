/**
 * Auto-confirm — flips `pending` bookings to `confirmed` for trusted
 * customers without any manual action. Trust rule:
 *   - customer has ≥ minCompletedBookings completed bookings with this vendor
 *   - scheduled time does NOT fall inside a prayer window (if
 *     respectPrayerTimes is on and the vendor city is known)
 *   - phone is verified
 *
 * Only confirms bookings that are more than 30 minutes away (so same-minute
 * confirmations still require a human glance) and less than 7 days out.
 */

import { db } from '../../db/index.js';
import { bookings, users, vendors } from '../../db/schema.js';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { AutopilotConfig } from './config.js';
import { recordDecision } from './decisions.js';
import { broadcast } from '../realtime/server.js';
import { prayerTimesFor, isNearPrayerTime } from '../saudi/prayerTimes.js';
import { toHijri } from '../saudi/hijri.js';

export async function runAutoConfirm(vendorId: number, cfg: AutopilotConfig['autoConfirm']) {
  if (!cfg.enabled) return;
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 60_000);
  const limit   = new Date(now.getTime() + 7 * 24 * 3600_000);

  const [vendor] = await db.select({ city: vendors.city })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const city = vendor?.city ?? 'الرياض';

  const pending = await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    customerId: bookings.customerId,
    scheduledAt: bookings.scheduledAt,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    eq(bookings.status, 'pending'),
    gte(bookings.scheduledAt, horizon),
    lte(bookings.scheduledAt, limit),
  ));

  for (const b of pending) {
    // Trust threshold — how many completed bookings does this customer have?
    const [stats] = await db.select({
      completed: sql<number>`COUNT(*)::int`,
      verified:  sql<number>`MAX(CASE WHEN u.phone_verified THEN 1 ELSE 0 END)::int`,
    })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.customerId))
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.customerId, b.customerId),
        eq(bookings.status, 'completed'),
      ));
    const completedN = Number(stats?.completed ?? 0);
    const phoneVerified = Number(stats?.verified ?? 0) === 1;
    if (completedN < cfg.minCompletedBookings || !phoneVerified) continue;

    if (cfg.respectPrayerTimes) {
      const h = toHijri(b.scheduledAt);
      const times = prayerTimesFor(city, b.scheduledAt, { isRamadan: h.month === 9 });
      if (times) {
        const hh = `${String(b.scheduledAt.getHours()).padStart(2, '0')}:${String(b.scheduledAt.getMinutes()).padStart(2, '0')}`;
        const near = isNearPrayerTime(hh, times.avoidWindows);
        if (near) {
          await recordDecision(vendorId, 'autopilot.auto_confirm', {
            summary: `تخطّي تأكيد #${b.bookingNumber} — داخل وقت صلاة ${near}`,
            skipped: true,
            reason: 'prayer_window',
            bookingId: b.id,
          });
          continue;
        }
      }
    }

    await db.update(bookings)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(bookings.id, b.id));

    await recordDecision(vendorId, 'autopilot.auto_confirm', {
      summary: `تأكيد تلقائي للحجز #${b.bookingNumber}`,
      bookingId: b.id,
      trustedCompletedCount: completedN,
    });

    broadcast(vendorId, 'booking.updated', {
      id: b.id,
      bookingNumber: b.bookingNumber,
      status: 'confirmed',
      updatedAt: new Date().toISOString(),
    });
  }
}
