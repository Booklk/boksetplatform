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
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { processIncomingMessage } from '../services/whatsappBot.js';
import { getSetting } from '../services/platformSettings.js';

const router = Router();

// ─── Public webhook ─────────────────────────────────────────────────────────

// Meta sends a GET to verify the URL on first setup.
// The verify_token must match what the vendor set up in their Meta App.
router.get('/webhook/:vendorId', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Vendor sets this same token in Meta App > Webhook config.
    // We allow either a per-vendor token (in vendor.settings.bot.verifyToken)
    // or a platform-wide fallback (platform.whatsappVerifyToken setting).
    const vendorId = Number(req.params.vendorId);
    let expected: string | null = null;
    if (!isNaN(vendorId)) {
      const [v] = await db.select({ settings: vendors.settings }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      const bot = ((v?.settings ?? {}) as { bot?: { verifyToken?: string } }).bot;
      expected = bot?.verifyToken ?? null;
    }
    if (!expected) {
      // Fall back to a platform-wide token via platform settings.
      // We re-use whatsapp.defaultPhoneId as a sentinel — this is *not* a
      // secret in the sense Meta cares about; it's just a string both sides
      // know in advance. Vendors can override per-vendor.
      expected = (await getSetting('whatsapp.defaultPhoneId')) ?? 'jdawil-verify';
    }

    if (mode === 'subscribe' && token === expected) {
      return res.status(200).send(String(challenge ?? ''));
    }
    return res.status(403).send('verification failed');
  } catch (e) {
    return res.status(500).send('error');
  }
});

// Meta posts inbound messages here. We process and respond out-of-band.
router.post('/webhook/:vendorId', async (req, res) => {
  // Always 200 fast — Meta retries aggressively otherwise
  res.status(200).send('ok');

  try {
    const vendorId = Number(req.params.vendorId);
    if (isNaN(vendorId)) return;

    const entry = (req.body?.entry ?? []) as Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            type?: string;
            text?: { body?: string };
            interactive?: {
              button_reply?: { id?: string; title?: string };
              list_reply?: { id?: string; title?: string };
            };
          }>;
        };
      }>;
    }>;

    for (const e of entry) {
      for (const change of e.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          if (!m.from) continue;
          const text = m.text?.body ?? '';
          const buttonId = m.interactive?.button_reply?.id;
          const listSelection = m.interactive?.list_reply?.id;
          await processIncomingMessage(vendorId, {
            fromPhone: m.from,
            text,
            buttonId,
            listSelection,
          });
        }
      }
    }
  } catch (e) {
    console.error('[whatsapp-bot webhook] processing error:', e);
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
