import { Router } from 'express';
import { requireAuth, AuthRequest, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { bookings, users, employeeStats, payrollRecords } from '../db/schema.js';
import { eq, and, gte, lte, sql, count, desc } from 'drizzle-orm';

const router = Router();
router.use(requireAuth);

// GET /api/gamification/leaderboard — Employee ranking
router.get('/leaderboard', requireRole('vendor_admin', 'admin', 'employee'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const period = (req.query.period as string) ?? 'month';
    const now = new Date();
    let since: Date;

    if (period === 'week') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'today') {
      since = new Date(now); since.setHours(0, 0, 0, 0);
    } else {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const leaderboard = await db.select({
      employeeId: bookings.employeeId,
      employeeName: users.name,
      employeePhone: users.phone,
      completedCount: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
      totalRevenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
      avgRating: sql<string>`coalesce(avg(${bookings.rating}), 0)`,
      fiveStarCount: sql<number>`count(*) filter (where ${bookings.rating} = 5)`,
    })
      .from(bookings)
      .leftJoin(users, eq(bookings.employeeId, users.id))
      .where(and(
        eq(bookings.vendorId, vendorId),
        gte(bookings.updatedAt, since),
        sql`${bookings.employeeId} IS NOT NULL`,
      ))
      .groupBy(bookings.employeeId, users.name, users.phone)
      .orderBy(desc(sql`count(*) filter (where ${bookings.status} = 'completed')`))
      .limit(20);

    // Calculate achievements for each employee
    const result = leaderboard.map((emp, index) => {
      const completed = Number(emp.completedCount);
      const revenue = parseFloat(emp.totalRevenue ?? '0');
      const avgRating = parseFloat(emp.avgRating ?? '0');
      const fiveStars = Number(emp.fiveStarCount);

      // Badges
      const badges: Array<{ id: string; name: string; icon: string; color: string }> = [];

      if (completed >= 50) badges.push({ id: 'powerhouse', name: 'محرك الإنتاج', icon: '🔥', color: '#ef4444' });
      else if (completed >= 30) badges.push({ id: 'machine', name: 'آلة العمل', icon: '⚡', color: '#f59e0b' });
      else if (completed >= 15) badges.push({ id: 'worker', name: 'عامل نشيط', icon: '💪', color: '#3b82f6' });

      if (avgRating >= 4.8) badges.push({ id: 'star', name: 'نجم الخدمة', icon: '⭐', color: '#f59e0b' });
      if (fiveStars >= 10) badges.push({ id: 'perfect', name: 'الكمال', icon: '💎', color: '#a855f7' });
      if (revenue >= 5000) badges.push({ id: 'revenue', name: 'صانع الأرباح', icon: '💰', color: '#10b981' });

      // Streak (approximate — consecutive completed bookings)
      const streak = Math.min(completed, Math.floor(completed * (1 - (Number(emp.fiveStarCount) > 0 ? 0.1 : 0.3))));

      // XP calculation
      const xp = completed * 100 + fiveStars * 50 + Math.floor(revenue / 10);
      const level = Math.floor(xp / 1000) + 1;
      const xpInLevel = xp % 1000;

      return {
        rank: index + 1,
        employeeId: emp.employeeId,
        name: emp.employeeName ?? 'موظف',
        completedBookings: completed,
        revenue,
        avgRating: Math.round(avgRating * 10) / 10,
        fiveStarCount: fiveStars,
        badges,
        streak,
        xp,
        level,
        xpInLevel,
        xpToNextLevel: 1000,
      };
    });

    return res.json({
      period,
      leaderboard: result,
      periodLabel: period === 'today' ? 'اليوم' : period === 'week' ? 'هذا الأسبوع' : 'هذا الشهر',
    });

  } catch (err) {
    console.error('[Gamification leaderboard]', err);
    return res.status(500).json({ error: 'فشل في جلب البيانات' });
  }
});

// GET /api/gamification/my-stats — Current employee's stats
router.get('/my-stats', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمشروع' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);

    // Today's stats
    const [todayStats] = await db.select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
      revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
    }).from(bookings).where(and(
      eq(bookings.employeeId, userId),
      eq(bookings.vendorId, vendorId),
      gte(bookings.updatedAt, startOfDay),
    ));

    // Month stats
    const [monthStats] = await db.select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
      revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
      avgRating: sql<string>`coalesce(avg(${bookings.rating}), 0)`,
      fiveStars: sql<number>`count(*) filter (where ${bookings.rating} = 5)`,
      totalBookings: count(bookings.id),
    }).from(bookings).where(and(
      eq(bookings.employeeId, userId),
      eq(bookings.vendorId, vendorId),
      gte(bookings.updatedAt, startOfMonth),
    ));

    // All-time stats
    const [allTimeStats] = await db.select({
      completed: sql<number>`count(*) filter (where ${bookings.status} = 'completed')`,
      revenue: sql<string>`coalesce(sum(case when ${bookings.status} = 'completed' then cast(${bookings.totalPrice} as numeric) else 0 end), 0)`,
    }).from(bookings).where(and(
      eq(bookings.employeeId, userId),
      eq(bookings.vendorId, vendorId),
    ));

    const completed = Number(monthStats?.completed ?? 0);
    const allTimeCompleted = Number(allTimeStats?.completed ?? 0);
    const fiveStars = Number(monthStats?.fiveStars ?? 0);
    const revenue = parseFloat(monthStats?.revenue ?? '0');

    // XP & Level
    const xp = allTimeCompleted * 100 + fiveStars * 50 + Math.floor(parseFloat(allTimeStats?.revenue ?? '0') / 10);
    const level = Math.floor(xp / 1000) + 1;

    // Daily goal: 8 bookings
    const dailyGoal = 8;
    const todayCompleted = Number(todayStats?.completed ?? 0);

    return res.json({
      today: {
        completed: todayCompleted,
        revenue: parseFloat(todayStats?.revenue ?? '0'),
        goalProgress: Math.min(100, Math.round((todayCompleted / dailyGoal) * 100)),
        goal: dailyGoal,
      },
      month: {
        completed,
        revenue,
        avgRating: Math.round(parseFloat(monthStats?.avgRating ?? '0') * 10) / 10,
        fiveStarCount: fiveStars,
      },
      allTime: {
        completed: allTimeCompleted,
        revenue: parseFloat(allTimeStats?.revenue ?? '0'),
      },
      xp,
      level,
      xpInLevel: xp % 1000,
      xpToNextLevel: 1000,
    });

  } catch (err) {
    console.error('[Gamification my-stats]', err);
    return res.status(500).json({ error: 'فشل في جلب البيانات' });
  }
});

export default router;
