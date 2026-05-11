/**
 * Dormant customer win-back — sends a short WhatsApp nudge to customers
 * who used to visit but haven't booked in `dormantDays`.
 *
 * Design rules:
 *   - Never message more than `dailyLimit` customers per run.
 *   - A customer is only nudged once per 60 days (tracked via audit log).
 *   - Message is composed by the vendor's WhatsApp template if configured,
 *     else a sensible default in Saudi dialect.
 */

import { db } from '../../db/index.js';
import { users, vendors, auditLogs, bookings } from '../../db/schema.js';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { AutopilotConfig } from './config.js';
import { recordDecision } from './decisions.js';
import { sendRawWhatsAppMessage } from '../whatsapp.js';

const NUDGE_COOLDOWN_DAYS = 60;

export async function runDormantRemarket(vendorId: number, cfg: AutopilotConfig['dormantRemarket']) {
  if (!cfg.enabled) return;

  const [vendor] = await db.select({ nameAr: vendors.nameAr, slug: vendors.slug })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) return;

  // Candidates: had a booking 30+ days ago AND nothing recent.
  const rows = await db.execute<{ id: number; name: string; phone: string; last_visit: string }>(sql`
    SELECT u.id, u.name, u.phone, MAX(b.scheduled_at) AS last_visit
      FROM users u
      JOIN bookings b ON b.customer_id = u.id
     WHERE u.vendor_id = ${vendorId}
       AND u.role = 'customer'
       AND u.phone_verified = true
       AND b.status = 'completed'
     GROUP BY u.id, u.name, u.phone
    HAVING MAX(b.scheduled_at) < NOW() - (INTERVAL '1 day' * ${cfg.dormantDays})
       AND MAX(b.scheduled_at) > NOW() - INTERVAL '365 days'
     ORDER BY MAX(b.scheduled_at) DESC
     LIMIT ${cfg.dailyLimit * 3}
  `);
  const candidates = ((rows as any).rows ?? rows) as Array<{ id: number; name: string; phone: string }>;

  // Cooldown filter — skip anyone we already nudged in the last 60 days.
  const cutoff = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 24 * 3600_000);
  let sent = 0;
  for (const c of candidates) {
    if (sent >= cfg.dailyLimit) break;
    const recentNudge = await db.select({ id: auditLogs.id })
      .from(auditLogs).where(and(
        eq(auditLogs.vendorId, vendorId),
        eq(auditLogs.action, 'autopilot.dormant_message'),
        gte(auditLogs.createdAt, cutoff),
        sql`(${auditLogs.metadata}->>'customerId')::int = ${c.id}`,
      )).limit(1);
    if (recentNudge.length > 0) continue;

    const message =
      `هلا ${c.name.split(' ')[0]} 👋\n` +
      `مشتاقين لك في ${vendor.nameAr}!\n` +
      `ما شفناك من فترة — جرّب تحجز وخلّنا نشوفك من جديد.\n` +
      `https://jdawil.sa/store/${vendor.slug}`;

    const ok = await sendRawWhatsAppMessage(c.phone, message, vendorId);
    await recordDecision(vendorId, 'autopilot.dormant_message', {
      summary: ok
        ? `رسالة واتساب إلى ${c.name}`
        : `تعذّر إرسال واتساب إلى ${c.name}`,
      customerId: c.id,
      phone: c.phone,
      delivered: ok,
    });
    if (ok) sent++;
  }
  // `desc` + `bookings` imports reserved for near-future query extensions.
  void desc; void bookings;
}
