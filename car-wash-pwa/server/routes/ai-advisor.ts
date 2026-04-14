import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, users, financials, customers, inventory, customerScores, employeeStats } from '../db/schema.js';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';
import OpenAI from 'openai';

const router = Router();

router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

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

export default router;
