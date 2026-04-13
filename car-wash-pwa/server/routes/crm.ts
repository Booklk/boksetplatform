import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  customerNotes,
  customerTags,
  customerTagAssignments,
  customerLifecycleEvents,
  customers,
  bookings,
  payments,
  users,
} from '../db/schema.js';
import { eq, and, desc, sql, gte, count, sum, avg, inArray } from 'drizzle-orm';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';

const router = Router();

// All CRM routes require vendor_admin or admin role
const crmAuth = [requireAuth, requireRole('vendor_admin', 'admin')];

// ─── ZOD SCHEMAS ─────────────────────────────────────────────────────────────

const createNoteSchema = z.object({
  note: z.string().min(1, 'الملاحظة مطلوبة').max(5000, 'الملاحظة طويلة جداً'),
});

const createTagSchema = z.object({
  name: z.string().min(1, 'اسم الوسم مطلوب').max(100, 'اسم الوسم طويل جداً'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'لون غير صالح').default('#3b82f6'),
});

const assignTagSchema = z.object({
  tagId: z.number().int().positive('معرف الوسم غير صالح'),
});

const lifecycleEventSchema = z.object({
  customerId: z.number().int().positive('معرف العميل غير صالح'),
  eventType: z.enum(
    ['first_booking', 'became_regular', 'became_vip', 'churning', 'reactivated', 'complained', 'referred_friend'],
    { errorMap: () => ({ message: 'نوع الحدث غير صالح' }) },
  ),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getVendorId(req: AuthRequest): number | null {
  return req.user?.vendorId ?? null;
}

/** Verify that a customer belongs to the current vendor */
async function verifyCustomerOwnership(customerId: number, vendorId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.vendorId, vendorId)))
    .limit(1);
  return !!row;
}

// ─── 1. GET /customers/:id/timeline ─────────────────────────────────────────

router.get('/customers/:id/timeline', ...crmAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const customerId = Number(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'معرف العميل غير صالح' });

    const owns = await verifyCustomerOwnership(customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    // Fetch all timeline sources in parallel
    const [recentBookings, notes, lifecycleEvents, tagAssignments] = await Promise.all([
      // Recent bookings (last 20) — customerId in bookings references users.id via customer record
      db
        .select({
          id: bookings.id,
          bookingNumber: bookings.bookingNumber,
          status: bookings.status,
          scheduledAt: bookings.scheduledAt,
          totalPrice: bookings.totalPrice,
          rating: bookings.rating,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(customers, eq(customers.userId, bookings.customerId))
        .where(and(eq(customers.id, customerId), eq(bookings.vendorId, vendorId)))
        .orderBy(desc(bookings.createdAt))
        .limit(20),

      // Notes
      db
        .select({
          id: customerNotes.id,
          note: customerNotes.note,
          createdBy: customerNotes.createdBy,
          createdAt: customerNotes.createdAt,
        })
        .from(customerNotes)
        .where(and(eq(customerNotes.customerId, customerId), eq(customerNotes.vendorId, vendorId)))
        .orderBy(desc(customerNotes.createdAt)),

      // Lifecycle events
      db
        .select({
          id: customerLifecycleEvents.id,
          eventType: customerLifecycleEvents.eventType,
          metadata: customerLifecycleEvents.metadata,
          createdAt: customerLifecycleEvents.createdAt,
        })
        .from(customerLifecycleEvents)
        .where(and(eq(customerLifecycleEvents.customerId, customerId), eq(customerLifecycleEvents.vendorId, vendorId)))
        .orderBy(desc(customerLifecycleEvents.createdAt)),

      // Tag assignments with tag details
      db
        .select({
          id: customerTagAssignments.id,
          tagId: customerTagAssignments.tagId,
          tagName: customerTags.name,
          tagColor: customerTags.color,
          assignedAt: customerTagAssignments.assignedAt,
        })
        .from(customerTagAssignments)
        .innerJoin(customerTags, eq(customerTags.id, customerTagAssignments.tagId))
        .where(eq(customerTagAssignments.customerId, customerId)),
    ]);

    // Build unified timeline
    const timeline: Array<{ type: string; date: Date | string; data: unknown }> = [];

    for (const b of recentBookings) {
      timeline.push({ type: 'booking', date: b.createdAt, data: b });
    }
    for (const n of notes) {
      timeline.push({ type: 'note', date: n.createdAt, data: n });
    }
    for (const e of lifecycleEvents) {
      timeline.push({ type: 'lifecycle_event', date: e.createdAt, data: e });
    }
    for (const t of tagAssignments) {
      timeline.push({ type: 'tag_assignment', date: t.assignedAt, data: t });
    }

    // Sort by date descending
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return res.json(timeline);
  } catch (e) {
    console.error('CRM timeline error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 2. GET /customers/:id/notes ────────────────────────────────────────────

router.get('/customers/:id/notes', ...crmAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const customerId = Number(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'معرف العميل غير صالح' });

    const owns = await verifyCustomerOwnership(customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    const notes = await db
      .select({
        id: customerNotes.id,
        note: customerNotes.note,
        createdBy: customerNotes.createdBy,
        createdByName: users.name,
        createdAt: customerNotes.createdAt,
      })
      .from(customerNotes)
      .leftJoin(users, eq(users.id, customerNotes.createdBy))
      .where(and(eq(customerNotes.customerId, customerId), eq(customerNotes.vendorId, vendorId)))
      .orderBy(desc(customerNotes.createdAt));

    return res.json(notes);
  } catch (e) {
    console.error('CRM notes list error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 3. POST /customers/:id/notes ───────────────────────────────────────────

router.post('/customers/:id/notes', ...crmAuth, audit('crm.note.create'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const customerId = Number(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'معرف العميل غير صالح' });

    const owns = await verifyCustomerOwnership(customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    const data = createNoteSchema.parse(req.body);

    const [note] = await db
      .insert(customerNotes)
      .values({
        vendorId,
        customerId,
        note: data.note,
        createdBy: req.user!.id,
      })
      .returning();

    return res.status(201).json(note);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('CRM note create error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 4. DELETE /notes/:noteId ───────────────────────────────────────────────

router.delete('/notes/:noteId', ...crmAuth, audit('crm.note.delete'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const noteId = Number(req.params.noteId);
    if (isNaN(noteId)) return res.status(400).json({ error: 'معرف الملاحظة غير صالح' });

    const [existing] = await db
      .select({ id: customerNotes.id })
      .from(customerNotes)
      .where(and(eq(customerNotes.id, noteId), eq(customerNotes.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'الملاحظة غير موجودة' });

    await db.delete(customerNotes).where(eq(customerNotes.id, noteId));

    return res.json({ success: true, message: 'تم حذف الملاحظة بنجاح' });
  } catch (e) {
    console.error('CRM note delete error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 5. GET /tags ───────────────────────────────────────────────────────────

router.get('/tags', ...crmAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const tags = await db
      .select({
        id: customerTags.id,
        name: customerTags.name,
        color: customerTags.color,
        createdAt: customerTags.createdAt,
        customerCount: sql<number>`(
          SELECT COUNT(*)::int FROM customer_tag_assignments
          WHERE customer_tag_assignments.tag_id = ${customerTags.id}
        )`,
      })
      .from(customerTags)
      .where(eq(customerTags.vendorId, vendorId))
      .orderBy(desc(customerTags.createdAt));

    return res.json(tags);
  } catch (e) {
    console.error('CRM tags list error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 6. POST /tags ──────────────────────────────────────────────────────────

router.post('/tags', ...crmAuth, audit('crm.tag.create'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const data = createTagSchema.parse(req.body);

    // Check for duplicate tag name within vendor
    const [duplicate] = await db
      .select({ id: customerTags.id })
      .from(customerTags)
      .where(and(eq(customerTags.vendorId, vendorId), eq(customerTags.name, data.name)))
      .limit(1);

    if (duplicate) return res.status(409).json({ error: 'يوجد وسم بنفس الاسم مسبقاً' });

    const [tag] = await db
      .insert(customerTags)
      .values({
        vendorId,
        name: data.name,
        color: data.color,
      })
      .returning();

    return res.status(201).json(tag);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('CRM tag create error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 7. DELETE /tags/:id ────────────────────────────────────────────────────

router.delete('/tags/:id', ...crmAuth, audit('crm.tag.delete'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const tagId = Number(req.params.id);
    if (isNaN(tagId)) return res.status(400).json({ error: 'معرف الوسم غير صالح' });

    const [existing] = await db
      .select({ id: customerTags.id })
      .from(customerTags)
      .where(and(eq(customerTags.id, tagId), eq(customerTags.vendorId, vendorId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'الوسم غير موجود' });

    // Cascade delete handles tag assignments automatically
    await db.delete(customerTags).where(eq(customerTags.id, tagId));

    return res.json({ success: true, message: 'تم حذف الوسم بنجاح' });
  } catch (e) {
    console.error('CRM tag delete error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 8. POST /customers/:id/tags ────────────────────────────────────────────

router.post('/customers/:id/tags', ...crmAuth, audit('crm.tag.assign'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const customerId = Number(req.params.id);
    if (isNaN(customerId)) return res.status(400).json({ error: 'معرف العميل غير صالح' });

    const owns = await verifyCustomerOwnership(customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    const data = assignTagSchema.parse(req.body);

    // Verify tag belongs to this vendor
    const [tag] = await db
      .select({ id: customerTags.id })
      .from(customerTags)
      .where(and(eq(customerTags.id, data.tagId), eq(customerTags.vendorId, vendorId)))
      .limit(1);

    if (!tag) return res.status(404).json({ error: 'الوسم غير موجود' });

    // Check if already assigned
    const [existingAssignment] = await db
      .select({ id: customerTagAssignments.id })
      .from(customerTagAssignments)
      .where(and(eq(customerTagAssignments.customerId, customerId), eq(customerTagAssignments.tagId, data.tagId)))
      .limit(1);

    if (existingAssignment) return res.status(409).json({ error: 'الوسم مُعيّن لهذا العميل مسبقاً' });

    const [assignment] = await db
      .insert(customerTagAssignments)
      .values({
        customerId,
        tagId: data.tagId,
      })
      .returning();

    return res.status(201).json(assignment);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('CRM tag assign error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 9. DELETE /customers/:id/tags/:tagId ───────────────────────────────────

router.delete('/customers/:id/tags/:tagId', ...crmAuth, audit('crm.tag.unassign'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const customerId = Number(req.params.id);
    const tagId = Number(req.params.tagId);
    if (isNaN(customerId) || isNaN(tagId)) return res.status(400).json({ error: 'معرفات غير صالحة' });

    const owns = await verifyCustomerOwnership(customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    const [existing] = await db
      .select({ id: customerTagAssignments.id })
      .from(customerTagAssignments)
      .where(and(eq(customerTagAssignments.customerId, customerId), eq(customerTagAssignments.tagId, tagId)))
      .limit(1);

    if (!existing) return res.status(404).json({ error: 'الوسم غير مُعيّن لهذا العميل' });

    await db
      .delete(customerTagAssignments)
      .where(and(eq(customerTagAssignments.customerId, customerId), eq(customerTagAssignments.tagId, tagId)));

    return res.json({ success: true, message: 'تم إزالة الوسم بنجاح' });
  } catch (e) {
    console.error('CRM tag unassign error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 10. GET /dashboard ─────────────────────────────────────────────────────

router.get('/dashboard', ...crmAuth, async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCustomersResult,
      newCustomersResult,
      churningResult,
      ltvResult,
      topTagsResult,
      recentEventsResult,
    ] = await Promise.all([
      // Total customers
      db
        .select({ total: count() })
        .from(customers)
        .where(eq(customers.vendorId, vendorId)),

      // New customers this month
      db
        .select({ total: count() })
        .from(customers)
        .where(and(eq(customers.vendorId, vendorId), gte(customers.createdAt, startOfMonth))),

      // Churning customers (no booking in 30 days)
      // Customers who have at least one booking but none in the last 30 days
      db.execute<{ total: number }>(sql`
        SELECT COUNT(DISTINCT c.id)::int AS total
        FROM customers c
        WHERE c.vendor_id = ${vendorId}
          AND EXISTS (
            SELECT 1 FROM bookings b WHERE b.customer_id = c.user_id AND b.vendor_id = ${vendorId}
          )
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.customer_id = c.user_id
              AND b.vendor_id = ${vendorId}
              AND b.created_at >= ${thirtyDaysAgo}
          )
      `),

      // Average LTV (total spend per customer)
      db.execute<{ avg_ltv: string }>(sql`
        SELECT COALESCE(AVG(customer_total), 0)::numeric(12,2) AS avg_ltv
        FROM (
          SELECT SUM(COALESCE(b.total_price::numeric, 0)) AS customer_total
          FROM customers c
          LEFT JOIN bookings b ON b.customer_id = c.user_id AND b.vendor_id = ${vendorId} AND b.status = 'completed'
          WHERE c.vendor_id = ${vendorId}
          GROUP BY c.id
        ) sub
      `),

      // Top tags (top 10 by usage)
      db
        .select({
          id: customerTags.id,
          name: customerTags.name,
          color: customerTags.color,
          customerCount: count(customerTagAssignments.id),
        })
        .from(customerTags)
        .leftJoin(customerTagAssignments, eq(customerTagAssignments.tagId, customerTags.id))
        .where(eq(customerTags.vendorId, vendorId))
        .groupBy(customerTags.id, customerTags.name, customerTags.color)
        .orderBy(sql`count(${customerTagAssignments.id}) DESC`)
        .limit(10),

      // Recent lifecycle events (last 20)
      db
        .select({
          id: customerLifecycleEvents.id,
          customerId: customerLifecycleEvents.customerId,
          eventType: customerLifecycleEvents.eventType,
          metadata: customerLifecycleEvents.metadata,
          createdAt: customerLifecycleEvents.createdAt,
        })
        .from(customerLifecycleEvents)
        .where(eq(customerLifecycleEvents.vendorId, vendorId))
        .orderBy(desc(customerLifecycleEvents.createdAt))
        .limit(20),
    ]);

    const churningRows = churningResult.rows ?? churningResult;
    const ltvRows = ltvResult.rows ?? ltvResult;

    return res.json({
      totalCustomers: totalCustomersResult[0]?.total ?? 0,
      newCustomersThisMonth: newCustomersResult[0]?.total ?? 0,
      churningCustomers: (churningRows as any[])[0]?.total ?? 0,
      averageLtv: parseFloat(String((ltvRows as any[])[0]?.avg_ltv ?? '0')),
      topTags: topTagsResult,
      recentLifecycleEvents: recentEventsResult,
    });
  } catch (e) {
    console.error('CRM dashboard error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── 11. POST /lifecycle-event ──────────────────────────────────────────────

router.post('/lifecycle-event', ...crmAuth, audit('crm.lifecycle.create'), async (req: AuthRequest, res) => {
  try {
    const vendorId = getVendorId(req);
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بهذا الحساب' });

    const data = lifecycleEventSchema.parse(req.body);

    const owns = await verifyCustomerOwnership(data.customerId, vendorId);
    if (!owns) return res.status(404).json({ error: 'العميل غير موجود' });

    const [event] = await db
      .insert(customerLifecycleEvents)
      .values({
        vendorId,
        customerId: data.customerId,
        eventType: data.eventType,
        metadata: data.metadata,
      })
      .returning();

    return res.status(201).json(event);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('CRM lifecycle event error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
