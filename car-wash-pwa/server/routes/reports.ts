import { Router } from 'express';
import { db } from '../db/index.js';
import { bookings, users, packages, services, financials, inventory, loyaltyPrograms, promoCodes as promos } from '../db/schema.js';
import { eq, desc, and, gte, lte, sql, count, ne, lt } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Dashboard stats (vendor-scoped) ─────────────────────────────────────────
router.get('/dashboard', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(monthStart);

    const vFilter = eq(bookings.vendorId, vendorId);
    const fFilter = eq(financials.vendorId, vendorId);

    const [[totalBookings], [todayBookings], [completedToday], [pendingCount],
           [totalIncome], [monthIncome], [prevMonthIncome], [weekIncome],
           [monthExpenses], [avgRating], [totalCustomers], lowStockItems] = await Promise.all([
      db.select({ count: count() }).from(bookings).where(vFilter),
      db.select({ count: count() }).from(bookings).where(and(vFilter, gte(bookings.scheduledAt, today), lte(bookings.scheduledAt, tomorrow))),
      db.select({ count: count() }).from(bookings).where(and(vFilter, eq(bookings.status, 'completed'), gte(bookings.updatedAt, today))),
      db.select({ count: count() }).from(bookings).where(and(vFilter, eq(bookings.status, 'pending'))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(fFilter, eq(financials.type, 'income'))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(fFilter, eq(financials.type, 'income'), gte(financials.date, monthStart))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(fFilter, eq(financials.type, 'income'), gte(financials.date, prevMonthStart), lte(financials.date, prevMonthEnd))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(fFilter, eq(financials.type, 'income'), gte(financials.date, weekStart))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(fFilter, eq(financials.type, 'expense'), gte(financials.date, monthStart))),
      db.select({ avg: sql<string>`ROUND(AVG(${bookings.rating}),1)` }).from(bookings).where(and(vFilter, sql`${bookings.rating} IS NOT NULL`)),
      db.select({ count: count() }).from(users).where(and(eq(users.role, 'customer'), eq(users.vendorId, vendorId))),
      db.select().from(inventory).where(and(eq(inventory.vendorId, vendorId), lte(inventory.quantity, inventory.minQuantity))).limit(5),
    ]);

    const monthIncomeVal = parseFloat(monthIncome.total ?? '0');
    const prevMonthVal = parseFloat(prevMonthIncome.total ?? '0');
    const monthGrowth = prevMonthVal > 0 ? Math.round(((monthIncomeVal - prevMonthVal) / prevMonthVal) * 100) : null;

    return res.json({
      totalBookings: totalBookings.count,
      todayBookings: todayBookings.count,
      completedToday: completedToday.count,
      pendingCount: pendingCount.count,
      totalIncome: parseFloat(totalIncome.total ?? '0'),
      monthIncome: monthIncomeVal,
      prevMonthIncome: prevMonthVal,
      monthGrowth,
      weekIncome: parseFloat(weekIncome.total ?? '0'),
      monthExpenses: parseFloat(monthExpenses.total ?? '0'),
      monthProfit: monthIncomeVal - parseFloat(monthExpenses.total ?? '0'),
      avgRating: parseFloat(avgRating.avg ?? '0'),
      totalCustomers: totalCustomers.count,
      lowStockCount: lowStockItems.length,
      lowStockItems,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Revenue chart — last 12 months (vendor-scoped) ─────────────────────────
router.get('/revenue', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const { months = '6' } = req.query as Record<string, string>;
    const numMonths = Math.min(12, Math.max(1, parseInt(months)));
    const since = new Date(); since.setMonth(since.getMonth() - numMonths + 1); since.setDate(1); since.setHours(0,0,0,0);

    const rows = await db.select({
      month: sql<string>`TO_CHAR(${financials.date}, 'YYYY-MM')`,
      total: sql<string>`COALESCE(SUM(${financials.amount}),0)`,
      type: financials.type,
    })
      .from(financials)
      .where(and(eq(financials.vendorId, vendorId), gte(financials.date, since)))
      .groupBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`, financials.type)
      .orderBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`);

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Revenue summary — this week day by day ─────────────────────────────────
router.get('/revenue/week', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);

    const rows = await db.select({
      day: sql<string>`TO_CHAR(${financials.date}, 'YYYY-MM-DD')`,
      income: sql<string>`COALESCE(SUM(CASE WHEN ${financials.type}='income' THEN ${financials.amount} ELSE 0 END),0)`,
      expense: sql<string>`COALESCE(SUM(CASE WHEN ${financials.type}='expense' THEN ${financials.amount} ELSE 0 END),0)`,
    })
      .from(financials)
      .where(and(eq(financials.vendorId, vendorId), gte(financials.date, weekStart)))
      .groupBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM-DD')`);

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Top services (vendor-scoped) ───────────────────────────────────────────
router.get('/top-services', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const rows = await db.select({
      serviceName: services.name,
      packageName: packages.name,
      bookingCount: count(bookings.id),
      totalRevenue: sql<string>`COALESCE(SUM(${bookings.totalPrice}),0)`,
    })
      .from(bookings)
      .leftJoin(packages, eq(bookings.packageId, packages.id))
      .leftJoin(services, eq(packages.serviceId, services.id))
      .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')))
      .groupBy(services.name, packages.name)
      .orderBy(desc(count(bookings.id)))
      .limit(5);

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Summary endpoint (used by old dashboard) ──────────────────────────────
router.get('/summary', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const vf = eq(bookings.vendorId, vendorId);

    const [[todayB], [pendingB], [monthIncome], [avgRating]] = await Promise.all([
      db.select({ count: count() }).from(bookings).where(and(vf, gte(bookings.scheduledAt, today), lte(bookings.scheduledAt, tomorrow))),
      db.select({ count: count() }).from(bookings).where(and(vf, eq(bookings.status, 'pending'))),
      db.select({ total: sql<string>`COALESCE(SUM(${financials.amount}),0)` }).from(financials).where(and(eq(financials.vendorId, vendorId), eq(financials.type, 'income'), gte(financials.date, monthStart))),
      db.select({ avg: sql<string>`ROUND(AVG(${bookings.rating}),1)` }).from(bookings).where(and(vf, sql`${bookings.rating} IS NOT NULL`)),
    ]);

    return res.json({
      todayBookings: todayB.count,
      pendingBookings: pendingB.count,
      totalRevenue: parseFloat(monthIncome.total ?? '0'),
      rating: parseFloat(avgRating.avg ?? '0') || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Smart Insights — personalized growth opportunities ─────────────────────
router.get('/insights', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cutoff21 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const vFilter = eq(bookings.vendorId, vendorId);

    // 1. Inactive customers (booked at least once but not in 21 days)
    const [{ inactiveCount }] = await db.select({
      inactiveCount: sql<number>`COUNT(DISTINCT ${bookings.customerId})`,
    }).from(bookings).where(and(
      vFilter,
      ne(bookings.status, 'cancelled'),
      lt(bookings.updatedAt, cutoff21),
      gte(bookings.updatedAt, cutoff90),
    ));

    // 2. Avg booking value this month
    const [{ avgVal }] = await db.select({
      avgVal: sql<string>`COALESCE(AVG(${bookings.totalPrice}), 0)`,
    }).from(bookings).where(and(vFilter, eq(bookings.status, 'completed'), gte(bookings.updatedAt, monthStart)));
    const avgBookingValue = Math.round(parseFloat(avgVal ?? '0'));

    // 3. Slowest day of week in last 28 days (0=Sun...6=Sat)
    const last28 = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const dayRows = await db.select({
      dow: sql<string>`EXTRACT(DOW FROM ${bookings.scheduledAt})::int`,
      cnt: count(),
    }).from(bookings)
      .where(and(vFilter, gte(bookings.scheduledAt, last28), ne(bookings.status, 'cancelled')))
      .groupBy(sql`EXTRACT(DOW FROM ${bookings.scheduledAt})::int`);

    const allDows = [0, 1, 2, 3, 4, 5, 6];
    const dayMap = Object.fromEntries(dayRows.map(r => [String(r.dow), r.cnt]));
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const activeDays = allDows.filter(d => d !== now.getDay());
    activeDays.sort((a, b) => (dayMap[String(a)] ?? 0) - (dayMap[String(b)] ?? 0));
    const slowestDow = activeDays[0];
    const slowestDayName = dayNames[slowestDow];
    const slowestDayCount = dayMap[String(slowestDow)] ?? 0;

    // 4. Total completed bookings this month
    const [{ monthBookings }] = await db.select({
      monthBookings: sql<number>`COUNT(*)`,
    }).from(bookings).where(and(vFilter, eq(bookings.status, 'completed'), gte(bookings.updatedAt, monthStart)));
    const timeSavedHours = Math.round((Number(monthBookings) * 15) / 60); // 15 min per booking

    // 5. Active loyalty program?
    const [loyalty] = await db.select({ isActive: loyaltyPrograms.isActive })
      .from(loyaltyPrograms).where(eq(loyaltyPrograms.vendorId, vendorId)).limit(1);
    const hasLoyalty = loyalty?.isActive === true;

    // 6. Active promos?
    const [activePromo] = await db.select({ id: promos.id })
      .from(promos).where(and(eq(promos.vendorId, vendorId), eq(promos.isActive, true))).limit(1);
    const hasActivePromo = !!activePromo;

    // 7. Month income vs prev month
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [{ curIncome }] = await db.select({
      curIncome: sql<string>`COALESCE(SUM(${financials.amount}),0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId), eq(financials.type, 'income'), gte(financials.date, monthStart)
    ));
    const [{ prevIncome }] = await db.select({
      prevIncome: sql<string>`COALESCE(SUM(${financials.amount}),0)`,
    }).from(financials).where(and(
      eq(financials.vendorId, vendorId), eq(financials.type, 'income'),
      gte(financials.date, prevMonthStart), lt(financials.date, monthStart)
    ));
    const curIncomeVal = parseFloat(curIncome ?? '0');
    const prevIncomeVal = parseFloat(prevIncome ?? '0');
    const growth = prevIncomeVal > 0 ? Math.round(((curIncomeVal - prevIncomeVal) / prevIncomeVal) * 100) : null;

    // Build insights array (ordered by priority)
    const insights = [];

    // A. Inactive customers opportunity
    const inactiveNum = Number(inactiveCount ?? 0);
    if (inactiveNum > 0) {
      const potential = inactiveNum * avgBookingValue;
      insights.push({
        id: 'inactive_customers',
        type: 'opportunity',
        emoji: '💤',
        title: `${inactiveNum} عميل لم يحجز منذ 3 أسابيع`,
        body: `رسالة تذكير واحدة تسترد 60% منهم في المتوسط`,
        value: potential > 0 ? `+${potential.toLocaleString('ar-SA')} ريال محتملة` : null,
        actionLabel: 'تذكيرهم الآن',
        actionUrl: '/vendor/promos',
        color: 'amber',
      });
    }

    // B. Slow day opportunity
    if (slowestDayCount < 3) {
      const potentialDay = avgBookingValue * 4; // 4 extra bookings on slow day
      insights.push({
        id: 'slow_day',
        type: 'opportunity',
        emoji: '📅',
        title: `${slowestDayName} ظرفك خفيف`,
        body: `أقل أيامك حجوزاً — عرض سريع يملأ جدولك`,
        value: potentialDay > 0 ? `+${potentialDay.toLocaleString('ar-SA')} ريال لو ملأته` : null,
        actionLabel: 'أضف عرضاً',
        actionUrl: '/vendor/promos',
        color: 'blue',
      });
    }

    // C. Platform impact this month (automation)
    if (Number(monthBookings) > 0) {
      insights.push({
        id: 'time_saved',
        type: 'impact',
        emoji: '⚡',
        title: `وفّرت ${timeSavedHours} ساعة هذا الشهر`,
        body: `${monthBookings} حجز نُظّم تلقائياً بدون تسجيل يدوي أو مكالمات`,
        value: null,
        actionLabel: 'مشاهدة التقارير',
        actionUrl: '/vendor/analytics',
        color: 'emerald',
      });
    }

    // D. Loyalty / promo suggestions
    if (!hasLoyalty) {
      insights.push({
        id: 'loyalty',
        type: 'suggestion',
        emoji: '🎁',
        title: 'فعّل برنامج الولاء',
        body: 'المغاسل التي تفعّل الولاء تحصل على 20% زيادة في تكرار الحجوزات',
        value: null,
        actionLabel: 'فعّل الآن',
        actionUrl: '/vendor/settings',
        color: 'purple',
      });
    } else if (!hasActivePromo) {
      insights.push({
        id: 'promo',
        type: 'suggestion',
        emoji: '🔥',
        title: 'لا توجد عروض نشطة',
        body: 'المغاسل ذات العروض تحصل على 35% حجوزات أكثر في أيام الأسبوع الهادئة',
        value: null,
        actionLabel: 'أضف عرضاً',
        actionUrl: '/vendor/promos',
        color: 'rose',
      });
    }

    // E. Growth momentum (positive reinforcement)
    if (growth !== null && growth > 0) {
      insights.push({
        id: 'growth',
        type: 'win',
        emoji: '🚀',
        title: `نمو ${growth}% هذا الشهر`,
        body: `دخلك ارتفع من ${prevIncomeVal.toLocaleString('ar-SA')} إلى ${curIncomeVal.toLocaleString('ar-SA')} ريال`,
        value: `+${(curIncomeVal - prevIncomeVal).toLocaleString('ar-SA')} ريال`,
        actionLabel: 'تفاصيل النمو',
        actionUrl: '/vendor/analytics',
        color: 'emerald',
      });
    }

    return res.json({
      insights: insights.slice(0, 4), // max 4 cards
      meta: {
        monthBookings: Number(monthBookings),
        timeSavedHours,
        inactiveCustomers: inactiveNum,
        hasLoyalty,
        growth,
        curIncome: curIncomeVal,
        prevIncome: prevIncomeVal,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── AI Revenue Predictions — next 3 months via linear regression ─────────────
router.get('/predictions', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    // Last 6 months starting from 6 months ago (inclusive)
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select({
        month: sql<string>`TO_CHAR(${financials.date}, 'YYYY-MM')`,
        income: sql<string>`COALESCE(SUM(${financials.amount}), 0)`,
      })
      .from(financials)
      .where(
        and(
          eq(financials.vendorId, vendorId),
          eq(financials.type, 'income'),
          gte(financials.date, since),
        ),
      )
      .groupBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${financials.date}, 'YYYY-MM')`);

    // Build history array (fill missing months with 0)
    const historyMap: Record<string, number> = {};
    for (const row of rows) {
      historyMap[row.month] = parseFloat(row.income ?? '0');
    }

    const history: { month: string; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      history.push({ month: label, income: historyMap[label] ?? 0 });
    }

    // Linear regression: y = a + b*x  (x = 0..5)
    const n = history.length;
    const xs = history.map((_, i) => i);
    const ys = history.map(h => h.income);

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
    const intercept = (sumY - slope * sumX) / n;

    // Project next 3 months
    const predictions: { month: string; income: number; isProjection: true }[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() + i);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const projected = Math.max(0, Math.round(intercept + slope * (n - 1 + i)));
      predictions.push({ month: label, income: projected, isProjection: true });
    }

    // Month-over-month growth rates
    const growthRates: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].income;
      const cur = history[i].income;
      if (prev > 0) growthRates.push(((cur - prev) / prev) * 100);
    }
    const avgGrowthRate =
      growthRates.length > 0
        ? Math.round((growthRates.reduce((a, b) => a + b, 0) / growthRates.length) * 10) / 10
        : 0;

    // Trend
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (slope > 50) trend = 'up';
    else if (slope < -50) trend = 'down';

    // Confidence: based on how consistent the growth rates are
    let confidence: 'low' | 'medium' | 'high' = 'low';
    if (growthRates.length >= 4) {
      const mean = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
      const variance =
        growthRates.reduce((acc, r) => acc + (r - mean) ** 2, 0) / growthRates.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev < 10) confidence = 'high';
      else if (stdDev < 25) confidence = 'medium';
      else confidence = 'low';
    } else if (growthRates.length >= 2) {
      confidence = 'medium';
    }

    return res.json({
      history,
      predictions,
      trend,
      avgGrowthRate,
      nextMonthProjection: predictions[0]?.income ?? 0,
      confidence,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Employee Performance Report ──────────────────────────────────────────────
router.get('/employee-performance', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد منشأة' });

    const { from, to } = req.query as Record<string, string>;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const rows = await db
      .select({
        employeeId: bookings.employeeId,
        employeeName: users.name,
        totalCompleted: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'completed' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'completed' THEN CAST(${bookings.totalPrice} AS DECIMAL) END), 0)`,
        avgRating: sql<number>`ROUND(AVG(CASE WHEN ${bookings.rating} IS NOT NULL THEN ${bookings.rating} END)::NUMERIC, 1)`,
        totalRatings: sql<number>`COUNT(CASE WHEN ${bookings.rating} IS NOT NULL THEN 1 END)`,
        fiveStar: sql<number>`COUNT(CASE WHEN ${bookings.rating} = 5 THEN 1 END)`,
      })
      .from(bookings)
      .innerJoin(users, eq(bookings.employeeId, users.id))
      .where(and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.scheduledAt, fromDate),
        lte(bookings.scheduledAt, toDate),
      ))
      .groupBy(bookings.employeeId, users.name)
      .orderBy(sql`COUNT(CASE WHEN ${bookings.status} = 'completed' THEN 1 END) DESC`);

    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
