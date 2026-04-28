import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { whatsappCampaigns, users, bookings, vendors } from '../db/schema.js';
import { eq, desc, sql, and, lt, gte } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { sendRawWhatsAppMessage } from '../services/whatsapp.js';

const router = Router();

// GET /api/campaigns — list vendor campaigns
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(whatsappCampaigns)
      .where(eq(whatsappCampaigns.vendorId, vendorId))
      .orderBy(desc(whatsappCampaigns.createdAt));
    return res.json(list);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/campaigns/preview/:segment — count recipients for a segment
router.get('/preview/:segment', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const segment = req.params.segment;
    const phones = await getSegmentPhones(vendorId, segment);
    return res.json({ count: phones.length });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// POST /api/campaigns — create & send campaign
router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = z.object({
      name: z.string().min(2).max(200),
      segment: z.enum(['all', 'inactive_21', 'inactive_14', 'top_customers']),
      message: z.string().min(10).max(1000),
    }).parse(req.body);

    // Check vendor has WhatsApp configured
    const [vendor] = await db.select({ whatsappToken: vendors.whatsappToken, whatsappPhoneId: vendors.whatsappPhoneId, nameAr: vendors.nameAr })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor?.whatsappToken) {
      return res.status(400).json({ error: 'يجب ضبط إعدادات واتساب أولاً من الإعدادات' });
    }

    // Get recipient phones
    const recipients = await getSegmentPhones(vendorId, data.segment);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'لا يوجد عملاء في هذه الشريحة' });
    }

    // Concurrency lock: only one campaign per vendor may be in 'sending' state
    // at a time. Prevents the parallel-campaigns quota-exhaustion exploit.
    const inFlight = await db.select({ id: whatsappCampaigns.id })
      .from(whatsappCampaigns)
      .where(and(
        eq(whatsappCampaigns.vendorId, vendorId),
        eq(whatsappCampaigns.status, 'sending'),
      ))
      .limit(1);
    if (inFlight.length > 0) {
      return res.status(429).json({ error: 'هناك حملة قيد الإرسال — انتظر حتى تنتهي قبل إطلاق حملة جديدة' });
    }

    // Atomic quota guard for the entire batch — denies if quota would be
    // exceeded BEFORE we start sending (no partial sends + double-charge).
    const { checkAndRecord } = await import('../services/usageGuard.js');
    const guard = await checkAndRecord({
      vendorId,
      resource: 'whatsapp_marketing',
      amount: recipients.length,
    });
    if (!guard.allowed) {
      const reason =
        guard.denyReason === 'subscription_inactive' ? 'الاشتراك غير مفعّل' :
        guard.denyReason === 'plan_locked'           ? 'حملات الواتساب تتطلب إضافة بوت AI' :
        `الكمية (${recipients.length}) تتجاوز حدك الشهري المتبقي. المستخدم: ${guard.used}/${guard.limit}.`;
      return res.status(402).json({
        error: reason,
        usage: { used: guard.used, limit: guard.limit, remaining: guard.remaining },
      });
    }

    // Insert campaign record
    const [campaign] = await db.insert(whatsappCampaigns).values({
      vendorId,
      name: data.name,
      segment: data.segment,
      message: data.message,
      status: 'sending',
      recipientCount: recipients.length,
      createdBy: req.user!.id,
    }).returning();

    // Send in background
    setImmediate(async () => {
      let sent = 0, failed = 0;
      for (const phone of recipients) {
        try {
          const ok = await sendRawWhatsAppMessage(phone, data.message);
          if (ok) sent++; else failed++;
        } catch { failed++; }
        // Throttle: 1 message per 200ms to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
      }
      await db.update(whatsappCampaigns)
        .set({ status: 'sent', sentCount: sent, failedCount: failed })
        .where(eq(whatsappCampaigns.id, campaign.id));
    });

    return res.status(201).json({
      ...campaign,
      message: `جاري الإرسال لـ ${recipients.length} عميل في الخلفية`,
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Helper: get phone numbers for a segment
async function getSegmentPhones(vendorId: number, segment: string): Promise<string[]> {
  const now = new Date();

  if (segment === 'all') {
    // All customers who had at least 1 completed booking with this vendor
    const rows = await db.selectDistinct({ phone: users.phone })
      .from(bookings)
      .innerJoin(users, eq(bookings.customerId, users.id))
      .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')));
    return rows.map(r => r.phone).filter(Boolean) as string[];
  }

  if (segment === 'inactive_21') {
    const cutoff = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    // Customers whose LAST completed booking was > 21 days ago
    const rows = await db
      .select({ phone: users.phone })
      .from(users)
      .innerJoin(
        db.select({ customerId: bookings.customerId, lastWash: sql<Date>`MAX(${bookings.updatedAt})` })
          .from(bookings)
          .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')))
          .groupBy(bookings.customerId)
          .as('lw'),
        sql`${users.id} = lw.customer_id AND lw.last_wash < ${cutoff.toISOString()}`
      );
    return rows.map(r => r.phone).filter(Boolean) as string[];
  }

  if (segment === 'inactive_14') {
    const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ phone: users.phone })
      .from(users)
      .innerJoin(
        db.select({ customerId: bookings.customerId, lastWash: sql<Date>`MAX(${bookings.updatedAt})` })
          .from(bookings)
          .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')))
          .groupBy(bookings.customerId)
          .as('lw'),
        sql`${users.id} = lw.customer_id AND lw.last_wash < ${cutoff.toISOString()}`
      );
    return rows.map(r => r.phone).filter(Boolean) as string[];
  }

  if (segment === 'top_customers') {
    // Top 20% by booking count
    const rows = await db
      .select({ phone: users.phone, cnt: sql<number>`COUNT(${bookings.id})` })
      .from(bookings)
      .innerJoin(users, eq(bookings.customerId, users.id))
      .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')))
      .groupBy(users.id, users.phone)
      .orderBy(sql`COUNT(${bookings.id}) DESC`)
      .limit(50);
    return rows.map(r => r.phone).filter(Boolean) as string[];
  }

  return [];
}

export default router;
