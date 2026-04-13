import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { financials, users } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const financialSchema = z.object({
  type: z.enum(['income', 'expense', 'salary', 'maintenance']),
  category: z.string().min(1),
  amount: z.string(),
  description: z.string().min(2),
  employeeId: z.number().optional(),
  notes: z.string().optional(),
  date: z.string().optional(),
});

// List financial records (vendor-scoped)
router.get('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const { type, category, from, to, limit = '200' } = req.query as Record<string, string>;
    const vendorId = req.user!.vendorId;

    const conditions: any[] = [];
    if (vendorId) conditions.push(eq(financials.vendorId, vendorId));
    if (type && type !== 'all') conditions.push(eq(financials.type, type));
    if (category && category !== 'all') conditions.push(eq(financials.category, category));
    if (from) conditions.push(gte(financials.date, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(financials.date, toDate));
    }

    const records = await db.select({
      id: financials.id,
      vendorId: financials.vendorId,
      type: financials.type,
      category: financials.category,
      amount: financials.amount,
      description: financials.description,
      notes: financials.notes,
      date: financials.date,
      createdAt: financials.createdAt,
      referenceId: financials.referenceId,
      referenceType: financials.referenceType,
      employeeName: users.name,
    })
      .from(financials)
      .leftJoin(users, eq(financials.employeeId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(financials.date))
      .limit(parseInt(limit));

    return res.json(records);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Summary totals (vendor-scoped)
router.get('/summary', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const vendorId = req.user!.vendorId;

    const conditions: any[] = [];
    if (vendorId) conditions.push(eq(financials.vendorId, vendorId));
    if (from) conditions.push(gte(financials.date, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(financials.date, toDate));
    }

    const results = await db.select({
      type: financials.type,
      total: sql<string>`SUM(${financials.amount})`,
      count: sql<string>`COUNT(*)`,
    })
      .from(financials)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(financials.type);

    const summary = {
      income: 0,
      expense: 0,
      salary: 0,
      maintenance: 0,
      net: 0,
      totalTransactions: 0,
    };

    for (const row of results) {
      const amt = parseFloat(row.total ?? '0');
      const cnt = parseInt(row.count ?? '0');
      summary.totalTransactions += cnt;
      if (row.type === 'income') summary.income = amt;
      else if (row.type === 'expense') summary.expense = amt;
      else if (row.type === 'salary') summary.salary = amt;
      else if (row.type === 'maintenance') summary.maintenance = amt;
    }

    summary.net = summary.income - summary.expense - summary.salary - summary.maintenance;
    return res.json(summary);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Category breakdown (vendor-scoped)
router.get('/by-category', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const { from, to, type } = req.query as Record<string, string>;
    const vendorId = req.user!.vendorId;

    const conditions: any[] = [];
    if (vendorId) conditions.push(eq(financials.vendorId, vendorId));
    if (type && type !== 'all') conditions.push(eq(financials.type, type));
    if (from) conditions.push(gte(financials.date, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(financials.date, toDate));
    }

    const results = await db.select({
      category: financials.category,
      type: financials.type,
      total: sql<string>`SUM(${financials.amount})`,
      count: sql<string>`COUNT(*)`,
    })
      .from(financials)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(financials.category, financials.type)
      .orderBy(sql`SUM(${financials.amount}) DESC`);

    return res.json(results);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Monthly trend (last 12 months, vendor-scoped)
router.get('/monthly-trend', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;

    const conditions: any[] = [];
    if (vendorId) conditions.push(eq(financials.vendorId, vendorId));
    // last 12 months
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    conditions.push(gte(financials.date, since));

    const results = await db.select({
      month: sql<string>`TO_CHAR(${financials.date}, 'YYYY-MM')`,
      type: financials.type,
      total: sql<string>`SUM(${financials.amount})`,
    })
      .from(financials)
      .where(and(...conditions))
      .groupBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`, financials.type)
      .orderBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`);

    // pivot into { month, income, expense, salary, maintenance, net }[]
    const monthMap: Record<string, any> = {};
    for (const row of results) {
      if (!monthMap[row.month]) {
        monthMap[row.month] = { month: row.month, income: 0, expense: 0, salary: 0, maintenance: 0 };
      }
      const amt = parseFloat(row.total ?? '0');
      if (row.type === 'income') monthMap[row.month].income = amt;
      else if (row.type === 'expense') monthMap[row.month].expense = amt;
      else if (row.type === 'salary') monthMap[row.month].salary = amt;
      else if (row.type === 'maintenance') monthMap[row.month].maintenance = amt;
    }

    const trend = Object.values(monthMap).map((m: any) => ({
      ...m,
      net: m.income - m.expense - m.salary - m.maintenance,
    }));

    return res.json(trend);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Create financial record (vendor-scoped)
router.post('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const data = financialSchema.parse(req.body);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد حساب مغسلة' });

    const [record] = await db.insert(financials).values({
      ...data,
      vendorId,
      date: data.date ? new Date(data.date) : new Date(),
      referenceType: 'manual',
      createdBy: req.user!.id,
    }).returning();

    return res.status(201).json(record);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Update financial record
router.put('/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId;
    const data = financialSchema.parse(req.body);

    const [updated] = await db.update(financials)
      .set({
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
      })
      .where(and(eq(financials.id, id), vendorId ? eq(financials.vendorId, vendorId) : sql`true`))
      .returning();

    if (!updated) return res.status(404).json({ error: 'السجل غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Delete financial record
router.delete('/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId;

    await db.delete(financials).where(
      and(eq(financials.id, id), vendorId ? eq(financials.vendorId, vendorId) : sql`true`)
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
