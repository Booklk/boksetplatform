import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, customers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

const customerRowSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  vehicleColor: z.string().optional(),
  vehicleModel: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/customer-import/bulk — Import multiple customers from parsed data
router.post('/bulk', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمغسلة' });

    const { customers: rawCustomers } = req.body;
    if (!Array.isArray(rawCustomers) || rawCustomers.length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات لاستيرادها' });
    }

    if (rawCustomers.length > 500) {
      return res.status(400).json({ error: 'الحد الأقصى 500 عميل في المرة الواحدة' });
    }

    const results = {
      total: rawCustomers.length,
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; reason: string }>,
    };

    for (let i = 0; i < rawCustomers.length; i++) {
      const raw = rawCustomers[i];
      try {
        const data = customerRowSchema.parse(raw);

        // Normalize phone number
        let phone = data.phone.replace(/[\s\-\(\)]/g, '');
        if (phone.startsWith('+966')) phone = '0' + phone.slice(4);
        if (phone.startsWith('966')) phone = '0' + phone.slice(3);
        if (!phone.startsWith('0')) phone = '0' + phone;

        // Check if user already exists for this vendor
        const [existing] = await db.select({ id: users.id })
          .from(users)
          .where(and(eq(users.phone, phone), eq(users.vendorId, vendorId)))
          .limit(1);

        if (existing) {
          results.skipped++;
          results.errors.push({ row: i + 1, name: data.name, reason: 'الرقم مسجل مسبقاً' });
          continue;
        }

        // Create user
        const [newUser] = await db.insert(users).values({
          name: data.name,
          phone,
          role: 'customer',
          vendorId,
        }).returning();

        // Create customer profile
        await db.insert(customers).values({
          userId: newUser.id,
          vendorId,
          vehicleType: data.vehicleType ?? null,
          vehiclePlate: data.vehiclePlate ?? null,
          vehicleColor: data.vehicleColor ?? null,
          vehicleModel: data.vehicleModel ?? null,
          notes: data.notes ?? null,
        });

        results.imported++;
      } catch (err: any) {
        results.skipped++;
        results.errors.push({
          row: i + 1,
          name: raw?.name ?? `صف ${i + 1}`,
          reason: err?.issues?.[0]?.message ?? 'بيانات غير صالحة',
        });
      }
    }

    return res.json(results);
  } catch (err) {
    console.error('[Customer Import]', err);
    return res.status(500).json({ error: 'فشل في الاستيراد' });
  }
});

// POST /api/customer-import/parse-csv — Parse CSV text and return structured data
router.post('/parse-csv', async (req: AuthRequest, res) => {
  try {
    const { csvText, delimiter } = req.body;
    if (!csvText) return res.status(400).json({ error: 'لا توجد بيانات' });

    const sep = delimiter || ',';
    const lines = csvText.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: 'الملف فارغ أو يحتوي صف واحد فقط' });

    const headers = lines[0].split(sep).map((h: string) => h.trim().toLowerCase());
    const rows = [];

    // Map common Arabic/English headers to our fields
    const headerMap: Record<string, string> = {
      'name': 'name', 'الاسم': 'name', 'اسم': 'name', 'اسم العميل': 'name', 'customer': 'name',
      'phone': 'phone', 'الجوال': 'phone', 'رقم الجوال': 'phone', 'هاتف': 'phone', 'mobile': 'phone', 'رقم': 'phone',
      'vehicle': 'vehicleType', 'نوع السيارة': 'vehicleType', 'سيارة': 'vehicleType', 'type': 'vehicleType',
      'plate': 'vehiclePlate', 'لوحة': 'vehiclePlate', 'رقم اللوحة': 'vehiclePlate',
      'color': 'vehicleColor', 'لون': 'vehicleColor', 'اللون': 'vehicleColor',
      'model': 'vehicleModel', 'موديل': 'vehicleModel', 'الموديل': 'vehicleModel',
      'notes': 'notes', 'ملاحظات': 'notes', 'ملاحظه': 'notes',
    };

    const mappedHeaders = headers.map((h: string) => headerMap[h] ?? h);

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map((v: string) => v.trim());
      const row: Record<string, string> = {};
      mappedHeaders.forEach((h: string, idx: number) => {
        if (values[idx]) row[h] = values[idx];
      });
      if (row.name && row.phone) rows.push(row);
    }

    return res.json({
      headers: mappedHeaders,
      rows,
      totalRows: rows.length,
      preview: rows.slice(0, 5),
    });
  } catch (err) {
    console.error('[Customer Import parse-csv]', err);
    return res.status(500).json({ error: 'فشل في قراءة الملف' });
  }
});

export default router;
