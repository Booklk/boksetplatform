/**
 * Lead capture from the marketing site.
 *
 * Channels:
 *   - "demo" — vendor wants a 15-min walkthrough
 *   - "contact" — generic inquiry
 *   - "newsletter" — email subscription
 *
 * Stores into a single leads table tagged with source + UTM. Auto-pings
 * the platform admin via WhatsApp for hot leads (demo).
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { leads } from '../db/schema.js';
import { sql } from 'drizzle-orm';

const router = Router();

const captureSchema = z.object({
  channel: z.enum(['demo', 'contact', 'newsletter']),
  name: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(200).optional(),
  message: z.string().max(2000).optional(),
  industry: z.string().max(50).optional(),
  bestTimeToCall: z.string().max(50).optional(),
  utm: z.object({
    source: z.string().max(100).optional(),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
  }).optional(),
});

router.post('/', async (req, res) => {
  try {
    const data = captureSchema.parse(req.body);

    // At least one of phone/email is required.
    if (!data.phone && !data.email) {
      return res.status(400).json({ error: 'أدخل إما رقم الجوال أو البريد الإلكتروني' });
    }

    const [row] = await db.insert(leads).values({
      channel: data.channel,
      name: data.name ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      message: data.message ?? null,
      industry: data.industry ?? null,
      bestTimeToCall: data.bestTimeToCall ?? null,
      utmSource: data.utm?.source ?? null,
      utmMedium: data.utm?.medium ?? null,
      utmCampaign: data.utm?.campaign ?? null,
      utmTerm: data.utm?.term ?? null,
      utmContent: data.utm?.content ?? null,
      ip: req.ip ?? null,
      userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 300),
    }).returning();

    // Hot lead → ping platform admin if configured.
    if (data.channel === 'demo') {
      const adminPhone = process.env.PLATFORM_ADMIN_PHONE;
      if (adminPhone) {
        try {
          const { sendRawWhatsAppMessage } = await import('../services/whatsapp.js');
          const summary = [
            `🔥 طلب Demo جديد`,
            data.name ? `الاسم: ${data.name}` : null,
            data.phone ? `جوال: ${data.phone}` : null,
            data.industry ? `قطاع: ${data.industry}` : null,
            data.bestTimeToCall ? `أفضل وقت: ${data.bestTimeToCall}` : null,
            data.utm?.source ? `مصدر: ${data.utm.source} / ${data.utm.campaign ?? '—'}` : null,
            data.message ? `\nرسالته: ${data.message}` : null,
          ].filter(Boolean).join('\n');
          await sendRawWhatsAppMessage(adminPhone, summary, null).catch(() => {});
        } catch { /* non-blocking */ }
      }
    }

    return res.status(201).json({ success: true, leadId: row.id });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[leads]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Super-admin pipeline view.
router.get('/admin', async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const channel = req.query.channel as string | undefined;
    const rows = await db.execute(sql`
      SELECT * FROM leads
      WHERE 1 = 1
        ${status ? sql` AND status = ${status}` : sql``}
        ${channel ? sql` AND channel = ${channel}` : sql``}
      ORDER BY created_at DESC
      LIMIT 200
    `);
    // postgres-js returns the row array directly
    return res.json(rows);
  } catch (e) {
    console.error('[leads admin]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
