import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, customers, vendors, customerLifecycleEvents } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { sendPlatformWhatsApp } from '../services/whatsapp.js';
import { cacheGet, cacheIncr, cacheDel } from '../services/cache.js';

// Per-account login lockout. The IP-based authLimiter stops casual scrapers,
// but a distributed brute-force attacker hitting a target phone from N IPs
// would slip through. We track attempts on the *phone* in cache and lock
// the account after LOGIN_MAX_ATTEMPTS failures within the window.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SEC = 15 * 60; // 15 minutes
const LOGIN_KEY = (phone: string) => `login:fail:${phone.replace(/\D/g, '')}`;

async function isLockedOut(phone: string): Promise<boolean> {
  const v = await cacheGet(LOGIN_KEY(phone));
  return v ? Number(v) >= LOGIN_MAX_ATTEMPTS : false;
}

async function recordFailedLogin(phone: string): Promise<number> {
  return cacheIncr(LOGIN_KEY(phone), LOGIN_LOCKOUT_SEC);
}

async function clearLoginFailures(phone: string): Promise<void> {
  await cacheDel(LOGIN_KEY(phone));
}

function normalizePhone(phone: string): string {
  let p = (phone || '').replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('+966')) p = '0' + p.slice(4);
  else if (p.startsWith('966')) p = '0' + p.slice(3);
  if (!p.startsWith('0')) p = '0' + p;
  return p;
}

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

// Login.
// Hardened against:
//   - account enumeration: same error message for "no such user" and
//     "wrong password"
//   - distributed brute force: per-phone attempt counter in cache locks
//     the account for 15min after 5 failures
//   - timing attacks: bcrypt.compare runs even when the user doesn't
//     exist (using a placeholder hash) so login latency doesn't leak
//     existence
const PLACEHOLDER_HASH = '$2a$10$' + 'A'.repeat(53); // never matches anything

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const phone = data.phone;
    const GENERIC_AUTH_ERROR = { error: 'رقم الجوال أو كلمة المرور غير صحيحة' };

    if (await isLockedOut(phone)) {
      return res.status(429).json({
        error: 'تم تجاوز عدد المحاولات. حاول مرة ثانية بعد 15 دقيقة.',
      });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.phone, phone))
      .limit(1);

    // Firebase UID path (passwordless / OTP-style)
    if (data.firebaseUid && user?.isActive) {
      await db.update(users).set({ firebaseUid: data.firebaseUid }).where(eq(users.id, user.id));
      await clearLoginFailures(phone);
      const token = signToken(user);
      return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vendorId: user.vendorId } });
    }

    if (!data.password) {
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    // Run bcrypt regardless so the response time is the same whether or
    // not the phone exists. Any failure (no user / inactive / bad password)
    // collapses to the generic error.
    const hashToCheck = user?.passwordHash ?? PLACEHOLDER_HASH;
    const valid = await bcrypt.compare(data.password, hashToCheck);

    if (!user || !user.isActive || !user.passwordHash || !valid) {
      const attempts = await recordFailedLogin(phone);
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({
          error: 'تم تجاوز عدد المحاولات. حاول مرة ثانية بعد 15 دقيقة.',
        });
      }
      return res.status(401).json(GENERIC_AUTH_ERROR);
    }

    await clearLoginFailures(phone);
    const token = signToken(user);
    return res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vendorId: user.vendorId } });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[auth/login]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Admin-only login (separate panel — phone + password) ────────────────────
// Hardened against brute-force, account-enumeration, and timing attacks
// the same way as /login. Lockout is more aggressive (3 attempts, 30 min)
// because super_admin compromise is catastrophic.
router.post('/admin-login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'رقم الجوال وكلمة المرور مطلوبة' });

    const p = normalizePhone(phone);
    const ADMIN_KEY = `admin-login:fail:${p.replace(/\D/g, '')}`;
    const ADMIN_MAX = 3;
    const ADMIN_LOCKOUT_SEC = 30 * 60;
    const genericError = 'رقم الجوال أو كلمة المرور غير صحيحة';
    const lockedError = 'تم تجاوز عدد المحاولات. حاول مرة ثانية بعد 30 دقيقة.';

    const fails = await cacheGet(ADMIN_KEY);
    if (fails && Number(fails) >= ADMIN_MAX) {
      return res.status(429).json({ error: lockedError });
    }

    const [user] = await db.select().from(users)
      .where(eq(users.phone, p))
      .limit(1);

    const hashToCheck = user?.passwordHash ?? PLACEHOLDER_HASH;
    const valid = await bcrypt.compare(password, hashToCheck);

    if (!user || user.role !== 'super_admin' || !user.isActive || !user.passwordHash || !valid) {
      const n = await cacheIncr(ADMIN_KEY, ADMIN_LOCKOUT_SEC);
      if (n >= ADMIN_MAX) return res.status(429).json({ error: lockedError });
      return res.status(401).json({ error: genericError });
    }

    await cacheDel(ADMIN_KEY);
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
        // Drives industry-aware UI on the vendor side: vehicle fields,
        // service-type pickers, copy on dashboards, etc.
        industry: vendors.industry,
        industryLabel: vendors.industryLabel,
        // Trust banners + cancel-with-refund flow read these.
        moneyBackUntil: vendors.moneyBackUntil,
        moneyBackUsed: vendors.moneyBackUsed,
        createdAt: vendors.createdAt,
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

// ─── OTP (WhatsApp phone verification) ──────────────────────────────────────
// Used during Fast-Onboard before the vendor is created, and any time we need
// to confirm that a phone really belongs to the person typing it.

const otpRequestSchema = z.object({
  phone: z.string().min(9, 'رقم الجوال غير صحيح'),
  purpose: z.enum(['signup', 'reset', 'verify']).default('signup'),
});

router.post('/send-otp', async (req, res) => {
  try {
    const data = otpRequestSchema.parse(req.body);
    const phone = normalizePhone(data.phone);

    // Find-or-create a lightweight user row to hold the OTP.
    const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (existing) {
      // Don't allow spamming: at most one OTP per 60 seconds
      if (existing.otpExpiresAt && existing.otpExpiresAt.getTime() - Date.now() > 9 * 60 * 1000) {
        return res.status(429).json({ error: 'تم إرسال رمز مؤخراً. انتظر دقيقة قبل المحاولة' });
      }
      await db.update(users).set({
        otpCode: code,
        otpExpiresAt: expires,
        otpAttempts: 0,
        updatedAt: new Date(),
      }).where(eq(users.id, existing.id));
    } else {
      // Placeholder row until registration finishes. Role is 'customer'
      // by default — will be bumped to vendor_admin when FastOnboard completes.
      await db.insert(users).values({
        name: 'زائر',
        phone,
        role: 'customer',
        otpCode: code,
        otpExpiresAt: expires,
        phoneVerified: false,
      });
    }

    const msg = `رمز التحقق الخاص بك في جداول: ${code}\nالرمز صالح لمدة 10 دقائق. لا تشاركه مع أحد.`;
    const delivered = await sendPlatformWhatsApp(phone, msg);
    // Prod-only hard failure: if the platform WhatsApp creds aren't
    // configured, the code will never arrive — tell the client so the
    // UI can show "خدمة التحقق غير متاحة حالياً" instead of waiting
    // forever on a code that isn't coming.
    if (!delivered && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'خدمة التحقق غير متاحة حالياً' });
    }
    return res.json({ success: true, expiresIn: 600 });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[send-otp]', e);
    return res.status(500).json({ error: 'تعذر إرسال الرمز' });
  }
});

const otpVerifySchema = z.object({
  phone: z.string(),
  code: z.string().length(6, 'الرمز يجب أن يكون 6 أرقام'),
});

router.post('/verify-otp', async (req, res) => {
  try {
    const data = otpVerifySchema.parse(req.body);
    const phone = normalizePhone(data.phone);
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ error: 'لم يتم إرسال رمز لهذا الرقم' });
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً' });
    }
    const attempts = user.otpAttempts ?? 0;
    if (attempts >= 5) {
      return res.status(429).json({ error: 'محاولات كثيرة. اطلب رمزاً جديداً' });
    }
    // Progressive backoff on wrong codes. Each subsequent attempt has a
    // minimum cooldown. A naive brute force of 900 seconds × rate is
    // reduced to a handful of attempts before the user is forced to
    // request a fresh code. updatedAt is bumped on every incorrect try.
    const cooldownSec = [0, 2, 5, 10, 30][attempts] ?? 60;
    if (cooldownSec > 0) {
      const sinceLast = Date.now() - (user.updatedAt?.getTime() ?? 0);
      if (sinceLast < cooldownSec * 1000) {
        const wait = Math.ceil((cooldownSec * 1000 - sinceLast) / 1000);
        return res.status(429).json({
          error: `انتظر ${wait} ثانية قبل المحاولة مرة ثانية`,
          retryAfter: wait,
        });
      }
    }
    if (user.otpCode !== data.code) {
      await db.update(users)
        .set({ otpAttempts: attempts + 1, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      return res.status(400).json({ error: 'الرمز غير صحيح' });
    }
    await db.update(users).set({
      phoneVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    // Short-lived proof-of-verification token: FastOnboard sends this with
    // the final vendor-create call so we know the phone is real.
    const verifyToken = jwt.sign(
      { phone, verified: true },
      process.env.JWT_SECRET!,
      { expiresIn: '30m', algorithm: 'HS256' }
    );
    return res.json({ success: true, verifyToken });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[verify-otp]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PASSWORD RESET (WhatsApp-delivered token) ──────────────────────────────

const resetRequestSchema = z.object({ phone: z.string().min(9) });

router.post('/request-password-reset', async (req, res) => {
  try {
    const data = resetRequestSchema.parse(req.body);
    const phone = normalizePhone(data.phone);
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    // Don't reveal whether the phone is registered.
    if (!user || !user.isActive) return res.json({ success: true });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.update(users).set({
      passwordResetToken: token,
      passwordResetExpiresAt: expires,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));

    const shortCode = token.slice(0, 8).toUpperCase();
    const msg = `طلب إعادة تعيين كلمة المرور في جداول.\nرمز الاسترجاع: ${shortCode}\n\nإذا لم تطلب ذلك، تجاهل هذه الرسالة.`;
    await sendPlatformWhatsApp(phone, msg);
    return res.json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[request-password-reset]', e);
    // Still return success to avoid leaking details
    return res.json({ success: true });
  }
});

const resetSchema = z.object({
  phone: z.string(),
  code: z.string().min(6, 'الرمز غير صحيح'),
  newPassword: z.string().min(6, 'كلمة المرور 6 أحرف على الأقل'),
});

router.post('/reset-password', async (req, res) => {
  try {
    const data = resetSchema.parse(req.body);
    const phone = normalizePhone(data.phone);
    const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!user || !user.passwordResetToken || !user.passwordResetExpiresAt) {
      return res.status(400).json({ error: 'رمز الاسترجاع غير صحيح أو منتهي' });
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: 'انتهت صلاحية رمز الاسترجاع' });
    }
    const expected = user.passwordResetToken.slice(0, 8).toUpperCase();
    if (data.code.toUpperCase() !== expected) {
      return res.status(400).json({ error: 'رمز الاسترجاع غير صحيح' });
    }
    const hash = await bcrypt.hash(data.newPassword, 12);
    await db.update(users).set({
      passwordHash: hash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id));
    return res.json({ success: true, message: 'تم تغيير كلمة المرور. سجّل الدخول الآن' });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[reset-password]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
