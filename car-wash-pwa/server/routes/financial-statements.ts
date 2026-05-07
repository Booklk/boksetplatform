import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { vendors, financials, bookings, invoices, payments, inventory, fleetVehicles, payrollRecords, supplierOrders } from '../db/schema.js';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { audit } from '../middleware/audit.js';
import ExcelJS from 'exceljs';

// Compatibility shim — reproduces the XLSX subset this file used so the
// SheetJS-specific call shape stays unchanged. exceljs is the underlying
// engine (xlsx had unfixed prototype-pollution + ReDoS advisories).
type Cell = string | number;
interface Sheet {
  rows: Cell[][];
  cols: { wch: number }[];
}
const XLSXShim = {
  utils: {
    book_new: () => ({ sheets: [] as Array<{ name: string; sheet: Sheet }> }),
    aoa_to_sheet: (rows: Cell[][]): Sheet => ({ rows: rows.map((r) => [...r]), cols: [] }),
    book_append_sheet: (
      wb: { sheets: Array<{ name: string; sheet: Sheet }> },
      sheet: Sheet,
      name: string,
    ) => { wb.sheets.push({ name, sheet }); },
  },
  write: async (wb: { sheets: Array<{ name: string; sheet: Sheet }> }): Promise<Buffer> => {
    const out = new ExcelJS.Workbook();
    out.creator = 'Jdawil';
    out.created = new Date();
    for (const { name, sheet } of wb.sheets) {
      const ws = out.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true }] });
      if (sheet.cols.length) ws.columns = sheet.cols.map((c) => ({ width: c.wch }));
      for (const row of sheet.rows) ws.addRow(row);
    }
    const buf = await out.xlsx.writeBuffer();
    return Buffer.from(buf);
  },
};
const XLSX = XLSXShim;

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
      ['تم إنشاء هذا التقرير من منصة Jdawil — jdawil.sa'],
    ];
    const coverSheet = XLSX.utils.aoa_to_sheet(coverData);
    coverSheet.cols = [{ wch: 25 }, { wch: 40 }];
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
      dataSheet.cols = [{ wch: 25 }, { wch: 20 }, { wch: 18 }];
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
      dataSheet.cols = [{ wch: 40 }, { wch: 15 }, { wch: 18 }];
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
      dataSheet.cols = [{ wch: 35 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'التدفقات النقدية');
    } else {
      return res.status(400).json({ error: 'نوع التقرير غير صالح. الأنواع: income-statement, balance-sheet, cash-flow' });
    }

    const typeNames: Record<string, string> = {
      'income-statement': 'قائمة-الدخل',
      'balance-sheet': 'المركز-المالي',
      'cash-flow': 'التدفقات-النقدية',
    };
    const buf = await XLSX.write(wb);
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

/* ══════════════════════════════════════════════════════════════════════════
   Professional financial statements export (Pro feature).
   One Excel file, multiple sheets:
     - Cover     : vendor identity + report period
     - P&L       : annual income statement
     - Monthly   : month-by-month breakdown for the selected year(s)
     - Expenses  : breakdown by category with % of total
     - Cashflow  : simplified cash in / cash out timeline
     - YoY       : year-over-year comparison when >= 2 years selected
   ────────────────────────────────────────────────────────────────────────── */

async function getMonthlyBreakdown(vendorId: number, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const rows = await db.select({
    type: financials.type,
    month: sql<number>`EXTRACT(MONTH FROM ${financials.date})::int`,
    total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
  }).from(financials)
    .where(and(
      eq(financials.vendorId, vendorId),
      gte(financials.date, yearStart),
      lte(financials.date, yearEnd),
    ))
    .groupBy(sql`EXTRACT(MONTH FROM ${financials.date})`, financials.type);

  // Pivot to 12 months × type
  const pivot: Record<number, { income: number; expense: number; salary: number; maintenance: number }> = {};
  for (let m = 1; m <= 12; m++) pivot[m] = { income: 0, expense: 0, salary: 0, maintenance: 0 };
  for (const r of rows) {
    const m = Number(r.month);
    const amt = parseFloat(r.total);
    if (r.type === 'income') pivot[m].income += amt;
    else if (r.type === 'salary') pivot[m].salary += amt;
    else if (r.type === 'maintenance') pivot[m].maintenance += amt;
    else pivot[m].expense += amt;
  }
  return pivot;
}

async function getYearTotals(vendorId: number, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const rows = await db.select({
    type: financials.type,
    total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
  }).from(financials)
    .where(and(
      eq(financials.vendorId, vendorId),
      gte(financials.date, yearStart),
      lte(financials.date, yearEnd),
    ))
    .groupBy(financials.type);

  const totals = { income: 0, expense: 0, salary: 0, maintenance: 0 };
  for (const r of rows) {
    const amt = parseFloat(r.total);
    if (r.type === 'income') totals.income += amt;
    else if (r.type === 'salary') totals.salary += amt;
    else if (r.type === 'maintenance') totals.maintenance += amt;
    else totals.expense += amt;
  }
  return totals;
}

async function getExpensesByCategory(vendorId: number, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  const rows = await db.select({
    type: financials.type,
    category: financials.category,
    total: sql<string>`COALESCE(SUM(CAST(${financials.amount} AS numeric)), 0)`,
  }).from(financials)
    .where(and(
      eq(financials.vendorId, vendorId),
      gte(financials.date, yearStart),
      lte(financials.date, yearEnd),
    ))
    .groupBy(financials.type, financials.category);

  const expenses = rows.filter((r) => r.type !== 'income');
  return expenses.map((r) => ({
    type: r.type,
    category: r.category ?? 'غير مصنّف',
    amount: parseFloat(r.total),
  }));
}

// GET /api/financial-statements/export-professional?years=2024,2025
router.get('/export-professional', requireAuth, requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId!;
      const yearsParam = (req.query.years as string | undefined)?.trim();
      const years = yearsParam
        ? Array.from(new Set(yearsParam.split(',').map((y) => parseInt(y.trim(), 10))))
            .filter((y) => Number.isFinite(y) && y >= 2015 && y <= 2100)
            .sort((a, b) => b - a)
        : [new Date().getFullYear()];

      if (years.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد سنة واحدة على الأقل' });
      }

      const identity = await getVendorIdentity(vendorId);
      const wb = XLSX.utils.book_new();
      const MONTHS_AR = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
      ];
      const fmt = (n: number) => n.toFixed(2);

      /* ─── 1. Cover sheet ────────────────────────────────────────────── */
      const coverRows: (string | number)[][] = [
        ['القوائم المالية الاحترافية'],
        [`المنشأة: ${identity?.nameAr ?? ''}`],
        [],
        ['بيانات المنشأة', ''],
        ['السجل التجاري', identity?.crNumber ?? '—'],
        ['الرقم الضريبي', identity?.vatNumber ?? '—'],
        ['العنوان الوطني', identity?.nationalAddress ?? '—'],
        ['المدينة', identity?.city ?? '—'],
        ['الهاتف', identity?.phone ?? '—'],
        ['البريد الإلكتروني', identity?.email ?? '—'],
        ['البنك', identity?.bankName ?? '—'],
        ['IBAN', identity?.bankIban ?? '—'],
        ['المالك', identity?.ownerName ?? '—'],
        [],
        ['نطاق التقرير', years.map(String).join('، ')],
        ['تاريخ الإصدار', new Date().toLocaleDateString('ar-SA')],
        [],
        ['تم إنشاء هذا التقرير من منصة جداول (jdawil) — jdawil.sa'],
      ];
      const cover = XLSX.utils.aoa_to_sheet(coverRows);
      cover.cols = [{ wch: 28 }, { wch: 44 }];
      XLSX.utils.book_append_sheet(wb, cover, 'الغلاف');

      /* ─── 2. Annual P&L ─────────────────────────────────────────────── */
      const pnlHeader: (string | number)[] = ['البند'];
      for (const y of years) pnlHeader.push(String(y));
      const pnlRows: (string | number)[][] = [
        [`قائمة الدخل — ${identity?.nameAr ?? ''}`],
        ['جميع المبالغ بالريال السعودي (شاملة ضريبة القيمة المضافة ١٥٪)'],
        [],
        pnlHeader,
      ];

      const yearlyTotals: Record<number, Awaited<ReturnType<typeof getYearTotals>>> = {};
      for (const y of years) yearlyTotals[y] = await getYearTotals(vendorId, y);

      const revRow: (string | number)[] = ['الإيرادات'];
      const expRow: (string | number)[] = ['المصروفات التشغيلية'];
      const salRow: (string | number)[] = ['الرواتب'];
      const mntRow: (string | number)[] = ['الصيانة'];
      const totExpRow: (string | number)[] = ['إجمالي المصروفات'];
      const netRow: (string | number)[] = ['صافي الربح'];
      const marginRow: (string | number)[] = ['هامش الربح ٪'];
      const vatRow: (string | number)[] = ['ضريبة القيمة المضافة المستحقة'];

      for (const y of years) {
        const t = yearlyTotals[y];
        const totalExp = t.expense + t.salary + t.maintenance;
        const net = t.income - totalExp;
        const margin = t.income > 0 ? (net / t.income) * 100 : 0;
        const vat = t.income * VAT_RATE / (1 + VAT_RATE);
        revRow.push(fmt(t.income));
        expRow.push(fmt(t.expense));
        salRow.push(fmt(t.salary));
        mntRow.push(fmt(t.maintenance));
        totExpRow.push(fmt(totalExp));
        netRow.push(fmt(net));
        marginRow.push(`${margin.toFixed(1)}%`);
        vatRow.push(fmt(vat));
      }

      pnlRows.push(revRow, expRow, salRow, mntRow, totExpRow, [], netRow, marginRow, vatRow);
      const pnl = XLSX.utils.aoa_to_sheet(pnlRows);
      pnl.cols = [{ wch: 30 }, ...years.map(() => ({ wch: 15 }))];
      XLSX.utils.book_append_sheet(wb, pnl, 'قائمة الدخل');

      /* ─── 3. Monthly breakdown (one sheet per year) ─────────────────── */
      for (const y of years) {
        const monthly = await getMonthlyBreakdown(vendorId, y);
        const rows: (string | number)[][] = [
          [`التفصيل الشهري — سنة ${y}`],
          [],
          ['الشهر', 'الإيرادات', 'المصروفات', 'الرواتب', 'الصيانة', 'إجمالي المصروفات', 'صافي الربح'],
        ];
        let ytdIncome = 0, ytdExp = 0;
        for (let m = 1; m <= 12; m++) {
          const d = monthly[m];
          const totalExp = d.expense + d.salary + d.maintenance;
          const net = d.income - totalExp;
          ytdIncome += d.income;
          ytdExp += totalExp;
          rows.push([
            MONTHS_AR[m - 1], fmt(d.income), fmt(d.expense), fmt(d.salary), fmt(d.maintenance),
            fmt(totalExp), fmt(net),
          ]);
        }
        rows.push([]);
        rows.push(['الإجمالي السنوي', fmt(ytdIncome), '', '', '', fmt(ytdExp), fmt(ytdIncome - ytdExp)]);
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet.cols = [
          { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
        ];
        XLSX.utils.book_append_sheet(wb, sheet, `شهري ${y}`);
      }

      /* ─── 4. Expense breakdown by category ──────────────────────────── */
      const expRows: (string | number)[][] = [
        ['تحليل المصروفات حسب الفئة'],
        [],
        ['الفئة', 'النوع', ...years.map(String)],
      ];

      // Collect all categories across years for stable row ordering.
      const categoryKey = (r: { type: string; category: string }) => `${r.type}::${r.category}`;
      const catLabel: Record<string, { cat: string; typeLabel: string }> = {};
      const yearCats: Record<number, Record<string, number>> = {};
      for (const y of years) {
        const cats = await getExpensesByCategory(vendorId, y);
        yearCats[y] = {};
        for (const c of cats) {
          const k = categoryKey(c);
          catLabel[k] = {
            cat: c.category,
            typeLabel:
              c.type === 'salary' ? 'رواتب'
              : c.type === 'maintenance' ? 'صيانة'
              : 'مصروف تشغيلي',
          };
          yearCats[y][k] = (yearCats[y][k] ?? 0) + c.amount;
        }
      }
      const allKeys = Object.keys(catLabel);
      // Sort by sum across years descending — heaviest first.
      allKeys.sort((a, b) => {
        const sa = years.reduce((s, y) => s + (yearCats[y][a] ?? 0), 0);
        const sb = years.reduce((s, y) => s + (yearCats[y][b] ?? 0), 0);
        return sb - sa;
      });
      for (const k of allKeys) {
        const r: (string | number)[] = [catLabel[k].cat, catLabel[k].typeLabel];
        for (const y of years) r.push(fmt(yearCats[y][k] ?? 0));
        expRows.push(r);
      }
      // Grand totals
      expRows.push([]);
      const grandRow: (string | number)[] = ['الإجمالي', ''];
      for (const y of years) {
        const total = allKeys.reduce((s, k) => s + (yearCats[y][k] ?? 0), 0);
        grandRow.push(fmt(total));
      }
      expRows.push(grandRow);

      const expSheet = XLSX.utils.aoa_to_sheet(expRows);
      expSheet.cols = [{ wch: 28 }, { wch: 15 }, ...years.map(() => ({ wch: 14 }))];
      XLSX.utils.book_append_sheet(wb, expSheet, 'تحليل المصروفات');

      /* ─── 5. Cashflow (simplified annual) ───────────────────────────── */
      const cashRows: (string | number)[][] = [
        ['قائمة التدفقات النقدية (مبسّطة)'],
        [],
        ['البند', ...years.map(String)],
      ];
      const cashInRow: (string | number)[] = ['تدفق نقدي داخل (إيرادات)'];
      const cashOutRow: (string | number)[] = ['تدفق نقدي خارج (مصروفات + رواتب + صيانة)'];
      const netCashRow: (string | number)[] = ['صافي التدفق النقدي'];
      for (const y of years) {
        const t = yearlyTotals[y];
        const out = t.expense + t.salary + t.maintenance;
        cashInRow.push(fmt(t.income));
        cashOutRow.push(fmt(out));
        netCashRow.push(fmt(t.income - out));
      }
      cashRows.push(cashInRow, cashOutRow, [], netCashRow);
      const cashSheet = XLSX.utils.aoa_to_sheet(cashRows);
      cashSheet.cols = [{ wch: 35 }, ...years.map(() => ({ wch: 16 }))];
      XLSX.utils.book_append_sheet(wb, cashSheet, 'التدفقات النقدية');

      /* ─── 6. YoY comparison (only when >= 2 years) ──────────────────── */
      if (years.length >= 2) {
        const yoyRows: (string | number)[][] = [
          ['المقارنة السنوية'],
          [],
          ['البند', ...years.map(String), 'نمو الأحدث مقابل الأقدم'],
        ];
        const newest = yearlyTotals[years[0]];
        const oldest = yearlyTotals[years[years.length - 1]];
        const pct = (a: number, b: number) => (b === 0 ? '—' : `${(((a - b) / b) * 100).toFixed(1)}%`);
        const newestTotalExp = newest.expense + newest.salary + newest.maintenance;
        const oldestTotalExp = oldest.expense + oldest.salary + oldest.maintenance;

        yoyRows.push(['الإيرادات', ...years.map((y) => fmt(yearlyTotals[y].income)), pct(newest.income, oldest.income)]);
        yoyRows.push(['إجمالي المصروفات', ...years.map((y) => {
          const t = yearlyTotals[y];
          return fmt(t.expense + t.salary + t.maintenance);
        }), pct(newestTotalExp, oldestTotalExp)]);
        yoyRows.push(['صافي الربح', ...years.map((y) => {
          const t = yearlyTotals[y];
          return fmt(t.income - (t.expense + t.salary + t.maintenance));
        }), pct(newest.income - newestTotalExp, oldest.income - oldestTotalExp)]);

        const yoy = XLSX.utils.aoa_to_sheet(yoyRows);
        yoy.cols = [{ wch: 25 }, ...years.map(() => ({ wch: 14 })), { wch: 24 }];
        XLSX.utils.book_append_sheet(wb, yoy, 'مقارنة سنوية');
      }

      /* ─── Ship ──────────────────────────────────────────────────────── */
      const buf = await XLSX.write(wb);
      const filename = `القوائم-المالية-${identity?.nameAr ?? ''}-${years.join('-')}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      return res.send(buf);
    } catch (err) {
      console.error('[export-professional]', err);
      return res.status(500).json({ error: 'تعذّر إنشاء التقرير' });
    }
  },
);

export default router;
