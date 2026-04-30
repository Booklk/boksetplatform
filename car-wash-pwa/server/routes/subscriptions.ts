import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { subscriptionPlans, customerSubscriptions, bookings, users } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

// ─── Ensure family_members column exists (lazy migration) ────────────────────
// Runs once at module load; safe to call multiple times (IF NOT EXISTS)
db.execute(sql`
  ALTER TABLE customer_subscriptions
  ADD COLUMN IF NOT EXISTS family_members jsonb NOT NULL DEFAULT '[]'::jsonb
`).catch(() => {
  // Column may already exist or DB not yet ready — silently ignore
});

const router = Router();

const createPlanSchema = z.object({
  nameAr: z.string({ required_error: 'اسم الخطة مطلوب' }).min(2, 'اسم الخطة يجب أن يكون حرفين على الأقل'),
  packageId: z.number().optional(),
  billingCycle: z.enum(['weekly', 'monthly'], {
    errorMap: () => ({ message: 'دورة الفوترة يجب أن تكون أسبوعية أو شهرية' }),
  }),
  washesIncluded: z.number({ required_error: 'عدد الغسيلات مطلوب' }).min(1, 'يجب أن يكون على الأقل غسيلة واحدة'),
  price: z.number({ required_error: 'السعر مطلوب' }).min(0, 'السعر يجب أن يكون موجباً'),
  discountPercent: z.number().min(0).max(100).default(0),
});

const subscribeSchema = z.object({
  planId: z.number({ required_error: 'معرّف الخطة مطلوب' }),
  vehicleId: z.number().optional(),
});

const useWashSchema = z.object({
  subscriptionId: z.number({ required_error: 'معرّف الاشتراك مطلوب' }),
  bookingId: z.number({ required_error: 'معرّف الحجز مطلوب' }),
});

const addMemberSchema = z.object({
  subscriptionId: z.number({ required_error: 'معرّف الاشتراك مطلوب' }),
  memberPhone: z.string({ required_error: 'رقم الهاتف مطلوب' }).min(9, 'رقم الهاتف غير صحيح'),
});

// Family plan name patterns → max members
const FAMILY_PLAN_MAX: Record<string, number> = {
  'الباقة العائلية': 3,
  'الباقة العائلية الكبيرة': 5,
};

function getFamilyMaxFromPlanName(nameAr: string): number | null {
  for (const [key, max] of Object.entries(FAMILY_PLAN_MAX)) {
    if (nameAr.includes(key.replace('الباقة ', ''))) return max;
  }
  return null;
}

function addBillingCycleDays(date: Date, cycle: string): Date {
  const result = new Date(date);
  if (cycle === 'weekly') {
    result.setDate(result.getDate() + 7);
  } else {
    result.setMonth(result.getMonth() + 1);
  }
  return result;
}

// GET /api/subscriptions/plans — Get vendor's subscription plans (public within vendor)
// Family plans are automatically appended if none exist yet.
router.get('/plans', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لم يتم تحديد المورد' });

    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.vendorId, vendorId),
          eq(subscriptionPlans.isActive, true),
        ),
      )
      .orderBy(desc(subscriptionPlans.createdAt));

    // Seed family plans for this vendor if they don't exist yet
    const hasFamilySmall = plans.some((p) => p.nameAr.includes('الباقة العائلية') && !p.nameAr.includes('الكبيرة'));
    const hasFamilyLarge = plans.some((p) => p.nameAr.includes('الباقة العائلية الكبيرة'));

    const inserted: typeof plans = [];

    if (!hasFamilySmall) {
      const [fp] = await db.insert(subscriptionPlans).values({
        vendorId,
        nameAr: 'الباقة العائلية',
        billingCycle: 'monthly',
        washesIncluded: 8,
        price: '249',
        discountPercent: '0',
        isActive: true,
      }).returning();
      inserted.push(fp);
    }

    if (!hasFamilyLarge) {
      const [fp] = await db.insert(subscriptionPlans).values({
        vendorId,
        nameAr: 'الباقة العائلية الكبيرة',
        billingCycle: 'monthly',
        washesIncluded: 12,
        price: '349',
        discountPercent: '0',
        isActive: true,
      }).returning();
      inserted.push(fp);
    }

    return res.json([...inserted, ...plans]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/subscriptions/plans — Create a plan (vendor_admin only)
router.post(
  '/plans',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(400).json({ error: 'لم يتم تحديد المورد' });

      const data = createPlanSchema.parse(req.body);

      const [plan] = await db
        .insert(subscriptionPlans)
        .values({
          vendorId,
          nameAr: data.nameAr,
          packageId: data.packageId,
          billingCycle: data.billingCycle,
          washesIncluded: data.washesIncluded,
          price: String(data.price),
          discountPercent: String(data.discountPercent),
          isActive: true,
        })
        .returning();

      return res.status(201).json(plan);
    } catch (e: any) {
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// PUT /api/subscriptions/plans/:id — Update plan
router.put(
  '/plans/:id',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرّف الخطة غير صالح' });

      const vendorId = req.user!.vendorId;
      const data = createPlanSchema.partial().parse(req.body);

      const whereClause =
        vendorId
          ? and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.vendorId, vendorId))
          : eq(subscriptionPlans.id, id);

      const [existing] = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(whereClause)
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'خطة الاشتراك غير موجودة' });

      const updateValues: Partial<typeof subscriptionPlans.$inferInsert> = {};
      if (data.nameAr !== undefined) updateValues.nameAr = data.nameAr;
      if (data.packageId !== undefined) updateValues.packageId = data.packageId;
      if (data.billingCycle !== undefined) updateValues.billingCycle = data.billingCycle;
      if (data.washesIncluded !== undefined) updateValues.washesIncluded = data.washesIncluded;
      if (data.price !== undefined) updateValues.price = String(data.price);
      if (data.discountPercent !== undefined) updateValues.discountPercent = String(data.discountPercent);

      const [updated] = await db
        .update(subscriptionPlans)
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

// DELETE /api/subscriptions/plans/:id — Deactivate plan
router.delete(
  '/plans/:id',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'معرّف الخطة غير صالح' });

      const vendorId = req.user!.vendorId;
      const whereClause =
        vendorId
          ? and(eq(subscriptionPlans.id, id), eq(subscriptionPlans.vendorId, vendorId))
          : eq(subscriptionPlans.id, id);

      const [existing] = await db
        .select({ id: subscriptionPlans.id })
        .from(subscriptionPlans)
        .where(whereClause)
        .limit(1);
      if (!existing) return res.status(404).json({ error: 'خطة الاشتراك غير موجودة' });

      await db.update(subscriptionPlans).set({ isActive: false }).where(whereClause);

      return res.json({ success: true, message: 'تم تعطيل خطة الاشتراك' });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// POST /api/subscriptions/subscribe — Customer subscribes to a plan
router.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = subscribeSchema.parse(req.body);

    // Fetch plan
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(and(eq(subscriptionPlans.id, data.planId), eq(subscriptionPlans.isActive, true)))
      .limit(1);
    if (!plan) return res.status(404).json({ error: 'خطة الاشتراك غير موجودة أو غير نشطة' });

    // Check for existing active subscription for same plan
    const [existing] = await db
      .select({ id: customerSubscriptions.id })
      .from(customerSubscriptions)
      .where(
        and(
          eq(customerSubscriptions.customerId, req.user!.id),
          eq(customerSubscriptions.planId, data.planId),
          eq(customerSubscriptions.status, 'active'),
        ),
      )
      .limit(1);
    if (existing) return res.status(400).json({ error: 'لديك اشتراك نشط بالفعل في هذه الخطة' });

    const startDate = new Date();
    const endDate = addBillingCycleDays(startDate, plan.billingCycle);
    const nextBillingDate = endDate;

    const [subscription] = await db
      .insert(customerSubscriptions)
      .values({
        customerId: req.user!.id,
        planId: data.planId,
        vendorId: plan.vendorId,
        vehicleId: data.vehicleId,
        status: 'active',
        startDate,
        endDate,
        nextBillingDate,
        washesRemaining: plan.washesIncluded,
        autoRenew: true,
      })
      .returning();

    return res.status(201).json(subscription);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/subscriptions/use-wash — Deduct one wash from subscription
router.post('/use-wash', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = useWashSchema.parse(req.body);

    const [subscription] = await db
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.id, data.subscriptionId))
      .limit(1);

    if (!subscription) return res.status(404).json({ error: 'الاشتراك غير موجود' });
    if (subscription.status !== 'active') return res.status(400).json({ error: 'الاشتراك غير نشط' });
    if (subscription.washesRemaining <= 0) {
      return res.status(400).json({ error: 'لا يوجد رصيد غسيلات متبقٍ في هذا الاشتراك' });
    }

    // Verify customer owns the subscription (or is an admin)
    const isAdmin = ['vendor_admin', 'admin', 'super_admin'].includes(req.user!.role);
    if (!isAdmin && subscription.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Verify booking exists and is linked to the same vendor
    const [booking] = await db
      .select({ id: bookings.id, vendorId: bookings.vendorId, customerId: bookings.customerId })
      .from(bookings)
      .where(eq(bookings.id, data.bookingId))
      .limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
    if (booking.vendorId !== subscription.vendorId) {
      return res.status(400).json({ error: 'الحجز لا ينتمي إلى نفس المورد' });
    }

    const newWashesRemaining = subscription.washesRemaining - 1;
    const newStatus = newWashesRemaining === 0 ? 'expired' : 'active';

    const [updated] = await db
      .update(customerSubscriptions)
      .set({
        washesRemaining: newWashesRemaining,
        status: newStatus as 'active' | 'expired',
      })
      .where(eq(customerSubscriptions.id, data.subscriptionId))
      .returning();

    // Mark booking as paid via subscription
    await db
      .update(bookings)
      .set({ paymentStatus: 'paid', paymentMethod: 'subscription', updatedAt: new Date() })
      .where(eq(bookings.id, data.bookingId));

    return res.json({
      subscription: updated,
      washesRemaining: newWashesRemaining,
      bookingId: data.bookingId,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/subscriptions/my — Customer: get my active subscriptions
router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const subscriptions = await db
      .select({
        id: customerSubscriptions.id,
        planId: customerSubscriptions.planId,
        vendorId: customerSubscriptions.vendorId,
        vehicleId: customerSubscriptions.vehicleId,
        status: customerSubscriptions.status,
        startDate: customerSubscriptions.startDate,
        endDate: customerSubscriptions.endDate,
        nextBillingDate: customerSubscriptions.nextBillingDate,
        washesRemaining: customerSubscriptions.washesRemaining,
        autoRenew: customerSubscriptions.autoRenew,
        createdAt: customerSubscriptions.createdAt,
        planNameAr: subscriptionPlans.nameAr,
        planPrice: subscriptionPlans.price,
        planBillingCycle: subscriptionPlans.billingCycle,
        planWashesIncluded: subscriptionPlans.washesIncluded,
      })
      .from(customerSubscriptions)
      .leftJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
      .where(eq(customerSubscriptions.customerId, req.user!.id))
      .orderBy(desc(customerSubscriptions.createdAt));

    return res.json(subscriptions);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/subscriptions/active — Vendor admin: list all active subscriptions
router.get(
  '/active',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId && req.user!.role !== 'super_admin') {
        return res.status(400).json({ error: 'لم يتم تحديد المورد' });
      }

      const whereClause =
        vendorId
          ? and(
              eq(customerSubscriptions.vendorId, vendorId),
              eq(customerSubscriptions.status, 'active'),
            )
          : eq(customerSubscriptions.status, 'active');

      const subscriptions = await db
        .select({
          id: customerSubscriptions.id,
          customerId: customerSubscriptions.customerId,
          planId: customerSubscriptions.planId,
          vendorId: customerSubscriptions.vendorId,
          vehicleId: customerSubscriptions.vehicleId,
          status: customerSubscriptions.status,
          startDate: customerSubscriptions.startDate,
          endDate: customerSubscriptions.endDate,
          nextBillingDate: customerSubscriptions.nextBillingDate,
          washesRemaining: customerSubscriptions.washesRemaining,
          autoRenew: customerSubscriptions.autoRenew,
          createdAt: customerSubscriptions.createdAt,
          planNameAr: subscriptionPlans.nameAr,
          planPrice: subscriptionPlans.price,
          planBillingCycle: subscriptionPlans.billingCycle,
        })
        .from(customerSubscriptions)
        .leftJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
        .where(whereClause)
        .orderBy(desc(customerSubscriptions.createdAt));

      return res.json(subscriptions);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: 'خطأ في الخادم' });
    }
  },
);

// POST /api/subscriptions/add-member — Add a family member to a subscription
router.post('/add-member', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = addMemberSchema.parse(req.body);

    // Fetch subscription
    const [subscription] = await db
      .select()
      .from(customerSubscriptions)
      .where(eq(customerSubscriptions.id, data.subscriptionId))
      .limit(1);

    if (!subscription) return res.status(404).json({ error: 'الاشتراك غير موجود' });
    if (subscription.status !== 'active') return res.status(400).json({ error: 'الاشتراك غير نشط' });

    // Only the subscription owner can add members
    if (subscription.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح — أنت لست مالك هذا الاشتراك' });
    }

    // Fetch plan to determine max members
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, subscription.planId))
      .limit(1);

    if (!plan) return res.status(404).json({ error: 'خطة الاشتراك غير موجودة' });

    // Determine max family members from plan name
    const maxMembers = getFamilyMaxFromPlanName(plan.nameAr);
    if (!maxMembers) {
      return res.status(400).json({ error: 'هذه الباقة لا تدعم الأعضاء العائليين — يرجى الاشتراك في باقة عائلية' });
    }

    // Find the user by phone
    const [memberUser] = await db
      .select({ id: users.id, name: users.name, phone: users.phone, vendorId: users.vendorId })
      .from(users)
      .where(and(eq(users.phone, data.memberPhone), eq(users.role, 'customer')))
      .limit(1);

    if (!memberUser) {
      return res.status(404).json({ error: 'لا يوجد مستخدم بهذا الرقم — يجب أن يكون مسجلاً في المنصة' });
    }

    if (memberUser.id === req.user!.id) {
      return res.status(400).json({ error: 'لا يمكنك إضافة نفسك كعضو عائلي' });
    }

    // Read current family members from DB using raw SQL (safe since column may be newly added)
    const [row] = await db.execute(
      sql`SELECT family_members FROM customer_subscriptions WHERE id = ${data.subscriptionId}`
    ) as any[];

    const currentMembers: Array<{ id: number; name: string; phone: string; addedAt: string; washesUsed: number }> =
      (row?.family_members ?? []) as any;

    // Check max
    if (currentMembers.length >= maxMembers) {
      return res.status(400).json({ error: `تم الوصول إلى الحد الأقصى من الأعضاء (${maxMembers})` });
    }

    // Check duplicate
    if (currentMembers.some((m) => m.id === memberUser.id)) {
      return res.status(400).json({ error: 'هذا الشخص عضو في الاشتراك بالفعل' });
    }

    const newMember = {
      id: memberUser.id,
      name: memberUser.name,
      phone: memberUser.phone,
      addedAt: new Date().toISOString(),
      washesUsed: 0,
    };

    const updatedMembers = [...currentMembers, newMember];

    await db.execute(
      sql`UPDATE customer_subscriptions SET family_members = ${JSON.stringify(updatedMembers)}::jsonb WHERE id = ${data.subscriptionId}`
    );

    return res.json({
      success: true,
      message: `تمت إضافة ${memberUser.name} إلى الاشتراك العائلي`,
      members: updatedMembers,
      maxMembers,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/subscriptions/family/:subscriptionId — Family subscription details + members + wash usage
router.get('/family/:subscriptionId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const subscriptionId = Number(req.params.subscriptionId);
    if (isNaN(subscriptionId)) return res.status(400).json({ error: 'معرّف الاشتراك غير صالح' });

    const [subscription] = await db
      .select({
        id: customerSubscriptions.id,
        planId: customerSubscriptions.planId,
        customerId: customerSubscriptions.customerId,
        vendorId: customerSubscriptions.vendorId,
        status: customerSubscriptions.status,
        startDate: customerSubscriptions.startDate,
        endDate: customerSubscriptions.endDate,
        washesRemaining: customerSubscriptions.washesRemaining,
        autoRenew: customerSubscriptions.autoRenew,
        planNameAr: subscriptionPlans.nameAr,
        planPrice: subscriptionPlans.price,
        planWashesIncluded: subscriptionPlans.washesIncluded,
        planBillingCycle: subscriptionPlans.billingCycle,
      })
      .from(customerSubscriptions)
      .leftJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
      .where(eq(customerSubscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) return res.status(404).json({ error: 'الاشتراك غير موجود' });

    // Authorization: owner or admin
    const isAdmin = ['vendor_admin', 'admin', 'super_admin'].includes(req.user!.role);
    if (!isAdmin && subscription.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Read family members via raw SQL
    const [row] = await db.execute(
      sql`SELECT family_members FROM customer_subscriptions WHERE id = ${subscriptionId}`
    ) as any[];

    const members = (row?.family_members ?? []) as Array<{
      id: number; name: string; phone: string; addedAt: string; washesUsed: number;
    }>;

    const maxMembers = getFamilyMaxFromPlanName(subscription.planNameAr ?? '');

    return res.json({
      subscription,
      members,
      maxMembers,
      isFamilyPlan: maxMembers !== null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
