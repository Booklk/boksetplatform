/**
 * PDPL — Saudi Personal Data Protection Law compliance kit.
 *
 * Three pillars:
 *   1. Consent log — append-only proof of every consent the data subject
 *      grants or revokes.
 *   2. Right to access — data subject downloads everything we hold on
 *      them in a single JSON.
 *   3. Right to erasure — already covered by the soft-delete in
 *      /api/customer-profile/me; this route just exposes the policy
 *      so the UI can explain it.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  pdplConsents, users, customers, bookings, loyaltyPoints,
  inAppNotifications,
} from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const CURRENT_VERSIONS = {
  cookies: '1.0',
  terms: '1.0',
  privacy: '1.0',
  marketing: '1.0',
  data_processing: '1.0',
  photo_use: '1.0',
} as const;

// ─── Consent capture (public — also accepts anon visitors) ─────────────────
const consentSchema = z.object({
  scope: z.enum(['cookies', 'terms', 'privacy', 'marketing', 'data_processing', 'photo_use']),
  granted: z.boolean(),
  anonId: z.string().min(8).max(64).optional(),
  vendorId: z.number().int().positive().optional(),
});

router.post('/consent', async (req, res) => {
  try {
    const data = consentSchema.parse(req.body);
    const userId = (req as AuthRequest).user?.id ?? null;

    if (!userId && !data.anonId) {
      return res.status(400).json({ error: 'لتسجيل الموافقة كزائر، أرسل anonId' });
    }

    await db.insert(pdplConsents).values({
      userId,
      anonId: data.anonId ?? null,
      vendorId: data.vendorId ?? null,
      scope: data.scope,
      granted: data.granted,
      documentVersion: CURRENT_VERSIONS[data.scope],
      ip: req.ip ?? null,
      userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 500),
    });

    return res.status(201).json({ success: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[pdpl/consent]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── My consent history (auth) ─────────────────────────────────────────────
router.get('/my-consents', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(pdplConsents)
      .where(eq(pdplConsents.userId, req.user!.id))
      .orderBy(desc(pdplConsents.createdAt))
      .limit(200);
    return res.json(rows);
  } catch (e) {
    console.error('[pdpl/my-consents]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Data export — RIGHT TO ACCESS (auth) ──────────────────────────────────
router.get('/my-data', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [user] = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      role: users.role,
      vendorId: users.vendorId,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const customerProfiles = await db.select().from(customers)
      .where(eq(customers.userId, userId));

    const myBookings = await db.select().from(bookings)
      .where(eq(bookings.customerId, userId))
      .orderBy(desc(bookings.createdAt))
      .limit(500);

    const loyalty = await db.select().from(loyaltyPoints)
      .where(eq(loyaltyPoints.customerId, userId));

    const notifs = await db.select().from(inAppNotifications)
      .where(eq(inAppNotifications.userId, userId))
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(500);

    const consents = await db.select().from(pdplConsents)
      .where(eq(pdplConsents.userId, userId))
      .orderBy(desc(pdplConsents.createdAt));

    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        regulation: 'PDPL Saudi Arabia',
        platform: 'Jdawil',
      },
      user,
      customerProfiles,
      bookings: myBookings,
      loyaltyPoints: loyalty,
      notifications: notifs,
      consentLog: consents,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jdawil-data-export-${user?.id ?? 'unknown'}.json"`);
    return res.json(payload);
  } catch (e) {
    console.error('[pdpl/my-data]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Privacy controls metadata for the client UI ───────────────────────────
router.get('/policy-versions', (_req, res) => {
  return res.json({
    versions: CURRENT_VERSIONS,
    rights: [
      { key: 'access',     label: 'حقّ الوصول لبياناتك',           endpoint: '/api/pdpl/my-data' },
      { key: 'consent',    label: 'سجل موافقاتك السابقة',          endpoint: '/api/pdpl/my-consents' },
      { key: 'erasure',    label: 'حقّ حذف حسابك خلال 30 يوم',     endpoint: '/api/customer-profile/me (DELETE)' },
      { key: 'rectify',    label: 'تصحيح بياناتك متى ما شئت',       endpoint: '/api/customer-profile/me (PATCH)' },
    ],
  });
});

export default router;
