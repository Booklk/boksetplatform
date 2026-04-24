/**
 * WhatsApp Business Cloud API Service — BYOC (Bring Your Own Credentials)
 *
 * Each vendor can connect their own WhatsApp Business account.
 * Falls back to platform-level credentials if vendor has none.
 *
 * Vendor credentials are AES-256 encrypted in the database.
 */

import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto.js';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';
const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';

interface WhatsAppCredentials {
  token: string;
  phoneId: string;
}

function platformCredentials(): WhatsAppCredentials | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

/** Get WhatsApp credentials for a vendor — vendor MUST have own credentials */
async function getCredentials(vendorId?: number | null): Promise<WhatsAppCredentials | null> {
  if (!vendorId) return null;

  try {
    const [vendor] = await db.select({
      whatsappToken: vendors.whatsappToken,
      whatsappPhoneId: vendors.whatsappPhoneId,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    if (!vendor?.whatsappToken || !vendor?.whatsappPhoneId) {
      // Vendor has not connected WhatsApp Business — do NOT send
      return null;
    }

    return {
      token: decrypt(vendor.whatsappToken),
      phoneId: decrypt(vendor.whatsappPhoneId),
    };
  } catch (e) {
    console.warn(`[WhatsApp] Failed to decrypt vendor ${vendorId} credentials`);
    return null;
  }
}

/**
 * Platform-level send for auth flows (OTP, password reset).
 * Uses WHATSAPP_TOKEN / WHATSAPP_PHONE_ID from env.
 *
 * Production behaviour: if creds are missing, return `false` so the
 * caller surfaces a 503 to the user — we never want to silently "succeed"
 * an OTP send that will never arrive.
 *
 * Development behaviour: print a redacted line to stdout so devs see
 * something happened. The actual code is hashed so OTPs don't end up
 * in shared log files.
 */
export async function sendPlatformWhatsApp(phone: string, message: string): Promise<boolean> {
  const creds = platformCredentials();
  const formatted = formatSaudiPhone(phone);
  if (!creds) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[WhatsApp:platform] WHATSAPP_TOKEN/PHONE_ID missing — message not sent');
      return false;
    }
    // Dev only: redact 6-digit OTP codes from the line we print so a
    // shared dev log doesn't leak fresh codes.
    const safe = message.replace(/\b\d{6}\b/g, '••••••');
    console.log(`[WhatsApp:dev] → ${formatted}\n${safe}\n`);
    return true;
  }
  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${creds.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
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

function formatSaudiPhone(phone: string): string {
  let p = phone.replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('0')) p = '966' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

/** Send a WhatsApp text message using vendor-specific or platform credentials */
async function sendMessage(phone: string, message: string, vendorId?: number | null): Promise<boolean> {
  const creds = await getCredentials(vendorId);
  if (!creds) return false;

  const formatted = formatSaudiPhone(phone);

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${creds.phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatted,
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`[WhatsApp] Send failed (vendor: ${vendorId ?? 'platform'}):`, err);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[WhatsApp] Error:', e);
    return false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendRawWhatsAppMessage(phone: string, message: string, vendorId?: number | null): Promise<boolean> {
  return sendMessage(phone, message, vendorId);
}

export async function notifyBookingConfirmed(phone: string, bookingNumber: string, scheduledAt: Date, packageName: string, vendorName = 'Jdawil', vendorId?: number | null) {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return sendMessage(phone, `✅ *${vendorName}*\n\nتم تأكيد حجزك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n📦 الخدمة: ${packageName}\n📅 الموعد: ${dateStr}\n⏰ الوقت: ${timeStr}\n\nشكراً لثقتك!`, vendorId);
}

export async function notifyEmployeeOnWay(phone: string, bookingNumber: string, employeeName: string, vendorName = 'Jdawil', vendorId?: number | null) {
  return sendMessage(phone, `🚗 *${vendorName}*\n\n*${employeeName}* في الطريق إليك الآن!\n\n📋 رقم الحجز: #${bookingNumber}\n\nيرجى التواجد في الموقع. شكراً!`, vendorId);
}

export async function notifyArrived(phone: string, bookingNumber: string, vendorName = 'Jdawil', vendorId?: number | null) {
  return sendMessage(phone, `📍 *${vendorName}*\n\nوصل مقدم الخدمة إلى موقعك!\n\n📋 رقم الحجز: #${bookingNumber}`, vendorId);
}

export async function notifyServiceCompleted(phone: string, bookingNumber: string, vendorName = 'Jdawil', vendorId?: number | null) {
  return sendMessage(phone, `🌟 *${vendorName}*\n\nاكتملت خدمتك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n\nنتمنى أن تكون راضياً. يسعدنا تقييمك ⭐\n\nشكراً لاختيارك ${vendorName}! 💙`, vendorId);
}

export async function notifyAppointmentReminder(phone: string, bookingNumber: string, scheduledAt: Date, vendorName = 'Jdawil', vendorId?: number | null) {
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return sendMessage(phone, `⏰ *${vendorName}*\n\nتذكير بموعدك غداً!\n\n📋 رقم الحجز: #${bookingNumber}\n🕐 الوقت: ${timeStr}\n\nنراك قريباً!`, vendorId);
}

export async function notifyRatingRequest(
  phone: string,
  bookingNumber: string,
  vendorName = 'جداول',
  vendorId?: number | null,
  bookingId?: number,
) {
  const link = bookingId ? `\n\nقيّمنا هنا: https://${DOMAIN}/app/rate/${bookingId}` : '';
  return sendMessage(
    phone,
    `⭐ *${vendorName}*\n\nشكراً لاستخدامك خدماتنا!\n\nقيّم تجربتك مع الحجز #${bookingNumber}${link}\n\nتقييمك يساعدنا على التحسين 💙`,
    vendorId,
  );
}

export async function notifyGoogleReviewRequest(phone: string, vendorName: string, googleReviewLink: string, vendorId?: number | null) {
  return sendMessage(phone, `شكراً لثقتك بـ ${vendorName} 🙏\nأعجبتك الخدمة؟ قيّمنا في Google:\n${googleReviewLink}\n\nشكراً! ❤️`, vendorId);
}

export async function notifyBookingConfirmedWithTracking(
  phone: string, bookingNumber: string, scheduledAt: Date,
  packageName: string, vendorName = 'Jdawil',
  bookingId?: number, trackingToken?: string, vendorId?: number | null,
) {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const trackingLine = (bookingId && trackingToken) ? `\n\n📍 تتبع مباشر:\nhttps://${DOMAIN}/track/${bookingId}/${trackingToken}` : '';
  return sendMessage(phone, `✅ *${vendorName}*\n\nتم تأكيد حجزك!\n\n📋 #${bookingNumber}\n📦 ${packageName}\n📅 ${dateStr}\n⏰ ${timeStr}${trackingLine}\n\nشكراً لثقتك!`, vendorId);
}

/** Verify if a vendor's WhatsApp credentials are valid */
export async function verifyVendorWhatsApp(vendorId: number): Promise<{ valid: boolean; error?: string }> {
  try {
    const creds = await getCredentials(vendorId);
    if (!creds) return { valid: false, error: 'لا توجد بيانات واتساب' };

    const res = await fetch(`${WHATSAPP_API_URL}/${creds.phoneId}`, {
      headers: { 'Authorization': `Bearer ${creds.token}` },
    });

    if (res.ok) return { valid: true };

    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    return { valid: false, error: err?.error?.message ?? 'بيانات غير صحيحة' };
  } catch (e: any) {
    return { valid: false, error: e.message ?? 'فشل الاتصال' };
  }
}
