import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, users, financials, customers, inventory, customerScores, employeeStats, vendors } from '../db/schema.js';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import {
  getFinancialSummary, getInventoryStatus, getTopPackages,
  getCustomerMetrics, getEmployeeProductivity, getPeakPattern,
  getVendorBasics,
} from '../services/vendorContext.js';
import {
  buildAgentSystemPrompt, getAgentIndustry, INDUSTRY_MARKET_DATA,
} from '../services/industryAgents.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

/* ─── Feature gate: vendor.settings.aiAdvisor.enabled must be true ─────────── */

async function requireAiAdvisorEnabled(vendorId: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  const v = await getVendorBasics(vendorId);
  if (!v) return { ok: false, reason: 'المتجر غير موجود' };
  const enabled = (v.settings as Record<string, any>)?.aiAdvisor?.enabled === true;
  if (!enabled) {
    return { ok: false, reason: 'المستشار الذكي غير مفعّل. فعّله من إعدادات المتجر أولاً.' };
  }
  return { ok: true };
}

// Gather business data for AI analysis
async function gatherBusinessData(vendorId: number) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // This month's bookings
  const [monthBookings] = await db.select({
    total: count(bookings.id),
    completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
    cancelled: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
    revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
    avgRating: sql<string>`coalesce(avg(${bookings.rating}), 0)`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.createdAt, thirtyDaysAgo),
  ));

  // Previous month's bookings (for comparison)
  const [prevMonthBookings] = await db.select({
    total: count(bookings.id),
    revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.createdAt, sixtyDaysAgo),
    lte(bookings.createdAt, thirtyDaysAgo),
  ));

  // This week's bookings
  const [weekBookings] = await db.select({
    total: count(bookings.id),
    revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.createdAt, sevenDaysAgo),
  ));

  // Customer stats
  const [customerStats] = await db.select({
    total: count(customers.id),
  }).from(customers).where(eq(customers.vendorId, vendorId));

  // Customer scoring breakdown
  const scoreTiers = await db.select({
    tier: customerScores.tier,
    count: count(customerScores.id),
    avgChurnRisk: sql<string>`avg(cast(${customerScores.churnRisk} as numeric))`,
  }).from(customerScores)
    .where(eq(customerScores.vendorId, vendorId))
    .groupBy(customerScores.tier);

  // Low stock items
  const lowStock = await db.select({
    count: count(inventory.id),
  }).from(inventory).where(and(
    eq(inventory.vendorId, vendorId),
    eq(inventory.isActive, true),
    sql`cast(${inventory.quantity} as numeric) <= cast(${inventory.minQuantity} as numeric)`,
  ));

  // Expenses this month
  const [monthExpenses] = await db.select({
    total: sql<string>`coalesce(sum(cast(${financials.amount} as numeric)), 0)`,
  }).from(financials).where(and(
    eq(financials.vendorId, vendorId),
    eq(financials.type, 'expense'),
    gte(financials.date, thirtyDaysAgo),
  ));

  // Peak hours (most bookings by hour)
  const peakHours = await db.select({
    hour: sql<number>`extract(hour from ${bookings.scheduledAt})`,
    count: count(bookings.id),
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.createdAt, thirtyDaysAgo),
  )).groupBy(sql`extract(hour from ${bookings.scheduledAt})`)
    .orderBy(desc(count(bookings.id)))
    .limit(5);

  // Peak days
  const peakDays = await db.select({
    day: sql<number>`extract(dow from ${bookings.scheduledAt})`,
    count: count(bookings.id),
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.createdAt, thirtyDaysAgo),
  )).groupBy(sql`extract(dow from ${bookings.scheduledAt})`)
    .orderBy(desc(count(bookings.id)))
    .limit(3);

  const dayNames: Record<number, string> = {
    0: 'الأحد', 1: 'الإثنين', 2: 'الثلاثاء', 3: 'الأربعاء',
    4: 'الخميس', 5: 'الجمعة', 6: 'السبت',
  };

  return {
    thisMonth: {
      totalBookings: Number(monthBookings?.total ?? 0),
      completedBookings: Number(monthBookings?.completed ?? 0),
      cancelledBookings: Number(monthBookings?.cancelled ?? 0),
      revenue: parseFloat(monthBookings?.revenue ?? '0'),
      avgRating: parseFloat(monthBookings?.avgRating ?? '0'),
      cancellationRate: monthBookings?.total
        ? ((Number(monthBookings.cancelled ?? 0) / Number(monthBookings.total)) * 100).toFixed(1)
        : '0',
    },
    lastMonth: {
      totalBookings: Number(prevMonthBookings?.total ?? 0),
      revenue: parseFloat(prevMonthBookings?.revenue ?? '0'),
    },
    thisWeek: {
      totalBookings: Number(weekBookings?.total ?? 0),
      revenue: parseFloat(weekBookings?.revenue ?? '0'),
    },
    customers: {
      total: Number(customerStats?.total ?? 0),
      tiers: scoreTiers.map(t => ({
        tier: t.tier,
        count: Number(t.count),
        avgChurnRisk: parseFloat(t.avgChurnRisk ?? '0'),
      })),
    },
    inventory: {
      lowStockCount: Number(lowStock[0]?.count ?? 0),
    },
    expenses: {
      monthTotal: parseFloat(monthExpenses?.total ?? '0'),
    },
    peakHours: peakHours.map(h => ({ hour: Number(h.hour), count: Number(h.count) })),
    peakDays: peakDays.map(d => ({
      day: dayNames[Number(d.day)] ?? `يوم ${d.day}`,
      count: Number(d.count),
    })),
    profitMargin: monthBookings?.revenue && monthExpenses?.total
      ? (((parseFloat(monthBookings.revenue) - parseFloat(monthExpenses.total)) / parseFloat(monthBookings.revenue)) * 100).toFixed(1)
      : null,
  };
}

// POST /api/ai-advisor/analyze — Get AI business recommendations
router.post('/analyze', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير مفعّلة حالياً' });
    }

    const data = await gatherBusinessData(vendorId);

    const openai = new OpenAI({ apiKey });

    const prompt = `أنت مستشار أعمال متخصص في قطاع الخدمات في السعودية. حلل البيانات التالية وقدم توصيات عملية.

بيانات الشهر الحالي:
- إجمالي الحجوزات: ${data.thisMonth.totalBookings}
- حجوزات مكتملة: ${data.thisMonth.completedBookings}
- حجوزات ملغاة: ${data.thisMonth.cancelledBookings} (نسبة الإلغاء: ${data.thisMonth.cancellationRate}%)
- الإيرادات: ${data.thisMonth.revenue.toFixed(0)} ر.س
- متوسط التقييم: ${data.thisMonth.avgRating.toFixed(1)}/5

بيانات الشهر السابق:
- إجمالي الحجوزات: ${data.lastMonth.totalBookings}
- الإيرادات: ${data.lastMonth.revenue.toFixed(0)} ر.س

بيانات هذا الأسبوع:
- الحجوزات: ${data.thisWeek.totalBookings}
- الإيرادات: ${data.thisWeek.revenue.toFixed(0)} ر.س

العملاء:
- إجمالي العملاء: ${data.customers.total}
- التوزيع: ${data.customers.tiers.map(t => `${t.tier}: ${t.count} (خطر مغادرة: ${(t.avgChurnRisk * 100).toFixed(0)}%)`).join(', ')}

المخزون:
- عناصر منخفضة المخزون: ${data.inventory.lowStockCount}

المصروفات الشهرية: ${data.expenses.monthTotal.toFixed(0)} ر.س
هامش الربح: ${data.profitMargin ?? 'غير متوفر'}%

أوقات الذروة: ${data.peakHours.map(h => `الساعة ${h.hour}:00 (${h.count} حجز)`).join(', ')}
أيام الذروة: ${data.peakDays.map(d => `${d.day} (${d.count} حجز)`).join(', ')}

قدم إجابتك بالعربية بصيغة JSON التالية فقط (بدون أي نص إضافي):
{
  "healthScore": <رقم من 0 إلى 100 يمثل صحة العمل>,
  "summary": "<ملخص تنفيذي في جملتين>",
  "insights": [
    { "type": "positive|warning|critical|tip", "title": "<عنوان قصير>", "detail": "<شرح مختصر>" }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "action": "<إجراء محدد>", "expectedImpact": "<الأثر المتوقع>" }
  ],
  "forecast": {
    "nextMonthRevenue": <تقدير إيرادات الشهر القادم>,
    "trend": "growing|stable|declining",
    "trendLabel": "<وصف الاتجاه>"
  }
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content ?? '{}';
    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch {
      analysis = { error: 'فشل في تحليل الاستجابة', raw: responseText };
    }

    return res.json({
      analysis,
      data: {
        thisMonth: data.thisMonth,
        lastMonth: data.lastMonth,
        customers: data.customers,
        profitMargin: data.profitMargin,
      },
      generatedAt: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[AI Advisor]', err);
    return res.status(500).json({ error: 'فشل في التحليل. حاول لاحقاً' });
  }
});

// GET /api/ai-advisor/quick-stats — Get data summary without AI
router.get('/quick-stats', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const data = await gatherBusinessData(vendorId);
    return res.json(data);
  } catch (err: any) {
    console.error('[AI Advisor quick-stats]', err);
    return res.status(500).json({ error: 'فشل في جلب البيانات' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   Industry-specialised chat agent
   POST /api/ai-advisor/agent/chat
   Body: { messages: [{ role: 'user'|'assistant', content: string }] }
   ────────────────────────────────────────────────────────────────────────── */

/** Tools the OpenAI function-calling loop can invoke. */
const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_financial_summary',
      description: 'إيرادات، مصروفات، ربح، هامش، ومقارنة مع الفترة السابقة.',
      parameters: {
        type: 'object',
        properties: {
          periodDays: { type: 'number', description: 'عدد الأيام (7, 30, 90)', default: 30 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_inventory_status',
      description: 'حالة المخزون الحالية — العناصر منخفضة المخزون، القيمة الإجمالية.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_top_packages',
      description: 'أعلى الباقات مبيعاً في الفترة المطلوبة.',
      parameters: {
        type: 'object',
        properties: {
          periodDays: { type: 'number', default: 30 },
          limit: { type: 'number', default: 5 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_customer_metrics',
      description: 'عدد العملاء، الجدد، نسبة العودة، متوسط الحجوزات لكل عميل.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_employee_productivity',
      description: 'أداء الموظفين — الحجوزات المكتملة، التقييم، الإيراد لكل موظف.',
      parameters: {
        type: 'object',
        properties: { periodDays: { type: 'number', default: 30 } },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_peak_pattern',
      description: 'ساعات وأيام ذروة الحجوزات عند هذا التاجر.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

async function executeAgentTool(
  vendorId: number,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const days = Math.max(1, Math.min(365, Number(args.periodDays ?? 30)));
  switch (name) {
    case 'get_financial_summary': return await getFinancialSummary(vendorId, days);
    case 'get_inventory_status':  return await getInventoryStatus(vendorId);
    case 'get_top_packages':      return await getTopPackages(vendorId, days, Number(args.limit ?? 5));
    case 'get_customer_metrics':  return await getCustomerMetrics(vendorId);
    case 'get_employee_productivity': return await getEmployeeProductivity(vendorId, days);
    case 'get_peak_pattern':      return await getPeakPattern(vendorId);
    default:                       return { error: `أداة غير معروفة: ${name}` };
  }
}

router.post('/agent/chat', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const gate = await requireAiAdvisorEnabled(vendorId);
    if (!gate.ok) return res.status(403).json({ error: gate.reason, needsEnable: true });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير مفعّلة على السيرفر' });

    const { messages } = req.body as {
      messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
    };
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages مطلوبة' });
    }

    const vendor = await getVendorBasics(vendorId);
    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    const industry = getAgentIndustry(vendor.industry);
    const systemPrompt = buildAgentSystemPrompt({
      industry,
      vendorNameAr: vendor.nameAr,
      vendorCity: vendor.city,
    });

    const openai = new OpenAI({ apiKey });

    // Function-calling loop: we cap at 6 iterations to be safe.
    const conversation: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({
        role: m.role,
        content: m.content,
      } as OpenAI.Chat.ChatCompletionMessageParam)),
    ];

    const toolCallLog: { name: string; args: unknown }[] = [];

    for (let step = 0; step < 6; step++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: 0.4,
        max_tokens: 900,
      });

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        conversation.push(msg);
        for (const tc of msg.tool_calls) {
          if (tc.type !== 'function') continue;
          let parsed: Record<string, unknown> = {};
          try { parsed = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
          toolCallLog.push({ name: tc.function.name, args: parsed });
          const result = await executeAgentTool(vendorId, tc.function.name, parsed);
          conversation.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue; // Let the model see tool results and respond.
      }

      // No more tool calls — final answer.
      return res.json({
        reply: msg.content ?? '',
        toolCalls: toolCallLog,
        industry,
        industryLabel: INDUSTRY_MARKET_DATA[industry].label,
      });
    }

    return res.status(500).json({ error: 'المستشار لم يُنهِ الرد بعد 6 خطوات' });
  } catch (err: any) {
    console.error('[AI Advisor agent/chat]', err);
    return res.status(500).json({ error: err?.message ?? 'فشل في المحادثة. حاول لاحقاً.' });
  }
});

/* GET /api/ai-advisor/agent/status — check whether the advisor is enabled */
router.get('/agent/status', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });
    const v = await getVendorBasics(vendorId);
    const enabled = (v?.settings as Record<string, any>)?.aiAdvisor?.enabled === true;
    const industry = getAgentIndustry(v?.industry);
    return res.json({
      enabled,
      industry,
      industryLabel: INDUSTRY_MARKET_DATA[industry].label,
      serverHasApiKey: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'فشل في جلب الحالة' });
  }
});

/* PUT /api/ai-advisor/agent/toggle — enable or disable */
router.put('/agent/toggle', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });
    const enable = Boolean(req.body?.enabled);

    const [current] = await db.select({ settings: vendors.settings })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    const settings = (current?.settings as Record<string, unknown>) ?? {};
    const updated = {
      ...settings,
      aiAdvisor: { ...((settings as any).aiAdvisor ?? {}), enabled: enable },
    };
    await db.update(vendors)
      .set({ settings: updated, updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    return res.json({ enabled: enable });
  } catch (err: any) {
    console.error('[AI Advisor toggle]', err);
    return res.status(500).json({ error: 'فشل في تحديث الإعداد' });
  }
});

export default router;
