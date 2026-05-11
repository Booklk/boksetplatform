import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { recurringBookings, bookings, packages, services, customers, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { randomBytes } from 'crypto';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateBookingNumber(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RZ-${now}-${rand}`;
}

/**
 * Calculate the next scheduled date based on frequency and preferred day/time.
 * preferredDay: "0"-"6" (Sunday-Saturday)
 * preferredTime: "HH:mm"
 */
function calculateNextScheduledAt(frequency: string, preferredDay: number | string | null, preferredTime: string | null, fromDate?: Date): Date {
  const now = fromDate ?? new Date();
  const [hours, minutes] = (preferredTime ?? '09:00').split(':').map(Number);
  const targetDay = Number(preferredDay ?? 0);

  // Find the next occurrence of the preferred day
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  const currentDay = now.getDay();
  let daysUntilTarget = (targetDay - currentDay + 7) % 7;

  // If today is the target day but the time has passed, push to next cycle
  if (daysUntilTarget === 0 && next <= now) {
    daysUntilTarget = frequency === 'weekly' ? 7 : frequency === 'biweekly' ? 14 : 0;
  }

  if (frequency === 'monthly') {
    // For monthly: advance to the same day next month
    next.setMonth(next.getMonth() + 1);
    // Adjust to preferred day of the week in that month
    const monthStart = new Date(next.getFullYear(), next.getMonth(), 1);
    const firstTargetDay = (targetDay - monthStart.getDay() + 7) % 7;
    next.setDate(1 + firstTargetDay);
    // If this date is somehow in the past, add another month
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      const ms = new Date(next.getFullYear(), next.getMonth(), 1);
      const ftd = (targetDay - ms.getDay() + 7) % 7;
      next.setDate(1 + ftd);
    }
  } else {
    // weekly or biweekly
    if (daysUntilTarget === 0) {
      daysUntilTarget = frequency === 'biweekly' ? 14 : 7;
    }
    next.setDate(now.getDate() + daysUntilTarget);
    if (frequency === 'biweekly' && fromDate) {
      // If advancing from a previous booking, ensure 14-day gap
      next.setDate(now.getDate() + 14);
      // Re-adjust to preferred day
      const adjustedDay = next.getDay();
      const adjust = (targetDay - adjustedDay + 7) % 7;
      next.setDate(next.getDate() + adjust);
    }
  }

  next.setHours(hours, minutes, 0, 0);
  return next;
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const createRecurringSchema = z.object({
  customerId: z.number({ required_error: 'معرّف العميل مطلوب' }),
  packageId: z.number({ required_error: 'معرّف الباقة مطلوب' }),
  frequency: z.enum(['weekly', 'biweekly', 'monthly'], {
    errorMap: () => ({ message: 'التكرار يجب أن يكون أسبوعي أو نصف شهري أو شهري' }),
  }),
  preferredDay: z.string({ required_error: 'اليوم المفضل مطلوب' }).regex(/^[0-6]$/, 'اليوم يجب أن يكون بين 0 و 6'),
  preferredTime: z.string({ required_error: 'الوقت المفضل مطلوب' }).regex(/^\d{2}:\d{2}$/, 'الوقت يجب أن يكون بصيغة HH:mm'),
  address: z.string({ required_error: 'العنوان مطلوب' }).min(5, 'العنوان يجب أن يكون 5 أحرف على الأقل'),
  lat: z.string().optional(),
  lng: z.string().optional(),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
});

const updateRecurringSchema = z.object({
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  preferredDay: z.string().regex(/^[0-6]$/, 'اليوم يجب أن يكون بين 0 و 6').optional(),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'الوقت يجب أن يكون بصيغة HH:mm').optional(),
  address: z.string().min(5, 'العنوان يجب أن يكون 5 أحرف على الأقل').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// ─── GET / — List recurring bookings for this vendor ────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const result = await db
      .select({
        id: recurringBookings.id,
        vendorId: recurringBookings.vendorId,
        customerId: recurringBookings.customerId,
        packageId: recurringBookings.packageId,
        frequency: recurringBookings.frequency,
        preferredDay: recurringBookings.preferredDay,
        preferredTime: recurringBookings.preferredTime,
        address: recurringBookings.address,
        lat: recurringBookings.lat,
        lng: recurringBookings.lng,
        vehicleType: recurringBookings.vehicleType,
        vehiclePlate: recurringBookings.vehiclePlate,
        notes: recurringBookings.notes,
        isActive: recurringBookings.isActive,
        nextScheduledAt: recurringBookings.nextScheduledAt,
        lastBookingId: recurringBookings.lastBookingId,
        createdAt: recurringBookings.createdAt,
        customerName: users.name,
        customerPhone: users.phone,
        packageName: packages.name,
        serviceName: services.name,
      })
      .from(recurringBookings)
      .leftJoin(customers, eq(recurringBookings.customerId, customers.id))
      .leftJoin(users, eq(customers.userId, users.id))
      .leftJoin(packages, eq(recurringBookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .where(eq(recurringBookings.vendorId, vendorId))
      .orderBy(desc(recurringBookings.createdAt));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST / — Create recurring booking ──────────────────────────────────────

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const data = createRecurringSchema.parse(req.body);

    // Verify customer belongs to this vendor
    const [customer] = await db.select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, data.customerId), eq(customers.vendorId, vendorId)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود أو لا ينتمي لهذا المتجر' });

    // Verify package belongs to this vendor
    const [pkg] = await db.select({ id: packages.id })
      .from(packages)
      .where(and(eq(packages.id, data.packageId), eq(packages.vendorId, vendorId)))
      .limit(1);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة أو لا تنتمي لهذا المتجر' });

    const nextScheduledAt = calculateNextScheduledAt(data.frequency, data.preferredDay, data.preferredTime);

    const [recurring] = await db.insert(recurringBookings).values({
      vendorId,
      customerId: data.customerId,
      packageId: data.packageId,
      frequency: data.frequency,
      // Zod parses preferredDay as the regex string "0".."6" — coerce to int.
      preferredDay: parseInt(data.preferredDay, 10),
      preferredTime: data.preferredTime,
      address: data.address,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      vehicleType: data.vehicleType ?? null,
      vehiclePlate: data.vehiclePlate ?? null,
      notes: data.notes ?? null,
      isActive: true,
      nextScheduledAt,
    }).returning();

    return res.status(201).json(recurring);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /:id — Get single recurring booking ───────────────────────────────

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [result] = await db
      .select({
        id: recurringBookings.id,
        vendorId: recurringBookings.vendorId,
        customerId: recurringBookings.customerId,
        packageId: recurringBookings.packageId,
        frequency: recurringBookings.frequency,
        preferredDay: recurringBookings.preferredDay,
        preferredTime: recurringBookings.preferredTime,
        address: recurringBookings.address,
        lat: recurringBookings.lat,
        lng: recurringBookings.lng,
        vehicleType: recurringBookings.vehicleType,
        vehiclePlate: recurringBookings.vehiclePlate,
        notes: recurringBookings.notes,
        isActive: recurringBookings.isActive,
        nextScheduledAt: recurringBookings.nextScheduledAt,
        lastBookingId: recurringBookings.lastBookingId,
        createdAt: recurringBookings.createdAt,
        updatedAt: recurringBookings.updatedAt,
        customerName: users.name,
        customerPhone: users.phone,
        packageName: packages.name,
        packagePrice: packages.price,
        serviceName: services.name,
      })
      .from(recurringBookings)
      .leftJoin(customers, eq(recurringBookings.customerId, customers.id))
      .leftJoin(users, eq(customers.userId, users.id))
      .leftJoin(packages, eq(recurringBookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .where(and(eq(recurringBookings.id, id), eq(recurringBookings.vendorId, vendorId)))
      .limit(1);

    if (!result) return res.status(404).json({ error: 'الحجز المتكرر غير موجود' });

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /:id — Update recurring booking ────────────────────────────────────

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const data = updateRecurringSchema.parse(req.body);

    // Verify ownership
    const [existing] = await db.select()
      .from(recurringBookings)
      .where(and(eq(recurringBookings.id, id), eq(recurringBookings.vendorId, vendorId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'الحجز المتكرر غير موجود' });

    // Build update values
    const updateValues: Partial<typeof recurringBookings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.frequency !== undefined) updateValues.frequency = data.frequency;
    if (data.preferredDay !== undefined) updateValues.preferredDay = parseInt(data.preferredDay, 10);
    if (data.preferredTime !== undefined) updateValues.preferredTime = data.preferredTime;
    if (data.address !== undefined) updateValues.address = data.address;
    if (data.isActive !== undefined) updateValues.isActive = data.isActive;
    if (data.notes !== undefined) updateValues.notes = data.notes;

    // Recalculate nextScheduledAt if frequency/day/time changed
    const newFrequency = data.frequency ?? existing.frequency;
    const newDay = data.preferredDay ?? existing.preferredDay;
    const newTime = data.preferredTime ?? existing.preferredTime;
    if (data.frequency !== undefined || data.preferredDay !== undefined || data.preferredTime !== undefined) {
      updateValues.nextScheduledAt = calculateNextScheduledAt(newFrequency, newDay, newTime);
    }

    const [updated] = await db.update(recurringBookings)
      .set(updateValues)
      .where(eq(recurringBookings.id, id))
      .returning();

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── DELETE /:id — Soft delete (isActive = false) ───────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [existing] = await db.select({ id: recurringBookings.id })
      .from(recurringBookings)
      .where(and(eq(recurringBookings.id, id), eq(recurringBookings.vendorId, vendorId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'الحجز المتكرر غير موجود' });

    await db.update(recurringBookings)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(recurringBookings.id, id));

    return res.json({ success: true, message: 'تم إيقاف الحجز المتكرر' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /:id/generate — Generate next booking from recurring ──────────────

router.post('/:id/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    // Fetch the recurring booking
    const [recurring] = await db.select()
      .from(recurringBookings)
      .where(and(eq(recurringBookings.id, id), eq(recurringBookings.vendorId, vendorId)))
      .limit(1);
    if (!recurring) return res.status(404).json({ error: 'الحجز المتكرر غير موجود' });
    if (!recurring.isActive) return res.status(400).json({ error: 'الحجز المتكرر غير نشط' });

    // Fetch the package to get the price
    const [pkg] = await db.select({ id: packages.id, price: packages.price, vendorId: packages.vendorId })
      .from(packages)
      .where(eq(packages.id, recurring.packageId))
      .limit(1);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });

    // Resolve customer userId from customers table
    const [customer] = await db.select({ userId: customers.userId })
      .from(customers)
      .where(eq(customers.id, recurring.customerId))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'العميل غير موجود' });

    const scheduledAt = recurring.nextScheduledAt ?? calculateNextScheduledAt(
      recurring.frequency,
      recurring.preferredDay,
      recurring.preferredTime,
    );

    const trackingToken = randomBytes(24).toString('hex');

    // Create the booking. The bookings.address column is NOT NULL, but
    // recurring.address is nullable — guard with an empty-string fallback
    // so we never violate the constraint.
    if (customer.userId == null) {
      return res.status(404).json({ error: 'حساب العميل غير موجود' });
    }
    const [newBooking] = await db.insert(bookings).values({
      bookingNumber: generateBookingNumber(),
      vendorId: recurring.vendorId,
      customerId: customer.userId,
      packageId: recurring.packageId,
      scheduledAt,
      address: recurring.address ?? '',
      lat: recurring.lat,
      lng: recurring.lng,
      vehicleType: recurring.vehicleType,
      vehiclePlate: recurring.vehiclePlate,
      notes: recurring.notes,
      totalPrice: pkg.price,
      status: 'pending',
      statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: req.user!.id }],
      trackingToken,
    }).returning();

    // Advance nextScheduledAt and record lastBookingId
    const nextScheduledAt = calculateNextScheduledAt(
      recurring.frequency,
      recurring.preferredDay,
      recurring.preferredTime,
      scheduledAt,
    );

    await db.update(recurringBookings)
      .set({
        nextScheduledAt,
        lastBookingId: newBooking.id,
        updatedAt: new Date(),
      })
      .where(eq(recurringBookings.id, id));

    return res.status(201).json({
      booking: newBooking,
      nextScheduledAt,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
