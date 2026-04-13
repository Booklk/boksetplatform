import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { inventory, inventoryTransactions } from '../db/schema.js';
import { eq, desc, lte, and } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Admin: list inventory
router.get('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });
    const items = await db.select().from(inventory).where(eq(inventory.vendorId, vendorId)).orderBy(desc(inventory.updatedAt));
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: low stock items
router.get('/low-stock', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });
    const items = await db.select().from(inventory)
      .where(and(eq(inventory.vendorId, vendorId), lte(inventory.quantity, inventory.minQuantity)));
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: create inventory item
router.post('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });

    const data = z.object({
      name: z.string().min(2),
      unit: z.string().min(1),
      quantity: z.union([z.string(), z.number()]).transform(String),
      minQuantity: z.union([z.string(), z.number()]).transform(String),
      costPerUnit: z.union([z.string(), z.number()]).transform(String),
      supplier: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const [item] = await db.insert(inventory).values({ ...data, vendorId }).returning();
    return res.status(201).json(item);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: update inventory item
router.put('/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId!;
    const data = z.object({
      name: z.string().optional(),
      unit: z.string().optional(),
      minQuantity: z.union([z.string(), z.number()]).transform(String).optional(),
      costPerUnit: z.union([z.string(), z.number()]).transform(String).optional(),
      supplier: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const [updated] = await db.update(inventory)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(inventory.id, id), eq(inventory.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'المنتج غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: adjust quantity (in/out/adjustment)
router.post('/:id/transaction', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      type: z.enum(['in', 'out', 'adjustment']),
      quantity: z.string(),
      notes: z.string().optional(),
    }).parse(req.body);

    const vendorId = req.user!.vendorId!;
    const [item] = await db.select().from(inventory)
      .where(and(eq(inventory.id, id), eq(inventory.vendorId, vendorId))).limit(1);
    if (!item) return res.status(404).json({ error: 'المنتج غير موجود أو غير مصرح' });

    const qty = parseFloat(data.quantity);
    const currentQty = parseFloat(item.quantity ?? '0');
    let newQty: number;

    if (data.type === 'in') newQty = currentQty + qty;
    else if (data.type === 'out') newQty = Math.max(0, currentQty - qty);
    else newQty = qty; // adjustment: set directly

    const [updated] = await db.update(inventory)
      .set({ quantity: newQty.toString(), updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();

    await db.insert(inventoryTransactions).values({
      vendorId,
      inventoryId: id,
      type: data.type,
      quantity: data.quantity,
      notes: data.notes,
      createdBy: req.user!.id,
    });

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: transaction log for an item
router.get('/:id/transactions', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const txns = await db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.inventoryId, id))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(50);
    return res.json(txns);
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
