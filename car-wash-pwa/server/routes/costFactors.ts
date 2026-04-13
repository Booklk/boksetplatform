import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { washCostFactors, bookings, payrollRecords, employeeSalaryConfig, users } from '../db/schema.js';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const factorSchema = z.object({
  name: z.string().min(1).max(100),
  nameKey: z.string().optional(),
  costPerWash: z.string(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

// Default cost factors to seed for a new vendor
const DEFAULT_FACTORS = [
  { name: 'صابون وكيماويات', nameKey: 'soap', costPerWash: '1.50', unit: 'ريال', sortOrder: 1 },
  { name: 'ماء', nameKey: 'water', costPerWash: '1.00', unit: 'ريال', sortOrder: 2 },
  { name: 'مناشف وفوط', nameKey: 'towels', costPerWash: '0.50', unit: 'ريال', sortOrder: 3 },
  { name: 'فرش واستهلاك معدات', nameKey: 'brushes', costPerWash: '0.75', unit: 'ريال', sortOrder: 4 },
  { name: 'وقود (بنزين)', nameKey: 'fuel', costPerWash: '4.00', unit: 'ريال', sortOrder: 5 },
  { name: 'معطر وعطور', nameKey: 'fragrance', costPerWash: '0.50', unit: 'ريال', sortOrder: 6 },
];

// GET all cost factors for vendor
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد حساب مغسلة' });

    let factors = await db.select().from(washCostFactors)
      .where(eq(washCostFactors.vendorId, vendorId))
      .orderBy(washCostFactors.sortOrder, washCostFactors.id);

    // Auto-seed defaults if this vendor has none
    if (factors.length === 0) {
      const seeded = await db.insert(washCostFactors).values(
        DEFAULT_FACTORS.map(f => ({ ...f, vendorId }))
      ).returning();
      factors = seeded;
    }

    return res.json(factors);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST create new factor
router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد حساب مغسلة' });

    const data = factorSchema.parse(req.body);
    const [factor] = await db.insert(washCostFactors)
      .values({ ...data, vendorId })
      .returning();

    return res.status(201).json(factor);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT update factor
router.put('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId;
    const data = factorSchema.parse(req.body);

    const [updated] = await db.update(washCostFactors)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(washCostFactors.id, id), vendorId ? eq(washCostFactors.vendorId, vendorId) : sql`true`))
      .returning();

    if (!updated) return res.status(404).json({ error: 'غير موجود' });
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE factor
router.delete('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const vendorId = req.user!.vendorId;
    await db.delete(washCostFactors).where(
      and(eq(washCostFactors.id, id), vendorId ? eq(washCostFactors.vendorId, vendorId) : sql`true`)
    );
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET profit analysis for a date range
// Returns: total washes, total revenue, total cost, net profit per wash, per day
router.get('/profit-analysis', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد حساب مغسلة' });

    const { from, to, period = 'this_month' } = req.query as Record<string, string>;

    // Resolve date range
    let fromDate: Date, toDate: Date;
    const now = new Date();
    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to); toDate.setHours(23, 59, 59, 999);
    } else if (period === 'today') {
      fromDate = new Date(now.toDateString());
      toDate = new Date(); toDate.setHours(23, 59, 59, 999);
    } else if (period === 'this_week') {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - now.getDay());
      toDate = new Date(); toDate.setHours(23, 59, 59, 999);
    } else { // this_month default
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(); toDate.setHours(23, 59, 59, 999);
    }

    // Get completed bookings in range
    const completedBookings = await db.select({
      id: bookings.id,
      totalPrice: bookings.totalPrice,
      updatedAt: bookings.updatedAt,
    }).from(bookings)
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'completed'),
        gte(bookings.updatedAt, fromDate),
        lte(bookings.updatedAt, toDate)
      ));

    const totalWashes = completedBookings.length;
    const totalRevenue = completedBookings.reduce((s, b) => s + parseFloat(b.totalPrice ?? '0'), 0);

    // Get active cost factors
    const factors = await db.select().from(washCostFactors)
      .where(and(eq(washCostFactors.vendorId, vendorId), eq(washCostFactors.isActive, true)));

    // Cost per wash from factors (excluding salary — handled separately)
    const salaryFactor = factors.find(f => f.nameKey === 'salary');
    const nonSalaryFactors = factors.filter(f => f.nameKey !== 'salary');
    const costPerWashFixed = nonSalaryFactors.reduce((s, f) => s + parseFloat(f.costPerWash ?? '0'), 0);

    // Calculate salary cost per wash
    // Get total monthly salary for vendor employees
    const salaryConfigs = await db.select({
      baseSalary: employeeSalaryConfig.baseSalary,
    }).from(employeeSalaryConfig)
      .innerJoin(users, eq(employeeSalaryConfig.employeeId, users.id))
      .where(eq(users.vendorId, vendorId));

    const totalMonthlySalary = salaryConfigs.reduce((s, e) => s + parseFloat(e.baseSalary ?? '0'), 0);
    const daysInPeriod = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)));
    const washesPerDay = totalWashes > 0 ? totalWashes / daysInPeriod : 1;
    const salaryPerWash = washesPerDay > 0 ? (totalMonthlySalary / 30 / washesPerDay) : 0;

    const totalCostPerWash = costPerWashFixed + salaryPerWash;
    const totalCost = totalCostPerWash * totalWashes;
    const netProfit = totalRevenue - totalCost;
    const profitPerWash = totalWashes > 0 ? netProfit / totalWashes : 0;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0;

    // Breakdown per factor
    const costBreakdown = [
      ...nonSalaryFactors.map(f => ({
        name: f.name,
        nameKey: f.nameKey,
        costPerWash: parseFloat(f.costPerWash ?? '0'),
        totalCost: parseFloat(f.costPerWash ?? '0') * totalWashes,
        pct: totalCost > 0 ? (parseFloat(f.costPerWash ?? '0') / totalCostPerWash * 100) : 0,
      })),
      {
        name: 'رواتب العمالة',
        nameKey: 'salary',
        costPerWash: parseFloat(salaryPerWash.toFixed(2)),
        totalCost: parseFloat((salaryPerWash * totalWashes).toFixed(2)),
        pct: totalCost > 0 ? (salaryPerWash / totalCostPerWash * 100) : 0,
      },
    ];

    return res.json({
      period: { from: fromDate, to: toDate, days: daysInPeriod },
      totalWashes,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      profitPerWash: parseFloat(profitPerWash.toFixed(2)),
      profitMargin: parseFloat(profitMargin.toFixed(1)),
      costPerWash: parseFloat(totalCostPerWash.toFixed(2)),
      averageRevenuePerWash: totalWashes > 0 ? parseFloat((totalRevenue / totalWashes).toFixed(2)) : 0,
      monthlySalaryTotal: parseFloat(totalMonthlySalary.toFixed(2)),
      salaryPerWash: parseFloat(salaryPerWash.toFixed(2)),
      costBreakdown,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
