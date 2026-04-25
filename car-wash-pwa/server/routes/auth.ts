import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, customers, vendors, customerLifecycleEvents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(10, 'رقم الجوال غير صحيح'),
  vendorId: z.number().optional(),
  firebaseUid: z.string().optional(),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleModel: z.string().optional(),
});

const loginSchema = z.object({
  phone: z.string(),
  password: z.string().optional(),
  firebaseUid: z.string().optional(),
  vendorId: z.number().optional(),
});

function signToken(user: { id: number; role: string; phone: string; vendorId?: number | null }) {
  return jwt.sign(
    { id: user.id, role: user.role, phone: user.phone, vendorId: user.vendorId ?? undefined },
    process.env.JWT_SECRET!,
    { expiresIn: '24h', algorithm: 'HS256' }
  );
}

// Register customer (Firebase OTP verified on client)
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const vendorId = data.vendorId;

    // Check if user with same phone exists in the same vendor scope
    const existing = await db.select().from(users)
      .where(
        vendorId
          ? and(eq(users.phone, data.phone), eq(users.vendorId, vendorId))
          : eq(users.phone, data.phone)
      )
      .limit(1);

    if (existing.length > 0) {
      if (data.firebaseUid) {
        const user = existing[0];
        await db.update(users).set({ firebaseUid: data.firebaseUid }).where(eq(users.id, user.id));
        const token = signToken(user);
        return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vendorId: user.vendorId } });
      }
      return res.status(409).json({ error: 'رقم الجوال مسجل مسبقاً' });
    }

    const [newUser] = await db.insert(users).values({
      name: data.name,
      phone: data.phone,
      firebaseUid: data.firebaseUid,
      role: 'customer',
      vendorId: vendorId ?? null,
    }).returning();

    // Create customer profile (vendor-scoped)
    if (vendorId) {
      await db.insert(customers).values({
        userId: newUser.id,
        vendorId,
        vehicleType: data.vehicleType,
        vehiclePlate: data.vehiclePlate,
        vehicleColor: data.vehicleColor,
        vehicleModel: data.vehicleModel,
      });
    }

    // Fire new_customer automation trigger
    try {
      const { processAutomationTrigger } = await import('../services/automationEngine.js');
      if (newUser.vendorId) {
        await processAutomationTrigger(newUser.vendorId, 'new_customer', newUser.id);
      }
    } catch (_e) { console.error('[auth automation trigger]', _e); }

    // Log lifecycle event
    try {
      if (newUser.vendorId) {
        await db.insert(customerLifecycleEvents).values({
          vendorId: newUser.vendorId,
          customerId: newUser.id,
          eventType: 'first_booking',
          metadata: { registeredAt: new Date().toISOString() },
        });
      }
    } catch (_e) { console.error('[auth lifecycle]', _e); }

    // Create welcome notification
    try {
      const { createNotification } = await import('./notification-center.js');
      await createNotification(newUser.id, 'أهلاً وسهلاً!', 'مرحباً بك في المنصة. احجز أول خدمة لك الآن!', 'info', '/app', newUser.vendorId ?? undefined);
    } catch (_e) { console.error('[auth notification]', _e); }

    const token = signToken(newUser);
    return res.status(201).json({
      token,
      user: { id: newUser.id, name: newUser.name, phone: newUser.phone, role: newUser.role, vendorId: newUser.vendorId },
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const [user] = await db.select().from(users)
      .where(eq(users.phone, data.phone))
      .limit(1);

    if (!user) return res.status(401).json({ error: 'رقم الجوال غير مسجل' });
    if (!user.isActive) return res.status(403).json({ error: 'الحساب موقوف' });

    if (data.firebaseUid) {
      await db.update(users).set({ firebaseUid: data.firebaseUid }).where(eq(users.id, user.id));
      const token = signToken(user);
      return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vendorId: user.vendorId } });
    }

    if (!data.password || !user.passwordHash) {
      return res.status(401).json({ error: 'كلمة المرور مطلوبة' });
    }
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vendorId: user.vendorId } });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Admin-only login (separate panel — phone + password) ────────────────────
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'رقم الجوال وكلمة المرور مطلوبة' });

    // Normalize phone
    let p = phone.replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('+966')) p = '0' + p.slice(4);
    if (p.startsWith('966')) p = '0' + p.slice(3);
    if (!p.startsWith('0')) p = '0' + p;

    const [user] = await db.select().from(users)
      .where(eq(users.phone, p))
      .limit(1);

    const genericError = 'رقم الجوال أو كلمة المرور غير صحيحة';
    if (!user) return res.status(401).json({ error: genericError });
    if (user.role !== 'super_admin') return res.status(401).json({ error: genericError });
    if (!user.isActive) return res.status(401).json({ error: genericError });
    if (!user.passwordHash) return res.status(401).json({ error: genericError });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: genericError });

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (e) {
    console.error('[admin-login]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
      vendorId: users.vendorId,
    }).from(users).where(eq(users.id, req.user!.id)).limit(1);

    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

    // If vendor_admin, include vendor info
    if (user.vendorId) {
      const [vendor] = await db.select({
        id: vendors.id,
        nameAr: vendors.nameAr,
        slug: vendors.slug,
        logoUrl: vendors.logoUrl,
        primaryColor: vendors.primaryColor,
        subscriptionStatus: vendors.subscriptionStatus,
        subscriptionPlan: vendors.subscriptionPlan,
      }).from(vendors).where(eq(vendors.id, user.vendorId)).limit(1);
      return res.json({ ...user, vendor: vendor ?? null });
    }

    return res.json(user);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'كلمة المرور القديمة والجديدة مطلوبتان' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (!user.passwordHash) return res.status(400).json({ error: 'لا يمكن تغيير كلمة المرور لهذا الحساب' });
    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'كلمة المرور القديمة غير صحيحة' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, req.user!.id));
    return res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
