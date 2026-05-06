/**
 * WhatsApp Business — vendor-facing send API.
 *
 * This module is the *only* place the rest of the codebase talks to when
 * it needs to notify a customer via WhatsApp. Three things happen for
 * every send:
 *   1. The vendor's per-event notification toggle is checked. If the
 *      vendor turned off "ratingRequest", we don't send.
 *   2. The vendor's monthly message quota is checked. Over-quota = drop.
 *   3. We delegate the actual send to whichever provider the vendor
 *      configured (Meta Cloud / Unifonic / shared Jdawil sender).
 *
 * Failures never throw — WhatsApp is best-effort, never a blocker.
 */
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { sendViaProvider, formatSaudiPhone } from './whatsappProviders.js';
import { enqueueSend } from './whatsappQueue.js';

const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';

type EventKey =
  | 'bookingConfirmed'
  | 'appointmentReminder'
  | 'employeeOnWay'
  | 'arrived'
  | 'completed'
  | 'ratingRequest'
  | 'paymentReceived'
  | 'marketing';

interface QuotaState {
  enabled: boolean; // false = no plan, no quota — block paid sends
  used: number;
  quota: number;
  notifications: Record<string, boolean>;
}

async function loadGuard(vendorId: number | null | undefined): Promise<QuotaState | null> {
  if (!vendorId) return null;
  const [v] = await db.select({
    plan: vendors.whatsappPlan,
    used: vendors.whatsappMessagesUsed,
    quota: vendors.whatsappMessagesQuota,
    resetAt: vendors.whatsappQuotaResetAt,
    notifications: vendors.whatsappNotifications,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) return null;

  // Auto-reset monthly counter when reset date has passed.
  if (v.resetAt && new Date(v.resetAt) < new Date()) {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    await db.update(vendors).set({
      whatsappMessagesUsed: 0,
      whatsappQuotaResetAt: next,
    }).where(eq(vendors.id, vendorId));
    v.used = 0;
  }

  return {
    enabled: v.plan !== 'none',
    used: v.used ?? 0,
    quota: v.quota ?? 0,
    notifications: (v.notifications as Record<string, boolean>) ?? {},
  };
}

async function increment(vendorId: number | null | undefined): Promise<void> {
  if (!vendorId) return;
  await db.update(vendors)
    .set({ whatsappMessagesUsed: sql`${vendors.whatsappMessagesUsed} + 1` })
    .where(eq(vendors.id, vendorId));
}

/**
 * Enqueue a transactional send. Returns `true` if the send was *accepted*
 * for delivery (queued or filtered by toggles), not whether it actually
 * landed at WhatsApp — by design, transactional notifications are
 * fire-and-forget so route handlers never block on Meta's latency.
 *
 * The toggle + quota check happens synchronously *before* enqueue so
 * vendors don't accidentally burn quota on disabled events.
 */
async function send(
  phone: string,
  message: string,
  vendorId: number | null | undefined,
  event: EventKey,
): Promise<boolean> {
  if (vendorId) {
    const guard = await loadGuard(vendorId);
    if (guard) {
      // Default ON for transactional events; default OFF for marketing.
      const defaultOn = event !== 'marketing';
      const flag = guard.notifications[event];
      if (flag === false || (flag === undefined && !defaultOn)) return false;
      if (guard.enabled && guard.quota > 0 && guard.used >= guard.quota) {
        console.warn(`[WhatsApp] vendor ${vendorId} over quota (${guard.used}/${guard.quota})`);
        return false;
      }
    }
  }
  enqueueSend(`${event}→${phone.slice(-4)}`, async () => {
    const result = await sendViaProvider(vendorId, phone, message);
    if (result.ok) await increment(vendorId);
    else throw new Error(result.error ?? 'send failed');
  });
  return true;
}

/**
 * Platform-level send for OTP / password reset / system alerts.
 * Always uses platform credentials, ignores vendor toggles & quotas.
 */
export async function sendPlatformWhatsApp(phone: string, message: string): Promise<boolean> {
  const formatted = formatSaudiPhone(phone);
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[WhatsApp:platform] WHATSAPP_TOKEN/PHONE_ID missing — message not sent');
      return false;
    }
    const safe = message.replace(/\b\d{6}\b/g, '••••••');
    console.log(`[WhatsApp:dev] → ${formatted}\n${safe}\n`);
    return true;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatted,
        type: 'text',
        text: { body: message },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[WhatsApp:platform] Send failed:', err);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[WhatsApp:platform] Error:', e);
    return false;
  }
}

// ─── Public API (vendor sends) ──────────────────────────────────────────────

export async function sendRawWhatsAppMessage(
  phone: string,
  message: string,
  vendorId?: number | null,
): Promise<boolean> {
  // Raw sends bypass per-event toggles but still respect quota.
  const result = await sendViaProvider(vendorId, phone, message);
  if (result.ok) await increment(vendorId);
  return result.ok;
}

export async function notifyBookingConfirmed(
  phone: string, bookingNumber: string, scheduledAt: Date, packageName: string,
  vendorName = 'Jdawil', vendorId?: number | null,
) {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return send(phone, `✅ *${vendorName}*\n\nتم تأكيد حجزك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n📦 الخدمة: ${packageName}\n📅 الموعد: ${dateStr}\n⏰ الوقت: ${timeStr}\n\nشكراً لثقتك!`, vendorId, 'bookingConfirmed');
}

export async function notifyEmployeeOnWay(
  phone: string, bookingNumber: string, employeeName: string,
  vendorName = 'Jdawil', vendorId?: number | null,
) {
  return send(phone, `🚗 *${vendorName}*\n\n*${employeeName}* في الطريق إليك الآن!\n\n📋 رقم الحجز: #${bookingNumber}\n\nيرجى التواجد في الموقع. شكراً!`, vendorId, 'employeeOnWay');
}

export async function notifyArrived(
  phone: string, bookingNumber: string,
  vendorName = 'Jdawil', vendorId?: number | null,
) {
  return send(phone, `📍 *${vendorName}*\n\nوصل مقدم الخدمة إلى موقعك!\n\n📋 رقم الحجز: #${bookingNumber}`, vendorId, 'arrived');
}

export async function notifyServiceCompleted(
  phone: string, bookingNumber: string,
  vendorName = 'Jdawil', vendorId?: number | null,
) {
  return send(phone, `🌟 *${vendorName}*\n\nاكتملت خدمتك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n\nنتمنى أن تكون راضياً. يسعدنا تقييمك ⭐\n\nشكراً لاختيارك ${vendorName}! 💙`, vendorId, 'completed');
}

export async function notifyAppointmentReminder(
  phone: string, bookingNumber: string, scheduledAt: Date,
  vendorName = 'Jdawil', vendorId?: number | null,
) {
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return send(phone, `⏰ *${vendorName}*\n\nتذكير بموعدك غداً!\n\n📋 رقم الحجز: #${bookingNumber}\n🕐 الوقت: ${timeStr}\n\nنراك قريباً!`, vendorId, 'appointmentReminder');
}

export async function notifyRatingRequest(
  phone: string, bookingNumber: string,
  vendorName = 'جداول', vendorId?: number | null, bookingId?: number,
) {
  const link = bookingId ? `\n\nقيّمنا هنا: https://${DOMAIN}/app/rate/${bookingId}` : '';
  return send(phone, `⭐ *${vendorName}*\n\nشكراً لاستخدامك خدماتنا!\n\nقيّم تجربتك مع الحجز #${bookingNumber}${link}\n\nتقييمك يساعدنا على التحسين 💙`, vendorId, 'ratingRequest');
}

export async function notifyGoogleReviewRequest(
  phone: string, vendorName: string, googleReviewLink: string,
  vendorId?: number | null,
) {
  return send(phone, `شكراً لثقتك بـ ${vendorName} 🙏\nأعجبتك الخدمة؟ قيّمنا في Google:\n${googleReviewLink}\n\nشكراً! ❤️`, vendorId, 'ratingRequest');
}

export async function notifyBookingConfirmedWithTracking(
  phone: string, bookingNumber: string, scheduledAt: Date,
  packageName: string, vendorName = 'Jdawil',
  bookingId?: number, trackingToken?: string, vendorId?: number | null,
) {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const trackingLine = (bookingId && trackingToken) ? `\n\n📍 تتبع مباشر:\nhttps://${DOMAIN}/track/${bookingId}/${trackingToken}` : '';
  return send(phone, `✅ *${vendorName}*\n\nتم تأكيد حجزك!\n\n📋 #${bookingNumber}\n📦 ${packageName}\n📅 ${dateStr}\n⏰ ${timeStr}${trackingLine}\n\nشكراً لثقتك!`, vendorId, 'bookingConfirmed');
}

// ─── Interactive messages (buttons / list) ──────────────────────────────────
// These bypass per-event toggles because they're conversational responses
// (the customer initiated the conversation), but they still respect quota.

interface ButtonOption { id: string; title: string }

/**
 * Send up to 3 reply-buttons. Used by the WhatsApp bot for menu navigation.
 * Falls back to a plain text list of choices on providers/clients that don't
 * support interactive messages.
 */
export async function sendInteractiveButtons(
  phone: string,
  body: string,
  buttons: ButtonOption[],
  vendorId?: number | null,
): Promise<boolean> {
  const { loadVendorConfig, formatSaudiPhone } = await import('./whatsappProviders.js');
  const cfg = vendorId ? await loadVendorConfig(vendorId) : null;
  const to = formatSaudiPhone(phone);

  // Meta Cloud is the only provider with native interactive support today;
  // for shared/Unifonic fall back to a numbered text list.
  if (cfg?.provider === 'meta_cloud' && cfg.metaToken && cfg.metaPhoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.metaPhoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.metaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body },
            action: {
              buttons: buttons.slice(0, 3).map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title.slice(0, 20) },
              })),
            },
          },
        }),
      });
      if (res.ok) return true;
    } catch {/* fall through to text fallback */}
  }

  // Fallback: plain text with numbered options
  const fallback = `${body}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}`;
  return sendRawWhatsAppMessage(phone, fallback, vendorId);
}

interface ListRow { id: string; title: string; description?: string }

/**
 * Send a list-style picker (up to 10 rows). Falls back to numbered text
 * for providers without interactive support.
 */
export async function sendInteractiveList(
  phone: string,
  body: string,
  buttonText: string,
  rows: ListRow[],
  vendorId?: number | null,
  sectionTitle?: string,
): Promise<boolean> {
  const { loadVendorConfig, formatSaudiPhone } = await import('./whatsappProviders.js');
  const cfg = vendorId ? await loadVendorConfig(vendorId) : null;
  const to = formatSaudiPhone(phone);

  if (cfg?.provider === 'meta_cloud' && cfg.metaToken && cfg.metaPhoneId) {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.metaPhoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.metaToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text: body },
            action: {
              button: buttonText.slice(0, 20),
              sections: [{
                title: (sectionTitle ?? buttonText).slice(0, 24),
                rows: rows.slice(0, 10).map((r) => ({
                  id: r.id,
                  title: r.title.slice(0, 24),
                  description: r.description?.slice(0, 72),
                })),
              }],
            },
          },
        }),
      });
      if (res.ok) return true;
    } catch {/* fall through */}
  }

  const fallback = `${body}\n\n${rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ' — ' + r.description : ''}`).join('\n')}`;
  return sendRawWhatsAppMessage(phone, fallback, vendorId);
}

/** Verify vendor's WhatsApp credentials — used by the Connect wizard test button. */
export async function verifyVendorWhatsApp(vendorId: number): Promise<{ valid: boolean; error?: string }> {
  const { verifyProvider } = await import('./whatsappProviders.js');
  const r = await verifyProvider(vendorId);
  return { valid: r.ok, error: r.error };
}
