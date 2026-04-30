import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vehicles, customers, bookings, packages, users } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const vehicleSchema = z.object({
  label: z.string().optional(),
  type: z.string().optional(),
  plate: z.string().optional(),
  color: z.string().optional(),
  model: z.string().optional(),
  year: z.number().optional(),
  isDefault: z.boolean().optional(),
});

// GET /api/vehicles — Get customer's vehicles
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    // Get customer profile
    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.userId, req.user!.id), eq(customers.vendorId, vendorId)))
      .limit(1);
    if (!customer) return res.json([]);

    const list = await db.select().from(vehicles)
      .where(and(eq(vehicles.customerId, customer.id), eq(vehicles.isActive, true)));
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/vehicles — Add vehicle
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = vehicleSchema.parse(req.body);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.userId, req.user!.id), eq(customers.vendorId, vendorId)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'ملف العميل غير موجود' });

    // If setting as default, clear other defaults
    if (data.isDefault) {
      await db.update(vehicles).set({ isDefault: false }).where(eq(vehicles.customerId, customer.id));
    }

    const [vehicle] = await db.insert(vehicles).values({
      customerId: customer.id,
      vendorId,
      ...data,
    }).returning();

    return res.status(201).json(vehicle);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/vehicles/:id — Update vehicle
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = vehicleSchema.parse(req.body);
    const vendorId = req.user!.vendorId;

    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.userId, req.user!.id), eq(customers.vendorId, vendorId!)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'غير موجود' });

    if (data.isDefault) {
      await db.update(vehicles).set({ isDefault: false }).where(eq(vehicles.customerId, customer.id));
    }

    const [vehicle] = await db.update(vehicles).set(data)
      .where(and(eq(vehicles.id, parseInt(req.params.id)), eq(vehicles.customerId, customer.id)))
      .returning();

    if (!vehicle) return res.status(404).json({ error: 'السيارة غير موجودة' });
    return res.json(vehicle);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/customers/vehicles/:vehicleId/history — scoped to auth customer
// Note: registered under /api/vehicles/:vehicleId/history for simplicity
router.get('/:vehicleId/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vehicleId = parseInt(req.params.vehicleId);
    if (isNaN(vehicleId)) return res.status(400).json({ error: 'vehicleId غير صالح' });

    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'vendorId مطلوب' });

    // Verify vehicle belongs to this customer
    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.userId, req.user!.id), eq(customers.vendorId, vendorId)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'ملف العميل غير موجود' });

    const [vehicle] = await db.select().from(vehicles)
      .where(and(eq(vehicles.id, vehicleId), eq(vehicles.customerId, customer.id)))
      .limit(1);
    if (!vehicle) return res.status(404).json({ error: 'السيارة غير موجودة' });

    // Fetch completed bookings for this vehicle
    const rows = await db
      .select({
        id: bookings.id,
        date: bookings.scheduledAt,
        serviceName: packages.name,
        amount: bookings.totalPrice,
        status: bookings.status,
        rating: bookings.rating,
        employeeName: users.name,
      })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(users, eq(bookings.employeeId, users.id))
      .where(and(
        eq(bookings.vehicleId, vehicleId),
        eq(bookings.customerId, req.user!.id),
        eq(bookings.status, 'completed'),
      ))
      .orderBy(desc(bookings.scheduledAt))
      .limit(50);

    const totalWashes = rows.length;
    const totalSpent = rows.reduce((sum, b) => sum + parseFloat(b.amount ?? '0'), 0);
    const lastWashDate = rows[0]?.date ?? null;

    return res.json({
      bookings: rows,
      totalWashes,
      totalSpent: totalSpent.toFixed(2),
      lastWashDate,
      vehicle,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    const [customer] = await db.select().from(customers)
      .where(and(eq(customers.userId, req.user!.id), eq(customers.vendorId, vendorId!)))
      .limit(1);
    if (!customer) return res.status(404).json({ error: 'غير موجود' });

    await db.update(vehicles).set({ isActive: false })
      .where(and(eq(vehicles.id, parseInt(req.params.id)), eq(vehicles.customerId, customer.id)));

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
