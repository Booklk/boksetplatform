/**
 * Employee Documents — per-employee binder of contracts, IDs, certificates.
 * Renewal alerts surfaced via /expiring.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { employeeDocuments, users } from '../db/schema.js';
import { eq, and, desc, lte, isNotNull, sql } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

// GET /api/employee-docs?employeeId=&category=
router.get('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;
    const category = (req.query.category as string) || null;

    const rows = await db.select({
      id: employeeDocuments.id,
      employeeId: employeeDocuments.employeeId,
      employeeName: users.name,
      category: employeeDocuments.category,
      title: employeeDocuments.title,
      fileUrl: employeeDocuments.fileUrl,
      expiresAt: employeeDocuments.expiresAt,
      notes: employeeDocuments.notes,
      createdAt: employeeDocuments.createdAt,
    })
      .from(employeeDocuments)
      .leftJoin(users, eq(users.id, employeeDocuments.employeeId))
      .where(and(
        eq(employeeDocuments.vendorId, vendorId),
        ...(employeeId ? [eq(employeeDocuments.employeeId, employeeId)] : []),
        ...(category ? [eq(employeeDocuments.category, category)] : []),
      ))
      .orderBy(desc(employeeDocuments.createdAt));
    return res.json(rows);
  } catch (e) {
    console.error('[employee-docs list]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/employee-docs/expiring — renewal alerts (next 30 days + already past)
router.get('/expiring', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const cutoff = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const rows = await db.select({
      id: employeeDocuments.id,
      employeeId: employeeDocuments.employeeId,
      employeeName: users.name,
      category: employeeDocuments.category,
      title: employeeDocuments.title,
      expiresAt: employeeDocuments.expiresAt,
    })
      .from(employeeDocuments)
      .leftJoin(users, eq(users.id, employeeDocuments.employeeId))
      .where(and(
        eq(employeeDocuments.vendorId, vendorId),
        isNotNull(employeeDocuments.expiresAt),
        lte(employeeDocuments.expiresAt, cutoff),
      ))
      .orderBy(employeeDocuments.expiresAt);
    return res.json(rows);
  } catch (e) {
    console.error('[employee-docs expiring]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const createSchema = z.object({
  employeeId: z.number().int().positive(),
  category: z.enum(['contract', 'id', 'iqama', 'health_card', 'training_cert', 'bank_iban', 'other']),
  title: z.string().min(2).max(200),
  fileUrl: z.string().url(),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = createSchema.parse(req.body);

    // Defense-in-depth: employee must belong to this vendor.
    const [emp] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.employeeId), eq(users.vendorId, vendorId)))
      .limit(1);
    if (!emp) return res.status(400).json({ error: 'الموظف غير تابع لهذا المتجر' });

    const [row] = await db.insert(employeeDocuments).values({
      vendorId,
      employeeId: data.employeeId,
      category: data.category,
      title: data.title.trim(),
      fileUrl: data.fileUrl,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      notes: data.notes ?? null,
      uploadedById: req.user!.id,
    }).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[employee-docs post]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const result = await db.delete(employeeDocuments)
      .where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.vendorId, vendorId)))
      .returning({ id: employeeDocuments.id });
    if (result.length === 0) return res.status(404).json({ error: 'الوثيقة غير موجودة' });
    return res.json({ success: true });
  } catch (e) {
    console.error('[employee-docs delete]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
