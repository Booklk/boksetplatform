import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import webpush from 'web-push';

const router = Router();

// Initialize VAPID keys (set in env)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL ?? 'admin@bokset.sa'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// POST /api/push/subscribe — Register push subscription
router.post('/subscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
      deviceType: z.enum(['web', 'android', 'ios']).optional(),
    }).parse(req.body);

    // Upsert
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, data.endpoint)).limit(1);
    if (existing.length > 0) {
      await db.update(pushSubscriptions).set({ isActive: true, userId: req.user!.id })
        .where(eq(pushSubscriptions.endpoint, data.endpoint));
    } else {
      await db.insert(pushSubscriptions).values({
        userId: req.user!.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        deviceType: data.deviceType ?? 'web',
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    await db.update(pushSubscriptions).set({ isActive: false })
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, req.user!.id)));
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/push/vapid-public-key — Return VAPID public key for client registration
router.get('/vapid-public-key', (_req, res) => {
  return res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});

export default router;
