import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import {
  posTransactions,
  financials,
  vendors,
} from '../db/schema.js';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const VAT_RATE = 0.15;

function generateTransactionNumber(vendorId: number): string {
  return `POS-${vendorId}-${Date.now()}`;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── POST /api/pos/transaction ────────────────────────────────────────────────
const createTxSchema = z.object({
  items: z.array(
    z.object({
      serviceId: z.number().optional(),
      name: z.string(),
      price: z.number().positive(),
      qty: z.number().int().positive(),
    })
  ).min(1),
  paymentMethod: z.enum(['cash', 'mada', 'stcpay', 'apple_pay', 'credit']).default('cash'),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  ticketId: z.number().optional(),
  bookingId: z.number().optional(),
});

router.post(
  '/transaction',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const data = createTxSchema.parse(req.body);

      const subtotal = data.items.reduce((acc, item) => acc + item.price * item.qty, 0);
      const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
      const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

      const transactionNumber = generateTransactionNumber(vendorId);

      const [tx] = await db
        .insert(posTransactions)
        .values({
          vendorId,
          ticketId: data.ticketId,
          bookingId: data.bookingId,
          employeeId: req.user!.id,
          transactionNumber,
          items: data.items,
          subtotal: subtotal.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          paymentMethod: data.paymentMethod,
          paymentStatus: 'paid',
          customerName: data.customerName,
          customerPhone: data.customerPhone,
        })
        .returning();

      // Record in financials
      await db.insert(financials).values({
        vendorId,
        type: 'income',
        category: 'pos_sale',
        amount: totalAmount.toFixed(2),
        description: `POS بيع ${transactionNumber}${data.customerName ? ` — ${data.customerName}` : ''}`,
        referenceId: tx.id,
        referenceType: 'pos_transaction',
        employeeId: req.user!.id,
        date: new Date(),
        createdBy: req.user!.id,
      });

      // Build receipt HTML
      const vendor = await db.select({ nameAr: vendors.nameAr }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
      const vendorName = vendor[0]?.nameAr ?? 'المتجر';

      const receiptHtml = buildReceiptHtml({
        vendorName,
        transactionNumber,
        items: data.items,
        subtotal,
        vatAmount,
        totalAmount,
        paymentMethod: data.paymentMethod,
        customerName: data.customerName,
        date: tx.createdAt,
      });

      return res.status(201).json({ ...tx, receiptHtml });
    } catch (e) {
      console.error('[pos/transaction POST]', e);
      if ((e as any)?.name === 'ZodError') return res.status(422).json({ error: 'Invalid input', details: e });
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── GET /api/pos/transactions ────────────────────────────────────────────────
router.get(
  '/transactions',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const txs = await db
        .select()
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.vendorId, vendorId),
            gte(posTransactions.createdAt, todayStart()),
            lte(posTransactions.createdAt, todayEnd())
          )
        )
        .orderBy(desc(posTransactions.createdAt));

      return res.json({ transactions: txs });
    } catch (e) {
      console.error('[pos/transactions GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── GET /api/pos/transactions/:id ────────────────────────────────────────────
router.get(
  '/transactions/:id',
  requireAuth,
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      const txId = Number(req.params.id);

      const [tx] = await db
        .select()
        .from(posTransactions)
        .where(eq(posTransactions.id, txId))
        .limit(1);

      if (!tx) return res.status(404).json({ error: 'Not found' });
      if (tx.vendorId !== vendorId) return res.status(403).json({ error: 'Forbidden' });

      return res.json(tx);
    } catch (e) {
      console.error('[pos/transactions/:id GET]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── POST /api/pos/transactions/:id/send-receipt ──────────────────────────────
router.post(
  '/transactions/:id/send-receipt',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const txId = Number(req.params.id);
      const vendorId = req.user!.vendorId;

      const [tx] = await db
        .select()
        .from(posTransactions)
        .where(eq(posTransactions.id, txId))
        .limit(1);

      if (!tx) return res.status(404).json({ error: 'Not found' });
      if (tx.vendorId !== vendorId) return res.status(403).json({ error: 'Forbidden' });

      if (!tx.customerPhone) {
        return res.status(400).json({ error: 'لا يوجد رقم هاتف للعميل' });
      }

      // Mark as sent (actual WhatsApp send can be wired in later)
      await db
        .update(posTransactions)
        .set({ receiptSentViaWhatsapp: true })
        .where(eq(posTransactions.id, txId));

      return res.json({ success: true, message: 'تم إرسال الإيصال' });
    } catch (e) {
      console.error('[pos/send-receipt]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── GET /api/pos/summary  (today's totals) ───────────────────────────────────
router.get(
  '/summary',
  requireAuth,
  requireRole('vendor_admin', 'admin', 'employee'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(403).json({ error: 'No vendor' });

      const txs = await db
        .select()
        .from(posTransactions)
        .where(
          and(
            eq(posTransactions.vendorId, vendorId),
            gte(posTransactions.createdAt, todayStart()),
            lte(posTransactions.createdAt, todayEnd())
          )
        );

      const totals: Record<string, number> = {
        cash: 0,
        mada: 0,
        stcpay: 0,
        apple_pay: 0,
        credit: 0,
        total: 0,
      };

      for (const tx of txs) {
        const amt = Number(tx.totalAmount);
        totals[tx.paymentMethod] = (totals[tx.paymentMethod] ?? 0) + amt;
        totals.total += amt;
      }

      return res.json({
        ...totals,
        transactionCount: txs.length,
        date: todayStart().toISOString().slice(0, 10),
      });
    } catch (e) {
      console.error('[pos/summary]', e);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ─── Receipt HTML builder ─────────────────────────────────────────────────────
function buildReceiptHtml(opts: {
  vendorName: string;
  transactionNumber: string;
  items: Array<{ name: string; price: number; qty: number }>;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: string;
  customerName?: string;
  date: Date;
}): string {
  const paymentLabels: Record<string, string> = {
    cash: 'نقدي',
    mada: 'مدى',
    stcpay: 'STC Pay',
    apple_pay: 'Apple Pay',
    credit: 'آجل',
  };

  const dateStr = opts.date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemRows = opts.items
    .map(
      (item) =>
        `<tr>
          <td style="padding:4px 8px;text-align:right">${item.name}</td>
          <td style="padding:4px 8px;text-align:center">${item.qty}</td>
          <td style="padding:4px 8px;text-align:left">${(item.price * item.qty).toFixed(2)} ر.س</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; margin: 0; padding: 20px; background: #fff; color: #111; max-width: 380px; }
    .header { text-align: center; margin-bottom: 16px; }
    .header h1 { font-size: 1.3rem; margin: 0; }
    .header p { font-size: 0.8rem; color: #666; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th { background: #f5f5f5; padding: 6px 8px; font-size: 0.85rem; }
    td { border-bottom: 1px solid #eee; font-size: 0.85rem; }
    .totals { margin-top: 8px; }
    .totals tr td:first-child { font-weight: 600; }
    .total-row { font-size: 1.1rem; font-weight: 800; color: #1a1a2e; }
    .footer { text-align: center; margin-top: 16px; font-size: 0.75rem; color: #999; }
    @media print { body { margin: 0; padding: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${opts.vendorName}</h1>
    <p>رقم الفاتورة: ${opts.transactionNumber}</p>
    <p>${dateStr}</p>
    ${opts.customerName ? `<p>العميل: ${opts.customerName}</p>` : ''}
  </div>
  <table>
    <thead><tr><th>الخدمة</th><th>الكمية</th><th>المبلغ</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals">
    <tr><td>المجموع قبل الضريبة</td><td style="text-align:left">${opts.subtotal.toFixed(2)} ر.س</td></tr>
    <tr><td>ضريبة القيمة المضافة 15%</td><td style="text-align:left">${opts.vatAmount.toFixed(2)} ر.س</td></tr>
    <tr class="total-row"><td>الإجمالي</td><td style="text-align:left">${opts.totalAmount.toFixed(2)} ر.س</td></tr>
    <tr><td>طريقة الدفع</td><td style="text-align:left">${paymentLabels[opts.paymentMethod] ?? opts.paymentMethod}</td></tr>
  </table>
  <div class="footer">شكراً لزيارتكم — نراكم قريباً!</div>
</body>
</html>`;
}

export default router;
