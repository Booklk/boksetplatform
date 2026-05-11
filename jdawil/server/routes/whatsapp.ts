/**
 * WhatsApp connection management — vendor-facing.
 *
 * Endpoints:
 *   GET    /status                   — current provider, status, plan, quota, toggles
 *   POST   /connect/meta             — save Meta Cloud creds + verify
 *   POST   /connect/unifonic         — save Unifonic creds + verify
 *   POST   /connect/shared           — switch to Jdawil's shared sender
 *   POST   /test                     — send a test message to vendor's own phone
 *   POST   /disconnect               — clear creds, revert to none
 *   PATCH  /notifications            — toggle per-event sends
 *   POST   /plan                     — change plan (essentials/pro/business)
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { encrypt } from '../lib/crypto.js';
import { verifyVendorWhatsApp } from '../services/whatsapp.js';
import { sendViaProvider } from '../services/whatsappProviders.js';

const router = Router();

const PLAN_QUOTAS: Record<string, number> = {
  none: 0,
  essentials: 500,
  pro: 2000,
  business: 5000,
};

// GET /api/whatsapp/status — current connection state
router.get('/status', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const [v] = await db.select({
      provider: vendors.whatsappProvider,
      status: vendors.whatsappStatus,
      verifiedAt: vendors.whatsappVerifiedAt,
      lastError: vendors.whatsappLastError,
      hasMetaCreds: vendors.whatsappToken,
      hasUnifonicCreds: vendors.whatsappUnifonicApiKey,
      unifonicSenderId: vendors.whatsappUnifonicSenderId,
      notifications: vendors.whatsappNotifications,
      plan: vendors.whatsappPlan,
      messagesUsed: vendors.whatsappMessagesUsed,
      messagesQuota: vendors.whatsappMessagesQuota,
      quotaResetAt: vendors.whatsappQuotaResetAt,
      vendorPhone: vendors.phone,
      vendorName: vendors.nameAr,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    if (!v) return res.status(404).json({ error: 'لم يتم العثور على المتجر' });

    return res.json({
      provider: v.provider,
      status: v.status,
      verifiedAt: v.verifiedAt,
      lastError: v.lastError,
      hasMetaCreds: !!v.hasMetaCreds,
      hasUnifonicCreds: !!v.hasUnifonicCreds,
      unifonicSenderId: v.unifonicSenderId,
      notifications: v.notifications ?? {},
      plan: v.plan,
      messagesUsed: v.messagesUsed,
      messagesQuota: v.messagesQuota,
      quotaResetAt: v.quotaResetAt,
      vendorPhone: v.vendorPhone,
      vendorName: v.vendorName,
    });
  } catch (e) {
    console.error('[WhatsApp:status]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/connect/meta
router.post('/connect/meta', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const { phoneId, token } = z.object({
      phoneId: z.string().min(5, 'Phone Number ID مطلوب'),
      token: z.string().min(20, 'Access Token مطلوب'),
    }).parse(req.body);

    await db.update(vendors).set({
      whatsappProvider: 'meta_cloud',
      whatsappPhoneId: encrypt(phoneId),
      whatsappToken: encrypt(token),
      whatsappStatus: 'pending',
      whatsappLastError: null,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    const verify = await verifyVendorWhatsApp(vendorId);
    if (!verify.valid) {
      await db.update(vendors).set({
        whatsappStatus: 'failed',
        whatsappLastError: verify.error ?? 'فشل التحقق',
      }).where(eq(vendors.id, vendorId));
      return res.status(400).json({ error: verify.error ?? 'فشل التحقق من بيانات Meta' });
    }

    await db.update(vendors).set({
      whatsappStatus: 'active',
      whatsappVerifiedAt: new Date(),
      whatsappLastError: null,
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true, provider: 'meta_cloud' });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[WhatsApp:connect/meta]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/connect/unifonic
router.post('/connect/unifonic', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const { appSid, apiKey, senderId } = z.object({
      appSid: z.string().min(5, 'App SID مطلوب'),
      apiKey: z.string().min(10, 'API Key مطلوب'),
      senderId: z.string().min(3, 'Sender ID مطلوب'),
    }).parse(req.body);

    await db.update(vendors).set({
      whatsappProvider: 'unifonic',
      whatsappUnifonicAppSid: encrypt(appSid),
      whatsappUnifonicApiKey: encrypt(apiKey),
      whatsappUnifonicSenderId: senderId,
      whatsappStatus: 'pending',
      whatsappLastError: null,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    const verify = await verifyVendorWhatsApp(vendorId);
    if (!verify.valid) {
      await db.update(vendors).set({
        whatsappStatus: 'failed',
        whatsappLastError: verify.error ?? 'فشل التحقق',
      }).where(eq(vendors.id, vendorId));
      return res.status(400).json({ error: verify.error ?? 'فشل التحقق من بيانات Unifonic' });
    }

    await db.update(vendors).set({
      whatsappStatus: 'active',
      whatsappVerifiedAt: new Date(),
      whatsappLastError: null,
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true, provider: 'unifonic' });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[WhatsApp:connect/unifonic]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/connect/shared
router.post('/connect/shared', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    await db.update(vendors).set({
      whatsappProvider: 'shared',
      whatsappStatus: 'active',
      whatsappVerifiedAt: new Date(),
      whatsappLastError: null,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true, provider: 'shared' });
  } catch (e) {
    console.error('[WhatsApp:connect/shared]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/test
router.post('/test', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const [v] = await db.select({ phone: vendors.phone, name: vendors.nameAr })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v?.phone) return res.status(400).json({ error: 'لا يوجد رقم هاتف مسجّل للمتجر' });

    const body = `✅ *${v.name ?? 'متجرك'}*\n\nتم ربط واتساب بنجاح مع منصة جداول!\nرسائلك ستصل من هذا الرقم من الآن فصاعداً.\n\n— Jdawil`;
    const result = await sendViaProvider(vendorId, v.phone, body);
    if (!result.ok) return res.status(400).json({ error: result.error ?? 'فشل إرسال الرسالة التجريبية' });
    return res.json({ ok: true, phone: v.phone });
  } catch (e) {
    console.error('[WhatsApp:test]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/disconnect
router.post('/disconnect', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    await db.update(vendors).set({
      whatsappProvider: 'none',
      whatsappStatus: 'not_connected',
      whatsappPhoneId: null,
      whatsappToken: null,
      whatsappUnifonicAppSid: null,
      whatsappUnifonicApiKey: null,
      whatsappUnifonicSenderId: null,
      whatsappVerifiedAt: null,
      whatsappLastError: null,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[WhatsApp:disconnect]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /api/whatsapp/notifications
router.patch('/notifications', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const notifications = z.object({
      bookingConfirmed: z.boolean().optional(),
      appointmentReminder: z.boolean().optional(),
      employeeOnWay: z.boolean().optional(),
      arrived: z.boolean().optional(),
      completed: z.boolean().optional(),
      ratingRequest: z.boolean().optional(),
      paymentReceived: z.boolean().optional(),
      marketing: z.boolean().optional(),
    }).parse(req.body);

    await db.update(vendors).set({
      whatsappNotifications: notifications,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true, notifications });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[WhatsApp:notifications]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/whatsapp/plan
router.post('/plan', requireAuth, requireRole('vendor_admin', 'admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });

    const { plan } = z.object({
      plan: z.enum(['none', 'essentials', 'pro', 'business']),
    }).parse(req.body);

    const quota = PLAN_QUOTAS[plan] ?? 0;
    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);

    await db.update(vendors).set({
      whatsappPlan: plan,
      whatsappMessagesQuota: quota,
      whatsappMessagesUsed: 0,
      whatsappQuotaResetAt: plan === 'none' ? null : resetAt,
      updatedAt: new Date(),
    }).where(eq(vendors.id, vendorId));

    return res.json({ ok: true, plan, quota });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[WhatsApp:plan]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
