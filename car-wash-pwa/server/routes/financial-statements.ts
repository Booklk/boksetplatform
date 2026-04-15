import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, financials, bookings, invoices, payments, inventory, fleetVehicles, payrollRecords, supplierOrders } from '../db/schema.js';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import * as XLSX from 'xlsx';

const router = Router();
const VAT_RATE = 0.15;

// ── Helper: fetch vendor identity ────────────────────────────────────────────
async function getVendorIdentity(vendorId: number) {
  const [v] = await db.select({
    nameAr: vendors.nameAr, nameEn: vendors.nameEn, logoUrl: vendors.logoUrl,
    phone: vendors.phone, email: vendors.email, address: vendors.address, city: vendors.city,
    crNumber: vendors.crNumber, vatNumber: vendors.vatNumber, nationalAddress: vendors.nationalAddress,
    bankName: vendors.bankName, bankIban: vendors.bankIban, ownerName: vendors.ownerName,
    businessType: vendors.businessType, maroofNumber: vendors.maroofNumber,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return v;
}

// ── Helper: aggregate financials by type/category ────────────────────────────
async function getFinancialAggregates(vendorId: number, from: Date, to: Date) {
  const records = await db.select({
    type: financials.type,
    category: financials.category,
    total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
    count: count(financials.id),
  }).from(financials).where(and(
    eq(financials.vendorId, vendorId),
    gte(financials.date, from),
    lte(financials.date, to),
  )).groupBy(financials.type, financials.category);
  return records;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /income-statement — قائمة الدخل
// ══════════════════════════════════════════════════════════════════════════════
router.get('/income-statement', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const identity = await getVendorIdentity(vendorId);
    const agg = await getFinancialAggregates(vendorId, from, to);

    // Revenue breakdown
    const incomeRecords = agg.filter(r => r.type === 'income');
    const revenueByCategory: Record<string, number> = {};
    let totalRevenue = 0;
    for (const r of incomeRecords) {
      const cat = r.category ?? 'أخرى';
      const amt = parseFloat(r.total);
      revenueByCategory[cat] = (revenueByCategory[cat] ?? 0) + amt;
      totalRevenue += amt;
    }

    // Expense breakdown
    const expenseTypes = ['expense', 'salary', 'maintenance'];
    const expenseRecords = agg.filter(r => expenseTypes.includes(r.type));
    const expenseByCategory: Record<string, number> = {};
    let totalExpenses = 0;
    for (const r of expenseRecords) {
      const cat = r.type === 'salary' ? 'رواتب وأجور' : r.type === 'maintenance' ? 'صيانة ومعدات' : (r.category ?? 'أخرى');
      const amt = parseFloat(r.total);
      expenseByCategory[cat] = (expenseByCategory[cat] ?? 0) + amt;
      totalExpenses += amt;
    }

    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const vatCollected = totalRevenue * VAT_RATE / (1 + VAT_RATE);

    return res.json({
      vendorIdentity: identity,
      period: { from, to },
      revenue: {
        breakdown: revenueByCategory,
        total: Math.round(totalRevenue * 100) / 100,
      },
      expenses: {
        breakdown: expenseByCategory,
        total: Math.round(totalExpenses * 100) / 100,
      },
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: Math.round(profitMargin * 100) / 100,
      vatCollected: Math.round(vatCollected * 100) / 100,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إعداد قائمة الدخل' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. GET /balance-sheet — قائمة المركز المالي
// ══════════════════════════════════════════════════════════════════════════════
router.get('/balance-sheet', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const identity = await getVendorIdentity(vendorId);

    // Assets: cash (paid bookings)
    const [cashRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${payments.amount} AS numeric)), 0)`,
    }).from(payments).where(and(eq(payments.vendorId, vendorId), eq(payments.status, 'paid')));

    // Assets: receivables (unpaid invoices)
    const [receivablesRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${invoices.totalAmount} AS numeric)), 0)`,
    }).from(invoices).where(and(eq(invoices.vendorId, vendorId), eq(invoices.status, 'sent')));

    // Assets: inventory value
    const [inventoryRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${inventory.quantity} AS numeric) * CAST(${inventory.costPerUnit} AS numeric)), 0)`,
    }).from(inventory).where(eq(inventory.vendorId, vendorId));

    // Assets: fleet value (sum of purchase/maintenance costs)
    const [fleetRow] = await db.select({
      count: count(fleetVehicles.id),
    }).from(fleetVehicles).where(and(eq(fleetVehicles.vendorId, vendorId), eq(fleetVehicles.status, 'active')));

    const cash = parseFloat(cashRow?.total ?? '0');
    const receivables = parseFloat(receivablesRow?.total ?? '0');
    const inventoryValue = parseFloat(inventoryRow?.total ?? '0');
    const totalAssets = cash + receivables + inventoryValue;

    // Liabilities: unpaid supplier orders
    const [suppliersRow] = await db.select({
      total: sql<string>`COUNT(*)`,
    }).from(supplierOrders).where(and(eq(supplierOrders.vendorId, vendorId), eq(supplierOrders.status, 'sent')));

    // Liabilities: unpaid payroll
    const [payrollRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${payrollRecords.totalAmount} AS numeric)), 0)`,
    }).from(payrollRecords).where(and(eq(payrollRecords.vendorId, vendorId), eq(payrollRecords.status, 'pending')));

    // Liabilities: VAT owed (15% of total income this quarter)
    const quarterStart = new Date();
    quarterStart.setMonth(quarterStart.getMonth() - 3);
    const [vatRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId), eq(financials.type, 'income'),
      gte(financials.date, quarterStart),
    ));

    const unpaidPayroll = parseFloat(payrollRow?.total ?? '0');
    const vatOwed = parseFloat(vatRow?.total ?? '0') * VAT_RATE / (1 + VAT_RATE);
    const totalLiabilities = unpaidPayroll + vatOwed;

    const equity = totalAssets - totalLiabilities;

    return res.json({
      vendorIdentity: identity,
      date: new Date(),
      assets: {
        cash: Math.round(cash * 100) / 100,
        receivables: Math.round(receivables * 100) / 100,
        inventory: Math.round(inventoryValue * 100) / 100,
        fleetCount: Number(fleetRow?.count ?? 0),
        total: Math.round(totalAssets * 100) / 100,
      },
      liabilities: {
        unpaidPayroll: Math.round(unpaidPayroll * 100) / 100,
        vatOwed: Math.round(vatOwed * 100) / 100,
        total: Math.round(totalLiabilities * 100) / 100,
      },
      equity: Math.round(equity * 100) / 100,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إعداد المركز المالي' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. GET /cash-flow — قائمة التدفقات النقدية
// ══════════════════════════════════════════════════════════════════════════════
router.get('/cash-flow', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const identity = await getVendorIdentity(vendorId);

    // Operating: inflows (income)
    const [inflowRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId), eq(financials.type, 'income'),
      gte(financials.date, from), lte(financials.date, to),
    ));

    // Operating: outflows (expenses + salaries)
    const [outflowRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId),
      sql`${financials.type} IN ('expense', 'salary')`,
      gte(financials.date, from), lte(financials.date, to),
    ));

    // Investing: maintenance/fleet
    const [investRow] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId), eq(financials.type, 'maintenance'),
      gte(financials.date, from), lte(financials.date, to),
    ));

    const operatingInflow = parseFloat(inflowRow?.total ?? '0');
    const operatingOutflow = parseFloat(outflowRow?.total ?? '0');
    const investingOutflow = parseFloat(investRow?.total ?? '0');
    const netOperating = operatingInflow - operatingOutflow;
    const netCashFlow = netOperating - investingOutflow;

    return res.json({
      vendorIdentity: identity,
      period: { from, to },
      operating: {
        inflow: Math.round(operatingInflow * 100) / 100,
        outflow: Math.round(operatingOutflow * 100) / 100,
        net: Math.round(netOperating * 100) / 100,
      },
      investing: {
        outflow: Math.round(investingOutflow * 100) / 100,
      },
      netCashFlow: Math.round(netCashFlow * 100) / 100,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إعداد التدفقات النقدية' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. GET /summary — ملخص مالي سريع
// ══════════════════════════════════════════════════════════════════════════════
router.get('/summary', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const identity = await getVendorIdentity(vendorId);
    const agg = await getFinancialAggregates(vendorId, from, to);

    const totalRevenue = agg.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.total), 0);
    const totalExpenses = agg.filter(r => r.type !== 'income').reduce((s, r) => s + parseFloat(r.total), 0);
    const netProfit = totalRevenue - totalExpenses;

    // Invoices
    const [paidInv] = await db.select({ c: count() }).from(invoices)
      .where(and(eq(invoices.vendorId, vendorId), eq(invoices.status, 'paid')));
    const [unpaidInv] = await db.select({ c: count() }).from(invoices)
      .where(and(eq(invoices.vendorId, vendorId), sql`${invoices.status} IN ('draft', 'sent', 'overdue')`));

    // Previous period comparison
    const periodLength = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - periodLength);
    const prevTo = new Date(from.getTime());
    const prevAgg = await getFinancialAggregates(vendorId, prevFrom, prevTo);
    const prevRevenue = prevAgg.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.total), 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    return res.json({
      vendorIdentity: identity,
      period: { from, to },
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      vatOwed: Math.round(totalRevenue * VAT_RATE / (1 + VAT_RATE) * 100) / 100,
      paidInvoices: Number(paidInv?.c ?? 0),
      unpaidInvoices: Number(unpaidInv?.c ?? 0),
      revenueChange: Math.round(revenueChange * 100) / 100,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في إعداد الملخص المالي' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. GET /export/:type — تصدير القائمة المالية (Excel)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/export/:type', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const { type } = req.params;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();

    const identity = await getVendorIdentity(vendorId);
    const wb = XLSX.utils.book_new();

    // ── Cover sheet with vendor identity ──
    const coverData = [
      ['بيانات المنشأة'],
      ['اسم المنشأة', identity?.nameAr ?? ''],
      ['الاسم بالإنجليزية', identity?.nameEn ?? ''],
      ['رقم السجل التجاري', identity?.crNumber ?? ''],
      ['الرقم الضريبي', identity?.vatNumber ?? ''],
      ['العنوان الوطني', identity?.nationalAddress ?? ''],
      ['المدينة', identity?.city ?? ''],
      ['الهاتف', identity?.phone ?? ''],
      ['البريد الإلكتروني', identity?.email ?? ''],
      ['اسم البنك', identity?.bankName ?? ''],
      ['IBAN', identity?.bankIban ?? ''],
      ['اسم المالك', identity?.ownerName ?? ''],
      ['نوع المنشأة', identity?.businessType ?? ''],
      ['رقم معروف', identity?.maroofNumber ?? ''],
      [],
      ['فترة التقرير', `${from.toLocaleDateString('ar-SA')} — ${to.toLocaleDateString('ar-SA')}`],
      ['تاريخ الإصدار', new Date().toLocaleDateString('ar-SA')],
      [],
      ['تم إنشاء هذا التقرير من منصة Jdawil — jdawil.com'],
    ];
    const coverSheet = XLSX.utils.aoa_to_sheet(coverData);
    coverSheet['!cols'] = [{ wch: 25 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, coverSheet, 'بيانات المنشأة');

    // ── Data sheet based on type ──
    if (type === 'income-statement') {
      const agg = await getFinancialAggregates(vendorId, from, to);
      const incomeRecords = agg.filter(r => r.type === 'income');
      const expenseRecords = agg.filter(r => r.type !== 'income');
      const totalRevenue = incomeRecords.reduce((s, r) => s + parseFloat(r.total), 0);
      const totalExpenses = expenseRecords.reduce((s, r) => s + parseFloat(r.total), 0);

      const rows: (string | number)[][] = [
        [`قائمة الدخل — ${identity?.nameAr ?? ''}`, '', ''],
        [`رقم السجل التجاري: ${identity?.crNumber ?? 'غير محدد'}`, `الرقم الضريبي: ${identity?.vatNumber ?? 'غير محدد'}`, ''],
        [`الفترة: ${from.toLocaleDateString('ar-SA')} — ${to.toLocaleDateString('ar-SA')}`, '', ''],
        [],
        ['البند', 'الفئة', 'المبلغ (ر.س)'],
        ['═══ الإيرادات ═══', '', ''],
        ...incomeRecords.map(r => ['إيرادات', r.category ?? 'أخرى', parseFloat(r.total).toFixed(2)]),
        ['إجمالي الإيرادات', '', totalRevenue.toFixed(2)],
        [],
        ['═══ المصروفات ═══', '', ''],
        ...expenseRecords.map(r => [r.type === 'salary' ? 'رواتب' : r.type === 'maintenance' ? 'صيانة' : 'مصروف', r.category ?? 'أخرى', parseFloat(r.total).toFixed(2)]),
        ['إجمالي المصروفات', '', totalExpenses.toFixed(2)],
        [],
        ['صافي الربح', '', (totalRevenue - totalExpenses).toFixed(2)],
        ['هامش الربح', '', totalRevenue > 0 ? `${((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1)}%` : '0%'],
        ['ضريبة القيمة المضافة المستحقة', '', (totalRevenue * VAT_RATE / (1 + VAT_RATE)).toFixed(2)],
      ];
      const dataSheet = XLSX.utils.aoa_to_sheet(rows);
      dataSheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'قائمة الدخل');

    } else if (type === 'balance-sheet') {
      // Simplified balance sheet export
      const rows: (string | number)[][] = [
        [`قائمة المركز المالي — ${identity?.nameAr ?? ''}`, '', ''],
        [`رقم السجل التجاري: ${identity?.crNumber ?? 'غير محدد'}`, `الرقم الضريبي: ${identity?.vatNumber ?? 'غير محدد'}`, ''],
        [`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, '', ''],
        [],
        ['البند', '', 'المبلغ (ر.س)'],
        ['═══ الأصول ═══', '', ''],
        ['(يرجى الاطلاع على التقرير التفصيلي عبر المنصة)', '', ''],
        [],
        ['═══ الالتزامات ═══', '', ''],
        ['(يرجى الاطلاع على التقرير التفصيلي عبر المنصة)', '', ''],
      ];
      const dataSheet = XLSX.utils.aoa_to_sheet(rows);
      dataSheet['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'المركز المالي');

    } else if (type === 'cash-flow') {
      const agg = await getFinancialAggregates(vendorId, from, to);
      const inflow = agg.filter(r => r.type === 'income').reduce((s, r) => s + parseFloat(r.total), 0);
      const outflow = agg.filter(r => r.type === 'expense' || r.type === 'salary').reduce((s, r) => s + parseFloat(r.total), 0);
      const invest = agg.filter(r => r.type === 'maintenance').reduce((s, r) => s + parseFloat(r.total), 0);

      const rows: (string | number)[][] = [
        [`قائمة التدفقات النقدية — ${identity?.nameAr ?? ''}`, ''],
        [`رقم السجل التجاري: ${identity?.crNumber ?? 'غير محدد'}`, `الرقم الضريبي: ${identity?.vatNumber ?? 'غير محدد'}`],
        [`الفترة: ${from.toLocaleDateString('ar-SA')} — ${to.toLocaleDateString('ar-SA')}`, ''],
        [],
        ['البند', 'المبلغ (ر.س)'],
        ['═══ التدفقات التشغيلية ═══', ''],
        ['المقبوضات من العملاء', inflow.toFixed(2)],
        ['المدفوعات (مصروفات + رواتب)', `-${outflow.toFixed(2)}`],
        ['صافي التدفق التشغيلي', (inflow - outflow).toFixed(2)],
        [],
        ['═══ التدفقات الاستثمارية ═══', ''],
        ['شراء معدات وصيانة', `-${invest.toFixed(2)}`],
        [],
        ['صافي التدفق النقدي', (inflow - outflow - invest).toFixed(2)],
      ];
      const dataSheet = XLSX.utils.aoa_to_sheet(rows);
      dataSheet['!cols'] = [{ wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'التدفقات النقدية');
    } else {
      return res.status(400).json({ error: 'نوع التقرير غير صالح. الأنواع: income-statement, balance-sheet, cash-flow' });
    }

    const typeNames: Record<string, string> = {
      'income-statement': 'قائمة-الدخل',
      'balance-sheet': 'المركز-المالي',
      'cash-flow': 'التدفقات-النقدية',
    };
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${typeNames[type] ?? type}-${identity?.nameAr ?? ''}-${new Date().toLocaleDateString('ar-SA')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تصدير القائمة المالية' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. PUT /vendor-identity — تحديث بيانات الهوية التجارية
// ══════════════════════════════════════════════════════════════════════════════
router.put('/vendor-identity', requireAuth, requireRole('vendor_admin', 'admin'), audit('vendor.identity.update'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const body = z.object({
      crNumber: z.string().optional(),
      vatNumber: z.string().optional(),
      nationalAddress: z.string().optional(),
      bankName: z.string().optional(),
      bankIban: z.string().optional(),
      ownerName: z.string().optional(),
      businessType: z.string().optional(),
      maroofNumber: z.string().optional(),
    }).parse(req.body);

    const [updated] = await db.update(vendors)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();

    return res.json({
      success: true,
      vendorIdentity: await getVendorIdentity(vendorId),
    });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تحديث الهوية التجارية' });
  }
});

export default router;
