/**
 * Appointment Booking Routes — Salon-style for fixed-location car washes
 *
 * Public:
 *   GET  /api/appointments/config?vendorId=X    → vendor booking config
 *   GET  /api/appointments/available             → time slots for a date
 *
 * Authenticated:
 *   PUT  /api/appointments/config                → (vendor_admin/admin) save config
 *   POST /api/appointments/book                  → customer books a slot
 *   GET  /api/appointments/my                    → customer's upcoming appointments
 *   DELETE /api/appointments/:id                 → customer cancels
 *   POST /api/appointments/:id/block-slot        → vendor blocks a slot
 *
 * Vendor schedule:
 *   GET  /api/appointments/schedule              → day view
 *   GET  /api/appointments/schedule/week         → week view
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  bookings, users, packages, services, vendors,
  vehicles, customers, notifications, appointmentSlots,
} from '../db/schema.js';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { notifyBookingConfirmed } from '../services/whatsapp.js';

const router = Router();

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingConfig {
  workingDays: number[];         // 0=Sun … 6=Sat
  startTime: string;             // "08:00"
  endTime: string;               // "20:00"
  slotDurationMin: number;       // 30 | 45 | 60
  carsPerSlot: number;           // 1-10
  advanceBookingDays: number;    // 7 | 14 | 30
  isAppointmentMode: boolean;    // false = walk-in queue only
}

const DEFAULT_CONFIG: BookingConfig = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '08:00',
  endTime: '20:00',
  slotDurationMin: 30,
  carsPerSlot: 2,
  advanceBookingDays: 7,
  isAppointmentMode: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingNumber(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `AP-${now}-${rand}`;
}

/** Generate HH:MM time slots from startTime to endTime every stepMin minutes */
function generateSlots(startTime: string, endTime: string, stepMin: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let current = sh * 60 + sm;
  const end = eh * 60 + em;
  while (current < end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    current += stepMin;
  }
  return slots;
}

/** Parse "YYYY-MM-DD HH:MM" → Date (UTC) */
function toUTC(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

/** Get vendor config from settings.bookingConfig with defaults */
async function getVendorConfig(vendorId: number): Promise<BookingConfig> {
  const [vendor] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) throw new Error('Vendor not found');
  const raw = (vendor.settings as any)?.bookingConfig as Partial<BookingConfig> | undefined;
  return { ...DEFAULT_CONFIG, ...raw };
}

// ─── GET /config ──────────────────────────────────────────────────────────────
// Public — customers browsing need this

router.get('/config', async (req, res) => {
  try {
    const vendorId = Number(req.query.vendorId);
    if (!vendorId || isNaN(vendorId)) return res.status(400).json({ error: 'vendorId مطلوب وصحيح' });
    const config = await getVendorConfig(vendorId);
    return res.json(config);
  } catch (e: any) {
    if (e?.message === 'Vendor not found') return res.status(404).json({ error: 'المتجر غير موجود' });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /config ──────────────────────────────────────────────────────────────
// Vendor admin only

const configSchema = z.object({
  workingDays: z.array(z.number().min(0).max(6)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMin: z.number().refine((v) => [15, 30, 45, 60].includes(v)),
  carsPerSlot: z.number().min(1).max(20),
  advanceBookingDays: z.number().min(1).max(60),
  isAppointmentMode: z.boolean(),
});

router.put('/config', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمنشأة' });
    const config = configSchema.parse(req.body);

    const [vendor] = await db.select({ settings: vendors.settings })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const currentSettings = (vendor?.settings as Record<string, unknown>) ?? {};

    await db.update(vendors)
      .set({
        settings: { ...currentSettings, bookingConfig: config },
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, vendorId));

    return res.json({ success: true, config });
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(422).json({ error: e.errors });
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /available ───────────────────────────────────────────────────────────
// Public — returns time slots for a date

router.get('/available', async (req, res) => {
  try {
    const { date, vendorId: vId } = req.query as Record<string, string>;
    const vendorId = Number(vId);

    if (!date || !vendorId) {
      return res.status(400).json({ error: 'date و vendorId مطلوبان' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'تنسيق التاريخ غير صحيح (YYYY-MM-DD)' });
    }

    const config = await getVendorConfig(vendorId);

    if (!config.isAppointmentMode) {
      return res.json({ appointmentMode: false, slots: [] });
    }

    // Check if this weekday is a working day
    const dayOfWeek = new Date(date).getDay();
    if (!config.workingDays.includes(dayOfWeek)) {
      return res.json({ appointmentMode: true, slots: [], closedDay: true });
    }

    // Advance booking limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000);
    if (diffDays > config.advanceBookingDays) {
      return res.json({ appointmentMode: true, slots: [], tooFarAhead: true });
    }

    // Generate slot times
    const slotTimes = generateSlots(config.startTime, config.endTime, config.slotDurationMin);

    // Fetch all confirmed/pending bookings for this vendor on this date
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const dayBookings = await db.select({ scheduledAt: bookings.scheduledAt })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.scheduledAt, dayStart),
          lte(bookings.scheduledAt, dayEnd),
          sql`${bookings.status} NOT IN ('cancelled')`,
        ),
      );

    // Fetch blocked slots from appointmentSlots table
    const blockedSlots = await db.select({ startTime: appointmentSlots.startTime })
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.vendorId, vendorId),
          eq(appointmentSlots.date, date),
          eq(appointmentSlots.isBlocked, true),
        ),
      );
    const blockedSet = new Set(blockedSlots.map((s) => s.startTime));

    // Count bookings per slot
    const countBySlot: Record<string, number> = {};
    for (const b of dayBookings) {
      if (!b.scheduledAt) continue;
      // Convert UTC scheduledAt to HH:MM
      const d = new Date(b.scheduledAt);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const key = `${hh}:${mm}`;
      countBySlot[key] = (countBySlot[key] ?? 0) + 1;
    }

    // Build slot list
    const now = new Date();
    const slots = slotTimes.map((time) => {
      const slotDateTime = toUTC(date, time);
      const bookedCount = countBySlot[time] ?? 0;
      const isBlocked = blockedSet.has(time);
      const isPast = slotDateTime < now;
      const available = !isBlocked && !isPast && bookedCount < config.carsPerSlot;
      return {
        time,
        available,
        bookedCount,
        capacity: config.carsPerSlot,
        isBlocked,
        isPast,
      };
    });

    return res.json({ appointmentMode: true, slots, config });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /book ───────────────────────────────────────────────────────────────
// Auth required (customer)

const bookSchema = z.object({
  vendorId: z.number(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  serviceId: z.number(),
  packageId: z.number().optional(),
  vehicleId: z.number().optional(),
  notes: z.string().optional(),
  // Marketing attribution from URL utm_* params (captured by client)
  utmSource:   z.string().max(100).optional(),
  utmMedium:   z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent:  z.string().max(200).optional(),
  utmTerm:     z.string().max(200).optional(),
});

router.post('/book', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = bookSchema.parse(req.body);
    const customerId = req.user!.id;
    const { vendorId, date, time } = data;

    // Re-validate availability (prevent double-booking)
    const config = await getVendorConfig(vendorId);
    const slotStart = toUTC(date, time);
    const slotEnd = new Date(slotStart.getTime() + config.slotDurationMin * 60000);

    const existing = await db.select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.scheduledAt, slotStart),
          lte(bookings.scheduledAt, slotEnd),
          sql`${bookings.status} NOT IN ('cancelled')`,
        ),
      );

    if (existing.length >= config.carsPerSlot) {
      return res.status(409).json({ error: 'هذا الموعد ممتلئ، يرجى اختيار وقت آخر' });
    }

    // Resolve package
    let resolvedPackageId = data.packageId;
    if (!resolvedPackageId) {
      // Pick first active package for this service
      const [pkg] = await db.select({ id: packages.id })
        .from(packages)
        .where(and(eq(packages.serviceId, data.serviceId), eq(packages.isActive, true)))
        .limit(1);
      if (!pkg) return res.status(404).json({ error: 'لا توجد باقات لهذه الخدمة' });
      resolvedPackageId = pkg.id;
    }

    const [pkg] = await db.select({ price: packages.price, name: packages.name })
      .from(packages).where(eq(packages.id, resolvedPackageId)).limit(1);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });

    // Ensure customer record
    let [customerRecord] = await db.select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.userId, customerId), eq(customers.vendorId, vendorId)))
      .limit(1);

    if (!customerRecord) {
      [customerRecord] = await db.insert(customers).values({
        userId: customerId,
        vendorId,
      }).returning({ id: customers.id });
    }

    // Create booking
    const [booking] = await db.insert(bookings).values({
      bookingNumber: generateBookingNumber(),
      vendorId,
      customerId,
      packageId: resolvedPackageId,
      vehicleId: data.vehicleId ?? null,
      scheduledAt: slotStart,
      address: 'موعد مسبق',
      status: 'confirmed',
      notes: data.notes ?? null,
      totalPrice: pkg.price,
      statusHistory: [{ status: 'confirmed', at: new Date().toISOString(), by: customerId }],
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
    }).returning();

    // Notify via WhatsApp (fire and forget)
    const [customer] = await db.select({ phone: users.phone })
      .from(users).where(eq(users.id, customerId)).limit(1);
    if (customer?.phone) {
      notifyBookingConfirmed(customer.phone, booking.bookingNumber, slotStart, pkg.name).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      booking: {
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        scheduledAt: booking.scheduledAt,
        status: booking.status,
      },
    });
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(422).json({ error: e.errors });
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /my ──────────────────────────────────────────────────────────────────

router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const customerId = req.user!.id;
    const now = new Date();

    const myBookings = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      scheduledAt: bookings.scheduledAt,
      status: bookings.status,
      notes: bookings.notes,
      totalPrice: bookings.totalPrice,
      packageName: packages.name,
      serviceName: services.name,
      vendorName: vendors.nameAr,
      vendorSlug: vendors.slug,
      vendorLogo: vendors.logoUrl,
    })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .leftJoin(vendors, eq(bookings.vendorId, vendors.id))
      .where(
        and(
          eq(bookings.customerId, customerId),
          gte(bookings.scheduledAt, now),
          sql`${bookings.status} NOT IN ('cancelled', 'completed')`,
        ),
      )
      .orderBy(asc(bookings.scheduledAt))
      .limit(20);

    return res.json(myBookings);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const customerId = req.user!.id;

    const [booking] = await db.select({ id: bookings.id, customerId: bookings.customerId, status: bookings.status })
      .from(bookings).where(eq(bookings.id, bookingId)).limit(1);

    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
    if (booking.customerId !== customerId && !['vendor_admin', 'admin'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (['completed', 'in_progress'].includes(booking.status)) {
      return res.status(400).json({ error: 'لا يمكن إلغاء حجز قيد التنفيذ' });
    }

    await db.update(bookings)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
        statusHistory: sql`status_history || ${JSON.stringify([{ status: 'cancelled', at: new Date().toISOString(), by: customerId }])}::jsonb`,
      })
      .where(eq(bookings.id, bookingId));

    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /schedule ────────────────────────────────────────────────────────────
// Vendor day view

router.get('/schedule', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمنشأة' });

    const date = (req.query.date as string) ?? new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const dayBookings = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      scheduledAt: bookings.scheduledAt,
      status: bookings.status,
      notes: bookings.notes,
      totalPrice: bookings.totalPrice,
      vehicleType: bookings.vehicleType,
      vehiclePlate: bookings.vehiclePlate,
      customerName: users.name,
      customerPhone: users.phone,
      packageName: packages.name,
      serviceName: services.name,
      employeeId: bookings.employeeId,
    })
      .from(bookings)
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.scheduledAt, dayStart),
          lte(bookings.scheduledAt, dayEnd),
        ),
      )
      .orderBy(asc(bookings.scheduledAt));

    // Get config for the timeline
    const config = await getVendorConfig(vendorId);

    return res.json({ date, bookings: dayBookings, config });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /schedule/week ───────────────────────────────────────────────────────

router.get('/schedule/week', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمنشأة' });

    const from = (req.query.from as string) ?? new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) ?? (() => {
      const d = new Date(from);
      d.setDate(d.getDate() + 6);
      return d.toISOString().slice(0, 10);
    })();

    const weekStart = new Date(`${from}T00:00:00.000Z`);
    const weekEnd = new Date(`${to}T23:59:59.999Z`);

    const weekBookings = await db.select({
      id: bookings.id,
      scheduledAt: bookings.scheduledAt,
      status: bookings.status,
    })
      .from(bookings)
      .where(
        and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.scheduledAt, weekStart),
          lte(bookings.scheduledAt, weekEnd),
          sql`${bookings.status} NOT IN ('cancelled')`,
        ),
      );

    // Group by date
    const byDate: Record<string, { date: string; count: number }> = {};
    for (const b of weekBookings) {
      const d = new Date(b.scheduledAt).toISOString().slice(0, 10);
      if (!byDate[d]) byDate[d] = { date: d, count: 0 };
      byDate[d].count++;
    }

    return res.json({ from, to, days: Object.values(byDate) });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /:id/block-slot ─────────────────────────────────────────────────────

const blockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().optional(),
});

router.post('/:id/block-slot', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمنشأة' });

    const data = blockSchema.parse(req.body);

    // Upsert into appointmentSlots
    const existing = await db.select({ id: appointmentSlots.id })
      .from(appointmentSlots)
      .where(
        and(
          eq(appointmentSlots.vendorId, vendorId),
          eq(appointmentSlots.date, data.date),
          eq(appointmentSlots.startTime, data.time),
        ),
      ).limit(1);

    if (existing.length > 0) {
      await db.update(appointmentSlots)
        .set({ isBlocked: true })
        .where(eq(appointmentSlots.id, existing[0].id));
    } else {
      const config = await getVendorConfig(vendorId);
      const [h, m] = data.time.split(':').map(Number);
      const endMin = h * 60 + m + config.slotDurationMin;
      const endH = Math.floor(endMin / 60);
      const endM = endMin % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      await db.insert(appointmentSlots).values({
        vendorId,
        date: data.date,
        startTime: data.time,
        endTime,
        capacity: config.carsPerSlot,
        isBlocked: true,
      });
    }

    return res.json({ success: true });
  } catch (e: any) {
    if (e.name === 'ZodError') return res.status(422).json({ error: e.errors });
    return res.status(500).json({ error: e.message });
  }
});

export default router;
