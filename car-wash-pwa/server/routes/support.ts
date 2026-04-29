import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { supportTickets, supportReplies, users, vendors } from '../db/schema.js';
import { eq, desc, and, or } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ─── CANNED RESPONSES (quick replies for one-person support) ─────────────────

const CANNED_RESPONSES = [
  { id: 'received', label: 'تم الاستلام', text: 'مرحباً! تم استلام طلبك وسنعمل على حله في أقرب وقت.' },
  { id: 'need_info', label: 'نحتاج معلومات', text: 'شكراً لتواصلك. نحتاج معلومات إضافية لمساعدتك:\n\n1. وصف دقيق للمشكلة\n2. لقطة شاشة إن أمكن\n3. الخطوات لتكرار المشكلة' },
  { id: 'billing_info', label: 'استفسار فواتير', text: 'بخصوص استفسارك عن الفواتير، يمكنك مراجعة قسم الفواتير من لوحة التحكم. إذا كان هناك خطأ في المبلغ، أرسل لنا رقم الفاتورة وسنراجعها.' },
  { id: 'feature_noted', label: 'طلب ميزة', text: 'شكراً لاقتراحك! تم تسجيل طلبك كميزة مطلوبة وسنأخذه بعين الاعتبار في التحديثات القادمة.' },
  { id: 'bug_fix', label: 'تم إصلاح الخلل', text: 'تم إصلاح المشكلة التي أبلغت عنها. يرجى تحديث الصفحة والتأكد من أن كل شيء يعمل بشكل صحيح.' },
  { id: 'resolved', label: 'تم الحل', text: 'تم حل مشكلتك بنجاح. إذا واجهت أي مشكلة أخرى لا تتردد في التواصل معنا.\n\nشكراً لصبرك!' },
  { id: 'whatsapp_help', label: 'ربط واتساب', text: 'لربط حسابك بواتساب بزنس:\n\n1. ادخل لوحة التحكم → الإعدادات → واتساب\n2. أدخل رقم الهاتف ومعرف الحساب من Meta Business\n3. اضغط "تفعيل"\n\nإذا تحتاج مساعدة إضافية، أرسل لنا رقم هاتفك وسنساعدك.' },
  { id: 'upgrade', label: 'ترقية الباقة', text: 'للترقية إلى باقة Pro:\n\n1. ادخل لوحة التحكم → الباقة\n2. اضغط "ترقية إلى Pro"\n3. اختر شهري (99 ر.س) أو سنوي (999 ر.س)\n\nالتجربة المجانية 14 يوم تفتح لك كل المميزات.' },
];

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────────────────

const createTicketSchema = z.object({
  subject: z.string().min(3).max(255),
  category: z.enum(['general', 'billing', 'technical', 'feature_request', 'bug']).default('general'),
  description: z.string().min(10),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').optional(),
});

const replySchema = z.object({
  message: z.string().min(1),
  isInternal: z.boolean().optional().default(false),
});

// ─── GET /support/canned — get quick reply templates ────────────────────────

router.get('/canned', requireAuth, requireRole('super_admin'), (_req, res) => {
  return res.json(CANNED_RESPONSES);
});

// ─── GET /support — list tickets ────────────────────────────────────────────

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
          adminReply: supportTickets.adminReply,
          adminRepliedAt: supportTickets.adminRepliedAt,
          resolvedAt: supportTickets.resolvedAt,
          satisfactionRating: supportTickets.satisfactionRating,
          internalNote: supportTickets.internalNote,
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

    if (!user.vendorId) return res.status(403).json({ error: 'غير مصرح' });

    const rows = await db
      .select({
        id: supportTickets.id,
        subject: supportTickets.subject,
        category: supportTickets.category,
        priority: supportTickets.priority,
        status: supportTickets.status,
        description: supportTickets.description,
        adminReply: supportTickets.adminReply,
        adminRepliedAt: supportTickets.adminRepliedAt,
        resolvedAt: supportTickets.resolvedAt,
        satisfactionRating: supportTickets.satisfactionRating,
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

// ─── POST /support — submit a new ticket ────────────────────────────────────

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

// ─── GET /support/:id — get ticket with conversation thread ─────────────────

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
        adminReply: supportTickets.adminReply,
        adminRepliedAt: supportTickets.adminRepliedAt,
        resolvedAt: supportTickets.resolvedAt,
        satisfactionRating: supportTickets.satisfactionRating,
        internalNote: supportTickets.internalNote,
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

    if (user.role !== 'super_admin') {
      if (!user.vendorId || ticket.vendorId !== user.vendorId) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
    }

    // Fetch conversation thread
    let repliesQuery = db
      .select({
        id: supportReplies.id,
        message: supportReplies.message,
        role: supportReplies.role,
        isInternal: supportReplies.isInternal,
        createdAt: supportReplies.createdAt,
        userName: users.name,
      })
      .from(supportReplies)
      .leftJoin(users, eq(supportReplies.userId, users.id))
      .where(eq(supportReplies.ticketId, id))
      .orderBy(supportReplies.createdAt);

    const allReplies = await repliesQuery;

    // Hide internal notes from non-admin
    const replies = user.role === 'super_admin'
      ? allReplies
      : allReplies.filter(r => !r.isInternal);

    return res.json({ ...ticket, replies });
  } catch (e) {
    console.error('[GET /support/:id]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /support/:id/reply — add reply to conversation ────────────────────

router.post('/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'الرسالة مطلوبة' });
    }

    const [ticket] = await db.select({ vendorId: supportTickets.vendorId, status: supportTickets.status })
      .from(supportTickets).where(eq(supportTickets.id, id));
    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    // Ownership check
    const isAdmin = user.role === 'super_admin';
    if (!isAdmin) {
      if (!user.vendorId || ticket.vendorId !== user.vendorId) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
      // Vendor can't send internal notes
      if (parsed.data.isInternal) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'لا يمكن الرد على تذكرة مغلقة' });
    }

    const [reply] = await db.insert(supportReplies).values({
      ticketId: id,
      userId: user.id,
      role: isAdmin ? 'admin' : 'vendor',
      message: parsed.data.message,
      isInternal: parsed.data.isInternal ?? false,
    }).returning();

    // Update ticket status
    const newStatus = isAdmin ? 'in_progress' : 'waiting_vendor';
    await db.update(supportTickets).set({
      status: isAdmin ? 'in_progress' : (ticket.status === 'resolved' ? 'resolved' : 'open'),
      ...(isAdmin ? { adminRepliedAt: new Date(), adminRepliedBy: user.id, adminReply: parsed.data.message } : {}),
      updatedAt: new Date(),
    }).where(eq(supportTickets.id, id));

    return res.status(201).json(reply);
  } catch (e) {
    console.error('[POST /support/:id/reply]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/reply — legacy admin reply (backwards compat) ───────

router.patch('/:id/reply', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const { adminReply } = req.body;
    if (!adminReply) return res.status(400).json({ error: 'الرد مطلوب' });

    // Add to conversation thread
    await db.insert(supportReplies).values({
      ticketId: id,
      userId: req.user!.id,
      role: 'admin',
      message: adminReply,
    });

    const [ticket] = await db.update(supportTickets).set({
      adminReply,
      adminRepliedAt: new Date(),
      adminRepliedBy: req.user!.id,
      status: 'in_progress',
      updatedAt: new Date(),
    }).where(eq(supportTickets.id, id)).returning();

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/reply]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/note — admin internal note ──────────────────────────

router.patch('/:id/note', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const { note } = req.body;
    const [ticket] = await db.update(supportTickets)
      .set({ internalNote: note ?? null, updatedAt: new Date() })
      .where(eq(supportTickets.id, id)).returning();

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/note]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/resolve — mark resolved ────────────────────────────

router.patch('/:id/resolve', requireAuth, requireRole('super_admin'), async (req: AuthRequest, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const [ticket] = await db.update(supportTickets).set({
      status: 'resolved',
      resolvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(supportTickets.id, id)).returning();

    if (!ticket) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/resolve]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/rate — vendor rates support after resolve ───────────

router.patch('/:id/rate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const rating = z.number().min(1).max(5).parse(req.body.rating);

    const [existing] = await db.select({ vendorId: supportTickets.vendorId, status: supportTickets.status })
      .from(supportTickets).where(eq(supportTickets.id, id));

    if (!existing) return res.status(404).json({ error: 'التذكرة غير موجودة' });
    if (user.role !== 'super_admin' && existing.vendorId !== user.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (existing.status !== 'resolved' && existing.status !== 'closed') {
      return res.status(400).json({ error: 'لا يمكن التقييم قبل حل التذكرة' });
    }

    const [ticket] = await db.update(supportTickets)
      .set({ satisfactionRating: rating, updatedAt: new Date() })
      .where(eq(supportTickets.id, id)).returning();

    return res.json(ticket);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: 'التقييم يجب أن يكون من 1 إلى 5' });
    console.error('[PATCH /support/:id/rate]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PATCH /support/:id/close — close ticket ───────────────────────────────

router.patch('/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صحيح' });

    const [existing] = await db.select({ vendorId: supportTickets.vendorId })
      .from(supportTickets).where(eq(supportTickets.id, id));

    if (!existing) return res.status(404).json({ error: 'التذكرة غير موجودة' });

    if (user.role !== 'super_admin') {
      if (!user.vendorId || existing.vendorId !== user.vendorId) {
        return res.status(403).json({ error: 'غير مصرح' });
      }
    }

    const [ticket] = await db.update(supportTickets)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(eq(supportTickets.id, id)).returning();

    return res.json(ticket);
  } catch (e) {
    console.error('[PATCH /support/:id/close]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
