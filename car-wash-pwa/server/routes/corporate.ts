import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { corporateAccounts, corporateMembers, bookings, users } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const ALLOWED_ROLES = ['vendor_admin', 'admin', 'super_admin'] as const;

const corporateSchema = z.object({
  nameAr: z.string({ required_error: 'اسم الشركة مطلوب' }).min(2, 'اسم الشركة يجب أن يكون حرفين على الأقل'),
  vatNumber: z.string().optional(),
  contactName: z.string({ required_error: 'اسم المسؤول مطلوب' }).min(1, 'اسم المسؤول مطلوب'),
  contactPhone: z.string({ required_error: 'رقم الهاتف مطلوب' }).min(1, 'رقم الهاتف مطلوب'),
  creditLimit: z.number().min(0).default(0),
  billingCycle: z.enum(['monthly', 'quarterly'], {
    errorMap: () => ({ message: 'دورة الفوترة يجب أن تكون شهرية أو ربع سنوية' }),
  }),
});

const memberSchema = z.object({
  userId: z.number({ required_error: 'معرّف المستخدم مطلوب' }),
  role: z.enum(['admin', 'member']).default('member'),
  maxMonthlyBookings: z.number().min(1).optional(),
});

// GET /api/corporate — List corporate accounts (vendor-scoped)
router.get(
  '/',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId && req.user!.role !== 'super_admin') {
        return res.status(400).json({ error: 'لم يتم تحديد المورد' });
      }

      const whereClause = vendorId ? eq(corporateAccounts.vendorId, vendorId) : undefined;

      const accounts = await db
        .select()
        .from(corporateAccounts)
        .where(whereClause)
        .orderBy(desc(corporateAccounts.createdAt));

      return res.json(accounts);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// POST /api/corporate — Create corporate account
router.post(
  '/',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(400).json({ error: 'لم يتم تحديد المورد' });

      const data = corporateSchema.parse(req.body);

      const [account] = await db
        .insert(corporateAccounts)
        .values({
          vendorId,
          nameAr: data.nameAr,
          vatNumber: data.vatNumber,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          billingCycle: data.billingCycle,
          creditLimit: String(data.creditLimit),
          isActive: true,
        })
        .returning();

      return res.status(201).json(account);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// PUT /api/corporate/:id — Update account
router.put(
  '/:id',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرّف الحساب غير صالح' });

      const vendorId = req.user!.vendorId;
      const data = corporateSchema.partial().parse(req.body);

      const whereClause =
        vendorId
          ? and(eq(corporateAccounts.id, id), eq(corporateAccounts.vendorId, vendorId))
          : eq(corporateAccounts.id, id);

      const [existing] = await db
        .select({ id: corporateAccounts.id })
        .from(corporateAccounts)
        .where(whereClause)
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'الحساب التجاري غير موجود' });

      const updateValues: Partial<typeof corporateAccounts.$inferInsert> = {};
      if (data.nameAr !== undefined) updateValues.nameAr = data.nameAr;
      if (data.vatNumber !== undefined) updateValues.vatNumber = data.vatNumber;
      if (data.contactName !== undefined) updateValues.contactName = data.contactName;
      if (data.contactPhone !== undefined) updateValues.contactPhone = data.contactPhone;
      if (data.billingCycle !== undefined) updateValues.billingCycle = data.billingCycle;
      if (data.creditLimit !== undefined) updateValues.creditLimit = String(data.creditLimit);

      const [updated] = await db
        .update(corporateAccounts)
        .set(updateValues)
        .where(whereClause)
        .returning();

      return res.json(updated);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// DELETE /api/corporate/:id — Deactivate (soft delete)
router.delete(
  '/:id',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرّف الحساب غير صالح' });

      const vendorId = req.user!.vendorId;
      const whereClause =
        vendorId
          ? and(eq(corporateAccounts.id, id), eq(corporateAccounts.vendorId, vendorId))
          : eq(corporateAccounts.id, id);

      const [existing] = await db
        .select({ id: corporateAccounts.id })
        .from(corporateAccounts)
        .where(whereClause)
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'الحساب التجاري غير موجود' });

      await db
        .update(corporateAccounts)
        .set({ isActive: false })
        .where(whereClause);

      return res.json({ success: true, message: 'تم تعطيل الحساب التجاري' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// POST /api/corporate/:id/members — Add member
router.post(
  '/:id/members',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const corporateId = Number(req.params.id);
      if (isNaN(corporateId)) return res.status(400).json({ error: 'معرّف الحساب غير صالح' });

      const vendorId = req.user!.vendorId;
      const data = memberSchema.parse(req.body);

      // Verify account belongs to vendor
      const whereClause =
        vendorId
          ? and(eq(corporateAccounts.id, corporateId), eq(corporateAccounts.vendorId, vendorId))
          : eq(corporateAccounts.id, corporateId);

      const [account] = await db
        .select({ id: corporateAccounts.id })
        .from(corporateAccounts)
        .where(whereClause)
        .limit(1);
      if (!account) return res.status(404).json({ error: 'الحساب التجاري غير موجود' });

      // Verify user exists
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);
      if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

      const [member] = await db
        .insert(corporateMembers)
        .values({
          corporateId,
          userId: data.userId,
          role: data.role,
          maxMonthlyBookings: data.maxMonthlyBookings,
        })
        .returning();

      return res.status(201).json(member);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// GET /api/corporate/:id/members — List members
router.get(
  '/:id/members',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const corporateId = Number(req.params.id);
      if (isNaN(corporateId)) return res.status(400).json({ error: 'معرّف الحساب غير صالح' });

      const vendorId = req.user!.vendorId;
      const whereClause =
        vendorId
          ? and(eq(corporateAccounts.id, corporateId), eq(corporateAccounts.vendorId, vendorId))
          : eq(corporateAccounts.id, corporateId);

      const [account] = await db
        .select({ id: corporateAccounts.id })
        .from(corporateAccounts)
        .where(whereClause)
        .limit(1);
      if (!account) return res.status(404).json({ error: 'الحساب التجاري غير موجود' });

      const members = await db
        .select({
          id: corporateMembers.id,
          corporateId: corporateMembers.corporateId,
          userId: corporateMembers.userId,
          role: corporateMembers.role,
          maxMonthlyBookings: corporateMembers.maxMonthlyBookings,
          createdAt: corporateMembers.createdAt,
          userName: users.name,
          userPhone: users.phone,
        })
        .from(corporateMembers)
        .leftJoin(users, eq(corporateMembers.userId, users.id))
        .where(eq(corporateMembers.corporateId, corporateId))
        .orderBy(desc(corporateMembers.createdAt));

      return res.json(members);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// GET /api/corporate/:id/bookings — Get bookings for this corporate account
router.get(
  '/:id/bookings',
  requireAuth,
  requireRole(...ALLOWED_ROLES),
  async (req: AuthRequest, res) => {
    try {
      const corporateId = Number(req.params.id);
      if (isNaN(corporateId)) return res.status(400).json({ error: 'معرّف الحساب غير صالح' });

      const vendorId = req.user!.vendorId;
      const whereClause =
        vendorId
          ? and(eq(corporateAccounts.id, corporateId), eq(corporateAccounts.vendorId, vendorId))
          : eq(corporateAccounts.id, corporateId);

      const [account] = await db
        .select({ id: corporateAccounts.id, vendorId: corporateAccounts.vendorId })
        .from(corporateAccounts)
        .where(whereClause)
        .limit(1);
      if (!account) return res.status(404).json({ error: 'الحساب التجاري غير موجود' });

      // Get member user IDs for this corporate account
      const members = await db
        .select({ userId: corporateMembers.userId })
        .from(corporateMembers)
        .where(eq(corporateMembers.corporateId, corporateId));

      const memberUserIds = members.map((m) => m.userId);
      if (!memberUserIds.length) return res.json([]);

      // Fetch bookings for all members scoped to the vendor
      const result = await db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          scheduledAt: bookings.scheduledAt,
          address: bookings.address,
          totalPrice: bookings.totalPrice,
          paymentStatus: bookings.paymentStatus,
          paymentMethod: bookings.paymentMethod,
          customerId: bookings.customerId,
          createdAt: bookings.createdAt,
          customerName: users.name,
          customerPhone: users.phone,
        })
        .from(bookings)
        .leftJoin(users, eq(bookings.customerId, users.id))
        .where(
          and(
            eq(bookings.vendorId, account.vendorId),
            eq(bookings.paymentMethod, 'corporate'),
          ),
        )
        .orderBy(desc(bookings.scheduledAt));

      // Filter to only members of this corporate account
      const filtered = result.filter((b) => b.customerId != null && memberUserIds.includes(b.customerId));
      return res.json(filtered);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

export default router;
