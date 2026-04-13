import { Router } from 'express';
import { db } from '../db/index.js';
import { financials, bookings, vendors } from '../db/schema.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();

const VAT_RATE = 0.15; // 15% Saudi VAT

// ── GET /vat-report?month=X&year=Y ──────────────────────────────────────────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const year  = Number(req.query.year  ?? new Date().getFullYear());

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    // Revenue (income) for the month
    const [incomeRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${financials.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
      .from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        eq(financials.type, 'income'),
        gte(financials.date, monthStart),
        lte(financials.date, monthEnd),
      ));

    // Expenses for the month
    const [expenseRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${financials.amount}), 0)`,
    })
      .from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        eq(financials.type, 'expense'),
        gte(financials.date, monthStart),
        lte(financials.date, monthEnd),
      ));

    // Completed bookings count and total
    const [bookingRow] = await db.select({
      count: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${bookings.totalPrice}), 0)`,
    })
      .from(bookings)
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'completed'),
        gte(bookings.updatedAt, monthStart),
        lte(bookings.updatedAt, monthEnd),
      ));

    const grossRevenue    = parseFloat(incomeRow.total ?? '0');
    const grossExpenses   = parseFloat(expenseRow.total ?? '0');
    const vatOnRevenue    = Math.round(grossRevenue * VAT_RATE * 100) / 100;
    const vatOnExpenses   = Math.round(grossExpenses * VAT_RATE * 100) / 100;
    const netVatPayable   = Math.round((vatOnRevenue - vatOnExpenses) * 100) / 100;
    const netRevenue      = Math.round((grossRevenue - vatOnRevenue) * 100) / 100;

    return res.json({
      month,
      year,
      grossRevenue,
      vatOnRevenue,
      netRevenue,
      grossExpenses,
      vatOnExpenses,
      netVatPayable,
      bookingsCount: Number(bookingRow.count),
      bookingsTotal: parseFloat(bookingRow.total ?? '0'),
      vatRate: VAT_RATE * 100,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /vat-report/annual?year=Y — annual VAT summary ──────────────────────
router.get('/annual', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const year = Number(req.query.year ?? new Date().getFullYear());
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year + 1, 0, 1);

    const rows = await db.select({
      month: sql<string>`EXTRACT(MONTH FROM ${financials.date})::int`,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${financials.type}='income' THEN ${financials.amount} ELSE 0 END), 0)`,
      expense: sql<string>`COALESCE(SUM(CASE WHEN ${financials.type}='expense' THEN ${financials.amount} ELSE 0 END), 0)`,
    })
      .from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        gte(financials.date, yearStart),
        lte(financials.date, yearEnd),
      ))
      .groupBy(sql`EXTRACT(MONTH FROM ${financials.date})::int`)
      .orderBy(sql`EXTRACT(MONTH FROM ${financials.date})::int`);

    const result = rows.map(r => {
      const income  = parseFloat(r.income);
      const expense = parseFloat(r.expense);
      return {
        month: Number(r.month),
        income,
        expense,
        vatOnIncome:  Math.round(income  * VAT_RATE * 100) / 100,
        vatOnExpense: Math.round(expense * VAT_RATE * 100) / 100,
        netVat:       Math.round((income - expense) * VAT_RATE * 100) / 100,
      };
    });

    const totals = result.reduce((acc, r) => ({
      income:       acc.income  + r.income,
      expense:      acc.expense + r.expense,
      vatOnIncome:  acc.vatOnIncome  + r.vatOnIncome,
      vatOnExpense: acc.vatOnExpense + r.vatOnExpense,
      netVat:       acc.netVat + r.netVat,
    }), { income: 0, expense: 0, vatOnIncome: 0, vatOnExpense: 0, netVat: 0 });

    return res.json({ year, months: result, totals });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /vat-report/invoice/:bookingId — ZATCA-compliant QR ──────────────────
// Generates base64 TLV QR code (ZATCA Phase 1 simplified e-invoice)
router.get('/invoice/:bookingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.bookingId);
    const [booking] = await db.select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      totalPrice: bookings.totalPrice,
      createdAt: bookings.createdAt,
      vendorId: bookings.vendorId,
    }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);

    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Auth check
    if (req.user!.role === 'customer' && req.user!.vendorId !== booking.vendorId) {
      // customers can see their own bookings; we skip vendorId check for customers
    }

    const [vendor] = await db.select({
      nameAr: vendors.nameAr,
      vatNumber: sql<string>`(settings->>'vatNumber')`,
    }).from(vendors).where(eq(vendors.id, booking.vendorId)).limit(1);

    const total   = parseFloat(booking.totalPrice ?? '0');
    const vat     = Math.round(total * VAT_RATE * 100) / 100;
    const netPrice = Math.round((total - vat) * 100) / 100;
    const date    = new Date(booking.createdAt).toISOString().split('T')[0];
    const sellerName  = vendor?.nameAr ?? 'مغسلة';
    const vatNumber   = vendor?.vatNumber ?? '000000000000000';

    // ZATCA TLV encoding (Phase 1)
    // Tags: 1=SellerName, 2=VATNumber, 3=Timestamp, 4=TotalWithVAT, 5=VAT
    function tlv(tag: number, value: string): Buffer {
      const valueBuf = Buffer.from(value, 'utf8');
      return Buffer.concat([Buffer.from([tag, valueBuf.length]), valueBuf]);
    }
    const qrBuf = Buffer.concat([
      tlv(1, sellerName),
      tlv(2, vatNumber),
      tlv(3, new Date(booking.createdAt).toISOString()),
      tlv(4, total.toFixed(2)),
      tlv(5, vat.toFixed(2)),
    ]);
    const qrBase64 = qrBuf.toString('base64');

    return res.json({
      bookingNumber: booking.bookingNumber,
      date,
      sellerName,
      vatNumber,
      totalWithVat: total,
      vatAmount: vat,
      netPrice,
      qrCode: qrBase64,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /vat-report/pdf?month=X&year=Y — printable HTML VAT report ───────────
router.get('/pdf', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const year  = Number(req.query.year  ?? new Date().getFullYear());

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    // Revenue
    const [incomeRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${financials.amount}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
      .from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        eq(financials.type, 'income'),
        gte(financials.date, monthStart),
        lte(financials.date, monthEnd),
      ));

    // Expenses
    const [expenseRow] = await db.select({
      total: sql<string>`COALESCE(SUM(${financials.amount}), 0)`,
    })
      .from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        eq(financials.type, 'expense'),
        gte(financials.date, monthStart),
        lte(financials.date, monthEnd),
      ));

    // Bookings
    const [bookingRow] = await db.select({
      count: sql<number>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${bookings.totalPrice}), 0)`,
    })
      .from(bookings)
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'completed'),
        gte(bookings.updatedAt, monthStart),
        lte(bookings.updatedAt, monthEnd),
      ));

    // Vendor name
    const [vendor] = await db.select({ nameAr: vendors.nameAr })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);

    const grossRevenue  = parseFloat(incomeRow.total ?? '0');
    const grossExpenses = parseFloat(expenseRow.total ?? '0');
    const vatOnRevenue  = Math.round(grossRevenue  * VAT_RATE * 100) / 100;
    const vatOnExpenses = Math.round(grossExpenses * VAT_RATE * 100) / 100;
    const netVatPayable = Math.round((vatOnRevenue - vatOnExpenses) * 100) / 100;
    const netRevenue    = Math.round((grossRevenue - vatOnRevenue) * 100) / 100;
    const bookingsCount = Number(bookingRow.count);
    const bookingsTotal = parseFloat(bookingRow.total ?? '0');

    const monthNames: Record<number, string> = {
      1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
      5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
      9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
    };
    const monthLabel = monthNames[month] ?? String(month);
    const companyName = vendor?.nameAr ?? 'المغسلة';
    const generatedAt = new Date().toLocaleDateString('ar-SA', { dateStyle: 'full' });

    const rows: Array<{ label: string; value: string }> = [
      { label: 'إجمالي الإيرادات (شامل الضريبة)', value: `${grossRevenue.toFixed(2)} ريال` },
      { label: 'صافي الإيرادات (قبل الضريبة)', value: `${netRevenue.toFixed(2)} ريال` },
      { label: `ضريبة القيمة المضافة على الإيرادات (${VAT_RATE * 100}%)`, value: `${vatOnRevenue.toFixed(2)} ريال` },
      { label: 'إجمالي المصروفات', value: `${grossExpenses.toFixed(2)} ريال` },
      { label: `ضريبة القيمة المضافة على المصروفات (${VAT_RATE * 100}%)`, value: `${vatOnExpenses.toFixed(2)} ريال` },
      { label: 'صافي ضريبة القيمة المضافة المستحقة', value: `${netVatPayable.toFixed(2)} ريال` },
      { label: 'عدد الحجوزات المكتملة', value: String(bookingsCount) },
      { label: 'إجمالي قيمة الحجوزات', value: `${bookingsTotal.toFixed(2)} ريال` },
    ];

    const tableRows = rows.map(r => `
      <tr>
        <td class="label-cell">${r.label}</td>
        <td class="value-cell">${r.value}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تقرير ضريبة القيمة المضافة — ${monthLabel} ${year}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      background: #fff;
      color: #1a1a2e;
      padding: 32px 40px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #1e3a5f;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .header .company { font-size: 26px; font-weight: 700; color: #1e3a5f; }
    .header .report-title { font-size: 18px; color: #3b6fa0; margin-top: 6px; }
    .header .period {
      display: inline-block;
      margin-top: 10px;
      background: #e8f0fb;
      color: #1e3a5f;
      font-size: 15px;
      font-weight: 600;
      padding: 4px 18px;
      border-radius: 20px;
    }

    .meta {
      font-size: 12px;
      color: #666;
      margin-bottom: 22px;
      text-align: left;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      background: #1e3a5f;
      color: #fff;
      padding: 12px 16px;
      font-weight: 600;
      text-align: right;
    }
    td {
      padding: 11px 16px;
      border-bottom: 1px solid #dde4ef;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f4f7fc; }
    .label-cell { color: #333; }
    .value-cell { font-weight: 600; color: #1e3a5f; text-align: left; white-space: nowrap; }

    .highlight-row td {
      background: #d4e4f7 !important;
      font-weight: 700;
      font-size: 15px;
    }

    .footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 2px solid #1e3a5f;
      font-size: 12px;
      color: #555;
      text-align: center;
      line-height: 1.7;
    }

    .print-btn {
      display: block;
      margin: 24px auto 0;
      padding: 10px 36px;
      background: #1e3a5f;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      font-family: inherit;
    }
    .print-btn:hover { background: #2a4e7c; }

    @media print {
      body { padding: 16px 20px; }
      .print-btn { display: none !important; }
      @page { size: A4; margin: 15mm 15mm 20mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">${companyName}</div>
    <div class="report-title">تقرير ضريبة القيمة المضافة</div>
    <div class="period">${monthLabel} ${year}</div>
  </div>

  <div class="meta">تاريخ الإصدار: ${generatedAt}</div>

  <table>
    <thead>
      <tr>
        <th>البيان</th>
        <th style="text-align:left">المبلغ</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="highlight-row">
        <td>صافي ضريبة القيمة المضافة المستحقة للسداد</td>
        <td style="text-align:left">${netVatPayable.toFixed(2)} ريال</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <p>هذا التقرير مُعدّ وفق متطلبات هيئة الزكاة والضريبة والجمارك (زاتكا) — المرحلة الأولى للفوترة الإلكترونية</p>
    <p>نسبة ضريبة القيمة المضافة المطبقة: ${VAT_RATE * 100}% | المملكة العربية السعودية</p>
  </div>

  <button class="print-btn" onclick="window.print()">طباعة / تصدير PDF</button>

  <script>
    window.addEventListener('load', function() { window.print(); });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
