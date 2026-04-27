import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { bookings, users, packages, services, customers, financials, notifications, cancellationLogs, fleetVehicles, vehicleCrewMembers, invoices, vendors, bookingPhotos, serviceInventoryLinks, inventory, inventoryTransactions, abandonedBookings } from '../db/schema.js';
import { eq, desc, and, gte, lte, or, ilike, not, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  notifyBookingConfirmedWithTracking,
  notifyEmployeeOnWay,
  notifyArrived,
  notifyServiceCompleted,
  notifyGoogleReviewRequest,
  sendRawWhatsAppMessage,
} from '../services/whatsapp.js';
import { randomBytes } from 'crypto';
import { checkBookingAllowed } from '../services/planLimits.js';

const router = Router();

function generateBookingNumber(): string {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RZ-${now}-${rand}`;
}

const createBookingSchema = z.object({
  packageId: z.number(),
  scheduledAt: z.string(),
  address: z.string().min(5),
  lat: z.string().optional(),
  lng: z.string().optional(),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleModel: z.string().optional(),
  notes: z.string().optional(),
  // For employee creating booking for a customer
  customerId: z.number().optional(),
  // Marketing attribution — passed by client from URL query params
  utmSource:   z.string().max(100).optional(),
  utmMedium:   z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  utmContent:  z.string().max(200).optional(),
  utmTerm:     z.string().max(200).optional(),
});

// Customer: create booking
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createBookingSchema.parse(req.body);

    const [pkg] = await db.select({ id: packages.id, price: packages.price, name: packages.name, serviceId: packages.serviceId, vendorId: packages.vendorId })
      .from(packages).where(eq(packages.id, data.packageId)).limit(1);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });

    // Free-plan monthly booking limit
    const allowance = await checkBookingAllowed(pkg.vendorId);
    if (!allowance.allowed) {
      return res.status(402).json({
        error: allowance.error,
        usage: allowance.usage,
        upgradeRequired: { plan: 'pro' },
      });
    }

    const [svc] = await db.select({ name: services.name })
      .from(services).where(eq(services.id, pkg.serviceId)).limit(1);

    // Determine customer
    let customerId = req.user!.id;
    if (req.user!.role === 'employee' && data.customerId) {
      customerId = data.customerId;
    }

    const trackingToken = randomBytes(24).toString('hex');

    const [newBooking] = await db.insert(bookings).values({
      bookingNumber: generateBookingNumber(),
      customerId,
      vendorId: pkg.vendorId,
      packageId: data.packageId,
      scheduledAt: new Date(data.scheduledAt),
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      vehicleType: data.vehicleType,
      vehiclePlate: data.vehiclePlate,
      vehicleColor: data.vehicleColor,
      vehicleModel: data.vehicleModel,
      notes: data.notes,
      totalPrice: pkg.price,
      status: 'pending',
      statusHistory: [{ status: 'pending', at: new Date().toISOString(), by: req.user!.id }],
      trackingToken,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
    }).returning();

    // Auto-assign to nearest available vehicle (inside transaction to prevent double-booking)
    try {
      await db.transaction(async (tx) => {
        const availableVehicles = await tx
          .select({ vehicle: fleetVehicles, crewCount: sql<number>`count(${vehicleCrewMembers.id})` })
          .from(fleetVehicles)
          .leftJoin(vehicleCrewMembers, and(
            eq(vehicleCrewMembers.vehicleId, fleetVehicles.id),
            eq(vehicleCrewMembers.isActive, true)
          ))
          .where(and(
            eq(fleetVehicles.vendorId, pkg.vendorId),
            eq(fleetVehicles.isActive, true)
          ))
          .groupBy(fleetVehicles.id);

        const targetTime = newBooking.scheduledAt ? new Date(newBooking.scheduledAt).getTime() : Date.now();
        const windowMs = 90 * 60 * 1000;

        for (const { vehicle } of availableVehicles) {
          // Lock conflicting bookings row to prevent race condition
          const conflicts = await tx.select({ id: bookings.id })
            .from(bookings)
            .where(and(
              eq(bookings.fleetVehicleId, vehicle.id),
              not(eq(bookings.status, 'cancelled')),
              not(eq(bookings.status, 'completed')),
              gte(bookings.scheduledAt, new Date(targetTime - windowMs)),
              lte(bookings.scheduledAt, new Date(targetTime + windowMs)),
            ));

          if (conflicts.length === 0) {
            const [driver] = await tx.select()
              .from(vehicleCrewMembers)
              .where(and(
                eq(vehicleCrewMembers.vehicleId, vehicle.id),
                eq(vehicleCrewMembers.role, 'driver'),
                eq(vehicleCrewMembers.isActive, true)
              ));

            await tx.update(bookings)
              .set({
                fleetVehicleId: vehicle.id,
                ...(driver ? { employeeId: driver.employeeId, status: 'confirmed' } : {}),
              })
              .where(eq(bookings.id, newBooking.id));
            break;
          }
        }
      });
    } catch (e) {
      console.error('[Auto-assign]', e);
    }

    // Re-fetch booking to reflect any auto-assign updates
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, newBooking.id)).limit(1);

    // Get customer phone for WhatsApp notification
    const [customer] = await db.select({ phone: users.phone, name: users.name })
      .from(users).where(eq(users.id, customerId)).limit(1);

    if (customer) {
      const packageDisplayName = `${svc?.name ?? ''} - ${pkg.name}`;
      // Fetch vendor name for branded WhatsApp message
      const [vendorRow] = await db.select({ nameAr: vendors.nameAr })
        .from(vendors).where(eq(vendors.id, pkg.vendorId)).limit(1);
      const vendorName = vendorRow?.nameAr ?? 'المتجر';
      await notifyBookingConfirmedWithTracking(
        customer.phone,
        booking.bookingNumber,
        booking.scheduledAt,
        packageDisplayName,
        vendorName,
        booking.id,
        booking.trackingToken ?? undefined,
      );

      // Log notification
      await db.insert(notifications).values({
        bookingId: booking.id,
        userId: customerId,
        type: 'confirmation',
        phone: customer.phone,
        message: `تأكيد الحجز #${booking.bookingNumber}`,
        status: 'sent',
        sentAt: new Date(),
      });
    }

    return res.status(201).json(booking);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Vendor: create booking manually for walk-in / phone customer — MUST come before /:id
const manualBookingSchema = z.object({
  customerName: z.string().min(2, 'الاسم قصير جداً'),
  customerPhone: z.string().regex(/^(05\d{8}|5\d{8}|\+?9665\d{8})$/, 'رقم الجوال غير صحيح'),
  packageId: z.number(),
  scheduledAt: z.string(),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleModel: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('966')) return '0' + digits.slice(3);
  if (digits.length === 9 && digits.startsWith('5')) return '0' + digits;
  return digits;
}

router.post('/manual', requireAuth, requireRole('admin', 'vendor_admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const data = manualBookingSchema.parse(req.body);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const [pkg] = await db.select({
      id: packages.id, price: packages.price, name: packages.name,
      serviceId: packages.serviceId, vendorId: packages.vendorId,
    }).from(packages).where(eq(packages.id, data.packageId)).limit(1);
    if (!pkg) return res.status(404).json({ error: 'الباقة غير موجودة' });
    if (pkg.vendorId !== vendorId) return res.status(403).json({ error: 'الباقة لا تنتمي لمتجرك' });

    const phone = normalizePhone(data.customerPhone);

    // Find or create user by phone
    let [customerUser] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!customerUser) {
      [customerUser] = await db.insert(users).values({
        name: data.customerName,
        phone,
        role: 'customer',
      }).returning();
    }

    // Ensure a customer record exists for this vendor (idempotent)
    const existingCustomer = await db.select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.userId, customerUser.id), eq(customers.vendorId, vendorId)))
      .limit(1);
    if (existingCustomer.length === 0) {
      await db.insert(customers).values({
        userId: customerUser.id,
        vendorId,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        vehicleColor: data.vehicleColor,
        vehicleModel: data.vehicleModel,
        defaultAddress: data.address,
      });
    }

    const [svc] = await db.select({ name: services.name })
      .from(services).where(eq(services.id, pkg.serviceId)).limit(1);

    const trackingToken = randomBytes(24).toString('hex');

    const [booking] = await db.insert(bookings).values({
      bookingNumber: generateBookingNumber(),
      customerId: customerUser.id,
      vendorId,
      packageId: data.packageId,
      scheduledAt: new Date(data.scheduledAt),
      address: data.address ?? '',
      vehicleType: data.vehicleType,
      vehiclePlate: data.vehiclePlate,
      vehicleColor: data.vehicleColor,
      vehicleModel: data.vehicleModel,
      notes: data.notes,
      totalPrice: pkg.price,
      status: 'confirmed',
      statusHistory: [
        { status: 'pending', at: new Date().toISOString(), by: req.user!.id },
        { status: 'confirmed', at: new Date().toISOString(), by: req.user!.id },
      ],
      trackingToken,
    }).returning();

    // WhatsApp confirmation (non-blocking)
    try {
      const [vendorRow] = await db.select({ nameAr: vendors.nameAr })
        .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      const packageDisplayName = `${svc?.name ?? ''} - ${pkg.name}`;
      await notifyBookingConfirmedWithTracking(
        phone,
        booking.bookingNumber,
        booking.scheduledAt,
        packageDisplayName,
        vendorRow?.nameAr ?? 'المتجر',
        booking.id,
        booking.trackingToken ?? undefined,
      );
      await db.insert(notifications).values({
        bookingId: booking.id,
        userId: customerUser.id,
        type: 'confirmation',
        phone,
        message: `تأكيد الحجز #${booking.bookingNumber}`,
        status: 'sent',
        sentAt: new Date(),
      });
    } catch (e) {
      console.error('[Manual booking] WhatsApp notify failed', e);
    }

    return res.status(201).json(booking);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Employee: get assigned bookings — MUST come before /:id
router.get('/employee/assigned', requireAuth, requireRole('employee', 'admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const employeeId = req.user!.role === 'employee' ? req.user!.id : undefined;
    const whereClause = employeeId ? eq(bookings.employeeId, employeeId) : undefined;

    const result = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
        address: bookings.address,
        lat: bookings.lat,
        lng: bookings.lng,
        totalPrice: bookings.totalPrice,
        vehicleType: bookings.vehicleType,
        vehiclePlate: bookings.vehiclePlate,
        vehicleColor: bookings.vehicleColor,
        notes: bookings.notes,
        packageName: packages.name,
        serviceName: services.name,
        customerName: users.name,
        customerPhone: users.phone,
      })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .where(whereClause ?? eq(bookings.status, bookings.status))
      .orderBy(desc(bookings.scheduledAt));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Customer: my bookings
router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const myBookings = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
        address: bookings.address,
        totalPrice: bookings.totalPrice,
        rating: bookings.rating,
        vehiclePlate: bookings.vehiclePlate,
        packageName: packages.name,
        serviceName: services.name,
      })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .where(eq(bookings.customerId, req.user!.id))
      .orderBy(desc(bookings.scheduledAt));

    return res.json(myBookings);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Customer: get single booking
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);

    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Only owner, assigned employee, or same-vendor admin can view
    if (req.user!.role === 'customer' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if ((req.user!.role === 'vendor_admin' || req.user!.role === 'admin') && booking.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    return res.json(booking);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Customer: rate completed booking
router.post('/:id/rate', requireAuth, requireRole('customer'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { rating, comment } = z.object({
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
    }).parse(req.body);

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
    if (booking.customerId !== req.user!.id) return res.status(403).json({ error: 'غير مصرح' });
    if (booking.status !== 'completed') return res.status(400).json({ error: 'لا يمكن تقييم حجز غير مكتمل' });

    const [updated] = await db.update(bookings)
      .set({ rating, ratingComment: comment, ratedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Employee: update booking status
router.post('/:id/status', requireAuth, requireRole('employee', 'admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({
      status: z.enum(['confirmed', 'on_way', 'arrived', 'in_progress', 'completed', 'cancelled']),
    }).parse(req.body);

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Vendor isolation: employee/admin can only update their vendor's bookings
    if (req.user!.vendorId && booking.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Terminal state guard
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: 'لا يمكن تغيير حالة حجز مكتمل أو ملغى' });
    }

    const history = [...(booking.statusHistory ?? []), {
      status,
      at: new Date().toISOString(),
      by: req.user!.id,
    }];

    const [updated] = await db.update(bookings)
      .set({ status, statusHistory: history, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    // WhatsApp notifications
    const [customer] = await db.select({ phone: users.phone, name: users.name })
      .from(users).where(eq(users.id, booking.customerId)).limit(1);

    // Fetch vendor name for branded WhatsApp messages
    let statusVendorName = 'المتجر';
    if (booking.vendorId) {
      const [vRow] = await db.select({ nameAr: vendors.nameAr })
        .from(vendors).where(eq(vendors.id, booking.vendorId)).limit(1);
      if (vRow?.nameAr) statusVendorName = vRow.nameAr;
    }

    if (customer) {
      if (status === 'on_way') {
        const [emp] = await db.select({ name: users.name }).from(users)
          .where(eq(users.id, req.user!.id)).limit(1);
        await notifyEmployeeOnWay(customer.phone, booking.bookingNumber, emp?.name ?? 'الموظف', statusVendorName);
      } else if (status === 'arrived') {
        await notifyArrived(customer.phone, booking.bookingNumber, statusVendorName);
      } else if (status === 'completed') {
        await notifyServiceCompleted(customer.phone, booking.bookingNumber, statusVendorName);

        // Schedule Google Review request after 30 minutes
        if (booking.vendorId) {
          // Capture values for the async closure
          const completedCustomerPhone = customer.phone;
          const completedVendorId = booking.vendorId;
          const completedVendorName = statusVendorName;

          setTimeout(async () => {
            try {
              const [vRow] = await db.select({ googleReviewLink: vendors.googleReviewLink })
                .from(vendors).where(eq(vendors.id, completedVendorId)).limit(1);
              if (vRow?.googleReviewLink) {
                await notifyGoogleReviewRequest(completedCustomerPhone, completedVendorName, vRow.googleReviewLink);
              }
            } catch (e) {
              console.error('[Google Review Notify]', e);
            }
          }, 30 * 60 * 1000);
        }

        // Record income in financials
        if (booking.totalPrice && booking.vendorId) {
          await db.insert(financials).values({
            vendorId: booking.vendorId,
            type: 'income',
            category: 'booking',
            amount: booking.totalPrice,
            description: `إيراد حجز #${booking.bookingNumber}`,
            referenceId: booking.id,
            referenceType: 'booking',
            date: new Date(),
            createdBy: req.user!.id,
          });
        }

        // Auto-deduct linked inventory items
        try {
          const [pkg] = await db.select({ serviceId: packages.serviceId })
            .from(packages).where(eq(packages.id, booking.packageId)).limit(1);
          if (pkg?.serviceId) {
            const links = await db.select().from(serviceInventoryLinks)
              .where(and(eq(serviceInventoryLinks.serviceId, pkg.serviceId), eq(serviceInventoryLinks.vendorId, booking.vendorId)));
            for (const link of links) {
              await db.update(inventory)
                .set({ quantity: sql`GREATEST(0, CAST(${inventory.quantity} AS DECIMAL) - ${link.quantityPerUse})`, updatedAt: new Date() })
                .where(eq(inventory.id, link.inventoryId));
              await db.insert(inventoryTransactions).values({
                vendorId: booking.vendorId,
                inventoryId: link.inventoryId,
                type: 'out',
                quantity: link.quantityPerUse,
                notes: `خصم تلقائي — حجز #${booking.bookingNumber}`,
                createdBy: req.user!.id,
              });
            }
          }
        } catch (_e) { console.error('[inventory-deduct]', _e); }

        // Send before/after photos to customer via WhatsApp
        try {
          if (customer?.phone) {
            const photos = await db.select({ phase: bookingPhotos.phase, photoUrl: bookingPhotos.photoUrl })
              .from(bookingPhotos)
              .where(eq(bookingPhotos.bookingId, booking.id));
            const afterPhotos = photos.filter(p => p.phase === 'after');
            const beforePhotos = photos.filter(p => p.phase === 'before');
            if (afterPhotos.length > 0) {
              const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';
              const photoLinks = afterPhotos.map(p => `https://${DOMAIN}${p.photoUrl}`).join('\n');
              const beforeLink = beforePhotos.length > 0
                ? `\n\n📸 قبل:\n${beforePhotos.map(p => `https://${DOMAIN}${p.photoUrl}`).join('\n')}`
                : '';
              const msg = `✅ *${statusVendorName}* — تمت خدمة سيارتك!\n\n📸 بعد الغسلة:\n${photoLinks}${beforeLink}\n\n_سيارتك تلمع الآن! 🚗✨_`;
              await sendRawWhatsAppMessage(customer.phone, msg);
            }
          }
        } catch (_e) { console.error('[photos-wa]', _e); }

        // Auto-create draft invoice for this booking (silent fail)
        try {
          // Only create if one doesn't already exist
          const existing = await db.select({ id: invoices.id }).from(invoices)
            .where(eq(invoices.bookingId, booking.id)).limit(1);

          if (!existing.length) {
            // Get package + service name
            const [pkgRow] = await db
              .select({ pkgName: packages.name, svcName: services.name })
              .from(packages)
              .leftJoin(services, eq(packages.serviceId, services.id))
              .where(eq(packages.id, booking.packageId))
              .limit(1);

            // Get customer info
            const [custRow] = await db
              .select({ name: users.name, phone: users.phone })
              .from(users)
              .where(eq(users.id, booking.customerId))
              .limit(1);

            const year = new Date().getFullYear();
            const invoiceNumber = `INV-${year}-${booking.bookingNumber}`;
            const rawAmount = Number(booking.totalPrice ?? 0);
            const vatRate = 0.15;
            const subtotal = parseFloat((rawAmount / (1 + vatRate)).toFixed(2));
            const vatAmount = parseFloat((rawAmount - subtotal).toFixed(2));
            const serviceName = [pkgRow?.svcName, pkgRow?.pkgName].filter(Boolean).join(' — ') || 'خدمة غسيل';

            await db.insert(invoices).values({
              vendorId: booking.vendorId,
              bookingId: booking.id,
              customerId: booking.customerId,
              invoiceNumber,
              customerName: custRow?.name ?? '',
              customerPhone: custRow?.phone ?? '',
              items: [{ description: serviceName, qty: 1, unitPrice: subtotal }],
              amount: subtotal.toFixed(2),
              vatAmount: vatAmount.toFixed(2),
              totalAmount: rawAmount.toFixed(2),
              status: 'draft',
            });
          }
        } catch (_e) {
          // Silent fail — invoice can be created manually
        }
      }
    }

    // ─── Phase 1: Fire automation triggers ───────────────────────────────
    try {
      const { processAutomationTrigger } = await import('../services/automationEngine.js');
      if (status === 'completed' && booking.customerId && booking.vendorId) {
        await processAutomationTrigger(booking.vendorId, 'booking_completed', booking.customerId, {
          bookingId: booking.id,
          totalPrice: booking.totalPrice,
        });
      } else if (status === 'cancelled' && booking.customerId && booking.vendorId) {
        await processAutomationTrigger(booking.vendorId, 'booking_cancelled', booking.customerId, {
          bookingId: booking.id,
        });
      }
    } catch (_e) { console.error('[automation-trigger]', _e); }

    // Log CRM lifecycle event
    try {
      const { customerLifecycleEvents } = await import('../db/schema.js');
      if (booking.vendorId && booking.customerId) {
        await db.insert(customerLifecycleEvents).values({
          vendorId: booking.vendorId,
          customerId: booking.customerId,
          eventType: status === 'completed' ? 'booking_completed' : 'booking_cancelled',
          metadata: { bookingId: booking.id, bookingNumber: booking.bookingNumber },
        });
      }
    } catch (_e) { console.error('[lifecycle-event]', _e); }

    // Create in-app notification for vendor admin
    try {
      const { createNotification } = await import('./notification-center.js');
      // Find vendor admin user
      const [vendorAdmin] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.vendorId, booking.vendorId), eq(users.role, 'vendor_admin')))
        .limit(1);
      if (vendorAdmin) {
        const notifTitle = status === 'completed' ? 'حجز مكتمل ✅' : 'حجز ملغي ❌';
        const notifBody = `الحجز #${booking.bookingNumber} ${status === 'completed' ? 'اكتمل بنجاح' : 'تم إلغاؤه'}`;
        await createNotification(vendorAdmin.id, notifTitle, notifBody, 'booking', `/vendor/operations`, booking.vendorId);
      }
    } catch (_e) { console.error('[booking-notification]', _e); }

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: all bookings with filters
router.get('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const { status, from, to, search } = req.query as Record<string, string>;

    // Tenant isolation: vendor_admin sees only their own vendor's bookings
    const reqUser = (req as AuthRequest).user!;
    const isVendorAdmin = reqUser.role === 'vendor_admin';

    const query = db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        status: bookings.status,
        scheduledAt: bookings.scheduledAt,
        address: bookings.address,
        totalPrice: bookings.totalPrice,
        vehiclePlate: bookings.vehiclePlate,
        rating: bookings.rating,
        createdAt: bookings.createdAt,
        fleetVehicleId: bookings.fleetVehicleId,
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
      .leftJoin(fleetVehicles, eq(bookings.fleetVehicleId, fleetVehicles.id));

    // vendor_admin MUST always be scoped — return 400 if somehow missing vendorId
    if (isVendorAdmin && !reqUser.vendorId) {
      return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });
    }

    const result = await (isVendorAdmin
      ? query.where(eq(bookings.vendorId, reqUser.vendorId!))
      : query
    ).orderBy(desc(bookings.scheduledAt));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Vendor: reply to customer rating
router.post('/:id/reply', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId!;
    const { reply } = z.object({ reply: z.string().min(1).max(500) }).parse(req.body);

    const [booking] = await db.select({ id: bookings.id, rating: bookings.rating, vendorId: bookings.vendorId })
      .from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
    if (booking.vendorId !== vendorId) return res.status(403).json({ error: 'غير مصرح' });
    if (!booking.rating) return res.status(400).json({ error: 'لا يوجد تقييم لهذا الحجز' });

    const [updated] = await db.update(bookings)
      .set({ vendorReply: reply, vendorRepliedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Customer or vendor: cancel booking
router.post('/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = z.object({ reason: z.string().min(3).max(500) }).parse(req.body);

    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    const role = req.user!.role;
    const isCustomer = role === 'customer';
    const isVendor = role === 'vendor_admin' || role === 'admin';

    if (isCustomer && booking.customerId !== req.user!.id) return res.status(403).json({ error: 'غير مصرح' });
    if (isVendor && booking.vendorId !== req.user!.vendorId) return res.status(403).json({ error: 'غير مصرح' });

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ error: 'لا يمكن إلغاء هذا الحجز' });
    }

    // Calculate refund: full refund if > 24h before service, 50% if < 24h
    const now = Date.now();
    const serviceTime = new Date(booking.scheduledAt).getTime();
    const hoursBeforeService = Math.max(0, (serviceTime - now) / 3_600_000);
    const totalPrice = parseFloat(booking.totalPrice ?? '0');
    let refundPercent = 0;
    if (hoursBeforeService >= 24) refundPercent = 100;
    else if (hoursBeforeService >= 2) refundPercent = 50;
    const refundAmount = Math.round((totalPrice * refundPercent / 100) * 100) / 100;

    const [updated] = await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        refundAmount: refundAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();

    // Log cancellation
    await db.insert(cancellationLogs).values({
      bookingId: id,
      vendorId: booking.vendorId,
      cancelledBy: req.user!.id,
      reason,
      refundAmount: refundAmount.toString(),      // decimal → string ✓
      refundPercent: Math.round(refundPercent),   // integer → number ✓
      refundStatus: refundAmount > 0 ? 'pending' : 'not_applicable',
      hoursBeforeService: String(Math.round(hoursBeforeService * 10) / 10), // decimal → string ✓
    });

    return res.json({ ...updated, refundPercent, refundAmount });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: assign employee to booking (with conflict detection)
router.post('/:id/assign', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { employeeId } = z.object({ employeeId: z.number() }).parse(req.body);

    // Get the booking being assigned
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Check for conflicts: any booking for same employee within ±90 min
    if (booking.scheduledAt) {
      const targetTime = new Date(booking.scheduledAt).getTime();
      const windowMs = 90 * 60 * 1000;

      const conflicts = await db.select().from(bookings).where(
        and(
          eq(bookings.employeeId, Number(employeeId)),
          not(eq(bookings.id, bookingId)),
          not(eq(bookings.status, 'cancelled')),
          not(eq(bookings.status, 'completed')),
          gte(bookings.scheduledAt, new Date(targetTime - windowMs)),
          lte(bookings.scheduledAt, new Date(targetTime + windowMs)),
        )
      );

      if (conflicts.length > 0) {
        return res.status(409).json({
          error: 'conflict',
          message: 'الموظف لديه حجز في نفس الوقت',
          conflicts: conflicts.map(c => ({
            bookingNumber: c.bookingNumber,
            scheduledAt: c.scheduledAt,
            address: c.address,
          })),
        });
      }
    }

    // Safe to assign
    const [updated] = await db.update(bookings)
      .set({ employeeId: Number(employeeId), status: 'confirmed', updatedAt: new Date() })
      .where(eq(bookings.id, bookingId))
      .returning();

    return res.json({ success: true, booking: updated });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Phase 1B: Track booking intent (for abandoned booking recovery) ────────
router.post('/intent', requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthRequest).user!;
    const { vendorId, packageId, serviceId, address, lat, lng, stepReached } = req.body;

    const vId = vendorId ?? reqUser.vendorId;
    if (!vId) return res.status(400).json({ error: 'يرجى تحديد المتجر' });

    const [intent] = await db.insert(abandonedBookings).values({
      vendorId: vId,
      customerId: reqUser.id,
      customerPhone: reqUser.phone,
      packageId: packageId ?? null,
      serviceId: serviceId ?? null,
      address: address ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      stepReached: stepReached ?? 1,
    }).returning();

    return res.json({ id: intent.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Mark an abandoned booking as recovered (customer completed booking)
router.post('/intent/:id/recover', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(abandonedBookings)
      .set({ recoveredAt: new Date(), recoveryMethod: 'completed' })
      .where(eq(abandonedBookings.id, id));
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
