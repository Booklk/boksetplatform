/**
 * /api/vendor-preferences — operational preferences for the vendor:
 * working hours, holidays, booking rules, deposit, customer fields.
 *
 * Public read is unauthenticated so the storefront can decide which
 * customer fields to render, show the hours block, and compute the
 * earliest bookable slot without exposing anything sensitive.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  readPreferences, writePreferences, isOpenAt, DEFAULT_PREFERENCES,
} from '../services/vendorPreferences.js';

const router = Router();

// ── Public read ──────────────────────────────────────────────────────────
router.get('/public/:slug', async (req, res) => {
  const [vendor] = await db.select({ id: vendors.id })
    .from(vendors).where(eq(vendors.slug, req.params.slug)).limit(1);
  if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });
  const prefs = await readPreferences(vendor.id);
  const isOpen = isOpenAt(prefs, new Date());
  res.set('Cache-Control', 'public, max-age=60');
  return res.json({
    hours:    prefs.hours,
    holidays: prefs.holidays,
    booking:  prefs.booking,      // safe: lead time / slot size are not secrets
    deposit:  prefs.deposit,      // customer needs to know if deposit required
    fields:   prefs.fields,       // storefront renders form around this
    isOpenNow: isOpen,
  });
});

// ── Vendor-side ──────────────────────────────────────────────────────────
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

router.get('/', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  return res.json(await readPreferences(vendorId));
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayHoursSchema = z.object({
  open:   hhmm,
  close:  hhmm,
  closed: z.boolean(),
});

const patchSchema = z.object({
  hours: z.record(dayHoursSchema).optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  booking: z.object({
    minLeadMinutes:      z.number().int().min(0).max(20160).optional(),
    maxLeadDays:         z.number().int().min(1).max(365).optional(),
    cancelDeadlineHours: z.number().int().min(0).max(168).optional(),
    slotDurationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]).optional(),
    maxConcurrent:       z.number().int().min(1).max(50).optional(),
    autoAccept:          z.boolean().optional(),
  }).optional(),
  deposit: z.object({
    required: z.boolean().optional(),
    type: z.enum(['percentage', 'fixed']).optional(),
    amount: z.number().min(0).optional(),
  }).optional(),
  fields: z.object({
    email:        z.enum(['hidden', 'optional', 'required']).optional(),
    vehiclePlate: z.enum(['hidden', 'optional', 'required']).optional(),
    vehicleType:  z.enum(['hidden', 'optional', 'required']).optional(),
    address:      z.enum(['hidden', 'optional', 'required']).optional(),
    notes:        z.enum(['hidden', 'optional', 'required']).optional(),
  }).optional(),
});

router.put('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
    const patch = patchSchema.parse(req.body);
    // Zod returns `Partial` on every sub-object; writePreferences's coerce()
    // re-fills any missing field from the current stored value, so an `as
    // any` cast here is safe — the storage layer owns the final shape.
    const next = await writePreferences(vendorId, patch as any);
    return res.json(next);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[vendor-preferences PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Convenience: get defaults as a GET so the client can show "restore
// defaults" without bundling them.
router.get('/defaults', async (_req, res) => {
  return res.json(DEFAULT_PREFERENCES);
});

export default router;
