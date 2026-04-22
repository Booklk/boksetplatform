/**
 * Jadawel Copilot — tools the LLM can call.
 *
 * Design rules:
 *   - Read tools run immediately.
 *   - Write tools return a *preview* (no DB change) unless `_confirm: true`.
 *     The UI renders the preview, asks the user to confirm, then re-sends
 *     the same call with `_confirm: true`.
 *   - Every call is vendor-scoped. The executor never trusts the LLM's
 *     `vendorId` argument — it's injected from the authenticated session.
 *   - Destructive deletes are NOT exposed. The Copilot can create / update
 *     freely but cannot delete. Deletes stay in the real dashboards.
 */

import { db } from '../../db/index.js';
import {
  bookings, users, services, packages, inventory, auditLogs,
} from '../../db/schema.js';
import { and, eq, gte, lte, sql, count, sum, desc } from 'drizzle-orm';

export interface CopilotContext {
  vendorId: number;
  userId: number;
  role: string;
}

export interface ToolResult {
  /** Human-readable summary for the LLM to explain back to the user. */
  summary: string;
  /** Optional structured data the UI can render (table, chart, confirmation). */
  data?: unknown;
  /** Preview metadata — non-empty means "write intent, not executed yet". */
  preview?: {
    title: string;
    rows: Array<{ label: string; value: string }>;
    executeHint: string;
  };
}

// ── Tool definitions for OpenAI function calling ───────────────────────────

export const COPILOT_TOOLS = [
  // ── Reads ─────────────────────────────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'count_bookings',
      description: 'عدد الحجوزات ضمن فترة (اليوم، غداً، الأسبوع، هذا الشهر، أو مدى مخصص بالأيام).',
      parameters: {
        type: 'object',
        properties: {
          range: {
            type: 'string',
            enum: ['today', 'tomorrow', 'this_week', 'last_week', 'this_month', 'last_30_days'],
          },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'completed', 'cancelled', 'any'],
            default: 'any',
          },
        },
        required: ['range'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'revenue_breakdown',
      description: 'إيرادات خلال فترة — الإجمالي + متوسط اليوم + أفضل خدمة.',
      parameters: {
        type: 'object',
        properties: {
          periodDays: { type: 'number', default: 30 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_services',
      description: 'قائمة الخدمات المفعّلة مع أسعار الباقات.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_customers',
      description: 'العملاء — الأكثر نشاطاً، الأعلى إنفاقاً، أو الذين لم يزوروا مؤخراً.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['most_active', 'top_spenders', 'dormant_30d', 'new_this_month'],
          },
          limit: { type: 'number', default: 10 },
        },
        required: ['kind'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'employee_performance',
      description: 'أداء الموظفين — حجوزات مكتملة، متوسط التقييم، الإيراد لكل موظف.',
      parameters: {
        type: 'object',
        properties: { periodDays: { type: 'number', default: 30 } },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'inventory_snapshot',
      description: 'حالة المخزون الحالية — الأصناف منخفضة، الكميات، التكلفة.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // ── Writes (preview-then-execute) ─────────────────────────────────────
  {
    type: 'function' as const,
    function: {
      name: 'create_service_with_package',
      description:
        'إنشاء خدمة جديدة مع باقة واحدة على الأقل. استخدم لما التاجر يقول مثلاً ' +
        '"أضف خدمة قص شعر أطفال 30 ريال 20 دقيقة".',
      parameters: {
        type: 'object',
        properties: {
          serviceName: { type: 'string' },
          packageName: { type: 'string' },
          priceSar: { type: 'number' },
          durationMinutes: { type: 'number' },
          description: { type: 'string' },
          _confirm: { type: 'boolean', default: false, description: 'اتركها false في أول استدعاء.' },
        },
        required: ['serviceName', 'packageName', 'priceSar', 'durationMinutes'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_package_price',
      description: 'تعديل سعر باقة. استخدم لما يقول "زد سعر X بـ 10 ريال".',
      parameters: {
        type: 'object',
        properties: {
          packageName: { type: 'string' },
          newPriceSar: { type: 'number' },
          _confirm: { type: 'boolean', default: false },
        },
        required: ['packageName', 'newPriceSar'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_employee',
      description: 'إضافة موظف جديد للمتجر بصلاحية موظف.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          phone: { type: 'string', description: 'رقم سعودي 05XXXXXXXX' },
          _confirm: { type: 'boolean', default: false },
        },
        required: ['name', 'phone'],
      },
    },
  },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────

function rangeToDates(range: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  switch (range) {
    case 'today':    return { from: start, to: end, label: 'اليوم' };
    case 'tomorrow': {
      const f = new Date(start); f.setDate(f.getDate() + 1);
      const t = new Date(end);   t.setDate(t.getDate() + 1);
      return { from: f, to: t, label: 'غداً' };
    }
    case 'this_week': {
      const f = new Date(start); f.setDate(f.getDate() - f.getDay());
      return { from: f, to: end, label: 'هذا الأسبوع' };
    }
    case 'last_week': {
      const f = new Date(start); f.setDate(f.getDate() - f.getDay() - 7);
      const t = new Date(f);     t.setDate(t.getDate() + 6); t.setHours(23,59,59,999);
      return { from: f, to: t, label: 'الأسبوع الماضي' };
    }
    case 'this_month': {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: f, to: end, label: 'هذا الشهر' };
    }
    case 'last_30_days': {
      const f = new Date(now); f.setDate(f.getDate() - 30);
      return { from: f, to: end, label: 'آخر 30 يوم' };
    }
    default: return { from: start, to: end, label: 'اليوم' };
  }
}

function saudiPhone(raw: string): string {
  let p = raw.replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('+966')) p = '0' + p.slice(4);
  else if (p.startsWith('966')) p = '0' + p.slice(3);
  if (!p.startsWith('0')) p = '0' + p;
  return p;
}

// ── Executor ───────────────────────────────────────────────────────────────

export async function executeCopilotTool(
  ctx: CopilotContext,
  name: string,
  args: Record<string, any>,
): Promise<ToolResult> {
  const { vendorId } = ctx;

  switch (name) {
    // ── Reads ───────────────────────────────────────────────────────────
    case 'count_bookings': {
      const { from, to, label } = rangeToDates(String(args.range));
      const statusFilter = args.status && args.status !== 'any'
        ? eq(bookings.status, String(args.status))
        : undefined;
      const [row] = await db.select({ total: count() }).from(bookings).where(
        statusFilter
          ? and(eq(bookings.vendorId, vendorId), gte(bookings.scheduledAt, from), lte(bookings.scheduledAt, to), statusFilter)
          : and(eq(bookings.vendorId, vendorId), gte(bookings.scheduledAt, from), lte(bookings.scheduledAt, to)),
      );
      const n = Number(row?.total ?? 0);
      return {
        summary: `عدد الحجوزات ${label}${args.status && args.status !== 'any' ? ` بحالة ${args.status}` : ''}: ${n}`,
        data: { count: n, range: label, status: args.status ?? 'any' },
      };
    }

    case 'revenue_breakdown': {
      const days = Math.max(1, Math.min(365, Number(args.periodDays ?? 30)));
      const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);
      const [agg] = await db.select({
        total: sum(bookings.totalPrice),
      }).from(bookings).where(and(
        eq(bookings.vendorId, vendorId),
        eq(bookings.status, 'completed'),
        gte(bookings.scheduledAt, from),
      ));
      const total = Number(agg?.total ?? 0);
      const topSvc = await db.execute<{ name: string; total: string }>(sql`
        SELECT s.name, SUM(b.total_price::numeric) AS total
        FROM bookings b
        JOIN packages p ON p.id = b.package_id
        JOIN services s ON s.id = p.service_id
        WHERE b.vendor_id = ${vendorId}
          AND b.status = 'completed'
          AND b.scheduled_at >= ${from}
        GROUP BY s.name
        ORDER BY total DESC
        LIMIT 1
      `);
      const top = (topSvc as any).rows?.[0] ?? (Array.isArray(topSvc) ? topSvc[0] : undefined);
      const avg = (total / days).toFixed(0);
      return {
        summary: `الإيرادات خلال آخر ${days} يوم: ${total.toFixed(0)} ر.س · متوسط يومي ${avg} ر.س${top ? ` · الأعلى: ${top.name}` : ''}`,
        data: { total, periodDays: days, avgPerDay: Number(avg), topService: top?.name ?? null },
      };
    }

    case 'list_services': {
      const rows = await db.select({
        id: services.id,
        name: services.name,
      }).from(services).where(and(eq(services.vendorId, vendorId), eq(services.isActive, true)));
      const pkgs = await db.select({
        id: packages.id, name: packages.name, price: packages.price, serviceId: packages.serviceId,
      }).from(packages).where(and(eq(packages.vendorId, vendorId), eq(packages.isActive, true)));
      const joined = rows.map((s) => ({
        service: s.name,
        packages: pkgs.filter((p) => p.serviceId === s.id).map((p) => ({
          name: p.name, price: p.price,
        })),
      }));
      return {
        summary: `عدد الخدمات: ${rows.length}`,
        data: { services: joined },
      };
    }

    case 'list_customers': {
      const kind = String(args.kind);
      const limit = Math.max(1, Math.min(50, Number(args.limit ?? 10)));
      if (kind === 'dormant_30d') {
        const rows = await db.execute<{ name: string; phone: string; last_visit: string }>(sql`
          SELECT u.name, u.phone, MAX(b.scheduled_at) AS last_visit
          FROM users u
          LEFT JOIN bookings b ON b.customer_id = u.id
          WHERE u.vendor_id = ${vendorId} AND u.role = 'customer'
          GROUP BY u.id, u.name, u.phone
          HAVING MAX(b.scheduled_at) < NOW() - INTERVAL '30 days' OR MAX(b.scheduled_at) IS NULL
          ORDER BY MAX(b.scheduled_at) DESC NULLS LAST
          LIMIT ${limit}
        `);
        const list = ((rows as any).rows ?? rows) as any[];
        return { summary: `${list.length} عميل ما زاروك من 30 يوم.`, data: { customers: list } };
      }
      if (kind === 'top_spenders') {
        const rows = await db.execute<{ name: string; phone: string; total: string }>(sql`
          SELECT u.name, u.phone, SUM(b.total_price::numeric) AS total
          FROM users u
          JOIN bookings b ON b.customer_id = u.id
          WHERE u.vendor_id = ${vendorId} AND b.status = 'completed'
          GROUP BY u.id, u.name, u.phone
          ORDER BY total DESC NULLS LAST
          LIMIT ${limit}
        `);
        const list = ((rows as any).rows ?? rows) as any[];
        return { summary: `أعلى ${list.length} منفق.`, data: { customers: list } };
      }
      if (kind === 'new_this_month') {
        const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
        const rows = await db.select({
          id: users.id, name: users.name, phone: users.phone, createdAt: users.createdAt,
        }).from(users).where(and(
          eq(users.vendorId, vendorId),
          eq(users.role, 'customer'),
          gte(users.createdAt, start),
        )).orderBy(desc(users.createdAt)).limit(limit);
        return { summary: `${rows.length} عميل جديد هذا الشهر.`, data: { customers: rows } };
      }
      // most_active
      const rows = await db.execute<{ name: string; phone: string; visits: string }>(sql`
        SELECT u.name, u.phone, COUNT(b.id) AS visits
        FROM users u
        JOIN bookings b ON b.customer_id = u.id
        WHERE u.vendor_id = ${vendorId}
        GROUP BY u.id, u.name, u.phone
        ORDER BY visits DESC
        LIMIT ${limit}
      `);
      const list = ((rows as any).rows ?? rows) as any[];
      return { summary: `${list.length} عميل الأكثر نشاطاً.`, data: { customers: list } };
    }

    case 'employee_performance': {
      const days = Math.max(1, Math.min(365, Number(args.periodDays ?? 30)));
      const from = new Date(); from.setDate(from.getDate() - days); from.setHours(0,0,0,0);
      const rows = await db.execute<{
        name: string; completed: string; avg_rating: string; revenue: string;
      }>(sql`
        SELECT u.name,
               COUNT(b.id) FILTER (WHERE b.status = 'completed') AS completed,
               AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL) AS avg_rating,
               SUM(b.total_price::numeric) FILTER (WHERE b.status = 'completed') AS revenue
        FROM users u
        LEFT JOIN bookings b ON b.employee_id = u.id AND b.scheduled_at >= ${from}
        WHERE u.vendor_id = ${vendorId} AND u.role = 'employee'
        GROUP BY u.id, u.name
        ORDER BY completed DESC NULLS LAST
        LIMIT 20
      `);
      const list = ((rows as any).rows ?? rows) as any[];
      return { summary: `أداء ${list.length} موظف خلال آخر ${days} يوم.`, data: { employees: list } };
    }

    case 'inventory_snapshot': {
      const items = await db.select().from(inventory).where(eq(inventory.vendorId, vendorId));
      const low = items.filter((i) => Number(i.quantity) <= Number(i.minQuantity));
      const value = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.costPerUnit ?? 0), 0);
      return {
        summary: `عدد الأصناف: ${items.length} · منخفض: ${low.length} · القيمة الإجمالية: ${value.toFixed(0)} ر.س`,
        data: { total: items.length, low: low.map((i) => i.name), valueSar: value },
      };
    }

    // ── Writes ──────────────────────────────────────────────────────────
    case 'create_service_with_package': {
      const serviceName = String(args.serviceName ?? '').trim();
      const packageName = String(args.packageName ?? '').trim();
      const price = Number(args.priceSar);
      const duration = Number(args.durationMinutes);
      const description = args.description ? String(args.description) : undefined;
      if (!serviceName || !packageName) throw new Error('اسم الخدمة أو الباقة ناقص');
      if (!Number.isFinite(price) || price <= 0) throw new Error('السعر غير صحيح');
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('المدة غير صحيحة');

      if (!args._confirm) {
        return {
          summary: `جاهز لإنشاء خدمة "${serviceName}" مع باقة "${packageName}" سعرها ${price} ر.س ومدتها ${duration} دقيقة. أحتاج تأكيد.`,
          preview: {
            title: 'إنشاء خدمة جديدة',
            rows: [
              { label: 'اسم الخدمة', value: serviceName },
              { label: 'اسم الباقة', value: packageName },
              { label: 'السعر',       value: `${price} ر.س` },
              { label: 'المدة',        value: `${duration} دقيقة` },
            ],
            executeHint: 'أعد نفس الأمر مع تأكيد التنفيذ.',
          },
        };
      }
      const [createdSvc] = await db.insert(services).values({
        vendorId, name: serviceName, description: description ?? null, isActive: true,
      }).returning();
      await db.insert(packages).values({
        vendorId, serviceId: createdSvc.id, name: packageName,
        price: String(price), duration, isActive: true, features: [],
      });
      await auditLog(ctx, 'copilot.create_service', { serviceName, packageName, price, duration });
      return {
        summary: `تم. أنشأت خدمة "${serviceName}" وباقة "${packageName}" (${price} ر.س · ${duration} دقيقة).`,
        data: { serviceId: createdSvc.id },
      };
    }

    case 'update_package_price': {
      const packageName = String(args.packageName ?? '').trim();
      const newPrice = Number(args.newPriceSar);
      if (!packageName || !Number.isFinite(newPrice) || newPrice <= 0) {
        throw new Error('اسم الباقة أو السعر غير صحيح');
      }
      const matches = await db.select().from(packages).where(and(
        eq(packages.vendorId, vendorId),
        eq(packages.isActive, true),
      ));
      const found = matches.find((p) => p.name.trim() === packageName)
                 ?? matches.find((p) => p.name.includes(packageName));
      if (!found) throw new Error(`ما لقيت باقة اسمها "${packageName}"`);

      if (!args._confirm) {
        return {
          summary: `سأحدّث سعر باقة "${found.name}" من ${found.price} إلى ${newPrice} ر.س.`,
          preview: {
            title: 'تعديل سعر باقة',
            rows: [
              { label: 'الباقة',      value: found.name },
              { label: 'السعر القديم', value: `${found.price} ر.س` },
              { label: 'السعر الجديد', value: `${newPrice} ر.س` },
            ],
            executeHint: 'أعد الأمر مع تأكيد التنفيذ.',
          },
        };
      }
      await db.update(packages).set({ price: String(newPrice) }).where(eq(packages.id, found.id));
      await auditLog(ctx, 'copilot.update_package_price', { packageId: found.id, from: found.price, to: newPrice });
      return { summary: `تم. سعر "${found.name}" الآن ${newPrice} ر.س.` };
    }

    case 'add_employee': {
      const name = String(args.name ?? '').trim();
      const phone = saudiPhone(String(args.phone ?? ''));
      if (!name || !/^05\d{8}$/.test(phone)) throw new Error('الاسم أو الجوال غير صحيح');

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
      if (existing.length > 0) throw new Error('هذا الرقم مستخدم مسبقاً في حساب آخر');

      if (!args._confirm) {
        return {
          summary: `سأضيف موظف "${name}" برقم ${phone}. يرسل رابط تسجيل دخوله بعدين.`,
          preview: {
            title: 'إضافة موظف',
            rows: [
              { label: 'الاسم',  value: name },
              { label: 'الجوال', value: phone },
            ],
            executeHint: 'أعد الأمر مع تأكيد التنفيذ.',
          },
        };
      }
      const [created] = await db.insert(users).values({
        name, phone, role: 'employee', vendorId, phoneVerified: false,
      }).returning();
      await auditLog(ctx, 'copilot.add_employee', { employeeId: created.id, name, phone });
      return { summary: `تم. أضفت ${name} كموظف. أرسل له كلمة مرور من إعدادات الموظفين.` };
    }

    default:
      return { summary: `أداة غير معروفة: ${name}` };
  }
}

async function auditLog(ctx: CopilotContext, action: string, meta: Record<string, unknown>) {
  try {
    await db.insert(auditLogs).values({
      vendorId: ctx.vendorId,
      userId: ctx.userId,
      action,
      resource: '/api/copilot/chat',
      method: 'POST',
      metadata: { ...meta, viaCopilot: true },
      ip: 'copilot',
    });
  } catch (e) { console.error('[copilot audit]', e); }
}
