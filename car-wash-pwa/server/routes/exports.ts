import { Router } from 'express';
import { db } from '../db/index.js';
import { customers, users, bookings, financials, vehicles, vendors } from '../db/schema.js';
import { eq, and, gte, lte, count } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import * as XLSX from 'xlsx';

const router = Router();

function buildWorkbook(sheetName: string, data: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// GET /api/exports/customers — Export customers list
router.get('/customers', requireAuth, requireRole('admin', 'vendor_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;

    const [vendor] = await db.select({ nameAr: vendors.nameAr }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

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

    const buf = buildWorkbook('العملاء', rows);
    const filename = `عملاء-${vendor?.nameAr ?? ''}-${new Date().toLocaleDateString('ar-SA')}.xlsx`;
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

    const [vendor] = await db.select({ nameAr: vendors.nameAr }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

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

    const buf = buildWorkbook('المالية', rows);
    const filename = `مالية-${vendor?.nameAr ?? ''}-${new Date().toLocaleDateString('ar-SA')}.xlsx`;
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

    const [vendor] = await db.select({ nameAr: vendors.nameAr }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

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

    const buf = buildWorkbook('الحجوزات', rows);
    const filename = `حجوزات-${vendor?.nameAr ?? ''}-${new Date().toLocaleDateString('ar-SA')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(buf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في تصدير الحجوزات' });
  }
});

export default router;
