import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { supportTickets, users, vendors } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── VALIDATION SCHEMAS ───────────────────────────────────────────────────────

const createTicketSchema = z.object({
  subject: z.string().min(3).max(255),
  category: z.enum(['general', 'billing', 'technical', 'feature_request', 'bug']).default('general'),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
});

const replySchema = z.object({
  adminReply: z.string().min(1),
});

// ─── GET /support — list tickets ─────────────────────────────────────────────
// vendor_admin: own tickets only
// super_admin: all tickets with vendor + submitter name
router.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    if (user.role === 'super_admin') {
      const rows = await db
        .select({
          id: supportTickets.id,
          subject: supportTickets.subject,
          category: supportTickets.category,
          priority: supportTickets.priority,
          status: supportTickets.status,
          description: supportTickets.description,
          attachmentUrls: supportTickets.attachmentUrls,
          adminReply: supportTickets.adminReply,
          adminRepliedAt: supportTickets.adminRepliedAt,
          resolvedAt: supportTickets.resolvedAt,
          createdAt: supportTickets.createdAt,
          updatedAt: supportTickets.updatedAt,
          vendorId: supportTickets.vendorId,
          submittedBy: supportTickets.submittedBy,
          vendorName: vendors.nameAr,
          submitterName: users.name,
        })
        .from(supportTickets)
        .leftJoin(vendors, eq(supportTickets.vendorId, vendors.id))
        .leftJoin(users, eq(supportTickets.submittedBy, users.id))
        .orderBy(desc(supportTickets.createdAt));

      return res.json(rows);
    }

    // vendor_admin: see own vendor's tickets
    if (!user.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const rows = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        description: supportTickets.description,
        attachmentUrls: supportTickets.attachmentUrls,
        adminReply: supportTickets.adminReply,
        adminRepliedAt: supportTickets.adminRepliedAt,
        resolvedAt: supportTickets.resolvedAt,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        vendorId: supportTickets.vendorId,
        submittedBy: supportTickets.submittedBy,
      })
      .from(supportTickets)
      .where(eq(supportTickets.vendorId, user.vendorId))
      .orderBy(desc(supportTickets.createdAt));

    return res.json(rows);
  } catch (e) {
    console.error('[GET /support]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /support — submit a new ticket ─────────────────────────────────────
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const parsed = createTicketSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() });
    }

    const { subject, category, description, priority } = parsed.data;

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        vendorId: user.vendorId ?? null,
        submittedBy: user.id,
        subject,
        category,
        description,
        priority: priority ?? 'medium',
        status: 'open',
      })
      .returning();

    return res.status(201).json(ticket);
  } catch (e) {
    console.error('[POST /support]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /support/:id — get single ticket ────────────────────────────────────
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const [ticket] = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        description: supportTickets.description,
        attachmentUrls: supportTickets.attachmentUrls,
        adminReply: supportTickets.adminReply,
        adminRepliedAt: supportTickets.adminRepliedAt,
        resolvedAt: supportTickets.resolvedAt,
        createdAt: supportTickets.createdAt,
        updatedAt: supportTickets.updatedAt,
        vendorId: supportTickets.vendorId,
        submittedBy: supportTickets.submittedBy,
        vendorName: vendors.nameAr,
        submitterName: users.name,
      })
      .from(supportTickets)
      .leftJoin(vendors, eq(supportTickets.vendorId, vendors.id))
      .leftJoin(users, eq(supportTickets.submittedBy, users.id))
      .where(eq(supportTickets.id, id));

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    // Ownership check: vendor_admin can only see their own vendor's tickets
    if (user.role !== 'super_admin') {
      if (!user.vendorId || ticket.vendorId !== user.vendorId) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
    }

    return res.json(ticket);
  } catch (e) {
    console.error('[GET /support/:id]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/reply — super_admin reply ────────────────────────────
router.patch('/:id/reply', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الرد مطلوب', details: parsed.error.flatten() });
    }

    const [ticket] = await db
      .update(supportTickets)
      .set({
        adminReply: parsed.data.adminReply,
        adminRepliedAt: new Date(),
        adminRepliedBy: req.user!.id,
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/reply]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/resolve — super_admin resolve ────────────────────────
router.patch('/:id/resolve', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const [ticket] = await db
      .update(supportTickets)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/resolve]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/close — vendor closes their own ticket ───────────────
router.patch('/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    // Fetch ticket first for ownership check
    const [existing] = await db
      .select({ vendorId: supportTickets.vendorId, status: supportTickets.status })
      .from(supportTickets)
      .where(eq(supportTickets.id, id));

    if (!existing) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    // super_admin can close any ticket; vendor_admin can only close their own
    if (user.role !== 'super_admin') {
      if (!user.vendorId || existing.vendorId !== user.vendorId) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
    }

    const [ticket] = await db
      .update(supportTickets)
      .set({
        status: 'closed',
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, id))
      .returning();

    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/close]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
