/**
 * Customer profile endpoints — manage own data: name, vehicles, addresses,
 * notification preferences. Used by /app/profile on the customer side.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, customers } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('customer'));

// GET /api/customer-profile/me
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const [u] = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      vendorId: users.vendorId,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // All vehicle/address/preferences profiles across vendors. The customer
    // may have a record per vendor — we return them all so the UI can
    // show a consolidated view.
    const profiles = await db.select({
      id: customers.id,
      vendorId: customers.vendorId,
      vehicleType: customers.vehicleType,
      vehiclePlate: customers.vehiclePlate,
      vehicleColor: customers.vehicleColor,
      vehicleModel: customers.vehicleModel,
      address: customers.address,
      notes: customers.notes,
      preferredLanguage: customers.preferredLanguage,
      preferredContactMethod: customers.preferredContactMethod,
    })
      .from(customers)
      .where(eq(customers.userId, userId))
      .orderBy(desc(customers.createdAt));

    return res.json({ user: u, profiles });
  } catch (e) {
    console.error('[customer-profile/me]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /api/customer-profile/me — update top-level user fields
const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().nullable().optional(),
});
router.patch('/me', async (req: AuthRequest, res) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email;
    if (Object.keys(updates).length === 0) return res.json({ success: true });

    const [updated] = await db.update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id))
      .returning({ id: users.id, name: users.name, phone: users.phone, email: users.email });
    return res.json({ success: true, user: updated });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[customer-profile/me patch]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /api/customer-profile/profile/:profileId — update vendor-scoped profile
const updateProfileSchema = z.object({
  vehicleType: z.string().max(50).nullable().optional(),
  vehiclePlate: z.string().max(20).nullable().optional(),
  vehicleColor: z.string().max(30).nullable().optional(),
  vehicleModel: z.string().max(50).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  preferredLanguage: z.enum(['ar', 'en']).optional(),
  preferredContactMethod: z.enum(['whatsapp', 'sms', 'email', 'push']).optional(),
});
router.patch('/profile/:profileId', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.profileId);
    const data = updateProfileSchema.parse(req.body);

    // Make sure this profile belongs to the calling customer.
    const [own] = await db.select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.userId, req.user!.id)))
      .limit(1);
    if (!own) return res.status(404).json({ error: 'الملف غير موجود' });

    const [updated] = await db.update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return res.json({ success: true, profile: updated });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[customer-profile/profile patch]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/customer-profile/me — soft-delete account (PDPL compliance)
router.delete('/me', async (req: AuthRequest, res) => {
  try {
    await db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));
    return res.json({ success: true, message: 'تم إيقاف حسابك. سيتم حذف بياناتك خلال 30 يوم.' });
  } catch (e) {
    console.error('[customer-profile/me delete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
