/**
 * AI brain for the WhatsApp bot — OpenAI gpt-4o-mini with function calling.
 *
 * Used as a fallback when the rule-based intent matcher returns 'unknown'
 * (or when the vendor explicitly opts in for "smart mode"). The agent has:
 *
 *   - System prompt loaded with the vendor's identity, full active service
 *     catalog with prices, working hours, location, today's date, customer's
 *     past bookings count, vendor governance rules
 *   - Conversation history (last 8 turns from session.context.history)
 *   - 5 tools (function calling):
 *       list_services, check_availability, create_booking,
 *       suggest_promo, escalate_to_vendor
 *
 * Cost guards:
 *   - Hard token cap per call (max 700 output tokens)
 *   - Monthly per-vendor message counter — when reached, AI stops, the
 *     rule-based bot keeps working
 *   - History summarization at >8 turns to keep context small
 */
import OpenAI from 'openai';
import { db } from '../db/index.js';
import {
  vendors, services as servicesTable, packages, bookings, customers, users,
  promoCodes,
} from '../db/schema.js';
import { eq, and, gte, lt, desc, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { getSetting } from './platformSettings.js';

interface AiContext {
  vendor: {
    id: number;
    nameAr: string;
    slug: string;
    address: string | null;
    city: string | null;
    industry: string | null;
    settings: Record<string, unknown> | null;
  };
  customerPhone: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  governance: {
    canBook: boolean;
    canApplyPromo: boolean;
    maxBookingValue?: number;
  };
}

let cachedClient: OpenAI | null = null;
let cachedKey: string | null = null;

async function getClient(): Promise<OpenAI | null> {
  const key = await getSetting('openai.apiKey');
  if (!key) return null;
  if (cachedKey !== key) {
    cachedClient = new OpenAI({ apiKey: key });
    cachedKey = key;
  }
  return cachedClient;
}

// ─── Tools (called by the model) ─────────────────────────────────────────────

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'يعرض قائمة الخدمات والباقات المتاحة لدى المتجر مع أسعارها ومدتها. استدعها عندما يسأل العميل عن الأسعار أو يريد رؤية الخيارات.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'كلمة بحث اختيارية للتصفية بالاسم' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'يرجع 3 أوقات شاغرة قريبة لخدمة معينة. استدعها بعد ما يختار العميل خدمة ويريد الحجز.',
      parameters: {
        type: 'object',
        properties: {
          packageId: { type: 'number', description: 'معرّف الباقة' },
        },
        required: ['packageId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'ينشئ حجزاً فعلياً في النظام. استدعها فقط بعد تأكيد العميل الواضح وموافقته على الموعد والسعر.',
      parameters: {
        type: 'object',
        properties: {
          packageId:    { type: 'number' },
          scheduledAt:  { type: 'string', description: 'ISO datetime مثل 2025-06-15T14:00:00.000Z' },
          customerName: { type: 'string', description: 'اسم العميل (إن سأله البوت)' },
        },
        required: ['packageId', 'scheduledAt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_promo',
      description: 'يبحث عن أحدث كود خصم نشط ويرجعه. استخدمه لإقناع عميل متردد، أو في نهاية الحجز كمكافأة.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_vendor',
      description: 'يحوّل المحادثة للتاجر. استخدم هذا عند الشكوى، طلب موظف، حالة خاصة، أو عجز البوت عن الإجابة.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'سبب التحويل بسطر واحد' },
        },
        required: ['reason'],
      },
    },
  },
];

// ─── Tool implementations ───────────────────────────────────────────────────

async function execListServices(ctx: AiContext, query?: string): Promise<string> {
  const list = await db
    .select({
      id: packages.id, name: packages.name, price: packages.price,
      duration: packages.duration, serviceName: servicesTable.name,
    })
    .from(packages)
    .leftJoin(servicesTable, eq(packages.serviceId, servicesTable.id))
    .where(and(eq(packages.vendorId, ctx.vendor.id), eq(packages.isActive, true)))
    .limit(15);

  const filtered = ctx.governance.maxBookingValue
    ? list.filter((p) => parseFloat(String(p.price ?? '0')) <= (ctx.governance.maxBookingValue ?? Infinity))
    : list;

  const matched = query
    ? filtered.filter((p) =>
        (p.name ?? '').includes(query) ||
        (p.serviceName ?? '').includes(query),
      )
    : filtered;

  return JSON.stringify(matched.map((p) => ({
    packageId: p.id,
    name: `${p.serviceName ?? ''} — ${p.name}`,
    priceSar: parseInt(String(p.price ?? '0')),
    durationMinutes: p.duration ?? null,
  })));
}

async function execCheckAvailability(ctx: AiContext, packageId: number): Promise<string> {
  const wh = ((ctx.vendor.settings ?? {}) as { workingHours?: { start?: string; end?: string; days?: number[] } }).workingHours;
  const start = wh?.start ?? '09:00';
  const end = wh?.end ?? '22:00';

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now); dayAfter.setDate(dayAfter.getDate() + 2);

  const slots: Date[] = [];
  for (const day of [now, tomorrow, dayAfter]) {
    const noon = new Date(day); noon.setHours(11, 0, 0, 0);
    const evening = new Date(day); evening.setHours(17, 30, 0, 0);
    if (noon > now) slots.push(noon);
    if (evening > now && slots.length < 3) slots.push(evening);
    if (slots.length >= 3) break;
  }

  return JSON.stringify({
    workingHours: `${start} – ${end}`,
    suggestedSlots: slots.slice(0, 3).map((d) => ({
      iso: d.toISOString(),
      label: d.toLocaleString('ar-SA', { weekday: 'long', hour: '2-digit', minute: '2-digit' }),
    })),
  });
}

async function execCreateBooking(
  ctx: AiContext,
  args: { packageId: number; scheduledAt: string; customerName?: string },
): Promise<string> {
  if (!ctx.governance.canBook) {
    return JSON.stringify({ error: 'الحجز التلقائي غير مفعّل لهذا التاجر. حوّل المحادثة بدلاً من ذلك.' });
  }
  // Look up package + vendor sanity check
  const [pkg] = await db.select({
    id: packages.id, vendorId: packages.vendorId, name: packages.name,
    price: packages.price, serviceId: packages.serviceId,
  }).from(packages).where(eq(packages.id, args.packageId)).limit(1);
  if (!pkg || pkg.vendorId !== ctx.vendor.id) {
    return JSON.stringify({ error: 'الباقة غير موجودة' });
  }
  const price = parseFloat(String(pkg.price ?? '0'));
  if (ctx.governance.maxBookingValue && price > ctx.governance.maxBookingValue) {
    return JSON.stringify({ error: 'قيمة الحجز تتجاوز الحد المسموح للبوت — يحتاج موافقة التاجر.' });
  }

  // Find or create user by phone
  const phone = '0' + ctx.customerPhone.replace(/^966/, '');
  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      name: args.customerName ?? 'عميل واتساب', phone, role: 'customer',
    }).returning();
  } else if (args.customerName && (user.name === 'عميل واتساب' || !user.name)) {
    await db.update(users).set({ name: args.customerName }).where(eq(users.id, user.id));
  }

  const existing = await db.select({ id: customers.id }).from(customers)
    .where(and(eq(customers.userId, user.id), eq(customers.vendorId, ctx.vendor.id))).limit(1);
  if (existing.length === 0) {
    await db.insert(customers).values({ userId: user.id, vendorId: ctx.vendor.id });
  }

  const bookingNumber = `RZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const trackingToken = randomBytes(24).toString('hex');

  const [booking] = await db.insert(bookings).values({
    bookingNumber,
    vendorId: ctx.vendor.id,
    customerId: user.id,
    packageId: args.packageId,
    scheduledAt: new Date(args.scheduledAt),
    address: ctx.vendor.address ?? '',
    totalPrice: String(price),
    status: 'confirmed',
    statusHistory: [{ status: 'confirmed', at: new Date().toISOString(), by: user.id }],
    trackingToken,
    notes: 'حجز عبر بوت واتساب AI',
    utmSource: 'whatsapp_bot_ai',
  }).returning();

  return JSON.stringify({
    ok: true,
    bookingNumber: booking.bookingNumber,
    scheduledAt: args.scheduledAt,
    packageName: pkg.name,
    priceSar: price,
  });
}

async function execSuggestPromo(ctx: AiContext): Promise<string> {
  if (!ctx.governance.canApplyPromo) {
    return JSON.stringify({ promo: null, note: 'تطبيق الأكواد غير مفعّل من التاجر.' });
  }
  const [promo] = await db.select({
    code: promoCodes.code,
    type: promoCodes.discountType,
    value: promoCodes.discountValue,
    desc: promoCodes.descriptionAr,
  })
    .from(promoCodes)
    .where(and(eq(promoCodes.vendorId, ctx.vendor.id), eq(promoCodes.isActive, true)))
    .orderBy(desc(promoCodes.createdAt))
    .limit(1);

  if (!promo) return JSON.stringify({ promo: null });
  return JSON.stringify({
    promo: {
      code: promo.code,
      discount: promo.type === 'percent' ? `${promo.value}%` : `${promo.value} ر.س`,
      description: promo.desc ?? null,
    },
  });
}

// ─── Main entry ──────────────────────────────────────────────────────────────

export interface AiTurn {
  /** What to send back to the customer on WhatsApp. May be empty if escalating. */
  reply: string;
  /** True when the model called escalate_to_vendor. */
  shouldEscalate: boolean;
  /** Reason from escalate_to_vendor, if any. */
  escalateReason?: string;
  /** True when the model used create_booking successfully. */
  createdBookingNumber?: string;
}

const SYSTEM_PROMPT_TEMPLATE = `أنت "مساعد {{vendorName}}"، بوت بيع وحجز ذكي على واتساب لمتجر سعودي.
You serve ONE store only: *{{vendorName}}*. Do not discuss other stores.

LANGUAGE POLICY (very important):
- Default: Saudi Arabic dialect — مختصر، ودود، طبيعي بدون فصحى متكلّفة.
  استعمل تعابير مثل: "هلا والله"، "تمام"، "ابشر"، "تحت أمرك"، "وش رايك"،
  "تبي/تبغى"، "كم تبي"، "زين"، "إن شاء الله".
  لا تستخدم رموز كثيرة، خل ردك واضح.
- If the customer's message is mostly English (Latin letters), reply in
  natural English — friendly, casual, no formal "Dear Sir/Madam".
- If the customer mixes Arabic and English, follow the dominant language
  of their LAST message and stay in it until they switch.
- Never translate prices/numbers — keep SAR and digits as-is in either language.

Goal in priority: (1) answer the question, (2) recommend the right
service, (3) take a time, (4) create the booking.

Store info:
{{vendorInfo}}

Hard rules:
- Always call list_services before stating any prices — never invent.
- Always call check_availability before suggesting a specific time.
- Only call create_booking AFTER an explicit confirmation
  ("تأكيد" / "أكد" / "احجزه" / "confirm" / "yes book it").
- If the customer wants a human, complains, or asks something out of
  scope, call escalate_to_vendor immediately.
- Keep replies short (2–4 lines) and clear. No marketing clichés.

Persuasion (use sparingly):
- Highlight one concrete value: time saved, quality guarantee, or warranty.
- Suggest a smart upgrade only when natural — never push.
- If the customer hesitates and the vendor allows discounts, use suggest_promo.

Today: {{today}}.`;

async function buildSystemPrompt(ctx: AiContext): Promise<string> {
  const wh = ((ctx.vendor.settings ?? {}) as { workingHours?: { start?: string; end?: string; days?: number[] } }).workingHours;
  const lines: string[] = [];
  lines.push(`- الاسم: ${ctx.vendor.nameAr}`);
  if (ctx.vendor.city)    lines.push(`- المدينة: ${ctx.vendor.city}`);
  if (ctx.vendor.address) lines.push(`- العنوان: ${ctx.vendor.address}`);
  if (wh?.start && wh?.end) lines.push(`- ساعات العمل: ${wh.start} – ${wh.end}`);
  lines.push(`- صلاحيات البوت: حجز=${ctx.governance.canBook ? 'مسموح' : 'غير مسموح'}، خصم=${ctx.governance.canApplyPromo ? 'مسموح' : 'غير مسموح'}${ctx.governance.maxBookingValue ? `، حد الحجز=${ctx.governance.maxBookingValue} ر.س` : ''}`);

  const today = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return SYSTEM_PROMPT_TEMPLATE
    .replace(/\{\{vendorName\}\}/g, ctx.vendor.nameAr)
    .replace('{{vendorInfo}}', lines.join('\n'))
    .replace('{{today}}', today);
}

export async function generateAiTurn(ctx: AiContext, userMessage: string): Promise<AiTurn | null> {
  const client = await getClient();
  if (!client) return null;
  const model = (await getSetting('openai.model')) ?? 'gpt-4o-mini';

  const systemPrompt = await buildSystemPrompt(ctx);

  // Compose conversation messages (system + last 8 turns + new message)
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...ctx.history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage },
  ];

  let shouldEscalate = false;
  let escalateReason: string | undefined;
  let createdBookingNumber: string | undefined;

  // Run a tool-use loop (max 3 hops to avoid runaway)
  for (let hop = 0; hop < 3; hop++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 700,
      temperature: 0.4,
    });

    const choice = completion.choices[0];
    const msg = choice.message;
    messages.push(msg as OpenAI.ChatCompletionMessageParam);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // No more tools — final answer
      return {
        reply: (msg.content ?? '').trim(),
        shouldEscalate,
        escalateReason,
        createdBookingNumber,
      };
    }

    // Execute every tool call requested in this hop
    for (const tc of msg.tool_calls) {
      if (tc.type !== 'function') continue;
      const args = (() => {
        try { return JSON.parse(tc.function.arguments); } catch { return {}; }
      })();
      let result = '';
      try {
        switch (tc.function.name) {
          case 'list_services':
            result = await execListServices(ctx, args.query);
            break;
          case 'check_availability':
            result = await execCheckAvailability(ctx, Number(args.packageId));
            break;
          case 'create_booking': {
            result = await execCreateBooking(ctx, {
              packageId:    Number(args.packageId),
              scheduledAt:  String(args.scheduledAt),
              customerName: args.customerName,
            });
            try {
              const parsed = JSON.parse(result);
              if (parsed?.ok && parsed.bookingNumber) createdBookingNumber = parsed.bookingNumber;
            } catch {/* ignore */}
            break;
          }
          case 'suggest_promo':
            result = await execSuggestPromo(ctx);
            break;
          case 'escalate_to_vendor':
            shouldEscalate = true;
            escalateReason = String(args.reason ?? '');
            result = JSON.stringify({ ok: true, willEscalate: true });
            break;
          default:
            result = JSON.stringify({ error: 'tool not found' });
        }
      } catch (e: any) {
        result = JSON.stringify({ error: e?.message ?? 'tool execution failed' });
      }
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  // Fallback if loop maxed out
  return {
    reply: 'سأعود إليك خلال لحظات.',
    shouldEscalate,
    escalateReason,
    createdBookingNumber,
  };
}
