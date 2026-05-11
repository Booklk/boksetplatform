/**
 * Add-ons routes — list catalog + active state + toggle.
 *
 *   GET  /api/addons                — public catalog (id/name/price/features)
 *   GET  /api/addons/me             — vendor: which add-ons are active
 *   POST /api/addons/me/:id/toggle  — vendor: enable/disable an add-on
 */
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import {
  ADDONS, AddonId, getAddon, listAddons, toggleAddon,
} from '../services/addons.js';
import { getMonthlyBookingUsage } from '../services/planLimits.js';
import { getAllQuotas } from '../services/usageGuard.js';

const router = Router();

// Public catalog
router.get('/', (_req, res) => {
  res.json(listAddons());
});

router.get('/me', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط' });
    const [v] = await db.select({ settings: vendors.settings }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const active = ((v?.settings ?? {}) as { addons?: string[] }).addons ?? [];

    const catalog = listAddons().map((a) => ({
      ...a,
      active: active.includes(a.id),
    }));
    return res.json({ active, catalog });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const toggleSchema = z.object({ enable: z.boolean() });

router.post('/me/:id/toggle', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط' });
    const id = req.params.id as AddonId;
    if (!getAddon(id)) return res.status(404).json({ error: 'الإضافة غير موجودة' });
    const { enable } = toggleSchema.parse(req.body);

    const list = await toggleAddon(vendorId, id, enable);
    return res.json({ ok: true, active: list });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/addons/me/usage — vendor's current month booking counter (legacy shape)
router.get('/me/usage', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط' });
    const usage = await getMonthlyBookingUsage(vendorId);
    return res.json(usage);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/addons/me/quotas — full per-resource quota status for dashboard
router.get('/me/quotas', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط' });
    const quotas = await getAllQuotas(vendorId);
    return res.json(quotas);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
