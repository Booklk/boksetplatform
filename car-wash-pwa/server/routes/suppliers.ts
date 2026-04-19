import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { suppliers, supplierOrders, inventory, vendors } from '../db/schema.js';
import { eq, and, desc, or } from 'drizzle-orm';
import { requireRole } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';
import { notifyAppointmentReminder } from '../services/whatsapp.js';

const router = Router();

// ─── SUPPLIERS ────────────────────────────────────────────────────────────────

// GET /suppliers — list vendor suppliers
router.get('/', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const rows = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.vendorId, vendorId))
      .orderBy(desc(suppliers.createdAt));

    return res.json(rows);
  } catch (e) {
    console.error('[suppliers GET]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /suppliers — add supplier
router.post('/', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const data = z.object({
      nameAr: z.string().min(2),
      phone: z.string().min(9),
      email: z.string().email().optional().nullable(),
      contactPerson: z.string().optional().nullable(),
      products: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);

    const [supplier] = await db.insert(suppliers).values({ ...data, vendorId }).returning();
    return res.status(201).json(supplier);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[suppliers POST]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /suppliers/:id — update supplier
router.put('/:id', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const id = Number(req.params.id);
    const data = z.object({
      nameAr: z.string().min(2).optional(),
      phone: z.string().min(9).optional(),
      email: z.string().email().optional().nullable(),
      contactPerson: z.string().optional().nullable(),
      products: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const [updated] = await db
      .update(suppliers)
      .set(data)
      .where(and(eq(suppliers.id, id), eq(suppliers.vendorId, vendorId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'المورد غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[suppliers PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /suppliers/:id — deactivate
router.delete('/:id', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const id = Number(req.params.id);
    const [updated] = await db
      .update(suppliers)
      .set({ isActive: false })
      .where(and(eq(suppliers.id, id), eq(suppliers.vendorId, vendorId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'المورد غير موجود' });
    return res.json({ success: true });
  } catch (e) {
    console.error('[suppliers DELETE]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── SUPPLIER ORDERS ──────────────────────────────────────────────────────────

// GET /suppliers/orders — list all supplier orders (with status filter)
router.get('/orders', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const { status } = req.query;

    const conditions: ReturnType<typeof eq>[] = [eq(supplierOrders.vendorId, vendorId)];
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(supplierOrders.status, status));
    }

    const rows = await db
      .select({
        order: supplierOrders,
        supplier: {
          id: suppliers.id,
          nameAr: suppliers.nameAr,
          phone: suppliers.phone,
          contactPerson: suppliers.contactPerson,
        },
      })
      .from(supplierOrders)
      .leftJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(supplierOrders.createdAt));

    return res.json(rows.map(({ order, supplier: s }) => ({ ...order, supplier: s })));
  } catch (e) {
    console.error('[orders GET]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /suppliers/orders — manually create order (send WhatsApp)
router.post('/orders', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const data = z.object({
      supplierId: z.number().int(),
      inventoryItemId: z.number().int().optional().nullable(),
      itemName: z.string().min(1),
      quantityRequested: z.union([z.string(), z.number()]).transform(String),
      unit: z.string().default('\u0648\u062d\u062f\u0629'),
      notes: z.string().optional().nullable(),
    }).parse(req.body);

    const [order] = await db.insert(supplierOrders).values({
      vendorId,
      supplierId: data.supplierId,
      inventoryItemId: data.inventoryItemId ?? null,
      itemName: data.itemName,
      quantityRequested: data.quantityRequested,
      unit: data.unit,
      notes: data.notes ?? null,
      status: 'sent',
    }).returning();

    const [supplierRow] = await db.select().from(suppliers)
      .where(and(eq(suppliers.id, data.supplierId), eq(suppliers.vendorId, vendorId)))
      .limit(1);

    const [vendorRow] = await db.select({ nameAr: vendors.nameAr }).from(vendors)
      .where(eq(vendors.id, vendorId)).limit(1);

    let whatsappSent = false;
    if (supplierRow?.phone && vendorRow) {
      const contact = supplierRow.contactPerson ?? supplierRow.nameAr;
      const msg = `\u0645\u0631\u062d\u0628\u0627\u064b ${contact}\u060c\n\u0637\u0644\u0628 \u062a\u0648\u0631\u064a\u062f \u0645\u0646 *${vendorRow.nameAr}*:\n\ud83d\udce6 *${data.itemName}*\n\u0627\u0644\u0643\u0645\u064a\u0629: ${data.quantityRequested} ${data.unit}\n\n\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0623\u0642\u0631\u0628 \u0648\u0642\u062a.\n\u0634\u0643\u0631\u0627\u064b \ud83d\ude4f`;
      try {
        await notifyAppointmentReminder(supplierRow.phone, msg, new Date());
        whatsappSent = true;
      } catch (err) {
        console.error('[suppliers/orders WhatsApp]', err);
      }
    }

    const [updated] = await db.update(supplierOrders)
      .set({ whatsappSent })
      .where(eq(supplierOrders.id, order.id))
      .returning();

    return res.status(201).json({ ...updated, supplier: supplierRow ?? null });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[orders POST]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /suppliers/orders/:id/status — update order status
router.put('/orders/:id/status', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const id = Number(req.params.id);
    const { status } = z.object({
      status: z.enum(['sent', 'confirmed', 'received', 'cancelled']),
    }).parse(req.body);

    const setData: Record<string, unknown> = { status };
    if (status === 'received') setData.receivedAt = new Date();

    const [updated] = await db.update(supplierOrders)
      .set(setData)
      .where(and(eq(supplierOrders.id, id), eq(supplierOrders.vendorId, vendorId)))
      .returning();

    if (!updated) return res.status(404).json({ error: 'الطلب غير موجود' });

    if (status === 'received' && updated.inventoryItemId) {
      const [item] = await db.select().from(inventory)
        .where(eq(inventory.id, updated.inventoryItemId)).limit(1);
      if (item) {
        const currentQty = parseFloat(item.quantity ?? '0');
        const addQty = parseFloat(updated.quantityRequested ?? '0');
        await db.update(inventory)
          .set({ quantity: (currentQty + addQty).toString(), updatedAt: new Date() })
          .where(eq(inventory.id, item.id));
      }
    }

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[orders/:id/status PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /suppliers/check-reorder
router.post('/check-reorder', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const lowStockItems = await db
      .select({
        item: inventory,
        supplier: suppliers,
        vendorName: vendors.nameAr,
      })
      .from(inventory)
      .innerJoin(suppliers, eq(inventory.supplierId, suppliers.id))
      .innerJoin(vendors, eq(inventory.vendorId, vendors.id))
      .where(
        and(
          eq(inventory.vendorId, vendorId),
          eq(inventory.isActive, true),
          eq(suppliers.isActive, true),
        )
      );

    const lowItems = lowStockItems.filter(
      ({ item }) => parseFloat(item.quantity ?? '0') <= parseFloat(item.minQuantity ?? '0')
    );

    const ordersCreated: string[] = [];

    for (const { item, supplier, vendorName } of lowItems) {
      const [existing] = await db.select({ id: supplierOrders.id })
        .from(supplierOrders)
        .where(
          and(
            eq(supplierOrders.inventoryItemId, item.id),
            or(
              eq(supplierOrders.status, 'sent'),
              eq(supplierOrders.status, 'confirmed'),
            )
          )
        ).limit(1);

      if (existing) continue;

      const qty = item.reorderQuantity ?? '10';
      const msg = `\u0645\u0631\u062d\u0628\u0627\u064b ${supplier.contactPerson ?? supplier.nameAr}\u060c\n\n\u0637\u0644\u0628 \u062a\u0648\u0631\u064a\u062f \u0639\u0627\u062c\u0644 \u0645\u0646 *${vendorName}*:\n\n\ud83d\udce6 *${item.name}*\n\u0627\u0644\u0643\u0645\u064a\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629: ${qty} ${item.unit}\n\n\u064a\u0631\u062c\u0649 \u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0623\u0642\u0631\u0628 \u0648\u0642\u062a \u0645\u0645\u0643\u0646.\n\u0634\u0643\u0631\u0627\u064b \ud83d\ude4f`;

      let whatsappSent = false;
      try {
        await notifyAppointmentReminder(supplier.phone, msg, new Date());
        whatsappSent = true;
      } catch (err) {
        console.error('[check-reorder WhatsApp]', err);
      }

      await db.insert(supplierOrders).values({
        vendorId,
        supplierId: supplier.id,
        inventoryItemId: item.id,
        itemName: item.name,
        quantityRequested: qty,
        unit: item.unit,
        status: 'sent',
        whatsappSent,
      });

      ordersCreated.push(item.name);
    }

    return res.json({ ordersCreated: ordersCreated.length, items: ordersCreated });
  } catch (e) {
    console.error('[check-reorder POST]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /suppliers/auto-reorder-toggle — enable/disable auto-reorder for the entire vendor
router.patch('/auto-reorder-toggle', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const [updated] = await db
      .update(vendors)
      .set({ autoReorderEnabled: enabled })
      .where(eq(vendors.id, vendorId))
      .returning({ id: vendors.id, autoReorderEnabled: vendors.autoReorderEnabled });

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[auto-reorder-toggle PATCH]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PATCH /suppliers/item/:id/auto-reorder — enable/disable auto-reorder for a single inventory item
router.patch('/item/:id/auto-reorder', requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const id = Number(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

    const [updated] = await db
      .update(inventory)
      .set({ autoReorderEnabled: enabled, updatedAt: new Date() })
      .where(and(eq(inventory.id, id), eq(inventory.vendorId, vendorId)))
      .returning({ id: inventory.id, autoReorderEnabled: inventory.autoReorderEnabled });

    if (!updated) return res.status(404).json({ error: 'الصنف غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[item/:id/auto-reorder PATCH]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
