/**
 * WhatsApp Cloud API webhook for the auto-reply bot.
 *
 *   GET  /api/whatsapp-bot/webhook/:vendorId  — Meta verification challenge
 *   POST /api/whatsapp-bot/webhook/:vendorId  — Inbound message events
 *
 * Each vendor configures their own Meta App webhook to point at the URL
 * with their vendorId. The bot reads inbound messages and replies via
 * services/whatsappBot.ts using the vendor's stored credentials.
 *
 *   GET  /api/whatsapp-bot/settings  — Read bot settings (auth)
 *   PUT  /api/whatsapp-bot/settings  — Update enabled / greeting / handoff
 */
import { Router } from 'express';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { processIncomingMessage } from '../services/whatsappBot.js';
import { getSetting } from '../services/platformSettings.js';
import { checkAndRecord } from '../services/usageGuard.js';

const router = Router();

// ─── Public webhook ─────────────────────────────────────────────────────────

// Meta sends a GET to verify the URL on first setup. The vendor MUST have
// configured a per-vendor verifyToken — there is no platform-wide fallback,
// because a shared fallback can be guessed and used to hijack any vendor's
// webhook.
router.get('/webhook/:vendorId', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const vendorId = Number(req.params.vendorId);
    if (isNaN(vendorId)) return res.status(403).send('verification failed');

    const [v] = await db.select({ settings: vendors.settings })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const expected = ((v?.settings ?? {}) as { bot?: { verifyToken?: string } }).bot?.verifyToken;
    if (!expected) return res.status(403).send('verification failed');

    // Constant-time compare so an attacker can't time-attack the token
    const a = Buffer.from(String(token ?? ''));
    const b = Buffer.from(expected);
    const match = mode === 'subscribe' && a.length === b.length && timingSafeEqual(a, b);
    if (match) return res.status(200).send(String(challenge ?? ''));
    return res.status(403).send('verification failed');
  } catch (e) {
    return res.status(500).send('error');
  }
});

// Meta posts inbound messages here. Authenticity is enforced by HMAC-SHA256
// on the raw request body using the per-vendor app secret. AI quota is
// checked synchronously BEFORE the async processIncomingMessage so a
// thundering-herd of forged messages can't bypass the cap.
router.post('/webhook/:vendorId', async (req, res) => {
  try {
    const vendorId = Number(req.params.vendorId);
    if (isNaN(vendorId)) {
      res.status(200).send('ok');
      return;
    }

    // 1. HMAC signature verification (mandatory)
    const [v] = await db.select({ settings: vendors.settings })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const appSecret = ((v?.settings ?? {}) as { bot?: { appSecret?: string } }).bot?.appSecret;
    const rawBody = (req as { rawBody?: Buffer }).rawBody;

    if (!appSecret || !rawBody) {
      // No secret configured = vendor hasn't completed setup. Drop quietly.
      res.status(401).send('unauthorized');
      return;
    }
    const sigHeader = (req.headers['x-hub-signature-256'] ?? '') as string;
    if (!sigHeader.startsWith('sha256=')) {
      res.status(401).send('unauthorized');
      return;
    }
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(sigHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).send('unauthorized');
      return;
    }

    // 2. Synchronously gate inbound message volume — count UNIQUE messages
    //    in this payload BEFORE acking, so an attacker who somehow forged a
    //    valid signature still can't spam past the monthly quota.
    const messages: Array<{
      from?: string; type?: string; text?: { body?: string };
      interactive?: {
        button_reply?: { id?: string; title?: string };
        list_reply?: { id?: string; title?: string };
      };
    }> = [];
    const entry = (req.body?.entry ?? []) as Array<{ changes?: Array<{ value?: { messages?: typeof messages } }> }>;
    for (const e of entry) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) messages.push(m);

    // Ack Meta now to prevent retries; processing continues asynchronously.
    res.status(200).send('ok');

    for (const m of messages) {
      if (!m.from) continue;
      // Reserve quota BEFORE invoking the bot. If denied, we silently drop
      // the message — Meta still sees a 200 (already sent above), so no retry.
      const guard = await checkAndRecord({
        vendorId,
        resource: 'ai_messages',
        amount: 1,
      });
      // Even if quota denied, we still let the rule-based bot reply because
      // its actions are free. processIncomingMessage handles the AI vs
      // rule-based split internally based on the same guard result.
      const text = m.text?.body ?? '';
      const buttonId = m.interactive?.button_reply?.id;
      const listSelection = m.interactive?.list_reply?.id;
      await processIncomingMessage(vendorId, {
        fromPhone: m.from,
        text,
        buttonId,
        listSelection,
        aiQuotaReserved: guard.allowed,
      }).catch((e) => console.error('[bot processing]', e));
    }
  } catch (e) {
    console.error('[whatsapp-bot webhook] processing error:', e);
    if (!res.headersSent) res.status(500).send('error');
  }
});

// ─── Vendor-facing settings ─────────────────────────────────────────────────

router.get('/settings', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });
  const [v] = await db.select({ settings: vendors.settings }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const bot = ((v?.settings ?? {}) as { bot?: Record<string, unknown> }).bot ?? {};
  return res.json(bot);
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  greeting: z.string().max(1024).optional(),
  handoffKeywords: z.array(z.string().max(40)).max(20).optional(),
  verifyToken: z.string().min(8).max(80).optional(),
  // AI brain
  aiEnabled: z.boolean().optional(),
  monthlyAiLimit: z.number().int().min(0).max(1000000).optional(),
  // Governance
  canBook: z.boolean().optional(),
  canApplyPromo: z.boolean().optional(),
  maxBookingValue: z.number().min(0).max(1000000).optional(),
  dailyBookingLimit: z.number().int().min(0).max(10000).optional(),
  activeHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).optional(),
  requireConfirmAbove: z.number().min(0).optional(),
});

router.put('/settings', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });
    const data = settingsSchema.parse(req.body);
    const [v] = await db.select({ settings: vendors.settings }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const current = (v?.settings ?? {}) as Record<string, unknown>;
    const bot = (current.bot ?? {}) as Record<string, unknown>;
    Object.assign(bot, data);
    await db.update(vendors)
      .set({ settings: { ...current, bot }, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));
    return res.json({ ok: true, bot });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
