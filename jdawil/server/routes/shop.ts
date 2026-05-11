import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendorProducts, bookingProducts, bookings } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const productSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().optional(),
  price: z.number().min(0),
  imageUrl: z.string().url().optional(),
  stock: z.number().int().min(0).default(0),
  category: z.enum(['general', 'care', 'fragrance', 'accessories', 'cleaning']).default('general'),
  sortOrder: z.number().int().default(0),
});

// GET /api/shop/products — vendor: list all products
router.get('/products', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const list = await db.select().from(vendorProducts)
      .where(eq(vendorProducts.vendorId, vendorId))
      .orderBy(vendorProducts.sortOrder, vendorProducts.name);
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/shop/products/public/:vendorId — Public: list active products for customer booking
router.get('/products/public/:vendorId', async (req, res) => {
  try {
    const vendorId = Number(req.params.vendorId);
    const list = await db.select({
      id: vendorProducts.id,
      name: vendorProducts.name,
      description: vendorProducts.description,
      price: vendorProducts.price,
      imageUrl: vendorProducts.imageUrl,
      stock: vendorProducts.stock,
      category: vendorProducts.category,
    }).from(vendorProducts)
      .where(and(eq(vendorProducts.vendorId, vendorId), eq(vendorProducts.isActive, true)))
      .orderBy(vendorProducts.sortOrder);
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// POST /api/shop/products — create product
router.post('/products', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = productSchema.parse(req.body);
    const [product] = await db.insert(vendorProducts).values({
      vendorId,
      ...data,
      price: String(data.price),
    }).returning();
    return res.status(201).json(product);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/shop/products/:id — update product
router.put('/products/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = productSchema.partial().parse(req.body);
    const updateData: any = { ...data, updatedAt: new Date() };
    if (data.price !== undefined) updateData.price = String(data.price);
    const [updated] = await db.update(vendorProducts)
      .set(updateData)
      .where(and(eq(vendorProducts.id, id), eq(vendorProducts.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'المنتج غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/shop/products/:id — soft delete (isActive = false)
router.delete('/products/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    await db.update(vendorProducts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(vendorProducts.id, id), eq(vendorProducts.vendorId, vendorId)));
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// GET /api/shop/booking/:bookingId/products — get products for a booking
router.get('/booking/:bookingId/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const list = await db.select().from(bookingProducts)
      .where(eq(bookingProducts.bookingId, bookingId));
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// POST /api/shop/booking/:bookingId/products — add products to a booking
router.post('/booking/:bookingId/products', requireAuth, requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const bookingId = Number(req.params.bookingId);

    const items = z.array(z.object({
      productId: z.number(),
      quantity: z.number().int().min(1),
    })).min(1).parse(req.body);

    // Verify booking belongs to vendor
    const [booking] = await db.select({ id: bookings.id }).from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.vendorId, vendorId))).limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    const results = [];
    for (const item of items) {
      const [product] = await db.select().from(vendorProducts)
        .where(and(eq(vendorProducts.id, item.productId), eq(vendorProducts.vendorId, vendorId))).limit(1);
      if (!product || !product.isActive) continue;
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `المخزون غير كافٍ للمنتج: ${product.name}` });
      }

      const total = Number(product.price) * item.quantity;
      const [bp] = await db.insert(bookingProducts).values({
        bookingId,
        vendorId,
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: String(total),
      }).returning();
      results.push(bp);

      // Deduct stock
      await db.update(vendorProducts)
        .set({ stock: sql`${vendorProducts.stock} - ${item.quantity}`, updatedAt: new Date() })
        .where(eq(vendorProducts.id, product.id));
    }

    return res.status(201).json(results);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/shop/stats — top products, total revenue from products
router.get('/stats', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const topProducts = await db
      .select({
        productName: bookingProducts.productName,
        totalSold: sql<number>`SUM(${bookingProducts.quantity})`,
        totalRevenue: sql<number>`SUM(${bookingProducts.totalPrice})`,
      })
      .from(bookingProducts)
      .where(eq(bookingProducts.vendorId, vendorId))
      .groupBy(bookingProducts.productName)
      .orderBy(sql`SUM(${bookingProducts.totalPrice}) DESC`)
      .limit(10);

    return res.json({ topProducts });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

export default router;
