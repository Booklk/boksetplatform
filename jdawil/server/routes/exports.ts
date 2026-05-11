import { Router } from 'express';
import { db } from '../db/index.js';
import { customers, users, bookings, financials, vehicles, vendors } from '../db/schema.js';
import { eq, and, gte, lte, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import ExcelJS from 'exceljs';
import { getVendorIdentity, buildIdentityCoverRows, buildReportFilename, type VendorIdentity } from '../services/vendorIdentity.js';

const router = Router();

/**
 * Build a workbook with a vendor-identity cover sheet first, then
 * the actual data sheet. Every Excel export the platform issues
 * opens with the merchant's official identity (name + CR + VAT +
 * address + logo URL) so the file looks branded the moment it
 * opens, not after the user scrolls.
 *
 * Uses exceljs (actively maintained) instead of xlsx — xlsx has
 * known prototype-pollution + ReDoS issues with no upstream fix.
 */
async function buildBrandedWorkbook(
  identity: VendorIdentity | null,
  reportTitle: string,
  sheetName: string,
  data: Record<string, unknown>[],
  dateRange?: { from: Date; to: Date },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jdawil';
  wb.created = new Date();

  // Cover sheet — vendor identity rows.
  const cover = wb.addWorksheet('بيانات المنشأة', { views: [{ rightToLeft: true }] });
  cover.columns = [{ width: 24 }, { width: 60 }];
  const coverRows = buildIdentityCoverRows(identity, reportTitle, dateRange);
  for (const row of coverRows) cover.addRow(row);

  // Data sheet — explicit column headers from the first row's keys
  // (matches the exact behaviour json_to_sheet had).
  const dataSheet = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    dataSheet.columns = keys.map((key) => ({ header: key, key, width: 20 }));
    for (const row of data) dataSheet.addRow(row);
    dataSheet.getRow(1).font = { bold: true };
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// GET /api/exports/customers — Export customers list
router.get('/customers', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const identity = await getVendorIdentity(vendorId);

    const list = await db.select({
      name: users.name,
      phone: users.phone,
      email: users.email,
      vehicleType: customers.vehicleType,
      vehiclePlate: customers.vehiclePlate,
      vehicleModel: customers.vehicleModel,
      defaultAddress: customers.defaultAddress,
      createdAt: customers.createdAt,
    }).from(customers)
      .leftJoin(users, eq(customers.userId, users.id))
      .where(eq(customers.vendorId, vendorId));

    const rows = list.map(c => ({
      'الاسم': c.name,
      'الجوال': c.phone,
      'البريد الإلكتروني': c.email ?? '',
      'نوع السيارة': c.vehicleType ?? '',
      'لوحة السيارة': c.vehiclePlate ?? '',
      'موديل السيارة': c.vehicleModel ?? '',
      'العنوان الافتراضي': c.defaultAddress ?? '',
      'تاريخ التسجيل': c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-SA') : '',
    }));

    const buf = await buildBrandedWorkbook(identity, 'تقرير العملاء', 'العملاء', rows);
    const filename = buildReportFilename('عملاء', identity, 'xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تصدير العملاء' });
  }
});

// GET /api/exports/financials?from=&to= — Export financial report
router.get('/financials', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const identity = await getVendorIdentity(vendorId);

    const records = await db.select().from(financials)
      .where(and(
        eq(financials.vendorId, vendorId),
        gte(financials.date, from),
        lte(financials.date, to)
      ));

    const rows = records.map(f => ({
      'النوع': f.type === 'income' ? 'دخل' : f.type === 'expense' ? 'مصروف' : f.type === 'salary' ? 'راتب' : 'صيانة',
      'الفئة': f.category ?? '',
      'المبلغ': f.amount,
      'الوصف': f.description,
      'التاريخ': new Date(f.date).toLocaleDateString('ar-SA'),
    }));

    const buf = await buildBrandedWorkbook(identity, 'تقرير الحركات المالية', 'المالية', rows, { from, to });
    const filename = buildReportFilename('مالية', identity, 'xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تصدير المالية' });
  }
});

// GET /api/exports/bookings?from=&to=&status= — Export bookings
router.get('/bookings', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const from = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const to = req.query.to ? new Date(req.query.to as string) : new Date();
    const identity = await getVendorIdentity(vendorId);

    const conditions: any[] = [
      eq(bookings.vendorId, vendorId),
      gte(bookings.createdAt, from),
      lte(bookings.createdAt, to),
    ];
    if (req.query.status) conditions.push(eq(bookings.status, req.query.status as string));

    const records = await db.select({
      bookingNumber: bookings.bookingNumber,
      status: bookings.status,
      totalPrice: bookings.totalPrice,
      address: bookings.address,
      vehiclePlate: bookings.vehiclePlate,
      vehicleModel: bookings.vehicleModel,
      scheduledAt: bookings.scheduledAt,
      createdAt: bookings.createdAt,
      rating: bookings.rating,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
    }).from(bookings).where(and(...conditions));

    const statusMap: Record<string, string> = {
      pending: 'معلق', confirmed: 'مؤكد', on_way: 'في الطريق',
      arrived: 'وصل', in_progress: 'جاري الغسيل', completed: 'مكتمل', cancelled: 'ملغي'
    };

    const rows = records.map(b => ({
      'رقم الحجز': b.bookingNumber,
      'الحالة': statusMap[b.status] ?? b.status,
      'المبلغ': b.totalPrice,
      'طريقة الدفع': b.paymentMethod,
      'حالة الدفع': b.paymentStatus === 'paid' ? 'مدفوع' : 'معلق',
      'العنوان': b.address,
      'السيارة': `${b.vehicleModel ?? ''} ${b.vehiclePlate ?? ''}`.trim(),
      'الموعد': b.scheduledAt ? new Date(b.scheduledAt).toLocaleString('ar-SA') : '',
      'تاريخ الإنشاء': new Date(b.createdAt).toLocaleString('ar-SA'),
      'التقييم': b.rating ?? '',
    }));

    const buf = await buildBrandedWorkbook(identity, 'تقرير الحجوزات', 'الحجوزات', rows, { from, to });
    const filename = buildReportFilename('حجوزات', identity, 'xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تصدير الحجوزات' });
  }
});

export default router;
