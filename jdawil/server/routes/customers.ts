import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, customers } from '../db/schema.js';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Admin/Employee: list customers — vendor-scoped
router.get('/', requireAuth, requireRole('admin', 'employee', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;

    const result = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        vehicleType: customers.vehicleType,
        vehiclePlate: customers.vehiclePlate,
        vehicleColor: customers.vehicleColor,
        vehicleModel: customers.vehicleModel,
        defaultAddress: customers.defaultAddress,
      })
      .from(users)
      .leftJoin(customers, eq(users.id, customers.userId))
      .where(
        vendorId
          ? and(eq(users.role, 'customer'), eq(customers.vendorId, vendorId))
          : eq(users.role, 'customer')
      )
      .orderBy(desc(users.createdAt));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin/Employee: create new customer (walk-in / phone order)
router.post('/', requireAuth, requireRole('admin', 'employee', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      name: z.string().min(2),
      phone: z.string().min(10),
      vehicleType: z.string().optional(),
      vehiclePlate: z.string().optional(),
      vehicleColor: z.string().optional(),
      vehicleModel: z.string().optional(),
      defaultAddress: z.string().optional(),
    }).parse(req.body);

    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    // Check if phone already exists
    const existing = await db.select().from(users).where(eq(users.phone, data.phone)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'هذا الرقم مسجل مسبقاً',
        existingCustomer: { id: existing[0].id, name: existing[0].name, phone: existing[0].phone },
      });
    }

    const [newUser] = await db.insert(users).values({
      name: data.name,
      phone: data.phone,
      role: 'customer',
    }).returning();

    await db.insert(customers).values({
      userId: newUser.id,
      vendorId,
      vehicleType: data.vehicleType,
      vehiclePlate: data.vehiclePlate,
      vehicleColor: data.vehicleColor,
      vehicleModel: data.vehicleModel,
      defaultAddress: data.defaultAddress,
    });

    return res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      phone: newUser.phone,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: search customer by phone — vendor-scoped
// MUST come before /:id to avoid Express matching "search" as an ID
router.get('/search/phone', requireAuth, requireRole('admin', 'employee', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const { q } = req.query as { q: string };
    if (!q || q.length < 4) return res.json([]);

    const vendorId = req.user!.vendorId;

    const result = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        vehiclePlate: customers.vehiclePlate,
        vehicleType: customers.vehicleType,
        defaultAddress: customers.defaultAddress,
      })
      .from(users)
      .leftJoin(customers, eq(users.id, customers.userId))
      .where(
        vendorId
          ? and(
              or(ilike(users.phone, `%${q}%`), ilike(users.name, `%${q}%`)),
              eq(customers.vendorId, vendorId)
            )
          : or(ilike(users.phone, `%${q}%`), ilike(users.name, `%${q}%`))
      )
      .limit(10);

    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: get customer details — vendor-scoped, MUST come after all named routes
router.get('/:id', requireAuth, requireRole('admin', 'employee', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId;

    const [user] = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
      vehicleType: customers.vehicleType,
      vehiclePlate: customers.vehiclePlate,
      vehicleColor: customers.vehicleColor,
      vehicleModel: customers.vehicleModel,
      defaultAddress: customers.defaultAddress,
    })
      .from(users)
      .leftJoin(customers, eq(users.id, customers.userId))
      .where(
        vendorId
          ? and(eq(users.id, id), eq(customers.vendorId, vendorId))
          : eq(users.id, id)
      )
      .limit(1);

    if (!user) return res.status(404).json({ error: 'العميل غير موجود' });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
