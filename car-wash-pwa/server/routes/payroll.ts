import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  payrollRecords, employeeSalaryConfig, users, bookings, employeeStats, bonusRules, vendors
} from '../db/schema.js';
import { eq, and, sql, count, sum, avg, isNull } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── GET /payroll/configs — salary configs for all employees ─────────────────
router.get('/configs', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        isActive: users.isActive,
        baseSalary: employeeSalaryConfig.baseSalary,
        commissionRate: employeeSalaryConfig.commissionRate,
        configId: employeeSalaryConfig.id,
      })
      .from(users)
      .leftJoin(employeeSalaryConfig, eq(employeeSalaryConfig.employeeId, users.id))
      .where(and(eq(users.vendorId, vendorId), eq(users.role, 'employee')));
    return res.json(employees);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── PUT /payroll/configs/:employeeId — set salary config ────────────────────
router.put('/configs/:employeeId', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employeeId = Number(req.params.employeeId);
    const data = z.object({
      baseSalary: z.union([z.string(), z.number()]).transform(String),
      commissionRate: z.union([z.string(), z.number()]).transform(String).optional(),
    }).parse(req.body);

    const existing = await db.select().from(employeeSalaryConfig)
      .where(eq(employeeSalaryConfig.employeeId, employeeId)).limit(1);

    if (existing.length) {
      const [updated] = await db.update(employeeSalaryConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(employeeSalaryConfig.employeeId, employeeId))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db.insert(employeeSalaryConfig)
        .values({ employeeId, vendorId, ...data })
        .returning();
      return res.json(created);
    }
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /payroll?month=X&year=Y — payroll records ────────────────────────────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const year  = Number(req.query.year  ?? new Date().getFullYear());

    const records = await db
      .select({
        id: payrollRecords.id,
        employeeId: payrollRecords.employeeId,
        employeeName: users.name,
        employeePhone: users.phone,
        month: payrollRecords.month,
        year: payrollRecords.year,
        baseSalary: payrollRecords.baseSalary,
        commissionAmount: payrollRecords.commissionAmount,
        bonusAmount: payrollRecords.bonusAmount,
        deductions: payrollRecords.deductions,
        totalAmount: payrollRecords.totalAmount,
        bookingsCount: payrollRecords.bookingsCount,
        revenueGenerated: payrollRecords.revenueGenerated,
        notes: payrollRecords.notes,
        status: payrollRecords.status,
        paidAt: payrollRecords.paidAt,
      })
      .from(payrollRecords)
      .leftJoin(users, eq(users.id, payrollRecords.employeeId))
      .where(and(
        eq(payrollRecords.vendorId, vendorId),
        eq(payrollRecords.month, month),
        eq(payrollRecords.year, year),
      ));
    return res.json(records);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── POST /payroll/calculate — auto-calculate payroll for month ───────────────
router.post('/calculate', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const month = Number(req.body.month ?? new Date().getMonth() + 1);
    const year  = Number(req.body.year  ?? new Date().getFullYear());

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    // Get all employees with their configs
    const employees = await db
      .select({
        id: users.id,
        name: users.name,
        baseSalary: employeeSalaryConfig.baseSalary,
        commissionRate: employeeSalaryConfig.commissionRate,
      })
      .from(users)
      .leftJoin(employeeSalaryConfig, eq(employeeSalaryConfig.employeeId, users.id))
      .where(and(eq(users.vendorId, vendorId), eq(users.role, 'employee'), eq(users.isActive, true)));

    const results = [];

    for (const emp of employees) {
      // Count completed bookings & revenue for this employee in this month
      const [stats] = await db
        .select({
          cnt: count(bookings.id),
          rev: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)`,
        })
        .from(bookings)
        .where(and(
          eq(bookings.vendorId, vendorId),
          eq(bookings.employeeId, emp.id),
          eq(bookings.status, 'completed'),
          sql`${bookings.updatedAt} >= ${monthStart}`,
          sql`${bookings.updatedAt} < ${monthEnd}`,
        ));

      const base = parseFloat(emp.baseSalary ?? '0');
      const commRate = parseFloat(emp.commissionRate ?? '0') / 100;
      const revenue = parseFloat(stats.rev ?? '0');
      const commission = Math.round(revenue * commRate * 100) / 100;
      const total = Math.round((base + commission) * 100) / 100;

      // Upsert payroll record
      const existing = await db.select({ id: payrollRecords.id })
        .from(payrollRecords)
        .where(and(
          eq(payrollRecords.vendorId, vendorId),
          eq(payrollRecords.employeeId, emp.id),
          eq(payrollRecords.month, month),
          eq(payrollRecords.year, year),
        )).limit(1);

      const payload = {
        vendorId,
        employeeId: emp.id,
        month,
        year,
        baseSalary: base.toString(),
        commissionRate: (commRate * 100).toString(),
        commissionAmount: commission.toString(),
        bookingsCount: stats.cnt,
        revenueGenerated: revenue.toString(),
        totalAmount: total.toString(),
        updatedAt: new Date(),
      };

      if (existing.length) {
        await db.update(payrollRecords).set(payload).where(eq(payrollRecords.id, existing[0].id));
        results.push({ employeeId: emp.id, name: emp.name, total, updated: true });
      } else {
        await db.insert(payrollRecords).values({ ...payload, status: 'pending' });
        results.push({ employeeId: emp.id, name: emp.name, total, created: true });
      }
    }

    return res.json({ success: true, processed: results.length, results });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── PATCH /payroll/:id — update bonus/deductions/notes ──────────────────────
router.patch('/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = z.object({
      bonusAmount: z.union([z.string(), z.number()]).transform(String).optional(),
      deductions: z.union([z.string(), z.number()]).transform(String).optional(),
      notes: z.string().optional(),
    }).parse(req.body);

    const record = await db.select().from(payrollRecords)
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.vendorId, vendorId))).limit(1);
    if (!record.length) return res.status(404).json({ error: 'السجل غير موجود' });

    const r = record[0];
    const base      = parseFloat(r.baseSalary ?? '0');
    const comm      = parseFloat(r.commissionAmount ?? '0');
    const bonus     = parseFloat(data.bonusAmount ?? r.bonusAmount ?? '0');
    const deductions = parseFloat(data.deductions ?? r.deductions ?? '0');
    const total = Math.round((base + comm + bonus - deductions) * 100) / 100;

    const [updated] = await db.update(payrollRecords)
      .set({ ...data, totalAmount: total.toString(), updatedAt: new Date() })
      .where(eq(payrollRecords.id, id))
      .returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── POST /payroll/:id/pay — mark as paid ────────────────────────────────────
router.post('/:id/pay', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [updated] = await db.update(payrollRecords)
      .set({ status: 'paid', paidAt: new Date(), paidBy: req.user!.id, updatedAt: new Date() })
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.vendorId, vendorId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'السجل غير موجود' });
    return res.json(updated);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── GET /payroll/employee/:id/history — payroll history for one employee ─────
router.get('/employee/:id/history', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employeeId = Number(req.params.id);
    const records = await db.select().from(payrollRecords)
      .where(and(eq(payrollRecords.vendorId, vendorId), eq(payrollRecords.employeeId, employeeId)))
      .orderBy(sql`${payrollRecords.year} DESC, ${payrollRecords.month} DESC`)
      .limit(24);
    return res.json(records);
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── GET /payroll/pdf?month=X&year=Y — printable HTML payroll report ──────────
router.get('/pdf', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const month = Number(req.query.month ?? new Date().getMonth() + 1);
    const year  = Number(req.query.year  ?? new Date().getFullYear());

    const records = await db
      .select({
        employeeName: users.name,
        employeePhone: users.phone,
        baseSalary: payrollRecords.baseSalary,
        commissionAmount: payrollRecords.commissionAmount,
        bonusAmount: payrollRecords.bonusAmount,
        deductions: payrollRecords.deductions,
        totalAmount: payrollRecords.totalAmount,
        bookingsCount: payrollRecords.bookingsCount,
        status: payrollRecords.status,
      })
      .from(payrollRecords)
      .leftJoin(users, eq(users.id, payrollRecords.employeeId))
      .where(and(
        eq(payrollRecords.vendorId, vendorId),
        eq(payrollRecords.month, month),
        eq(payrollRecords.year, year),
      ));

    const totalSalaries = records.reduce((s, r) => s + parseFloat(r.totalAmount ?? '0'), 0);
    const totalBase = records.reduce((s, r) => s + parseFloat(r.baseSalary ?? '0'), 0);
    const totalCommissions = records.reduce((s, r) => s + parseFloat(r.commissionAmount ?? '0'), 0);
    const totalBonuses = records.reduce((s, r) => s + parseFloat(r.bonusAmount ?? '0'), 0);
    const totalDeductions = records.reduce((s, r) => s + parseFloat(r.deductions ?? '0'), 0);

    const monthNames: Record<number, string> = {
      1: 'يناير', 2: 'فبراير', 3: 'مارس', 4: 'أبريل',
      5: 'مايو', 6: 'يونيو', 7: 'يوليو', 8: 'أغسطس',
      9: 'سبتمبر', 10: 'أكتوبر', 11: 'نوفمبر', 12: 'ديسمبر',
    };
    const monthLabel = monthNames[month] ?? String(month);
    const generatedAt = new Date().toLocaleDateString('ar-SA', { dateStyle: 'full' });

    // Fetch full vendor identity for branded report (logo + CR + VAT + address).
    const { getVendorIdentity } = await import('../services/vendorIdentity.js');
    const identity = await getVendorIdentity(vendorId);
    const vendorDisplayName = identity?.nameAr ?? 'المتجر';
    const vendorLogo = identity?.logoUrl ?? null;
    const vendorCr = identity?.crNumber ?? null;
    const vendorAddress = identity?.nationalAddress ?? identity?.address ?? null;

    const statusLabel = (s: string | null) => {
      if (s === 'paid') return '<span style="color:#16a34a;font-weight:600">مدفوع</span>';
      if (s === 'pending') return '<span style="color:#d97706;font-weight:600">معلّق</span>';
      return '<span style="color:#6b7280">—</span>';
    };

    const tableRows = records.map((r, i) => `
      <tr>
        <td class="center-cell">${i + 1}</td>
        <td>${r.employeeName ?? '—'}</td>
        <td class="center-cell">${r.employeePhone ?? '—'}</td>
        <td class="num-cell">${parseFloat(r.baseSalary ?? '0').toFixed(2)}</td>
        <td class="num-cell">${parseFloat(r.commissionAmount ?? '0').toFixed(2)}</td>
        <td class="num-cell">${parseFloat(r.bonusAmount ?? '0').toFixed(2)}</td>
        <td class="num-cell">${parseFloat(r.deductions ?? '0').toFixed(2)}</td>
        <td class="num-cell total-col">${parseFloat(r.totalAmount ?? '0').toFixed(2)}</td>
        <td class="center-cell">${r.bookingsCount ?? 0}</td>
        <td class="center-cell">${statusLabel(r.status)}</td>
      </tr>`).join('');

    const emptyMsg = records.length === 0
      ? `<tr><td colspan="10" style="text-align:center;padding:24px;color:#999">لا توجد سجلات رواتب لهذا الشهر</td></tr>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>كشف الرواتب — ${monthLabel} ${year}</title>
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

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .summary-card {
      background: #f4f7fc;
      border: 1px solid #dde4ef;
      border-radius: 8px;
      padding: 14px 16px;
      text-align: center;
    }
    .summary-card .s-label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .summary-card .s-value { font-size: 18px; font-weight: 700; color: #1e3a5f; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #1e3a5f;
      color: #fff;
      padding: 10px 12px;
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #dde4ef;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f9fafb; }

    .center-cell { text-align: center; }
    .num-cell { text-align: left; font-variant-numeric: tabular-nums; }
    .total-col { font-weight: 700; color: #1e3a5f; }

    .totals-row td {
      background: #d4e4f7 !important;
      font-weight: 700;
      font-size: 13px;
      border-top: 2px solid #1e3a5f;
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
      @page { size: A4 landscape; margin: 12mm 12mm 16mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${vendorLogo ? `<img src="${vendorLogo}" alt="" style="width:72px;height:72px;border-radius:12px;object-fit:cover;margin:0 auto 12px;display:block"/>` : ''}
    <div class="company">${vendorDisplayName}</div>
    ${vendorCr ? `<div style="font-size:12px;color:#64748b;margin-top:4px">س.ت: ${vendorCr}</div>` : ''}
    ${vendorAddress ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${vendorAddress}</div>` : ''}
    <div class="report-title">كشف الرواتب الشهري</div>
    <div class="period">${monthLabel} ${year}</div>
  </div>

  <div class="meta">تاريخ الإصدار: ${generatedAt} | عدد الموظفين: ${records.length}</div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="s-label">إجمالي الرواتب الأساسية</div>
      <div class="s-value">${totalBase.toFixed(2)} ر.س</div>
    </div>
    <div class="summary-card">
      <div class="s-label">إجمالي العمولات</div>
      <div class="s-value">${totalCommissions.toFixed(2)} ر.س</div>
    </div>
    <div class="summary-card">
      <div class="s-label">إجمالي المكافآت</div>
      <div class="s-value">${totalBonuses.toFixed(2)} ر.س</div>
    </div>
    <div class="summary-card">
      <div class="s-label">إجمالي الخصومات</div>
      <div class="s-value">${totalDeductions.toFixed(2)} ر.س</div>
    </div>
    <div class="summary-card" style="border-color:#1e3a5f;background:#d4e4f7">
      <div class="s-label">إجمالي المدفوع</div>
      <div class="s-value">${totalSalaries.toFixed(2)} ر.س</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center-cell">#</th>
        <th>اسم الموظف</th>
        <th class="center-cell">رقم الجوال</th>
        <th>الراتب الأساسي</th>
        <th>العمولة</th>
        <th>المكافأة</th>
        <th>الخصومات</th>
        <th>الإجمالي</th>
        <th class="center-cell">الحجوزات</th>
        <th class="center-cell">الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}${emptyMsg}
      ${records.length > 0 ? `
      <tr class="totals-row">
        <td colspan="3" style="text-align:right">الإجمالي الكلي</td>
        <td class="num-cell">${totalBase.toFixed(2)}</td>
        <td class="num-cell">${totalCommissions.toFixed(2)}</td>
        <td class="num-cell">${totalBonuses.toFixed(2)}</td>
        <td class="num-cell">${totalDeductions.toFixed(2)}</td>
        <td class="num-cell total-col">${totalSalaries.toFixed(2)} ر.س</td>
        <td colspan="2"></td>
      </tr>` : ''}
    </tbody>
  </table>

  <div class="footer">
    <p>هذا الكشف سري ومخصص للاستخدام الداخلي فقط</p>
    <p>${vendorDisplayName} — صادر عبر منصة جداول | ${year}</p>
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

// ── GET /payroll/bonus-rules — list vendor's active rules ───────────────────
router.get('/bonus-rules', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const rules = await db.select().from(bonusRules)
      .where(eq(bonusRules.vendorId, vendorId))
      .orderBy(bonusRules.id);
    return res.json(rules);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── POST /payroll/bonus-rules — create rule ──────────────────────────────────
router.post('/bonus-rules', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const data = z.object({
      name: z.string().min(1),
      conditionType: z.enum(['jobs_per_day', 'rating_avg', 'revenue_target', 'no_cancellation_week', 'top_performer']),
      threshold: z.union([z.string(), z.number()]).transform(String),
      bonusAmount: z.union([z.string(), z.number()]).transform(String),
      period: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
      isActive: z.boolean().default(true),
    }).parse(req.body);
    const [rule] = await db.insert(bonusRules).values({ vendorId, ...data }).returning();
    return res.status(201).json(rule);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── PUT /payroll/bonus-rules/:id — update rule ───────────────────────────────
router.put('/bonus-rules/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = z.object({
      name: z.string().min(1).optional(),
      conditionType: z.enum(['jobs_per_day', 'rating_avg', 'revenue_target', 'no_cancellation_week', 'top_performer']).optional(),
      threshold: z.union([z.string(), z.number()]).transform(String).optional(),
      bonusAmount: z.union([z.string(), z.number()]).transform(String).optional(),
      period: z.enum(['daily', 'weekly', 'monthly']).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const [rule] = await db.update(bonusRules)
      .set(data)
      .where(and(eq(bonusRules.id, id), eq(bonusRules.vendorId, vendorId)))
      .returning();
    if (!rule) return res.status(404).json({ error: 'القاعدة غير موجودة' });
    return res.json(rule);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── DELETE /payroll/bonus-rules/:id — deactivate rule ────────────────────────
router.delete('/bonus-rules/:id', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const [rule] = await db.update(bonusRules)
      .set({ isActive: false })
      .where(and(eq(bonusRules.id, id), eq(bonusRules.vendorId, vendorId)))
      .returning();
    if (!rule) return res.status(404).json({ error: 'القاعدة غير موجودة' });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── POST /payroll/auto-bonus/:employeeId — calculate auto bonuses ────────────
router.post('/auto-bonus/:employeeId', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const employeeId = Number(req.params.employeeId);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);
    const weekStart  = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    // Get active bonus rules for vendor
    const rules = await db.select().from(bonusRules)
      .where(and(eq(bonusRules.vendorId, vendorId), eq(bonusRules.isActive, true)));

    const rulesTriggered: { ruleName: string; bonusAmount: number }[] = [];
    let totalBonusEarned = 0;

    for (const rule of rules) {
      const threshold = parseFloat(rule.threshold);
      const bonusAmt  = parseFloat(rule.bonusAmount);
      let triggered   = false;

      if (rule.conditionType === 'jobs_per_day') {
        // avg daily completed bookings this month
        const [stats] = await db
          .select({ cnt: count(bookings.id) })
          .from(bookings)
          .where(and(
            eq(bookings.vendorId, vendorId),
            eq(bookings.employeeId, employeeId),
            eq(bookings.status, 'completed'),
            sql`${bookings.updatedAt} >= ${monthStart}`,
            sql`${bookings.updatedAt} < ${monthEnd}`,
          ));
        const daysInMonth = now.getDate(); // days elapsed
        const avgPerDay = daysInMonth > 0 ? stats.cnt / daysInMonth : 0;
        if (avgPerDay >= threshold) triggered = true;

      } else if (rule.conditionType === 'rating_avg') {
        const [stats] = await db
          .select({ avgRating: avg(bookings.rating) })
          .from(bookings)
          .where(and(
            eq(bookings.vendorId, vendorId),
            eq(bookings.employeeId, employeeId),
            eq(bookings.status, 'completed'),
            sql`${bookings.updatedAt} >= ${monthStart}`,
            sql`${bookings.updatedAt} < ${monthEnd}`,
            sql`${bookings.rating} IS NOT NULL`,
          ));
        const avgRating = parseFloat(stats.avgRating ?? '0');
        if (avgRating >= threshold) triggered = true;

      } else if (rule.conditionType === 'revenue_target') {
        const [stats] = await db
          .select({ rev: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)` })
          .from(bookings)
          .where(and(
            eq(bookings.vendorId, vendorId),
            eq(bookings.employeeId, employeeId),
            eq(bookings.status, 'completed'),
            sql`${bookings.updatedAt} >= ${monthStart}`,
            sql`${bookings.updatedAt} < ${monthEnd}`,
          ));
        const revenue = parseFloat(stats.rev ?? '0');
        if (revenue >= threshold) triggered = true;

      } else if (rule.conditionType === 'no_cancellation_week') {
        const [stats] = await db
          .select({ cnt: count(bookings.id) })
          .from(bookings)
          .where(and(
            eq(bookings.vendorId, vendorId),
            eq(bookings.employeeId, employeeId),
            eq(bookings.status, 'cancelled'),
            sql`${bookings.updatedAt} >= ${weekStart}`,
          ));
        if (stats.cnt === 0) triggered = true;
      }

      if (triggered) {
        rulesTriggered.push({ ruleName: rule.name, bonusAmount: bonusAmt });
        totalBonusEarned += bonusAmt;
      }
    }

    // Update payroll record bonus if record exists
    if (totalBonusEarned > 0) {
      const existing = await db.select().from(payrollRecords)
        .where(and(
          eq(payrollRecords.vendorId, vendorId),
          eq(payrollRecords.employeeId, employeeId),
          eq(payrollRecords.month, month),
          eq(payrollRecords.year, year),
        )).limit(1);

      if (existing.length) {
        const r = existing[0];
        const base = parseFloat(r.baseSalary ?? '0');
        const comm = parseFloat(r.commissionAmount ?? '0');
        const currentBonus = parseFloat(r.bonusAmount ?? '0');
        const deductions = parseFloat(r.deductions ?? '0');
        const newBonus = currentBonus + totalBonusEarned;
        const newTotal = Math.round((base + comm + newBonus - deductions) * 100) / 100;
        await db.update(payrollRecords)
          .set({ bonusAmount: newBonus.toString(), totalAmount: newTotal.toString(), updatedAt: new Date() })
          .where(eq(payrollRecords.id, r.id));
      }
    }

    return res.json({ totalBonusEarned, rulesTriggered });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

// ── GET /payroll/live-earnings/:employeeId — today & month earnings ───────────
router.get('/live-earnings/:employeeId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    // Employees can only see their own earnings
    if (req.user!.role === 'employee' && req.user!.id !== employeeId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    const vendorId = req.user!.vendorId!;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const month = now.getMonth() + 1;
    const year  = now.getFullYear();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd   = new Date(year, month, 1);

    // Today stats
    const [todayStats] = await db
      .select({
        cnt: count(bookings.id),
        rev: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)`,
      })
      .from(bookings)
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.employeeId, employeeId),
        eq(bookings.status, 'completed'),
        sql`${bookings.updatedAt} >= ${todayStart}`,
        sql`${bookings.updatedAt} < ${todayEnd}`,
      ));

    // Month stats
    const [monthStats] = await db
      .select({
        cnt: count(bookings.id),
        rev: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)`,
      })
      .from(bookings)
      .where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.employeeId, employeeId),
        eq(bookings.status, 'completed'),
        sql`${bookings.updatedAt} >= ${monthStart}`,
        sql`${bookings.updatedAt} < ${monthEnd}`,
      ));

    // Get commission rate
    const [config] = await db.select().from(employeeSalaryConfig)
      .where(eq(employeeSalaryConfig.employeeId, employeeId)).limit(1);
    const commRate = parseFloat(config?.commissionRate ?? '0') / 100;
    const baseSalary = parseFloat(config?.baseSalary ?? '0');

    const todayRevenue   = parseFloat(todayStats.rev ?? '0');
    const todayCommission = Math.round(todayRevenue * commRate * 100) / 100;
    const monthRevenue   = parseFloat(monthStats.rev ?? '0');
    const monthCommission = Math.round(monthRevenue * commRate * 100) / 100;

    // Get this month's payroll bonus if exists
    const [payroll] = await db.select({ bonusAmount: payrollRecords.bonusAmount })
      .from(payrollRecords)
      .where(and(
        eq(payrollRecords.vendorId, vendorId),
        eq(payrollRecords.employeeId, employeeId),
        eq(payrollRecords.month, month),
        eq(payrollRecords.year, year),
      )).limit(1);

    const monthBonus = parseFloat(payroll?.bonusAmount ?? '0');
    const totalThisMonth = Math.round((monthCommission + baseSalary + monthBonus) * 100) / 100;

    return res.json({
      todayBookings: todayStats.cnt,
      todayRevenue,
      todayCommission,
      monthBookings: monthStats.cnt,
      monthRevenue,
      monthCommission,
      monthBonus,
      baseSalary,
      totalThisMonth,
    });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'خطأ في الخادم' }); }
});

export default router;
