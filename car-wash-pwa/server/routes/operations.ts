import { Router } from 'express';
import { db } from '../db/index.js';
import {
  bookings,
  users,
  fleetVehicles,
  maintenanceSettings,
  employeeShifts,
  packages,
  services,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, isNull, count, not } from 'drizzle-orm';
import { requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── GET /api/operations/alerts ───────────────────────────────────────────────
// Returns smart operational alerts for the vendor dashboard
router.get('/alerts', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const alerts: Array<{
      type: 'unassigned_booking' | 'employee_not_ready' | 'maintenance_due';
      severity: 'high' | 'medium' | 'low';
      message: string;
      actionUrl: string;
      actionLabel: string;
      data: Record<string, unknown>;
    }> = [];

    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // ── 1. Unassigned bookings within next 3 hours ────────────────────────────
    const unassignedBookings = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        scheduledAt: bookings.scheduledAt,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          eq(bookings.status, 'pending'),
          isNull(bookings.fleetVehicleId),
          gte(bookings.scheduledAt, now),
          lte(bookings.scheduledAt, threeHoursLater),
        ),
      );

    for (const booking of unassignedBookings) {
      const timeStr = booking.scheduledAt
        ? new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(
            new Date(booking.scheduledAt),
          )
        : '—';

      alerts.push({
        type: 'unassigned_booking',
        severity: 'high',
        message: `حجز #${booking.bookingNumber} موعده الساعة ${timeStr} لم يُعيَّن لسيارة`,
        actionUrl: '/vendor/dispatch',
        actionLabel: 'تعيين الآن',
        data: {
          bookingId: booking.id,
          bookingNumber: booking.bookingNumber,
          scheduledAt: booking.scheduledAt,
          customerName: booking.customerName,
        },
      });
    }

    // ── 2. Employees with shifts today but not on duty AND have assigned bookings ─
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's shifts
    const todayShifts = await db
      .select({
        employeeId: employeeShifts.employeeId,
        employeeName: users.name,
        employeePhone: users.phone,
        startTime: employeeShifts.startTime,
        isOnDuty: users.isOnDuty,
      })
      .from(employeeShifts)
      .leftJoin(users, eq(employeeShifts.employeeId, users.id))
      .where(
        and(
          eq(employeeShifts.vendorId, vendorId),
          gte(employeeShifts.date, todayStart),
          lte(employeeShifts.date, todayEnd),
          not(eq(employeeShifts.status, 'cancelled')),
        ),
      );

    for (const shift of todayShifts) {
      if (shift.isOnDuty || !shift.employeeId) continue;

      // Check if this employee has a booking today
      const [assignedBooking] = await db
        .select({ id: bookings.id, scheduledAt: bookings.scheduledAt })
        .from(bookings)
        .where(
          and(
            eq(bookings.vendorId, vendorId),
            eq(bookings.employeeId, shift.employeeId),
            gte(bookings.scheduledAt, todayStart),
            lte(bookings.scheduledAt, todayEnd),
            sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
          ),
        )
        .limit(1);

      if (assignedBooking) {
        const timeStr = assignedBooking.scheduledAt
          ? new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(
              new Date(assignedBooking.scheduledAt),
            )
          : '—';

        alerts.push({
          type: 'employee_not_ready',
          severity: 'medium',
          message: `${shift.employeeName ?? 'موظف'} لديه حجز الساعة ${timeStr} ولم يضغط جاهز`,
          actionUrl: `tel:${shift.employeePhone ?? ''}`,
          actionLabel: 'اتصل به',
          data: {
            employeeId: shift.employeeId,
            employeeName: shift.employeeName,
            employeePhone: shift.employeePhone,
            shiftStart: shift.startTime,
            bookingId: assignedBooking.id,
            scheduledAt: assignedBooking.scheduledAt,
          },
        });
      }
    }

    // ── 3. Vehicles due for maintenance ──────────────────────────────────────
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const vehiclesWithSettings = await db
      .select({
        vehicleId: fleetVehicles.id,
        vehicleName: fleetVehicles.nameAr,
        plateNumber: fleetVehicles.plateNumber,
        currentMileage: fleetVehicles.currentMileage,
        nextServiceMileage: maintenanceSettings.nextServiceMileage,
        nextServiceDate: maintenanceSettings.nextServiceDate,
        alertAtKmBefore: maintenanceSettings.alertAtKmBefore,
      })
      .from(fleetVehicles)
      .leftJoin(maintenanceSettings, eq(maintenanceSettings.vehicleId, fleetVehicles.id))
      .where(
        and(
          eq(fleetVehicles.vendorId, vendorId),
          eq(fleetVehicles.isActive, true),
        ),
      );

    for (const v of vehiclesWithSettings) {
      let shouldAlert = false;
      let reason = '';

      const kmUntilDue =
        v.nextServiceMileage != null && v.currentMileage != null
          ? v.nextServiceMileage - v.currentMileage
          : null;

      const alertKm = v.alertAtKmBefore ?? 500;

      if (kmUntilDue != null && kmUntilDue <= alertKm) {
        shouldAlert = true;
        reason =
          kmUntilDue <= 0
            ? `متأخرة — كان يجب الصيانة منذ ${Math.abs(kmUntilDue)} كم`
            : `الصيانة بعد ${kmUntilDue} كم`;
      }

      if (v.nextServiceDate) {
        const daysUntilDue = Math.ceil(
          (new Date(v.nextServiceDate).getTime() - now.getTime()) / 86400000,
        );
        if (daysUntilDue <= 7) {
          shouldAlert = true;
          reason =
            daysUntilDue <= 0
              ? `موعد الصيانة قد انتهى`
              : `الصيانة بعد ${daysUntilDue} يوم`;
        }
      }

      if (shouldAlert) {
        const plate = v.plateNumber ? ` (${v.plateNumber})` : '';
        alerts.push({
          type: 'maintenance_due',
          severity: 'low',
          message: `${v.vehicleName ?? 'مركبة'}${plate} — ${reason}`,
          actionUrl: '/vendor/fleet',
          actionLabel: 'عرض الأسطول',
          data: {
            vehicleId: v.vehicleId,
            vehicleName: v.vehicleName,
            plateNumber: v.plateNumber,
            kmUntilDue,
          },
        });
      }
    }

    return res.json({ alerts });
  } catch (e) {
    console.error('[GET /operations/alerts]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/operations/today-summary ───────────────────────────────────────
// Quick stats for today: bookings count, revenue, active vehicles
router.get('/today-summary', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const yesterdayEnd = new Date(todayStart.getTime() - 1);

    const [[todayBookingsCount], [completedCount], [todayRevenue], [yesterdayRevenue], [activeVehicles]] =
      await Promise.all([
        // Today's total bookings
        db
          .select({ count: count() })
          .from(bookings)
          .where(
            and(
              eq(bookings.vendorId, vendorId),
              gte(bookings.scheduledAt, todayStart),
              lte(bookings.scheduledAt, todayEnd),
              sql`${bookings.status} != 'cancelled'`,
            ),
          ),
        // Completed today
        db
          .select({ count: count() })
          .from(bookings)
          .where(
            and(
              eq(bookings.vendorId, vendorId),
              eq(bookings.status, 'completed'),
              gte(bookings.updatedAt, todayStart),
              lte(bookings.updatedAt, todayEnd),
            ),
          ),
        // Revenue today from completed bookings
        db
          .select({ total: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)` })
          .from(bookings)
          .where(
            and(
              eq(bookings.vendorId, vendorId),
              eq(bookings.status, 'completed'),
              gte(bookings.updatedAt, todayStart),
              lte(bookings.updatedAt, todayEnd),
            ),
          ),
        // Revenue yesterday (for progress bar)
        db
          .select({ total: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)` })
          .from(bookings)
          .where(
            and(
              eq(bookings.vendorId, vendorId),
              eq(bookings.status, 'completed'),
              gte(bookings.updatedAt, yesterdayStart),
              lte(bookings.updatedAt, yesterdayEnd),
            ),
          ),
        // Active vehicles (with an active booking right now)
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${bookings.fleetVehicleId})` })
          .from(bookings)
          .where(
            and(
              eq(bookings.vendorId, vendorId),
              sql`${bookings.status} IN ('on_way','arrived','in_progress')`,
              sql`${bookings.fleetVehicleId} IS NOT NULL`,
            ),
          ),
      ]);

    const todayRevenueVal = parseFloat(todayRevenue.total ?? '0');
    const yesterdayRevenueVal = parseFloat(yesterdayRevenue.total ?? '0');
    const avgBookingValue =
      completedCount.count > 0 ? todayRevenueVal / completedCount.count : 0;

    return res.json({
      todayBookings: todayBookingsCount.count,
      completedToday: completedCount.count,
      todayRevenue: todayRevenueVal,
      yesterdayRevenue: yesterdayRevenueVal,
      avgBookingValue: Math.round(avgBookingValue * 100) / 100,
      activeVehicles: Number(activeVehicles.count),
    });
  } catch (e) {
    console.error('[GET /operations/today-summary]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /api/operations/bookings/today ──────────────────────────────────────
// Today's bookings with all enrichment data for the operations timeline
router.get('/bookings/today', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const result = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
        address: bookings.address,
        totalPrice: bookings.totalPrice,
        vehiclePlate: bookings.vehiclePlate,
        fleetVehicleId: bookings.fleetVehicleId,
        employeeId: bookings.employeeId,
        packageName: packages.name,
        serviceName: services.name,
        customerName: users.name,
        customerPhone: users.phone,
        assignedVehicleName: fleetVehicles.nameAr,
        assignedVehiclePlate: fleetVehicles.plateNumber,
      })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(fleetVehicles, eq(bookings.fleetVehicleId, fleetVehicles.id))
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.scheduledAt, todayStart),
          lte(bookings.scheduledAt, todayEnd),
        ),
      )
      .orderBy(bookings.scheduledAt);

    return res.json(result);
  } catch (e) {
    console.error('[GET /operations/bookings/today]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
