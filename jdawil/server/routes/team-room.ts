/**
 * Team Room — private channel per vendor.
 *
 * The owner is host by default; any user with users.vendorId = X is
 * automatically a member. No separate "membership" table — vendor
 * scoping handles it.
 *
 * Endpoints:
 *   GET    /api/team/members            — owner + employees of this vendor
 *   GET    /api/team/messages           — paginated chat history
 *   POST   /api/team/messages           — post a message
 *   PATCH  /api/team/messages/:id/pin   — pin/unpin (owner only)
 *   DELETE /api/team/messages/:id       — soft-delete (author or owner)
 *   POST   /api/team/read               — update read cursor (unread badge)
 *   GET    /api/team/unread-count       — for badge in nav
 *
 *   GET    /api/team/tasks              — list tasks (filter: status, assignee)
 *   POST   /api/team/tasks              — create task
 *   PATCH  /api/team/tasks/:id          — update (status, assignee, etc.)
 *   DELETE /api/team/tasks/:id          — delete (creator or owner)
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  teamMessages, teamTasks, teamReadCursors, users, vendors,
} from '../db/schema.js';
import { eq, and, desc, asc, isNull, lt, sql, gt } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── Members ───────────────────────────────────────────────────────────────
router.get('/members', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const list = await db.select({
      id: users.id,
      name: users.name,
      phone: users.phone,
      role: users.role,
    })
      .from(users)
      .where(eq(users.vendorId, vendorId))
      .orderBy(asc(users.name));
    return res.json(list);
  } catch (e) {
    console.error('[team/members]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Messages ──────────────────────────────────────────────────────────────
router.get('/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;

    const rows = await db.select({
      id: teamMessages.id,
      authorId: teamMessages.authorId,
      authorName: users.name,
      body: teamMessages.body,
      attachmentUrl: teamMessages.attachmentUrl,
      attachmentType: teamMessages.attachmentType,
      pinned: teamMessages.pinned,
      createdAt: teamMessages.createdAt,
    })
      .from(teamMessages)
      .leftJoin(users, eq(users.id, teamMessages.authorId))
      .where(and(
        eq(teamMessages.vendorId, vendorId),
        isNull(teamMessages.deletedAt),
        ...(beforeId ? [lt(teamMessages.id, beforeId)] : []),
      ))
      .orderBy(desc(teamMessages.id))
      .limit(limit);

    return res.json(rows.reverse());
  } catch (e) {
    console.error('[team/messages list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const postMessageSchema = z.object({
  body: z.string().min(1, 'الرسالة فارغة').max(4000),
  attachmentUrl: z.string().url().optional(),
  attachmentType: z.string().max(30).optional(),
});

router.post('/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const data = postMessageSchema.parse(req.body);

    const [msg] = await db.insert(teamMessages).values({
      vendorId,
      authorId: req.user!.id,
      body: data.body.trim(),
      attachmentUrl: data.attachmentUrl ?? null,
      attachmentType: data.attachmentType ?? null,
    }).returning();

    return res.status(201).json(msg);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[team/messages post]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.patch('/messages/:id/pin', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const pinned = Boolean(req.body?.pinned);
    const [updated] = await db.update(teamMessages)
      .set({ pinned })
      .where(and(eq(teamMessages.id, id), eq(teamMessages.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'الرسالة غير موجودة' });
    return res.json(updated);
  } catch (e) {
    console.error('[team/messages pin]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.delete('/messages/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [msg] = await db.select().from(teamMessages)
      .where(and(eq(teamMessages.id, id), eq(teamMessages.vendorId, vendorId)))
      .limit(1);
    if (!msg) return res.status(404).json({ error: 'الرسالة غير موجودة' });
    if (msg.authorId !== req.user!.id && req.user!.role !== 'vendor_admin' && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'الحذف يقتصر على الكاتب أو المدير' });
    }
    await db.update(teamMessages).set({ deletedAt: new Date() }).where(eq(teamMessages.id, id));
    return res.json({ success: true });
  } catch (e) {
    console.error('[team/messages delete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Read cursor + unread count ────────────────────────────────────────────
router.post('/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const lastId = Number(req.body?.lastReadMessageId ?? 0);
    if (!lastId) return res.status(400).json({ error: 'lastReadMessageId مطلوب' });

    // Upsert via uniqueIndex(vendor_id, user_id).
    const [existing] = await db.select().from(teamReadCursors)
      .where(and(eq(teamReadCursors.vendorId, vendorId), eq(teamReadCursors.userId, req.user!.id)))
      .limit(1);
    if (existing) {
      await db.update(teamReadCursors)
        .set({ lastReadMessageId: lastId, updatedAt: new Date() })
        .where(eq(teamReadCursors.id, existing.id));
    } else {
      await db.insert(teamReadCursors).values({
        vendorId, userId: req.user!.id, lastReadMessageId: lastId,
      });
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('[team/read]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.get('/unread-count', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.json({ count: 0 });
    const [cursor] = await db.select().from(teamReadCursors)
      .where(and(eq(teamReadCursors.vendorId, vendorId), eq(teamReadCursors.userId, req.user!.id)))
      .limit(1);
    const lastRead = cursor?.lastReadMessageId ?? 0;

    const [{ count = 0 }] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(teamMessages)
      .where(and(
        eq(teamMessages.vendorId, vendorId),
        gt(teamMessages.id, lastRead),
        isNull(teamMessages.deletedAt),
      ));
    return res.json({ count: Number(count ?? 0) });
  } catch (e) {
    console.error('[team/unread]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── Tasks ─────────────────────────────────────────────────────────────────
const taskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.number().int().positive().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt: z.string().datetime().optional(),
});

router.get('/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const status = (req.query.status as string) || null;
    const mine = req.query.mine === '1';

    const rows = await db.select({
      id: teamTasks.id,
      title: teamTasks.title,
      description: teamTasks.description,
      status: teamTasks.status,
      priority: teamTasks.priority,
      dueAt: teamTasks.dueAt,
      completedAt: teamTasks.completedAt,
      createdAt: teamTasks.createdAt,
      updatedAt: teamTasks.updatedAt,
      assigneeId: teamTasks.assigneeId,
      assigneeName: users.name,
      createdById: teamTasks.createdById,
    })
      .from(teamTasks)
      .leftJoin(users, eq(users.id, teamTasks.assigneeId))
      .where(and(
        eq(teamTasks.vendorId, vendorId),
        ...(status ? [eq(teamTasks.status, status)] : []),
        ...(mine ? [eq(teamTasks.assigneeId, req.user!.id)] : []),
      ))
      .orderBy(desc(teamTasks.createdAt));
    return res.json(rows);
  } catch (e) {
    console.error('[team/tasks list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.post('/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'لا تنتمي لمتجر' });
    const data = taskSchema.parse(req.body);

    if (data.assigneeId) {
      // Defense-in-depth: assignee must belong to this vendor.
      const [u] = await db.select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, data.assigneeId), eq(users.vendorId, vendorId)))
        .limit(1);
      if (!u) return res.status(400).json({ error: 'الموظف غير تابع لهذا المتجر' });
    }

    const [task] = await db.insert(teamTasks).values({
      vendorId,
      createdById: req.user!.id,
      assigneeId: data.assigneeId ?? null,
      title: data.title.trim(),
      description: data.description ?? null,
      priority: data.priority ?? 'normal',
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
    }).returning();

    return res.status(201).json(task);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[team/tasks post]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const taskPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

router.patch('/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = taskPatchSchema.parse(req.body);

    const updates: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.dueAt) updates.dueAt = new Date(data.dueAt);
    if (data.dueAt === null) updates.dueAt = null;
    if (data.status === 'done') updates.completedAt = new Date();
    if (data.status && data.status !== 'done') updates.completedAt = null;

    const [updated] = await db.update(teamTasks)
      .set(updates)
      .where(and(eq(teamTasks.id, id), eq(teamTasks.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'المهمة غير موجودة' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[team/tasks patch]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.delete('/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [task] = await db.select().from(teamTasks)
      .where(and(eq(teamTasks.id, id), eq(teamTasks.vendorId, vendorId)))
      .limit(1);
    if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
    if (task.createdById !== req.user!.id && req.user!.role !== 'vendor_admin' && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'الحذف يقتصر على المنشئ أو المدير' });
    }
    await db.delete(teamTasks).where(eq(teamTasks.id, id));
    return res.json({ success: true });
  } catch (e) {
    console.error('[team/tasks delete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
