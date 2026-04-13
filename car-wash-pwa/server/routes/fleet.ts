import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  fleetVehicles,
  fleetMaintenance,
  maintenanceSettings,
  users,
  vehicleCrewMembers,
  bookings,
} from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── FLEET VEHICLES ──────────────────────────────────────────────────────────

// GET /api/fleet — list all vendor vehicles with last maintenance + alert status
router.get('/', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicles = await db
      .select({
        vehicle: fleetVehicles,
        employee: {
          id: users.id,
          name: users.name,
          phone: users.phone,
        },
      })
      .from(fleetVehicles)
      .leftJoin(users, eq(fleetVehicles.assignedEmployeeId, users.id))
      .where(and(eq(fleetVehicles.vendorId, vendorId), eq(fleetVehicles.isActive, true)))
      .orderBy(desc(fleetVehicles.createdAt));

    // For each vehicle, get last maintenance + settings
    const result = await Promise.all(
      vehicles.map(async ({ vehicle, employee }) => {
        const [lastMaint] = await db
          .select()
          .from(fleetMaintenance)
          .where(eq(fleetMaintenance.vehicleId, vehicle.id))
          .orderBy(desc(fleetMaintenance.performedAt))
          .limit(1);

        const [settings] = await db
          .select()
          .from(maintenanceSettings)
          .where(eq(maintenanceSettings.vehicleId, vehicle.id))
          .limit(1);

        let kmUntilDue: number | null = null;
        let daysUntilDue: number | null = null;
        let isOverdue = false;

        if (settings?.nextServiceMileage && vehicle.currentMileage != null) {
          kmUntilDue = settings.nextServiceMileage - vehicle.currentMileage;
          if (kmUntilDue <= 0) isOverdue = true;
        }

        if (settings?.nextServiceDate) {
          daysUntilDue = Math.ceil(
            (new Date(settings.nextServiceDate).getTime() - Date.now()) / 86400000,
          );
          if (daysUntilDue <= 0) isOverdue = true;
        }

        const alertKmBefore = settings?.alertAtKmBefore ?? 500;
        const needsAlert =
          (kmUntilDue != null && kmUntilDue <= alertKmBefore) ||
          (daysUntilDue != null && daysUntilDue <= 7);

        return {
          ...vehicle,
          assignedEmployee: employee?.id ? employee : null,
          lastMaintenance: lastMaint ?? null,
          settings: settings ?? null,
          kmUntilDue,
          daysUntilDue,
          isOverdue,
          needsAlert,
        };
      }),
    );

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/fleet/alerts — vehicles due for maintenance
router.get('/alerts', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicles = await db
      .select()
      .from(fleetVehicles)
      .where(and(eq(fleetVehicles.vendorId, vendorId), eq(fleetVehicles.isActive, true)));

    const alerts = [];

    for (const vehicle of vehicles) {
      const [settings] = await db
        .select()
        .from(maintenanceSettings)
        .where(eq(maintenanceSettings.vehicleId, vehicle.id))
        .limit(1);

      if (!settings) continue;

      let kmUntilDue: number | null = null;
      let daysUntilDue: number | null = null;
      let isOverdue = false;
      let shouldAlert = false;

      if (settings.nextServiceMileage && vehicle.currentMileage != null) {
        kmUntilDue = settings.nextServiceMileage - vehicle.currentMileage;
        const alertBefore = settings.alertAtKmBefore ?? 500;
        if (kmUntilDue <= alertBefore) {
          shouldAlert = true;
          if (kmUntilDue <= 0) isOverdue = true;
        }
      }

      if (settings.nextServiceDate) {
        daysUntilDue = Math.ceil(
          (new Date(settings.nextServiceDate).getTime() - Date.now()) / 86400000,
        );
        if (daysUntilDue <= 7) {
          shouldAlert = true;
          if (daysUntilDue <= 0) isOverdue = true;
        }
      }

      if (shouldAlert) {
        alerts.push({ vehicle, settings, kmUntilDue, daysUntilDue, isOverdue });
      }
    }

    return res.json(alerts);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/fleet/with-crew — all vehicles with their crew + availability
router.get('/with-crew', requireRole('vendor_admin', 'admin', 'super_admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    // Get all active vehicles for this vendor
    const fleetRows = await db
      .select()
      .from(fleetVehicles)
      .where(and(eq(fleetVehicles.vendorId, vendorId), eq(fleetVehicles.isActive, true)))
      .orderBy(desc(fleetVehicles.createdAt));

    // Get all active crew assignments for this vendor (join users)
    const crewRows = await db
      .select({
        vehicleId: vehicleCrewMembers.vehicleId,
        role: vehicleCrewMembers.role,
        employeeId: users.id,
        name: users.name,
        phone: users.phone,
        isOnDuty: users.isOnDuty,
      })
      .from(vehicleCrewMembers)
      .leftJoin(users, eq(vehicleCrewMembers.employeeId, users.id))
      .where(and(eq(vehicleCrewMembers.vendorId, vendorId), eq(vehicleCrewMembers.isActive, true)));

    // Get active bookings for this vendor (not cancelled/completed)
    const activeBookings = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        scheduledAt: bookings.scheduledAt,
        fleetVehicleId: bookings.fleetVehicleId,
        status: bookings.status,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
          sql`${bookings.fleetVehicleId} IS NOT NULL`,
        ),
      );

    // Build crew map: vehicleId → crew[]
    const crewByVehicle: Record<number, Array<{ id: number; name: string; phone: string; role: string; isOnDuty: boolean | null }>> = {};
    for (const row of crewRows) {
      if (!row.employeeId) continue;
      if (!crewByVehicle[row.vehicleId]) crewByVehicle[row.vehicleId] = [];
      crewByVehicle[row.vehicleId].push({
        id: row.employeeId,
        name: row.name ?? '',
        phone: row.phone ?? '',
        role: row.role,
        isOnDuty: row.isOnDuty,
      });
    }

    // Build active booking map: fleetVehicleId → booking
    const bookingByVehicle: Record<number, { id: number; bookingNumber: string; scheduledAt: Date }> = {};
    for (const b of activeBookings) {
      if (b.fleetVehicleId && !bookingByVehicle[b.fleetVehicleId]) {
        bookingByVehicle[b.fleetVehicleId] = {
          id: b.id,
          bookingNumber: b.bookingNumber,
          scheduledAt: b.scheduledAt,
        };
      }
    }

    const result = fleetRows.map((v) => ({
      id: v.id,
      nameAr: v.nameAr,
      plateNumber: v.plateNumber,
      type: v.type,
      isActive: v.isActive,
      status: v.status,
      crew: crewByVehicle[v.id] ?? [],
      currentBooking: bookingByVehicle[v.id] ?? null,
      isAvailable: !bookingByVehicle[v.id],
    }));

    return res.json({ vehicles: result });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/fleet/:vehicleId/crew — list crew members
router.get('/:vehicleId/crew', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.vehicleId);

    const crew = await db
      .select({
        id: vehicleCrewMembers.id,
        role: vehicleCrewMembers.role,
        isActive: vehicleCrewMembers.isActive,
        assignedAt: vehicleCrewMembers.assignedAt,
        employee: {
          id: users.id,
          name: users.name,
          phone: users.phone,
          isOnDuty: users.isOnDuty,
        },
      })
      .from(vehicleCrewMembers)
      .leftJoin(users, eq(vehicleCrewMembers.employeeId, users.id))
      .where(
        and(
          eq(vehicleCrewMembers.vehicleId, vehicleId),
          eq(vehicleCrewMembers.vendorId, vendorId),
          eq(vehicleCrewMembers.isActive, true),
        ),
      );

    return res.json(crew);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/fleet/:vehicleId/crew — assign employee to vehicle crew
router.post('/:vehicleId/crew', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.vehicleId);
    const { employeeId, role } = z
      .object({ employeeId: z.number().int(), role: z.enum(['driver', 'technician']) })
      .parse(req.body);

    // Check employee belongs to same vendor
    const [employee] = await db
      .select({ id: users.id, vendorId: users.vendorId })
      .from(users)
      .where(and(eq(users.id, employeeId), eq(users.isActive, true)))
      .limit(1);

    if (!employee) return res.status(404).json({ error: 'الموظف غير موجود' });
    if (employee.vendorId !== vendorId) return res.status(403).json({ error: 'الموظف لا ينتمي لهذه المغسلة' });

    // If adding a driver, ensure no other active driver on this vehicle
    if (role === 'driver') {
      const [existingDriver] = await db
        .select({ id: vehicleCrewMembers.id })
        .from(vehicleCrewMembers)
        .where(
          and(
            eq(vehicleCrewMembers.vehicleId, vehicleId),
            eq(vehicleCrewMembers.vendorId, vendorId),
            eq(vehicleCrewMembers.role, 'driver'),
            eq(vehicleCrewMembers.isActive, true),
          ),
        )
        .limit(1);

      if (existingDriver) {
        return res.status(409).json({ error: 'هذه المركبة لديها سائق بالفعل — أزل السائق الحالي أولاً' });
      }
    }

    // Check if employee already assigned to this vehicle
    const [existing] = await db
      .select({ id: vehicleCrewMembers.id })
      .from(vehicleCrewMembers)
      .where(
        and(
          eq(vehicleCrewMembers.vehicleId, vehicleId),
          eq(vehicleCrewMembers.employeeId, employeeId),
          eq(vehicleCrewMembers.isActive, true),
        ),
      )
      .limit(1);

    if (existing) return res.status(409).json({ error: 'الموظف مضاف بالفعل لطاقم هذه المركبة' });

    const [record] = await db
      .insert(vehicleCrewMembers)
      .values({ vehicleId, employeeId, vendorId, role })
      .returning();

    return res.status(201).json(record);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/fleet/:vehicleId/crew/:employeeId — remove employee from crew
router.delete('/:vehicleId/crew/:employeeId', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.vehicleId);
    const employeeId = Number(req.params.employeeId);

    await db
      .update(vehicleCrewMembers)
      .set({ isActive: false })
      .where(
        and(
          eq(vehicleCrewMembers.vehicleId, vehicleId),
          eq(vehicleCrewMembers.employeeId, employeeId),
          eq(vehicleCrewMembers.vendorId, vendorId),
        ),
      );

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/fleet — add new vehicle
router.post('/', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const data = z
      .object({
        nameAr: z.string().min(1),
        type: z.enum(['car', 'pickup', 'water_tank', 'van', 'motorcycle', 'equipment']),
        plateNumber: z.string().optional(),
        color: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        year: z.number().int().optional(),
        currentMileage: z.number().int().default(0),
        assignedEmployeeId: z.number().int().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const [vehicle] = await db
      .insert(fleetVehicles)
      .values({ ...data, vendorId, lastMileageUpdate: data.currentMileage ? new Date() : null })
      .returning();

    // Create default maintenance settings
    await db.insert(maintenanceSettings).values({
      vehicleId: vehicle.id,
      vendorId,
      mileageIntervalKm: 5000,
      alertAtKmBefore: 500,
      notifyViaApp: true,
      notifyViaWhatsapp: true,
    });

    return res.status(201).json(vehicle);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/fleet/:id — update vehicle
router.put('/:id', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const id = Number(req.params.id);
    const data = z
      .object({
        nameAr: z.string().min(1).optional(),
        type: z.enum(['car', 'pickup', 'water_tank', 'van', 'motorcycle', 'equipment']).optional(),
        plateNumber: z.string().optional(),
        color: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        year: z.number().int().optional(),
        status: z.enum(['active', 'maintenance', 'inactive', 'sold']).optional(),
        assignedEmployeeId: z.number().int().nullable().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const [updated] = await db
      .update(fleetVehicles)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(fleetVehicles.id, id), eq(fleetVehicles.vendorId, vendorId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'المركبة غير موجودة' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/fleet/:id — deactivate
router.delete('/:id', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const id = Number(req.params.id);
    const [updated] = await db
      .update(fleetVehicles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fleetVehicles.id, id), eq(fleetVehicles.vendorId, vendorId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'المركبة غير موجودة' });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/fleet/:id/update-mileage
router.post('/:id/update-mileage', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const id = Number(req.params.id);
    const { currentMileage } = z.object({ currentMileage: z.number().int().min(0) }).parse(req.body);

    const [existing] = await db
      .select()
      .from(fleetVehicles)
      .where(and(eq(fleetVehicles.id, id), eq(fleetVehicles.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'المركبة غير موجودة' });

    if (currentMileage < (existing.currentMileage ?? 0)) {
      return res.status(400).json({ error: 'العداد الجديد لا يمكن أن يكون أقل من الحالي' });
    }

    const [updated] = await db
      .update(fleetVehicles)
      .set({ currentMileage, lastMileageUpdate: new Date(), updatedAt: new Date() })
      .where(eq(fleetVehicles.id, id))
      .returning();

    // Get settings to return km remaining
    const [settings] = await db
      .select()
      .from(maintenanceSettings)
      .where(eq(maintenanceSettings.vehicleId, id))
      .limit(1);

    const kmUntilDue =
      settings?.nextServiceMileage != null ? settings.nextServiceMileage - currentMileage : null;

    return res.json({ vehicle: updated, kmUntilDue });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── MAINTENANCE RECORDS ──────────────────────────────────────────────────────

// GET /api/fleet/:id/maintenance
router.get('/:id/maintenance', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.id);

    const records = await db
      .select({
        record: fleetMaintenance,
        employee: { id: users.id, name: users.name },
      })
      .from(fleetMaintenance)
      .leftJoin(users, eq(fleetMaintenance.performedBy, users.id))
      .where(
        and(
          eq(fleetMaintenance.vehicleId, vehicleId),
          eq(fleetMaintenance.vendorId, vendorId),
        ),
      )
      .orderBy(desc(fleetMaintenance.performedAt));

    return res.json(records.map(({ record, employee }) => ({ ...record, performedByEmployee: employee?.id ? employee : null })));
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/fleet/:id/maintenance
router.post('/:id/maintenance', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.id);

    const data = z
      .object({
        type: z.enum(['oil_change', 'tire_rotation', 'brake_check', 'full_service', 'repair', 'inspection', 'other']),
        descriptionAr: z.string().optional(),
        mileageAtService: z.number().int().min(0),
        cost: z.string().optional(),
        serviceProvider: z.string().optional(),
        performedAt: z.string().optional(),
        performedBy: z.number().int().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const performedAt = data.performedAt ? new Date(data.performedAt) : new Date();

    const [record] = await db
      .insert(fleetMaintenance)
      .values({ ...data, vehicleId, vendorId, performedAt })
      .returning();

    // Auto-update vehicle mileage if higher
    const [vehicle] = await db
      .select()
      .from(fleetVehicles)
      .where(eq(fleetVehicles.id, vehicleId))
      .limit(1);

    if (vehicle && data.mileageAtService > (vehicle.currentMileage ?? 0)) {
      await db
        .update(fleetVehicles)
        .set({ currentMileage: data.mileageAtService, lastMileageUpdate: new Date(), updatedAt: new Date() })
        .where(eq(fleetVehicles.id, vehicleId));
    }

    // Recalculate next service mileage & date
    const [settings] = await db
      .select()
      .from(maintenanceSettings)
      .where(eq(maintenanceSettings.vehicleId, vehicleId))
      .limit(1);

    if (settings) {
      const nextServiceMileage = data.mileageAtService + (settings.mileageIntervalKm ?? 5000);
      let nextServiceDate: Date | undefined;

      if (settings.timeIntervalDays) {
        nextServiceDate = new Date(performedAt.getTime() + settings.timeIntervalDays * 86400000);
      }

      await db
        .update(maintenanceSettings)
        .set({
          nextServiceMileage,
          ...(nextServiceDate ? { nextServiceDate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(maintenanceSettings.vehicleId, vehicleId));
    }

    const nextServiceMileage = settings
      ? data.mileageAtService + (settings.mileageIntervalKm ?? 5000)
      : null;

    return res.status(201).json({ record, nextServiceMileage });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/fleet/maintenance/:recordId
router.delete('/maintenance/:recordId', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const recordId = Number(req.params.recordId);
    await db
      .delete(fleetMaintenance)
      .where(and(eq(fleetMaintenance.id, recordId), eq(fleetMaintenance.vendorId, vendorId)));

    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── MAINTENANCE SETTINGS ─────────────────────────────────────────────────────

// GET /api/fleet/:id/settings
router.get('/:id/settings', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.id);
    const [settings] = await db
      .select()
      .from(maintenanceSettings)
      .where(and(eq(maintenanceSettings.vehicleId, vehicleId), eq(maintenanceSettings.vendorId, vendorId)))
      .limit(1);

    if (!settings) return res.status(404).json({ error: 'الإعدادات غير موجودة' });
    return res.json(settings);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/fleet/:id/settings
router.put('/:id/settings', requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'يتطلب ارتباطاً بمغسلة' });

    const vehicleId = Number(req.params.id);
    const data = z
      .object({
        mileageIntervalKm: z.number().int().min(1000).optional(),
        timeIntervalDays: z.number().int().nullable().optional(),
        notifyViaApp: z.boolean().optional(),
        notifyViaWhatsapp: z.boolean().optional(),
        alertAtKmBefore: z.number().int().min(100).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);

    const [settings] = await db
      .select()
      .from(maintenanceSettings)
      .where(and(eq(maintenanceSettings.vehicleId, vehicleId), eq(maintenanceSettings.vendorId, vendorId)))
      .limit(1);

    if (!settings) return res.status(404).json({ error: 'الإعدادات غير موجودة' });

    const [updated] = await db
      .update(maintenanceSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(maintenanceSettings.vehicleId, vehicleId))
      .returning();

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
