import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { bookings, users, employeeLocations, packages, services, fleetVehicles, vehicleCrewMembers } from '../db/schema.js';
import { eq, and, desc, sql, not, gte, lte } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── ETA (minutes) at 40 km/h city average ───────────────────────────────────
function etaMinutes(distanceKm: number): number {
  return Math.ceil((distanceKm / 40) * 60);
}

// ─── GET /available?bookingId=X ──────────────────────────────────────────────
router.get(
  '/available',
  requireAuth,
  requireRole('admin', 'vendor_admin'),
  async (req: AuthRequest, res) => {
    try {
      const bookingId = Number(req.query.bookingId);
      if (!bookingId || isNaN(bookingId)) {
        return res.status(400).json({ error: 'bookingId مطلوب' });
      }

      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });

      // 1. Get booking lat/lng + scheduledAt
      const [booking] = await db
        .select({
          id: bookings.id,
          lat: bookings.lat,
          lng: bookings.lng,
          scheduledAt: bookings.scheduledAt,
          vendorId: bookings.vendorId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
      if (booking.vendorId !== vendorId) return res.status(403).json({ error: 'غير مصرح' });

      const bookingLat = booking.lat ? parseFloat(booking.lat) : null;
      const bookingLng = booking.lng ? parseFloat(booking.lng) : null;
      const bookingScheduledAt = new Date(booking.scheduledAt).getTime();

      // 2. Get all active employees for this vendor
      const employees = await db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
        })
        .from(users)
        .where(
          and(
            eq(users.vendorId, vendorId),
            eq(users.role, 'employee'),
            eq(users.isActive, true),
          ),
        );

      // 3. For each employee, get latest location
      const latestLocations: Record<number, { lat: number; lng: number; recordedAt: Date }> = {};

      if (employees.length > 0) {
        const empIds = employees.map((e) => e.id);

        // Subquery: max recordedAt per employee
        const rows = await db
          .select({
            employeeId: employeeLocations.employeeId,
            lat: employeeLocations.lat,
            lng: employeeLocations.lng,
            recordedAt: employeeLocations.recordedAt,
          })
          .from(employeeLocations)
          .where(sql`${employeeLocations.employeeId} IN (${sql.join(empIds.filter(id => Number.isInteger(Number(id))).map(id => sql`${Number(id)}`), sql`, `)})`)
          .orderBy(desc(employeeLocations.recordedAt));

        // Keep only the first row per employee (latest)
        for (const row of rows) {
          if (!latestLocations[row.employeeId]) {
            latestLocations[row.employeeId] = {
              lat: parseFloat(row.lat as unknown as string),
              lng: parseFloat(row.lng as unknown as string),
              recordedAt: row.recordedAt,
            };
          }
        }
      }

      // 4. Get conflicting bookings for each employee (within ±90 min of scheduledAt)
      const windowMs = 90 * 60 * 1000;
      const windowStart = new Date(bookingScheduledAt - windowMs);
      const windowEnd = new Date(bookingScheduledAt + windowMs);

      const conflictingBookings = await db
        .select({
          employeeId: bookings.employeeId,
          bookingNumber: bookings.bookingNumber,
          scheduledAt: bookings.scheduledAt,
          address: bookings.address,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.vendorId, vendorId),
            sql`${bookings.employeeId} IS NOT NULL`,
            sql`${bookings.scheduledAt} BETWEEN ${windowStart} AND ${windowEnd}`,
            sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
            sql`${bookings.id} != ${bookingId}`,
          ),
        );

      // Build a set of employee IDs that have conflicts
      const conflictMap: Record<number, { bookingNumber: string; scheduledAt: Date; address: string }[]> = {};
      for (const cb of conflictingBookings) {
        if (!cb.employeeId) continue;
        if (!conflictMap[cb.employeeId]) conflictMap[cb.employeeId] = [];
        conflictMap[cb.employeeId].push({
          bookingNumber: cb.bookingNumber,
          scheduledAt: cb.scheduledAt,
          address: cb.address,
        });
      }

      // 5. Get last known booking status per employee
      const activeBookings = await db
        .select({
          employeeId: bookings.employeeId,
          status: bookings.status,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.vendorId, vendorId),
            sql`${bookings.employeeId} IS NOT NULL`,
            sql`${bookings.status} NOT IN ('cancelled', 'completed', 'pending')`,
          ),
        )
        .orderBy(desc(bookings.updatedAt));

      const currentStatusMap: Record<number, string> = {};
      for (const ab of activeBookings) {
        if (ab.employeeId && !currentStatusMap[ab.employeeId]) {
          currentStatusMap[ab.employeeId] = ab.status;
        }
      }

      // 6. Build sorted result
      const result = employees.map((emp) => {
        const loc = latestLocations[emp.id];
        const hasConflict = !!conflictMap[emp.id]?.length;

        let distKm: number | null = null;
        let eta: number | null = null;

        if (loc && bookingLat !== null && bookingLng !== null) {
          distKm = Math.round(haversineKm(loc.lat, loc.lng, bookingLat, bookingLng) * 10) / 10;
          eta = etaMinutes(distKm);
        }

        return {
          id: emp.id,
          name: emp.name,
          phone: emp.phone,
          distanceKm: distKm,
          etaMinutes: eta,
          isAvailable: !hasConflict,
          conflictReason: hasConflict ? 'لديه حجز في نفس الوقت' : undefined,
          lastLocationAt: loc?.recordedAt?.toISOString() ?? null,
          currentStatus: currentStatusMap[emp.id] ?? null,
        };
      });

      // Sort: available first, then by distance (nulls last)
      result.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });

      return res.json({ employees: result });
    } catch (e) {
      console.error('[dispatch/available]', e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// ─── POST /assign ─────────────────────────────────────────────────────────────
router.post(
  '/assign',
  requireAuth,
  requireRole('admin', 'vendor_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { bookingId, employeeId, vehicleId } = z
        .object({ bookingId: z.number(), employeeId: z.number(), vehicleId: z.number().optional() })
        .parse(req.body);

      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });

      // Verify booking belongs to vendor
      const [booking] = await db
        .select({
          id: bookings.id,
          vendorId: bookings.vendorId,
          scheduledAt: bookings.scheduledAt,
          status: bookings.status,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
      if (booking.vendorId !== vendorId) return res.status(403).json({ error: 'غير مصرح' });

      // Conflict check: ±90 minutes
      const windowMs = 90 * 60 * 1000;
      const scheduledAt = new Date(booking.scheduledAt).getTime();
      const windowStart = new Date(scheduledAt - windowMs);
      const windowEnd = new Date(scheduledAt + windowMs);

      const conflicts = await db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          scheduledAt: bookings.scheduledAt,
          address: bookings.address,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.employeeId, employeeId),
            eq(bookings.vendorId, vendorId),
            sql`${bookings.scheduledAt} BETWEEN ${windowStart} AND ${windowEnd}`,
            sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
            sql`${bookings.id} != ${bookingId}`,
          ),
        );

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'conflict',
          message: 'الموظف لديه حجز في نفس الوقت',
          conflicts: conflicts.map((c) => ({
            bookingNumber: c.bookingNumber,
            scheduledAt: c.scheduledAt,
            address: c.address,
          })),
        });
      }

      // Assign employee + confirm booking
      const [updated] = await db
        .update(bookings)
        .set({
          employeeId: Number(employeeId),
          ...(vehicleId ? { fleetVehicleId: Number(vehicleId) } : {}),
          status: 'confirmed',
          updatedAt: new Date(),
          statusHistory: sql`COALESCE(status_history, '[]'::jsonb) || ${JSON.stringify([
            { status: 'confirmed', at: new Date().toISOString(), by: req.user!.id },
          ])}::jsonb`,
        })
        .where(eq(bookings.id, bookingId))
        .returning();

      return res.json(updated);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error('[dispatch/assign]', e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// ─── GET /conflicts?employeeId=X&scheduledAt=Y&durationMinutes=Z ─────────────
router.get(
  '/conflicts',
  requireAuth,
  requireRole('admin', 'vendor_admin'),
  async (req: AuthRequest, res) => {
    try {
      const employeeId = Number(req.query.employeeId);
      const scheduledAtStr = String(req.query.scheduledAt ?? '');
      const durationMinutes = Number(req.query.durationMinutes ?? 60);

      if (!employeeId || isNaN(employeeId)) {
        return res.status(400).json({ error: 'employeeId مطلوب' });
      }
      if (!scheduledAtStr) {
        return res.status(400).json({ error: 'scheduledAt مطلوب' });
      }

      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });

      const requestedTime = new Date(scheduledAtStr).getTime();
      const windowMinutes = durationMinutes + 60;
      const windowMs = windowMinutes * 60 * 1000;
      const windowStart = new Date(requestedTime - windowMs);
      const windowEnd = new Date(requestedTime + windowMs);

      const conflicts = await db
        .select({
          bookingNumber: bookings.bookingNumber,
          scheduledAt: bookings.scheduledAt,
          address: bookings.address,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.employeeId, employeeId),
            eq(bookings.vendorId, vendorId),
            sql`${bookings.scheduledAt} BETWEEN ${windowStart} AND ${windowEnd}`,
            sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
          ),
        );

      return res.json({
        hasConflict: conflicts.length > 0,
        conflicts: conflicts.map((c) => ({
          bookingNumber: c.bookingNumber,
          scheduledAt: c.scheduledAt,
          address: c.address,
        })),
      });
    } catch (e) {
      console.error('[dispatch/conflicts]', e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// ─── PATCH /reassign — change vehicle assignment ──────────────────────────────
router.patch('/reassign', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  const { bookingId, newVehicleId } = req.body;
  const vendorId = req.user!.vendorId!;

  try {
    // Get booking
    const [booking] = await db.select().from(bookings).where(
      and(eq(bookings.id, Number(bookingId)), eq(bookings.vendorId, vendorId))
    );
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Conflict check for new vehicle
    if (booking.scheduledAt) {
      const targetTime = new Date(booking.scheduledAt).getTime();
      const windowMs = 90 * 60 * 1000;
      const conflicts = await db.select({ id: bookings.id }).from(bookings).where(
        and(
          eq(bookings.fleetVehicleId, Number(newVehicleId)),
          not(eq(bookings.id, Number(bookingId))),
          not(eq(bookings.status, 'cancelled')),
          not(eq(bookings.status, 'completed')),
          gte(bookings.scheduledAt, new Date(targetTime - windowMs)),
          lte(bookings.scheduledAt, new Date(targetTime + windowMs)),
        )
      );
      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'conflict', message: 'السيارة الجديدة لديها حجز في نفس الوقت' });
      }
    }

    // Get new vehicle's driver
    const [driver] = await db.select().from(vehicleCrewMembers).where(
      and(
        eq(vehicleCrewMembers.vehicleId, Number(newVehicleId)),
        eq(vehicleCrewMembers.role, 'driver'),
        eq(vehicleCrewMembers.isActive, true)
      )
    );

    await db.update(bookings).set({
      fleetVehicleId: Number(newVehicleId),
      ...(driver ? { employeeId: driver.employeeId } : {}),
    }).where(eq(bookings.id, Number(bookingId)));

    res.json({ success: true, message: 'تم تغيير السيارة بنجاح' });
  } catch (e) {
    console.error('[dispatch/reassign]', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
