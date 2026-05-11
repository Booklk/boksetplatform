/**
 * Vendor branches — a vendor can operate from multiple physical locations.
 * Branches are optional: bookings/employees with branchId = NULL continue
 * to work as they did pre-multi-branch.
 *
 * Auth: vendor_admin or admin of the owning vendor.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendorBranches } from '../db/schema.js';
import { and, eq, asc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin', 'employee'));

const upsertSchema = z.object({
  nameAr: z.string().min(1, 'اسم الفرع مطلوب'),
  nameEn: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  lat: z.union([z.string(), z.number()]).optional(),
  lng: z.union([z.string(), z.number()]).optional(),
  workingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    closed: z.boolean().optional(),
  })).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/branches — list branches for the current vendor
router.get('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const rows = await db.select().from(vendorBranches)
      .where(eq(vendorBranches.vendorId, vendorId))
      .orderBy(asc(vendorBranches.sortOrder), asc(vendorBranches.id));
    return res.json(rows);
  } catch (e) {
    console.error('[branches/list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/branches — create a branch
router.post('/', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بحسابك' });
    const data = upsertSchema.parse(req.body);
    const [row] = await db.insert(vendorBranches).values({
      vendorId,
      nameAr: data.nameAr,
      nameEn: data.nameEn ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      lat: data.lat !== undefined ? String(data.lat) : null,
      lng: data.lng !== undefined ? String(data.lng) : null,
      workingHours: data.workingHours ?? {},
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[branches/create]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/branches/:id — update a branch
router.put('/:id', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = upsertSchema.partial().parse(req.body);
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (data.nameAr !== undefined)       update.nameAr       = data.nameAr;
    if (data.nameEn !== undefined)       update.nameEn       = data.nameEn;
    if (data.city !== undefined)         update.city         = data.city;
    if (data.address !== undefined)      update.address      = data.address;
    if (data.phone !== undefined)        update.phone        = data.phone;
    if (data.lat !== undefined)          update.lat          = data.lat === null ? null : String(data.lat);
    if (data.lng !== undefined)          update.lng          = data.lng === null ? null : String(data.lng);
    if (data.workingHours !== undefined) update.workingHours = data.workingHours;
    if (data.sortOrder !== undefined)    update.sortOrder    = data.sortOrder;
    if (data.isActive !== undefined)     update.isActive     = data.isActive;

    const [row] = await db.update(vendorBranches)
      .set(update)
      .where(and(eq(vendorBranches.id, id), eq(vendorBranches.vendorId, vendorId)))
      .returning();
    if (!row) return res.status(404).json({ error: 'الفرع غير موجود' });
    return res.json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[branches/update]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/branches/:id — soft delete (deactivate)
router.delete('/:id', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    await db.update(vendorBranches)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(vendorBranches.id, id), eq(vendorBranches.vendorId, vendorId)));
    return res.json({ success: true });
  } catch (e) {
    console.error('[branches/delete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
