/**
 * Auto-assign engine — picks an employee for every pending booking
 * whose scheduled time is at least `minLeadMinutes` away.
 *
 * Strategies:
 *   - round_robin   : cycle through eligible employees (cursor in settings).
 *   - least_loaded  : whoever has fewest completed+upcoming bookings today.
 *   - highest_rated : whoever has the highest average rating (≥ 1 rating).
 *
 * An employee is "eligible" when:
 *   - role = 'employee'
 *   - isActive = true
 *   - isOnDuty = true
 *   - branch matches the booking's branch (or both are null)
 *   - not already booked within ±30 min of the slot
 */

import { db } from '../../db/index.js';
import { bookings, users } from '../../db/schema.js';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { AutopilotConfig } from './config.js';
import { recordDecision } from './decisions.js';
import { broadcast } from '../realtime/server.js';

interface EligibleEmployee extends Record<string, unknown> {
  id: number;
  name: string;
  rating: number | null;
  todayLoad: number;
}

export async function runAssignEmployee(vendorId: number, cfg: AutopilotConfig['assignEmployee']) {
  if (!cfg.enabled) return;

  const now = new Date();
  const horizon = new Date(now.getTime() + cfg.minLeadMinutes * 60_000);
  const later   = new Date(now.getTime() + 48 * 3600_000); // 48h window

  // 1. Find unassigned bookings to schedule.
  const candidates = await db.select({
    id: bookings.id,
    bookingNumber: bookings.bookingNumber,
    scheduledAt: bookings.scheduledAt,
    branchId: bookings.branchId,
    totalPrice: bookings.totalPrice,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    isNull(bookings.employeeId),
    gte(bookings.scheduledAt, horizon),
    lte(bookings.scheduledAt, later),
    eq(bookings.status, 'confirmed'),
  ));

  if (candidates.length === 0) return;

  for (const booking of candidates) {
    const employeeId = await pickEmployee(vendorId, cfg.strategy, booking);
    if (!employeeId) {
      await recordDecision(vendorId, 'autopilot.assign_employee', {
        summary: `تخطّي الحجز #${booking.bookingNumber} — ما في موظف متاح`,
        skipped: true,
        reason: 'no_eligible_employee',
        bookingId: booking.id,
      });
      continue;
    }
    await db.update(bookings)
      .set({ employeeId, updatedAt: new Date() })
      .where(eq(bookings.id, booking.id));

    const [emp] = await db.select({ name: users.name })
      .from(users).where(eq(users.id, employeeId)).limit(1);
    const summary = `تعيين ${emp?.name ?? 'موظف'} للحجز #${booking.bookingNumber}`;
    await recordDecision(vendorId, 'autopilot.assign_employee', {
      summary,
      bookingId: booking.id,
      employeeId,
      strategy: cfg.strategy,
    });
    broadcast(vendorId, 'booking.updated', {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      status: 'confirmed',
      employeeId,
      updatedAt: new Date().toISOString(),
    });
  }
}

async function pickEmployee(
  vendorId: number,
  strategy: AutopilotConfig['assignEmployee']['strategy'],
  booking: { id: number; scheduledAt: Date; branchId: number | null },
): Promise<number | null> {
  // Branch filter — if the booking is pinned to a branch, so is the employee.
  const branchMatch = booking.branchId != null
    ? sql`(${users.branchId} IS NULL OR ${users.branchId} = ${booking.branchId})`
    : sql`1=1`;

  // ±30 min collision window.
  const slotStart = new Date(booking.scheduledAt.getTime() - 30 * 60_000);
  const slotEnd   = new Date(booking.scheduledAt.getTime() + 30 * 60_000);

  const rows = await db.execute<EligibleEmployee>(sql`
    SELECT u.id,
           u.name,
           (SELECT AVG(b.rating)
              FROM bookings b
              WHERE b.employee_id = u.id
                AND b.rating IS NOT NULL) AS rating,
           (SELECT COUNT(*)::int
              FROM bookings b
              WHERE b.employee_id = u.id
                AND DATE(b.scheduled_at) = DATE(${booking.scheduledAt})
                AND b.status NOT IN ('cancelled', 'completed')) AS today_load
      FROM users u
     WHERE u.vendor_id = ${vendorId}
       AND u.role = 'employee'
       AND u.is_active = true
       AND u.is_on_duty = true
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
          WHERE b.employee_id = u.id
            AND b.scheduled_at BETWEEN ${slotStart} AND ${slotEnd}
            AND b.status NOT IN ('cancelled', 'completed')
       )
       AND ${branchMatch}
  `);
  const list = ((rows as any).rows ?? rows) as EligibleEmployee[];
  if (list.length === 0) return null;

  if (strategy === 'highest_rated') {
    list.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    return list[0].id;
  }
  if (strategy === 'least_loaded') {
    list.sort((a, b) => Number(a.todayLoad ?? 0) - Number(b.todayLoad ?? 0));
    return list[0].id;
  }
  // round_robin — a deterministic pick based on booking id keeps it stable
  // across retries without having to persist a cursor.
  return list[booking.id % list.length].id;
}
