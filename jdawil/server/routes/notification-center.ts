import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { inAppNotifications } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Helper: create notification (exported for use from other routes) ───────

export async function createNotification(
  userId: number,
  title: string,
  body: string,
  type: string,
  link?: string,
  vendorId?: number,
) {
  const [notification] = await db.insert(inAppNotifications).values({
    userId,
    title,
    body,
    type,
    link: link ?? null,
    vendorId: vendorId ?? null,
  }).returning();

  return notification;
}

// ─── GET /unread-count — Quick unread count for badge ───────────────────────
// Must come before /:id routes to avoid param conflict

router.get('/unread-count', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inAppNotifications)
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.isRead, false),
      ));

    return res.json({ unreadCount: result?.count ?? 0 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /read-all — Mark all as read ───────────────────────────────────────
// Must come before /:id routes to avoid param conflict

router.put('/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    await db.update(inAppNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.isRead, false),
      ));

    return res.json({ success: true, message: 'تم تحديد جميع الإشعارات كمقروءة' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET / — List notifications (paginated) ────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Fetch notifications
    const notifications = await db
      .select()
      .from(inAppNotifications)
      .where(eq(inAppNotifications.userId, userId))
      .orderBy(desc(inAppNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Total count
    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inAppNotifications)
      .where(eq(inAppNotifications.userId, userId));

    // Unread count
    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inAppNotifications)
      .where(and(
        eq(inAppNotifications.userId, userId),
        eq(inAppNotifications.isRead, false),
      ));

    return res.json({
      notifications,
      total: totalRow?.count ?? 0,
      unreadCount: unreadRow?.count ?? 0,
      page,
      limit,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /:id/read — Mark single notification as read ───────────────────────

router.put('/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [existing] = await db.select({ id: inAppNotifications.id })
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'الإشعار غير موجود' });

    const [updated] = await db.update(inAppNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(inAppNotifications.id, id))
      .returning();

    return res.json(updated);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── DELETE /:id — Delete single notification ───────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [existing] = await db.select({ id: inAppNotifications.id })
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: 'الإشعار غير موجود' });

    await db.delete(inAppNotifications)
      .where(eq(inAppNotifications.id, id));

    return res.json({ success: true, message: 'تم حذف الإشعار' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
