/**
 * WhatsApp provider abstraction.
 *
 * Three providers ship today:
 *   1. meta_cloud — vendor's own Meta Cloud API (Phone Number ID + Token).
 *      Direct, free for the platform, vendor handles Meta Business Verification.
 *   2. unifonic   — Saudi BSP. Vendor onboarded under Jdawil's partner account.
 *      Branded sender ID, Arabic support, paid per-message + monthly fee.
 *   3. shared     — vendor uses Jdawil's shared sender. Cheapest path; messages
 *      go from Jdawil's number with the vendor's name in the body. Used during
 *      verification waiting-period or for low-volume merchants.
 *
 * Every provider returns {ok, error}. The shared sender uses platform creds
 * (`WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID`) — same as the OTP path — so a vendor
 * who has not configured anything still gets *something* working out of the
 * box if the platform is provisioned.
 */
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decrypt } from '../lib/crypto.js';

const META_API_URL = 'https://graph.facebook.com/v19.0';
const UNIFONIC_API_URL = 'https://api.unifonic.com/whatsapp/v1';

export type WhatsAppProvider = 'meta_cloud' | 'unifonic' | 'shared' | 'none';

export interface SendResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

interface VendorWhatsAppConfig {
  provider: WhatsAppProvider;
  status: string;
  // Meta Cloud
  metaPhoneId?: string;
  metaToken?: string;
  // Unifonic
  unifonicAppSid?: string;
  unifonicSenderId?: string;
  unifonicApiKey?: string;
}

export async function loadVendorConfig(vendorId: number): Promise<VendorWhatsAppConfig | null> {
  const [v] = await db.select({
    provider: vendors.whatsappProvider,
    status: vendors.whatsappStatus,
    metaPhoneId: vendors.whatsappPhoneId,
    metaToken: vendors.whatsappToken,
    unifonicAppSid: vendors.whatsappUnifonicAppSid,
    unifonicSenderId: vendors.whatsappUnifonicSenderId,
    unifonicApiKey: vendors.whatsappUnifonicApiKey,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

  if (!v) return null;

  const cfg: VendorWhatsAppConfig = {
    provider: (v.provider ?? 'none') as WhatsAppProvider,
    status: v.status ?? 'not_connected',
  };

  try {
    if (v.metaPhoneId) cfg.metaPhoneId = decrypt(v.metaPhoneId);
    if (v.metaToken) cfg.metaToken = decrypt(v.metaToken);
    if (v.unifonicAppSid) cfg.unifonicAppSid = decrypt(v.unifonicAppSid);
    if (v.unifonicApiKey) cfg.unifonicApiKey = decrypt(v.unifonicApiKey);
  } catch {
    return { ...cfg, provider: 'none' };
  }
  if (v.unifonicSenderId) cfg.unifonicSenderId = v.unifonicSenderId;

  return cfg;
}

export function formatSaudiPhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('0')) p = '966' + p.slice(1);
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

async function sendMeta(token: string, phoneId: string, to: string, body: string): Promise<SendResult> {
  try {
    const res = await fetch(`${META_API_URL}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j?.error?.message ?? `Meta ${res.status}` };
    }
    const j = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
    return { ok: true, messageId: j?.messages?.[0]?.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

async function sendUnifonic(
  appSid: string,
  apiKey: string,
  senderId: string,
  to: string,
  body: string,
): Promise<SendResult> {
  try {
    const res = await fetch(`${UNIFONIC_API_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        AppSid: appSid,
        SenderID: senderId,
        Recipient: to,
        Body: body,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { errorMessage?: string; message?: string };
      return { ok: false, error: j?.errorMessage ?? j?.message ?? `Unifonic ${res.status}` };
    }
    const j = (await res.json().catch(() => ({}))) as { data?: { MessageID?: string } };
    return { ok: true, messageId: j?.data?.MessageID };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' };
  }
}

async function sendShared(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WhatsApp:shared:dev] → ${to}\n${body}\n`);
      return { ok: true };
    }
    return { ok: false, error: 'shared sender not configured' };
  }
  return sendMeta(token, phoneId, to, body);
}

/**
 * Send a message via whichever provider the vendor has configured.
 * Returns ok=false (no throw) if config is missing or the provider fails —
 * callers should treat WhatsApp as best-effort and never block flows on it.
 */
export async function sendViaProvider(
  vendorId: number | null | undefined,
  phone: string,
  body: string,
): Promise<SendResult> {
  const to = formatSaudiPhone(phone);

  if (!vendorId) {
    return sendShared(to, body);
  }

  const cfg = await loadVendorConfig(vendorId);
  if (!cfg) return { ok: false, error: 'vendor not found' };

  if (cfg.status !== 'active' && cfg.provider !== 'shared') {
    return sendShared(to, body);
  }

  switch (cfg.provider) {
    case 'meta_cloud':
      if (!cfg.metaPhoneId || !cfg.metaToken) return { ok: false, error: 'meta credentials missing' };
      return sendMeta(cfg.metaToken, cfg.metaPhoneId, to, body);
    case 'unifonic':
      if (!cfg.unifonicAppSid || !cfg.unifonicApiKey || !cfg.unifonicSenderId) {
        return { ok: false, error: 'unifonic credentials missing' };
      }
      return sendUnifonic(cfg.unifonicAppSid, cfg.unifonicApiKey, cfg.unifonicSenderId, to, body);
    case 'shared':
      return sendShared(to, body);
    case 'none':
    default:
      return sendShared(to, body);
  }
}

/**
 * Verify a vendor's currently-configured provider can reach WhatsApp.
 * Used by the connect wizard's "Test connection" button.
 */
export async function verifyProvider(vendorId: number): Promise<{ ok: boolean; error?: string }> {
  const cfg = await loadVendorConfig(vendorId);
  if (!cfg) return { ok: false, error: 'لم يتم العثور على المتجر' };

  if (cfg.provider === 'meta_cloud') {
    if (!cfg.metaPhoneId || !cfg.metaToken) return { ok: false, error: 'بيانات Meta غير مكتملة' };
    try {
      const res = await fetch(`${META_API_URL}/${cfg.metaPhoneId}`, {
        headers: { Authorization: `Bearer ${cfg.metaToken}` },
      });
      if (res.ok) return { ok: true };
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: j?.error?.message ?? 'بيانات Meta غير صحيحة' };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال' };
    }
  }

  if (cfg.provider === 'unifonic') {
    if (!cfg.unifonicAppSid || !cfg.unifonicApiKey) return { ok: false, error: 'بيانات Unifonic غير مكتملة' };
    try {
      const res = await fetch(`${UNIFONIC_API_URL}/account`, {
        headers: { Authorization: `Bearer ${cfg.unifonicApiKey}` },
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `Unifonic ${res.status}` };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال' };
    }
  }

  if (cfg.provider === 'shared') {
    const tokenOk = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
    return tokenOk ? { ok: true } : { ok: false, error: 'الرقم المشترك غير مفعّل' };
  }

  return { ok: false, error: 'لم يتم اختيار مزود' };
}
