import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { timeBlocks } from '../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const blockSchema = z.object({
  title: z.string().min(2).max(200),
  reason: z.enum(['maintenance', 'break', 'holiday', 'full', 'other']).default('maintenance'),
  startsAt: z.string().transform(s => new Date(s)),
  endsAt: z.string().transform(s => new Date(s)),
}).refine(d => d.endsAt > d.startsAt, { message: 'وقت النهاية يجب أن يكون بعد وقت البداية' });

// GET /api/time-blocks — list active + upcoming blocks
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(timeBlocks)
      .where(and(
        eq(timeBlocks.vendorId, vendorId),
        gte(timeBlocks.endsAt, new Date()),
      ))
      .orderBy(timeBlocks.startsAt);
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/time-blocks/all — all blocks including past
router.get('/all', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(timeBlocks)
      .where(eq(timeBlocks.vendorId, vendorId))
      .orderBy(desc(timeBlocks.startsAt))
      .limit(50);
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/time-blocks/check — Public: check if a slot is blocked (used during booking)
router.get('/check', async (req, res) => {
  try {
    const { vendorId, at } = req.query as { vendorId: string; at: string };
    if (!vendorId || !at) return res.json({ blocked: false });
    const date = new Date(at);
    const [block] = await db.select({ id: timeBlocks.id, title: timeBlocks.title })
      .from(timeBlocks)
      .where(and(
        eq(timeBlocks.vendorId, Number(vendorId)),
        // starts_at <= date <= ends_at
      ))
      .limit(1);
    return res.json({ blocked: !!block, reason: block?.title });
  } catch (e) { return res.json({ blocked: false }); }
});

// POST /api/time-blocks — create block
router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = blockSchema.parse(req.body);
    const [block] = await db.insert(timeBlocks).values({
      vendorId,
      title: data.title,
      reason: data.reason,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdBy: req.user!.id,
    }).returning();
    return res.status(201).json(block);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/time-blocks/:id
router.delete('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    await db.delete(timeBlocks).where(and(eq(timeBlocks.id, id), eq(timeBlocks.vendorId, vendorId)));
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

export default router;
