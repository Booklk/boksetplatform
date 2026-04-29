import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import webpush from 'web-push';
import { getSetting } from '../services/platformSettings.js';

const router = Router();

// VAPID is now configured lazily from platform_settings (DB) or env fallback;
// the actual webpush.setVapidDetails() call lives in services/webPush.ts so
// the super-admin can rotate keys at runtime.

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
router.get('/vapid-public-key', async (_req, res) => {
  const publicKey = await getSetting('vapid.publicKey');
  return res.json({ publicKey: publicKey ?? null });
});

export default router;
