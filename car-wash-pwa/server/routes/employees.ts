import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, bookings, employeeStats, fleetVehicles, payrollRecords, employeeLocations } from '../db/schema.js';
import { eq, desc, and, gte, inArray, sql, count, avg } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

// In-memory ready-status store (per employee id)
const readyStatusStore = new Map<number, boolean>();

const router = Router();

// Admin: list employees
router.get('/', requireAuth, requireRole('admin', 'vendor_admin'), async (_req, res) => {
  try {
    const result = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.role, 'employee')).orderBy(desc(users.createdAt));

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: create employee
router.post('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      phone: z.string().min(10),
      password: z.string().min(6),
    }).parse(req.body);

    const existing = await db.select().from(users).where(eq(users.phone, data.phone)).limit(1);
    if (existing.length > 0) return res.status(409).json({ error: 'رقم الجوال مسجل مسبقاً' });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [emp] = await db.insert(users).values({
      name: data.name,
      phone: data.phone,
      passwordHash,
      role: 'employee',
    }).returning();

    return res.status(201).json({ id: emp.id, name: emp.name, phone: emp.phone });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: toggle employee active status
router.patch('/:id/toggle', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [emp] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const [updated] = await db.update(users)
      .set({ isActive: !emp.isActive })
      .where(eq(users.id, id))
      .returning();
    return res.json({ id: updated.id, isActive: updated.isActive });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: reset employee password
router.patch('/:id/password', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { password } = z.object({ password: z.string().min(6) }).parse(req.body);

    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Employee: set ready status
router.post('/ready-status', requireAuth, requireRole('employee', 'admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const { isReady } = z.object({ isReady: z.boolean() }).parse(req.body);
    const empId = req.user!.id;
    readyStatusStore.set(empId, isReady);
    return res.json({ ok: true, isReady });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Employee: get own ready status
router.get('/ready-status', requireAuth, async (req: AuthRequest, res) => {
  const empId = req.user!.id;
  return res.json({ isReady: readyStatusStore.get(empId) ?? false });
});

// PATCH /api/employees/:id/availability — toggle isOnDuty status
router.patch('/:id/availability', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { isOnDuty } = z.object({ isOnDuty: z.boolean() }).parse(req.body);
    const id = Number(req.params.id);
    await db.update(users).set({ isOnDuty }).where(eq(users.id, id));
    return res.json({ success: true, isOnDuty });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/employees/on-duty — all employees currently on duty for this vendor
router.get('/on-duty', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    // Get all on-duty employees for this vendor
    const onDutyEmployees = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        isOnDuty: users.isOnDuty,
      })
      .from(users)
      .where(and(eq(users.vendorId, vendorId), eq(users.role, 'employee'), eq(users.isOnDuty, true)));

    if (onDutyEmployees.length === 0) return res.json([]);

    const employeeIds = onDutyEmployees.map(e => e.id);

    // Get latest location per employee
    const latestLocations = await db
      .selectDistinctOn([employeeLocations.employeeId], {
        employeeId: employeeLocations.employeeId,
        lat: employeeLocations.lat,
        lng: employeeLocations.lng,
        recordedAt: employeeLocations.recordedAt,
      })
      .from(employeeLocations)
      .where(inArray(employeeLocations.employeeId, employeeIds))
      .orderBy(employeeLocations.employeeId, desc(employeeLocations.recordedAt));

    // Get current active bookings
    const activeBookings = await db
      .select({
        id: bookings.id,
        employeeId: bookings.employeeId,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        address: bookings.address,
        scheduledAt: bookings.scheduledAt,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.employeeId, employeeIds),
          inArray(bookings.status, ['on_way', 'arrived', 'in_progress']),
        ),
      );

    const locationMap: Record<number, { lat: string; lng: string; recordedAt: Date }> = {};
    latestLocations.forEach(l => { locationMap[l.employeeId] = { lat: l.lat, lng: l.lng, recordedAt: l.recordedAt }; });

    const bookingMap: Record<number, typeof activeBookings[0]> = {};
    activeBookings.forEach(b => { if (b.employeeId) bookingMap[b.employeeId] = b; });

    const result = onDutyEmployees.map(emp => ({
      ...emp,
      location: locationMap[emp.id] ?? null,
      activeBooking: bookingMap[emp.id] ?? null,
    }));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/employees/:id/stats — performance stats this month
router.get('/:id/stats', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.id);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get bookings-based stats this month
    const [statsRow] = await db
      .select({
        bookingsCompleted: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'completed' THEN 1 END)`,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'completed' THEN ${bookings.totalPrice}::numeric ELSE 0 END), 0)`,
        avgRating: sql<string>`ROUND(AVG(CASE WHEN ${bookings.rating} IS NOT NULL THEN ${bookings.rating} END)::numeric, 2)`,
      })
      .from(bookings)
      .where(and(eq(bookings.employeeId, employeeId), gte(bookings.scheduledAt, startOfMonth)));

    // Daily stats for last 7 days
    const last7Days = await db
      .select()
      .from(employeeStats)
      .where(
        and(
          eq(employeeStats.employeeId, employeeId),
          gte(employeeStats.date, new Date(Date.now() - 7 * 86400000)),
        ),
      )
      .orderBy(desc(employeeStats.date));

    // Get assigned fleet vehicle
    const [assignedVehicle] = await db
      .select({ id: fleetVehicles.id, nameAr: fleetVehicles.nameAr, type: fleetVehicles.type, plateNumber: fleetVehicles.plateNumber })
      .from(fleetVehicles)
      .where(eq(fleetVehicles.assignedEmployeeId, employeeId))
      .limit(1);

    return res.json({
      bookingsCompleted: Number(statsRow?.bookingsCompleted ?? 0),
      totalRevenue: Number(statsRow?.totalRevenue ?? 0),
      avgRating: statsRow?.avgRating ? Number(statsRow.avgRating) : null,
      dailyStats: last7Days,
      assignedVehicle: assignedVehicle ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/employees/:id/assign-vehicle — assign fleet vehicle to employee
router.post('/:id/assign-vehicle', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const employeeId = Number(req.params.id);
    const { vehicleId } = z.object({ vehicleId: z.number().int().nullable() }).parse(req.body);

    // Unassign from previous vehicle (if any)
    await db
      .update(fleetVehicles)
      .set({ assignedEmployeeId: null, updatedAt: new Date() })
      .where(and(eq(fleetVehicles.assignedEmployeeId, employeeId), eq(fleetVehicles.vendorId, vendorId)));

    if (vehicleId) {
      // Also unassign that vehicle from any previous employee
      await db
        .update(fleetVehicles)
        .set({ assignedEmployeeId: employeeId, updatedAt: new Date() })
        .where(and(eq(fleetVehicles.id, vehicleId), eq(fleetVehicles.vendorId, vendorId)));
    }

    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/employees/:id/performance?month=X&year=Y
router.get('/:id/performance', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.id);
    const now = new Date();
    const month = Number(req.query.month) || now.getMonth() + 1;
    const year = Number(req.query.year) || now.getFullYear();

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // Booking stats for the month
    const [bookingStats] = await db
      .select({
        completedBookings: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'completed' THEN 1 END)`,
        totalRevenue: sql<string>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'completed' THEN ${bookings.totalPrice}::numeric ELSE 0 END), 0)`,
        avgRating: sql<string>`ROUND(AVG(CASE WHEN ${bookings.rating} IS NOT NULL THEN ${bookings.rating} END)::numeric, 2)`,
        cancelledBookings: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'cancelled' THEN 1 END)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.employeeId, employeeId),
          gte(bookings.scheduledAt, monthStart),
          sql`${bookings.scheduledAt} < ${monthEnd}`,
        ),
      );

    // Payroll record for this employee/month/year
    const [payroll] = await db
      .select({
        baseSalary: payrollRecords.baseSalary,
        commissionAmount: payrollRecords.commissionAmount,
        totalAmount: payrollRecords.totalAmount,
        status: payrollRecords.status,
      })
      .from(payrollRecords)
      .where(
        and(
          eq(payrollRecords.employeeId, employeeId),
          eq(payrollRecords.month, month),
          eq(payrollRecords.year, year),
        ),
      )
      .limit(1);

    return res.json({
      employeeId,
      month,
      year,
      completedBookings: Number(bookingStats?.completedBookings ?? 0),
      totalRevenue: Number(bookingStats?.totalRevenue ?? 0),
      avgRating: bookingStats?.avgRating ? Number(bookingStats.avgRating) : null,
      cancelledBookings: Number(bookingStats?.cancelledBookings ?? 0),
      baseSalary: payroll ? Number(payroll.baseSalary) : null,
      commissionAmount: payroll ? Number(payroll.commissionAmount) : null,
      totalPayroll: payroll ? Number(payroll.totalAmount) : null,
      payrollStatus: payroll?.status ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
