import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db } from '../db/index.js';
import { bookings, packages, services, users, vendors, invoices } from '../db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { sendRawWhatsAppMessage } from '../services/whatsapp.js';

const router = Router();

const INVOICES_DIR = path.resolve('uploads/invoices');

function ensureInvoicesDir() {
  if (!fs.existsSync(INVOICES_DIR)) {
    fs.mkdirSync(INVOICES_DIR, { recursive: true });
  }
}

// ─── Sequential invoice number per vendor ─────────────────────────────────────
async function generateInvoiceNumber(vendorId: number): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(invoices)
    .where(and(
      eq(invoices.vendorId, vendorId),
      sql`extract(year from ${invoices.createdAt}) = ${year}`,
    ));
  const seq = (Number(row?.cnt ?? 0) + 1).toString().padStart(4, '0');
  return `INV-${year}-${seq}`;
}

// ─── HTML invoice builder ──────────────────────────────────────────────────────
interface InvoiceHtmlParams {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  vendorNameAr: string;
  vendorPhone: string | null;
  vendorAddress: string | null;
  vendorLogoUrl: string | null;
  items: Array<{ description: string; qty: number; unitPrice: string | number }>;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  notes: string | null;
  dueDate: Date | null;
  createdAt: Date;
}

function buildInvoiceHtml(p: InvoiceHtmlParams): string {
  const dateStr = p.createdAt.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const dueDateStr = p.dueDate
    ? p.dueDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const logoHtml = p.vendorLogoUrl
    ? `<img src="${p.vendorLogoUrl}" alt="شعار المغسلة" style="height:70px;object-fit:contain;margin-bottom:8px;" />`
    : '';

  const itemRows = p.items.map((item) => {
    const up = Number(item.unitPrice ?? 0);
    const total = up * item.qty;
    return `
      <tr>
        <td>${item.description}</td>
        <td style="text-align:center;">${item.qty}</td>
        <td style="text-align:left;">${up.toFixed(2)}</td>
        <td style="text-align:left;">${total.toFixed(2)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>فاتورة ${p.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      background: #f9fafb;
      color: #1a1a2e;
      font-size: 14px;
    }
    .page {
      max-width: 780px;
      margin: 32px auto;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
      color: #fff;
      padding: 32px 40px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-vendor h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header-vendor p { font-size: 13px; opacity: 0.85; margin-top: 2px; }
    .header-meta { text-align: left; }
    .header-meta .invoice-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .header-meta p { font-size: 13px; opacity: 0.9; margin-top: 3px; }
    .body { padding: 32px 40px; }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
      margin-bottom: 14px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    .info-block p { margin-bottom: 5px; font-size: 13px; color: #374151; }
    .info-block strong { color: #111827; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    thead tr { background: #1e3a8a; color: #fff; }
    thead th {
      padding: 12px 14px;
      font-size: 13px;
      font-weight: 600;
      text-align: right;
    }
    tbody tr { border-bottom: 1px solid #f3f4f6; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody td { padding: 12px 14px; font-size: 13px; color: #374151; }
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      margin-bottom: 32px;
    }
    .total-row {
      display: flex;
      gap: 12px;
      font-size: 13px;
      color: #374151;
    }
    .total-row .label { width: 200px; font-weight: 600; }
    .total-row.grand { font-size: 16px; font-weight: 700; color: #1e3a8a; margin-top: 6px; }
    .notes-box {
      background: #f9fafb;
      border-right: 3px solid #2563eb;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #374151;
    }
    .footer {
      background: #f3f4f6;
      text-align: center;
      padding: 20px 40px;
      font-size: 13px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer strong { color: #1e3a8a; font-size: 15px; display: block; margin-bottom: 4px; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
      .print-btn { display: none; }
    }
    .print-btn {
      display: block;
      margin: 20px auto;
      padding: 10px 32px;
      background: #1e3a8a;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨️ طباعة الفاتورة</button>
  <div class="page">
    <div class="header">
      <div class="header-vendor">
        ${logoHtml}
        <h1>${p.vendorNameAr}</h1>
        ${p.vendorPhone ? `<p>📞 ${p.vendorPhone}</p>` : ''}
        ${p.vendorAddress ? `<p>📍 ${p.vendorAddress}</p>` : ''}
      </div>
      <div class="header-meta">
        <div class="invoice-title">فاتورة ضريبية مبسّطة</div>
        <p>رقم الفاتورة: <strong>${p.invoiceNumber}</strong></p>
        <p>التاريخ: <strong>${dateStr}</strong></p>
        ${dueDateStr ? `<p>تاريخ الاستحقاق: <strong>${dueDateStr}</strong></p>` : ''}
      </div>
    </div>

    <div class="body">
      <div class="info-grid">
        <div>
          <div class="section-title">بيانات العميل</div>
          <div class="info-block">
            <p><strong>${p.customerName}</strong></p>
            <p>${p.customerPhone}</p>
          </div>
        </div>
      </div>

      <div class="section-title">بنود الفاتورة</div>
      <table>
        <thead>
          <tr>
            <th>الوصف</th>
            <th style="text-align:center;">الكمية</th>
            <th style="text-align:left;">سعر الوحدة (ريال)</th>
            <th style="text-align:left;">الإجمالي (ريال)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span class="label">المجموع قبل الضريبة:</span>
          <span>${p.subtotal.toFixed(2)} ريال</span>
        </div>
        <div class="total-row">
          <span class="label">ضريبة القيمة المضافة (15%):</span>
          <span>${p.vatAmount.toFixed(2)} ريال</span>
        </div>
        <div class="total-row grand">
          <span class="label">الإجمالي المستحق:</span>
          <span>${p.totalAmount.toFixed(2)} ريال</span>
        </div>
      </div>

      ${p.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${p.notes}</div>` : ''}
    </div>

    <div class="footer">
      <strong>شكراً لاختيارك خدماتنا</strong>
      هذه فاتورة ضريبية مبسّطة وفق أنظمة هيئة الزكاة والضريبة والجمارك
    </div>
  </div>
</body>
</html>`;
}

// ─── GET /invoices — list all invoices for vendor (paginated, filterable) ─────
router.get('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });

    const { status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [eq(invoices.vendorId, vendorId)];
    if (status && status !== 'all') {
      conditions.push(eq(invoices.status, status));
    }

    const rows = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [countRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(invoices)
      .where(and(...conditions));

    return res.json({
      data: rows,
      total: Number(countRow?.total ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /invoices — create manual invoice ────────────────────────────────────
const createInvoiceSchema = z.object({
  customerId: z.number().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(5),
  items: z.array(z.object({
    description: z.string().min(1),
    qty: z.number().min(1),
    unitPrice: z.union([z.number(), z.string()]),
  })).min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'غير مصرح' });

    const data = createInvoiceSchema.parse(req.body);

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.qty, 0);
    const vatAmount = parseFloat((subtotal * 0.15).toFixed(2));
    const totalAmount = parseFloat((subtotal + vatAmount).toFixed(2));

    const invoiceNumber = await generateInvoiceNumber(vendorId);

    const [created] = await db.insert(invoices).values({
      vendorId,
      customerId: data.customerId ?? null,
      invoiceNumber,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      items: data.items,
      amount: subtotal.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      status: 'draft',
      notes: data.notes ?? null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    }).returning();

    return res.status(201).json(created);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /invoices/booking/:bookingId — get or create invoice for a booking ───
// NOTE: This must be registered BEFORE /:id to avoid Express matching "booking" as :id
router.get('/booking/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'معرّف الحجز غير صالح' });

    const [row] = await db
      .select({
        id: bookings.id,
        bookingNumber: bookings.bookingNumber,
        scheduledAt: bookings.scheduledAt,
        address: bookings.address,
        totalPrice: bookings.totalPrice,
        customerId: bookings.customerId,
        vendorId: bookings.vendorId,
        paymentStatus: bookings.paymentStatus,
        serviceName: services.name,
        packageName: packages.name,
        customerName: users.name,
        customerPhone: users.phone,
        vendorNameAr: vendors.nameAr,
        vendorPhone: vendors.phone,
        vendorAddress: vendors.address,
        vendorLogoUrl: vendors.logoUrl,
      })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .leftJoin(users, eq(bookings.customerId, users.id))
      .leftJoin(vendors, eq(bookings.vendorId, vendors.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) return res.status(404).json({ error: 'الحجز غير موجود' });

    // Authorization: customer sees own bookings; vendor_admin sees own vendor only; admin sees all
    if (req.user!.role === 'customer' && row.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    }
    if (req.user!.role === 'vendor_admin' && row.vendorId !== req.user!.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Check if an invoice already exists for this booking
    const [existing] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.bookingId, bookingId))
      .limit(1);

    if (existing) {
      const html = buildInvoiceHtml({
        invoiceNumber: existing.invoiceNumber,
        customerName: existing.customerName,
        customerPhone: existing.customerPhone,
        vendorNameAr: row.vendorNameAr ?? 'المغسلة',
        vendorPhone: row.vendorPhone ?? null,
        vendorAddress: row.vendorAddress ?? null,
        vendorLogoUrl: row.vendorLogoUrl ?? null,
        items: (existing.items as Array<{ description: string; qty: number; unitPrice: string | number }>) ?? [],
        subtotal: Number(existing.amount),
        vatAmount: Number(existing.vatAmount),
        totalAmount: Number(existing.totalAmount),
        notes: existing.notes,
        dueDate: existing.dueDate,
        createdAt: existing.createdAt,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    // Build from booking data
    const amount = parseFloat(row.totalPrice ?? '0');
    const vatRate = 0.15;
    const netAmount = parseFloat((amount / (1 + vatRate)).toFixed(2));
    const vatAmount = parseFloat((amount - netAmount).toFixed(2));

    const invoiceNumber = `INV-${row.id}-${new Date().getFullYear()}`;
    const itemsArr = [{ description: `${row.serviceName ?? 'خدمة'} — ${row.packageName ?? 'باقة'}`, qty: 1, unitPrice: netAmount }];

    const [created] = await db.insert(invoices).values({
      vendorId: row.vendorId,
      bookingId: row.id,
      customerId: row.customerId,
      invoiceNumber,
      customerName: row.customerName ?? 'عميل',
      customerPhone: row.customerPhone ?? '',
      items: itemsArr,
      amount: netAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      totalAmount: amount.toFixed(2),
      status: 'draft',
    }).returning();

    const htmlNew = buildInvoiceHtml({
      invoiceNumber: created.invoiceNumber,
      customerName: created.customerName,
      customerPhone: created.customerPhone,
      vendorNameAr: row.vendorNameAr ?? 'المغسلة',
      vendorPhone: row.vendorPhone ?? null,
      vendorAddress: row.vendorAddress ?? null,
      vendorLogoUrl: row.vendorLogoUrl ?? null,
      items: itemsArr,
      subtotal: netAmount,
      vatAmount,
      totalAmount: amount,
      notes: null,
      dueDate: null,
      createdAt: created.createdAt,
    });

    // Save to disk and update booking
    ensureInvoicesDir();
    const filePath = path.join(INVOICES_DIR, `inv-${bookingId}.html`);
    fs.writeFileSync(filePath, htmlNew, 'utf8');
    const invoiceUrl = `/uploads/invoices/inv-${bookingId}.html`;
    await db.update(bookings).set({ invoiceUrl, updatedAt: new Date() }).where(eq(bookings.id, bookingId));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(htmlNew);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /booking/:id/html — Return the saved HTML invoice file (legacy) ──────
router.get('/booking/:id/html', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) return res.status(400).json({ error: 'معرّف الحجز غير صالح' });

    const filePath = path.join(INVOICES_DIR, `inv-${bookingId}.html`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'الفاتورة غير موجودة، يرجى توليدها أولاً' });
    }

    const html = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /invoices/:id — get invoice details ───────────────────────────────────
router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    // Vendor can access their own invoices; customer can access invoices for their bookings
    const user = req.user!;
    if (user.role === 'customer') {
      if (inv.customerId !== user.id) return res.status(403).json({ error: 'غير مصرح' });
    } else if (!['super_admin'].includes(user.role)) {
      if (inv.vendorId !== user.vendorId) return res.status(403).json({ error: 'غير مصرح' });
    }

    return res.json(inv);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── PUT /invoices/:id/status — update status ──────────────────────────────────
router.put('/:id/status', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const { status } = z.object({
      status: z.enum(['draft', 'sent', 'paid', 'overdue']),
    }).parse(req.body);

    const vendorId = req.user!.vendorId;
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    if (inv.vendorId !== vendorId) return res.status(403).json({ error: 'غير مصرح' });

    const extra: Record<string, unknown> = { status, updatedAt: new Date() };
    if (status === 'paid') extra.paidAt = new Date();
    if (status === 'sent') extra.sentAt = new Date();

    const [updated] = await db
      .update(invoices)
      .set(extra)
      .where(eq(invoices.id, id))
      .returning();

    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── POST /invoices/:id/send-whatsapp ─────────────────────────────────────────
router.post('/:id/send-whatsapp', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const vendorId = req.user!.vendorId;
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });
    if (inv.vendorId !== vendorId) return res.status(403).json({ error: 'غير مصرح' });

    // Get vendor name
    const [vendor] = await db
      .select({ nameAr: vendors.nameAr })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    const vendorName = vendor?.nameAr ?? 'المغسلة';
    const invoiceUrl = `${process.env.APP_URL ?? 'https://app.washsaas.com'}/api/invoices/${id}/pdf`;

    const message =
      `🧾 *فاتورتك من ${vendorName}*\n\n` +
      `رقم الفاتورة: #${inv.invoiceNumber}\n` +
      `المبلغ الإجمالي: ${Number(inv.totalAmount).toFixed(2)} ر.س\n` +
      `رابط الفاتورة: ${invoiceUrl}\n\n` +
      `شكراً لاختيارك خدماتنا 💙`;

    await sendRawWhatsAppMessage(inv.customerPhone, message);

    const [updated] = await db
      .update(invoices)
      .set({ sentAt: new Date(), status: 'sent', updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();

    return res.json({ success: true, invoice: updated });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ─── GET /invoices/:id/pdf — generate printable HTML invoice ──────────────────
router.get('/:id/pdf', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'معرّف غير صالح' });

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const user = req.user!;
    if (user.role === 'customer' && inv.customerId !== user.id) {
      return res.status(403).json({ error: 'غير مصرح' });
    } else if (!['super_admin', 'customer'].includes(user.role) && inv.vendorId !== user.vendorId) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    // Get vendor info
    const [vendor] = await db
      .select({ nameAr: vendors.nameAr, phone: vendors.phone, address: vendors.address, logoUrl: vendors.logoUrl })
      .from(vendors)
      .where(eq(vendors.id, inv.vendorId))
      .limit(1);

    const html = buildInvoiceHtml({
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      vendorNameAr: vendor?.nameAr ?? 'المغسلة',
      vendorPhone: vendor?.phone ?? null,
      vendorAddress: vendor?.address ?? null,
      vendorLogoUrl: vendor?.logoUrl ?? null,
      items: (inv.items as Array<{ description: string; qty: number; unitPrice: string | number }>) ?? [],
      subtotal: Number(inv.amount),
      vatAmount: Number(inv.vatAmount),
      totalAmount: Number(inv.totalAmount),
      notes: inv.notes,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
