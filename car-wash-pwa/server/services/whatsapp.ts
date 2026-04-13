/**
 * WhatsApp Business Cloud API Service
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Required env vars:
 *   WHATSAPP_TOKEN      - Meta access token
 *   WHATSAPP_PHONE_ID   - Your WhatsApp phone number ID
 */

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';
const DOMAIN = process.env.DOMAIN ?? 'washsaas.com';

interface TextMessage {
  phone: string;
  message: string;
}

async function sendWhatsAppMessage({ phone, message }: TextMessage): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsApp] Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_ID - skipping send');
    return false;
  }

  // Format Saudi phone number
  const formatted = formatSaudiPhone(phone);

  try {
    const res = await fetch(`${WHATSAPP_API_URL}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
      const err = await res.json();
      console.error('[WhatsApp] Send failed:', err);
      return false;
    }

    console.log(`[WhatsApp] Message sent to ${formatted}`);
    return true;
  } catch (e) {
    console.error('[WhatsApp] Error:', e);
    return false;
  }
}

function formatSaudiPhone(phone: string): string {
  // Remove spaces, dashes
  let p = phone.replace(/[\s-]/g, '');
  // Convert 05xxxxxxxx → 9665xxxxxxxx
  if (p.startsWith('0')) p = '966' + p.slice(1);
  if (!p.startsWith('+')) p = '+' + p;
  return p;
}

// Raw message send (for custom/summary messages)
export async function sendRawWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  return sendWhatsAppMessage({ phone, message });
}

// Notification templates
export async function notifyBookingConfirmed(phone: string, bookingNumber: string, scheduledAt: Date, packageName: string, vendorName = 'المغسلة') {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return sendWhatsAppMessage({
    phone,
    message: `✅ *${vendorName}*\n\nتم تأكيد حجزك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n📦 الخدمة: ${packageName}\n📅 الموعد: ${dateStr}\n⏰ الوقت: ${timeStr}\n\nسنتواصل معك قبل الموعد. شكراً لثقتك بنا! 🚗💧`,
  });
}

export async function notifyEmployeeOnWay(phone: string, bookingNumber: string, employeeName: string, vendorName = 'المغسلة') {
  return sendWhatsAppMessage({
    phone,
    message: `🚗 *${vendorName}*\n\nموظفنا *${employeeName}* في الطريق إليك الآن!\n\n📋 رقم الحجز: #${bookingNumber}\n\nيرجى التواجد في الموقع المحدد. شكراً! 💧`,
  });
}

export async function notifyArrived(phone: string, bookingNumber: string, vendorName = 'المغسلة') {
  return sendWhatsAppMessage({
    phone,
    message: `📍 *${vendorName}*\n\nوصل موظفنا إلى موقعك!\n\n📋 رقم الحجز: #${bookingNumber}\n\nسيبدأ العمل فور التحقق من السيارة. 🚗✨`,
  });
}

export async function notifyServiceCompleted(phone: string, bookingNumber: string, vendorName = 'المغسلة') {
  return sendWhatsAppMessage({
    phone,
    message: `🌟 *${vendorName}*\n\nاكتملت خدمة غسيل سيارتك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n\nنتمنى أن تكون راضياً عن الخدمة.\nيسعدنا تقييمك من خلال التطبيق ⭐\n\nشكراً لاختيارك ${vendorName}! 💙`,
  });
}

export async function notifyAppointmentReminder(phone: string, bookingNumber: string, scheduledAt: Date, vendorName = 'المغسلة') {
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  return sendWhatsAppMessage({
    phone,
    message: `⏰ *${vendorName}*\n\nتذكير بموعدك غداً!\n\n📋 رقم الحجز: #${bookingNumber}\n🕐 الوقت: ${timeStr}\n\nسيتواصل معك موظفنا قبل الوصول. 🚗💧`,
  });
}

export async function notifyRatingRequest(phone: string, bookingNumber: string, vendorName = 'المغسلة') {
  return sendWhatsAppMessage({
    phone,
    message: `⭐ *${vendorName}*\n\nشكراً لاستخدامك خدماتنا!\n\nرأيك يهمنا - قيّم تجربتك مع الحجز #${bookingNumber} من خلال التطبيق.\n\nتقييمك يساعدنا على تحسين خدماتنا 💙`,
  });
}

export async function notifyGoogleReviewRequest(phone: string, vendorName: string, googleReviewLink: string) {
  return sendWhatsAppMessage({
    phone,
    message: `شكراً لك على ثقتك بـ ${vendorName} 🙏\nهل أعجبك الخدمة؟ أسعدنا رأيك في Google:\n${googleReviewLink}\nسيساعدنا تقييمك في الوصول لمزيد من العملاء ❤️`,
  });
}

export async function notifyBookingConfirmedWithTracking(
  phone: string,
  bookingNumber: string,
  scheduledAt: Date,
  packageName: string,
  vendorName = 'المغسلة',
  bookingId?: number,
  trackingToken?: string,
) {
  const dateStr = scheduledAt.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const trackingLine = (bookingId && trackingToken)
    ? `\n\n📍 رابط التتبع المباشر:\nhttps://${DOMAIN}/track/${bookingId}/${trackingToken}`
    : '';
  return sendWhatsAppMessage({
    phone,
    message: `✅ *${vendorName}*\n\nتم تأكيد حجزك بنجاح!\n\n📋 رقم الحجز: #${bookingNumber}\n📦 الخدمة: ${packageName}\n📅 الموعد: ${dateStr}\n⏰ الوقت: ${timeStr}${trackingLine}\n\nسنتواصل معك قبل الموعد. شكراً لثقتك بنا! 🚗💧`,
  });
}
