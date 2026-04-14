import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK SYSTEM — Allow vendors to receive event callbacks
// ═══════════════════════════════════════════════════════════════════════════════

// Webhook events:
// booking.created | booking.confirmed | booking.completed | booking.cancelled
// payment.received | customer.registered | rating.submitted | inventory.low

const WEBHOOK_EVENTS = [
  'booking.created',
  'booking.confirmed',
  'booking.completed',
  'booking.cancelled',
  'payment.received',
  'customer.registered',
  'rating.submitted',
  'inventory.low',
] as const;

type WebhookEvent = typeof WEBHOOK_EVENTS[number];

const webhookSchema = z.object({
  url: z.string().url('رابط URL غير صحيح'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'اختر حدث واحد على الأقل'),
  secret: z.string().optional(),
  isActive: z.boolean().default(true),
});

// GET /api/webhooks — List vendor's webhooks
router.get('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    const [vendor] = await db.select({ settings: vendors.settings })
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    const webhooks = (vendor?.settings as any)?.webhooks ?? [];
    return res.json({
      webhooks,
      availableEvents: WEBHOOK_EVENTS.map(e => ({
        event: e,
        label: {
          'booking.created': 'حجز جديد',
          'booking.confirmed': 'تأكيد حجز',
          'booking.completed': 'إتمام حجز',
          'booking.cancelled': 'إلغاء حجز',
          'payment.received': 'استلام دفعة',
          'customer.registered': 'تسجيل عميل جديد',
          'rating.submitted': 'تقييم جديد',
          'inventory.low': 'نقص مخزون',
        }[e],
      })),
    });
  } catch (err) {
    console.error('[Webhooks list]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/webhooks — Create a webhook
router.post('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    const data = webhookSchema.parse(req.body);

    const [vendor] = await db.select({ settings: vendors.settings })
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    const currentSettings = (vendor?.settings ?? {}) as Record<string, unknown>;
    const webhooks = (currentSettings.webhooks as any[]) ?? [];

    if (webhooks.length >= 5) {
      return res.status(400).json({ error: 'الحد الأقصى 5 webhooks' });
    }

    const newWebhook = {
      id: `wh_${Date.now().toString(36)}`,
      url: data.url,
      events: data.events,
      secret: data.secret || null,
      isActive: data.isActive,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      failCount: 0,
    };

    webhooks.push(newWebhook);

    await db.update(vendors).set({
      settings: { ...currentSettings, webhooks },
    }).where(eq(vendors.id, vendorId));

    return res.json(newWebhook);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: err.issues[0]?.message ?? 'بيانات غير صالحة' });
    console.error('[Webhooks create]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/webhooks/:id — Delete a webhook
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    const [vendor] = await db.select({ settings: vendors.settings })
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    const currentSettings = (vendor?.settings ?? {}) as Record<string, unknown>;
    const webhooks = ((currentSettings.webhooks as any[]) ?? []).filter(
      (w: any) => w.id !== req.params.id,
    );

    await db.update(vendors).set({
      settings: { ...currentSettings, webhooks },
    }).where(eq(vendors.id, vendorId));

    return res.json({ success: true });
  } catch (err) {
    console.error('[Webhooks delete]', err);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/webhooks/test — Test a webhook URL
router.post('/test', async (req: AuthRequest, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'رابط URL مطلوب' });

    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'هذا اختبار من Bokset Webhooks',
        vendorId: req.user!.vendorId,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bokset-Event': 'test' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    return res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err.message ?? 'فشل في الاتصال',
    });
  }
});

// ─── Utility: Fire webhook (called from other routes) ────────────────────────
export async function fireWebhook(vendorId: number, event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const [vendor] = await db.select({ settings: vendors.settings })
      .from(vendors)
      .where(eq(vendors.id, vendorId));

    const webhooks = ((vendor?.settings as any)?.webhooks as any[]) ?? [];
    const activeHooks = webhooks.filter((w: any) => w.isActive && w.events.includes(event));

    for (const hook of activeHooks) {
      try {
        const payload = {
          event,
          timestamp: new Date().toISOString(),
          data,
        };

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Bokset-Event': event,
        };

        if (hook.secret) {
          const crypto = await import('crypto');
          const signature = crypto.createHmac('sha256', hook.secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          headers['X-Bokset-Signature'] = signature;
        }

        await fetch(hook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        hook.lastTriggeredAt = new Date().toISOString();
        hook.failCount = 0;
      } catch {
        hook.failCount = (hook.failCount ?? 0) + 1;
        // Deactivate after 10 consecutive failures
        if (hook.failCount >= 10) hook.isActive = false;
      }
    }

    // Update webhook stats
    if (activeHooks.length > 0) {
      const currentSettings = (vendor?.settings ?? {}) as Record<string, unknown>;
      await db.update(vendors).set({
        settings: { ...currentSettings, webhooks },
      }).where(eq(vendors.id, vendorId));
    }
  } catch (err) {
    console.error(`[Webhook fire] ${event}`, err);
  }
}

export default router;
