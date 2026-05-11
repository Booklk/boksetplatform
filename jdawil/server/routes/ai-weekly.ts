/**
 * AI Sector Advisor 2.0 — weekly digest with sector benchmarks +
 * actionable recommendations.
 *
 * Reads:
 *   - vendor's last 7-day numbers (bookings, revenue, no-shows)
 *   - sector market data from industryAgents.INDUSTRY_MARKET_DATA
 *   - prior week's numbers for delta
 *
 * Returns:
 *   - 3 vital stats with ▲ / ▼ vs prior week
 *   - up to 5 prioritized recommendations the vendor can act on this week
 *   - sector benchmark snippet so the vendor knows where they stand
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { bookings, vendors } from '../db/schema.js';
import { eq, and, gte, lt, sql, count, sum } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.js';
import { getAgentIndustry, INDUSTRY_MARKET_DATA } from '../services/industryAgents.js';

const router = Router();
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

interface Recommendation {
  priority: 'high' | 'normal' | 'low';
  title: string;
  body: string;
  action?: { label: string; link: string };
}

router.get('/me', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const [v] = await db.select({
      industry: vendors.industry,
      nameAr: vendors.nameAr,
    }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!v) return res.status(404).json({ error: 'المتجر غير موجود' });

    // Time windows
    const now = new Date();
    const week = 7 * 24 * 60 * 60 * 1000;
    const thisWeekStart = new Date(now.getTime() - week);
    const lastWeekStart = new Date(now.getTime() - 2 * week);

    async function snapshot(from: Date, to: Date) {
      const [row] = await db.select({
        total: count(bookings.id),
        revenue: sum(bookings.totalPrice),
        noShow: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'no_show')::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'completed')::int`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'cancelled')::int`,
      })
        .from(bookings)
        .where(and(
          eq(bookings.vendorId, vendorId),
          gte(bookings.createdAt, from),
          lt(bookings.createdAt, to),
        ));
      return {
        bookings: Number(row?.total ?? 0),
        revenue: Number(row?.revenue ?? 0),
        noShow: Number(row?.noShow ?? 0),
        completed: Number(row?.completed ?? 0),
        cancelled: Number(row?.cancelled ?? 0),
      };
    }

    const thisWeek = await snapshot(thisWeekStart, now);
    const lastWeek = await snapshot(lastWeekStart, thisWeekStart);

    const pctDelta = (now: number, prev: number) => {
      if (prev === 0) return now > 0 ? 100 : 0;
      return Math.round(((now - prev) / prev) * 100);
    };

    const stats = [
      {
        label: 'حجوزات هذا الأسبوع',
        value: thisWeek.bookings,
        deltaPct: pctDelta(thisWeek.bookings, lastWeek.bookings),
      },
      {
        label: 'إيراد هذا الأسبوع',
        value: thisWeek.revenue,
        suffix: 'ر.س',
        deltaPct: pctDelta(thisWeek.revenue, lastWeek.revenue),
      },
      {
        label: 'حجوزات لم يحضر العميل',
        value: thisWeek.noShow,
        deltaPct: pctDelta(thisWeek.noShow, lastWeek.noShow),
        invertDelta: true,
      },
    ];

    // Sector benchmark snippet
    const agentKey = getAgentIndustry(v.industry);
    const benchmark = INDUSTRY_MARKET_DATA[agentKey];

    // ─── Recommendations engine ────────────────────────────────────────────
    const recs: Recommendation[] = [];

    // 1) No-show alert
    const noShowRate = thisWeek.bookings > 0 ? thisWeek.noShow / thisWeek.bookings : 0;
    if (noShowRate > 0.1) {
      recs.push({
        priority: 'high',
        title: `نسبة الـ no-show عندك ${(noShowRate * 100).toFixed(0)}٪ — مرتفعة`,
        body: 'فعّل العربون 30٪ + سلسلة تذكيرات (24س + 3س) لتنزل النسبة لأقل من 5٪. أكثر تجار قطاعك يطبّقونها.',
        action: { label: 'إعدادات العربون', link: '/vendor/payment-gateway' },
      });
    }

    // 2) Revenue trend
    if (thisWeek.bookings > 0 && thisWeek.revenue / thisWeek.bookings > 0) {
      const avgTicket = thisWeek.revenue / thisWeek.bookings;
      recs.push({
        priority: 'normal',
        title: `متوسط قيمة الحجز عندك ${avgTicket.toFixed(0)} ر.س`,
        body: `نطاق قطاعك: ${benchmark.priceRangeSar}. لو أنت أقل من النطاق، فعّل upsell عبر بوت واتساب الذكي.`,
        action: { label: 'إعدادات البوت', link: '/vendor/whatsapp-bot' },
      });
    }

    // 3) Loyalty — if punching activity & no program
    if (thisWeek.completed >= 5) {
      recs.push({
        priority: 'normal',
        title: 'فعّل برنامج ولاء — عندك زبائن متكررين',
        body: 'لو نسبة 30٪ من العملاء يرجعون، برنامج "اشترِ 6 احصل على 7 مجاناً" يرفع تكرار الزيارة 1.5×.',
        action: { label: 'برنامج الولاء', link: '/vendor/loyalty-settings' },
      });
    }

    // 4) Sector-specific growth lever (rotate weekly)
    const lever = benchmark.growthLevers[
      Math.floor(now.getTime() / week) % benchmark.growthLevers[0]?.length || 0
    ] ?? benchmark.growthLevers[0];
    if (lever) {
      recs.push({
        priority: 'normal',
        title: 'اقتراح هذا الأسبوع لقطاعك',
        body: lever,
      });
    }

    // 5) Sector pitfall alert
    const pitfall = benchmark.commonPitfalls[
      Math.floor(now.getTime() / week) % (benchmark.commonPitfalls.length || 1)
    ];
    if (pitfall) {
      recs.push({
        priority: 'low',
        title: 'انتبه من هذا الخطأ الشائع',
        body: pitfall,
      });
    }

    // 6) Empty week
    if (thisWeek.bookings === 0) {
      recs.unshift({
        priority: 'high',
        title: 'أسبوع بدون حجوزات — لنوقظ المتجر',
        body: 'أرسل حملة واتساب لعملائك السابقين بعرض خاص. متوسط الاستجابة: 8-15٪.',
        action: { label: 'حملة واتساب', link: '/vendor/campaigns' },
      });
    }

    return res.json({
      vendor: { nameAr: v.nameAr, industry: v.industry, industryLabel: benchmark.label },
      thisWeek,
      lastWeek,
      stats,
      benchmark: {
        priceRangeSar: benchmark.priceRangeSar,
        margingPct: benchmark.margingPct,
        peakPattern: benchmark.peakPattern,
      },
      recommendations: recs.slice(0, 5),
      generatedAt: now.toISOString(),
    });
  } catch (e) {
    console.error('[ai-weekly]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
