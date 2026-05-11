import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { employeeLocations, bookings, users, fleetVehicles } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/tracking/location — Employee sends their GPS location
router.post('/location', requireAuth, requireRole('employee', 'admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
      heading: z.number().optional(),
      speed: z.number().optional(),
      bookingId: z.number().optional(),
    }).parse(req.body);

    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'الموظف غير مرتبط بمتجر' });

    await db.insert(employeeLocations).values({
      employeeId: req.user!.id,
      vendorId,
      lat: String(data.lat),
      lng: String(data.lng),
      accuracy: data.accuracy ? String(data.accuracy) : null,
      heading: data.heading ? String(data.heading) : null,
      speed: data.speed ? String(data.speed) : null,
      bookingId: data.bookingId ?? null,
    });

    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/tracking/booking/:id — Customer: last known location of employee on a booking
router.get('/booking/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);

    // Verify this booking belongs to the customer
    const [booking] = await db.select().from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.customerId, req.user!.id)))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
    if (!booking.employeeId) return res.json({ location: null, message: 'لم يتم تعيين موظف بعد' });

    const [location] = await db.select().from(employeeLocations)
      .where(and(
        eq(employeeLocations.employeeId, booking.employeeId),
        eq(employeeLocations.bookingId, bookingId)
      ))
      .orderBy(desc(employeeLocations.recordedAt))
      .limit(1);

    return res.json({ location: location ?? null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/tracking/booking/:bookingId/live — Public token-based live tracking
router.get('/booking/:bookingId/live', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    const { token } = req.query as { token?: string };

    if (!bookingId || isNaN(bookingId)) {
      return res.status(400).json({ error: 'معرف الحجز غير صالح' });
    }

    // Fetch booking (token check is soft — missing token still allowed for auth'd users)
    const [booking] = await db.select().from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Validate tracking token if provided in booking
    if (booking.trackingToken && token !== booking.trackingToken) {
      return res.status(403).json({ error: 'رابط التتبع غير صالح' });
    }

    // Get employee info
    let employeeName = 'موظف';
    let employeePhone: string | null = null;
    if (booking.employeeId) {
      const [emp] = await db.select({ name: users.name, phone: users.phone })
        .from(users).where(eq(users.id, booking.employeeId)).limit(1);
      if (emp) {
        employeeName = emp.name;
        employeePhone = emp.phone;
      }
    }

    // Get fleet vehicle info
    let vehicleName: string | null = null;
    if (booking.fleetVehicleId) {
      const [veh] = await db.select({ nameAr: fleetVehicles.nameAr, plateNumber: fleetVehicles.plateNumber })
        .from(fleetVehicles).where(eq(fleetVehicles.id, booking.fleetVehicleId)).limit(1);
      if (veh) {
        vehicleName = [veh.nameAr, veh.plateNumber].filter(Boolean).join(' — ');
      }
    }

    // Get latest GPS location for this booking's employee
    let vehicleLat: number | null = null;
    let vehicleLng: number | null = null;

    if (booking.employeeId) {
      const [loc] = await db.select()
        .from(employeeLocations)
        .where(and(
          eq(employeeLocations.employeeId, booking.employeeId),
          eq(employeeLocations.bookingId, bookingId),
        ))
        .orderBy(desc(employeeLocations.recordedAt))
        .limit(1);

      if (loc) {
        vehicleLat = parseFloat(String(loc.lat));
        vehicleLng = parseFloat(String(loc.lng));
      }
    }

    // Haversine ETA calculation (avg speed 40 km/h)
    let etaMinutes: number | null = null;
    let distanceKm: number | null = null;
    const custLat = booking.lat ? parseFloat(String(booking.lat)) : null;
    const custLng = booking.lng ? parseFloat(String(booking.lng)) : null;

    if (vehicleLat !== null && vehicleLng !== null && custLat !== null && custLng !== null) {
      const R = 6371;
      const dLat = (custLat - vehicleLat) * Math.PI / 180;
      const dLng = (custLng - vehicleLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(vehicleLat * Math.PI / 180)
        * Math.cos(custLat * Math.PI / 180)
        * Math.sin(dLng / 2) ** 2;
      distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      etaMinutes = Math.max(1, Math.ceil((distanceKm / 40) * 60));
    }

    return res.json({
      vehicleLat,
      vehicleLng,
      vehicleName,
      employeeName,
      employeePhone,
      status: booking.status,
      eta_minutes: etaMinutes,
      customerLat: custLat,
      customerLng: custLng,
      distance_km: distanceKm ? parseFloat(distanceKm.toFixed(2)) : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/tracking/employees — Vendor admin: all active employee locations
router.get('/employees', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });
    // Get latest location per employee in the last 30 minutes
    const locations = await db.execute(
      sql`SELECT DISTINCT ON (employee_id)
        el.employee_id, el.lat, el.lng, el.accuracy, el.heading, el.speed,
        el.booking_id, el.recorded_at,
        u.name as employee_name
       FROM employee_locations el
       JOIN users u ON u.id = el.employee_id
       WHERE el.vendor_id = ${vendorId}
         AND el.recorded_at > NOW() - INTERVAL '30 minutes'
       ORDER BY employee_id, recorded_at DESC`
    );

    return res.json(locations ?? []);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/tracking/vendor/active — LiveMap: employee locations + active booking count
// Returns { employees: [...], activeBookingsCount: N }
router.get('/vendor/active', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });
    const locations = await db.execute(
      sql`SELECT DISTINCT ON (el.employee_id)
        el.employee_id as id, el.lat, el.lng, el.accuracy, el.heading, el.speed,
        el.booking_id, el.recorded_at,
        u.name as employee_name
       FROM employee_locations el
       JOIN users u ON u.id = el.employee_id
       WHERE el.vendor_id = ${vendorId}
         AND el.recorded_at > NOW() - INTERVAL '30 minutes'
       ORDER BY el.employee_id, el.recorded_at DESC`
    );

    const employees = (locations ?? []) as any[];
    const activeBookingsCount = employees.filter((e: any) => e.booking_id).length;

    return res.json({ employees, activeBookingsCount });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
