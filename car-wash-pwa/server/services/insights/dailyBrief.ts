/**
 * Daily brief — the "good morning" summary the vendor sees first thing.
 *
 * Pipeline:
 *   1. Collect raw metrics (yesterday + last 7 days baseline).
 *   2. Detect anomalies vs baseline (revenue ±20%, bookings ±30%, etc.).
 *   3. Find at-risk customers (dormant ≥ 30 days).
 *   4. Detect milestones crossed (100th booking, record day, etc.).
 *   5. Ask the LLM to turn the numbers into a 2-3 sentence Arabic narrative
 *      with concrete next actions — the vendor can *act* on the brief,
 *      not just read it.
 *
 * The LLM is optional: if OPENAI_API_KEY is missing, we still return a
 * plain-language template — no silent failure.
 */

import { db } from '../../db/index.js';
import { bookings, users, vendors } from '../../db/schema.js';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import OpenAI from 'openai';

export interface DailyBrief {
  greeting: string;
  narrative: string;
  headline: {
    kind: 'up' | 'down' | 'flat' | 'milestone';
    text: string;
  };
  metrics: {
    yesterdayBookings: number;
    yesterdayRevenue: number;
    avg7dBookings: number;
    avg7dRevenue: number;
    revenueDeltaPct: number;
  };
  actions: Array<{
    kind: 'send_reminder' | 'review_low_rating' | 'reorder_inventory' | 'celebrate';
    title: string;
    hint: string;
    payload?: Record<string, unknown>;
  }>;
  milestones: string[];
  generatedAt: string;
}

export async function buildDailyBrief(vendorId: number): Promise<DailyBrief> {
  // ── 1. Timestamps ─────────────────────────────────────────────────────
  const now = new Date();
  const todayStart     = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd   = new Date(todayStart); yesterdayEnd.setMilliseconds(-1);
  const sevenDaysAgo   = new Date(todayStart); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // ── 2. Yesterday ──────────────────────────────────────────────────────
  const [yd] = await db.select({
    count: sql<number>`COUNT(*)::int`,
    revenue: sql<number>`COALESCE(SUM(total_price::numeric), 0)::float`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.scheduledAt, yesterdayStart),
    lte(bookings.scheduledAt, yesterdayEnd),
    eq(bookings.status, 'completed'),
  ));

  // ── 3. 7-day baseline (excluding yesterday so we compare fairly) ─────
  const [baseline] = await db.select({
    total:   sql<number>`COUNT(*)::int`,
    revenue: sql<number>`COALESCE(SUM(total_price::numeric), 0)::float`,
  }).from(bookings).where(and(
    eq(bookings.vendorId, vendorId),
    gte(bookings.scheduledAt, sevenDaysAgo),
    lte(bookings.scheduledAt, yesterdayStart),
    eq(bookings.status, 'completed'),
  ));
  const avg7dBookings = Math.round(Number(baseline?.total ?? 0) / 7);
  const avg7dRevenue  = Math.round(Number(baseline?.revenue ?? 0) / 7);

  const yBookings = Number(yd?.count ?? 0);
  const yRevenue  = Math.round(Number(yd?.revenue ?? 0));

  const revenueDeltaPct = avg7dRevenue > 0
    ? Math.round(((yRevenue - avg7dRevenue) / avg7dRevenue) * 100)
    : yRevenue > 0 ? 100 : 0;

  // ── 4. Milestones ─────────────────────────────────────────────────────
  const [totalBookings] = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.vendorId, vendorId), eq(bookings.status, 'completed')));
  const total = Number(totalBookings?.count ?? 0);

  const milestones: string[] = [];
  for (const mark of [1, 10, 50, 100, 500, 1000, 5000]) {
    if (total === mark) milestones.push(`🎉 حجزك رقم ${mark}!`);
  }
  if (yRevenue > 0 && yRevenue > avg7dRevenue * 1.5 && avg7dRevenue > 500) {
    milestones.push(`🏆 أعلى يوم إيراد خلال أسبوع`);
  }

  // ── 5. At-risk customers (dormant ≥ 30 days) ─────────────────────────
  const dormant = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int AS count
    FROM users u
    WHERE u.vendor_id = ${vendorId}
      AND u.role = 'customer'
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.customer_id = u.id
          AND b.scheduled_at > NOW() - INTERVAL '30 days'
      )
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.customer_id = u.id
          AND b.scheduled_at > NOW() - INTERVAL '180 days'
      )
  `);
  const dormantCount = Number((dormant as any).rows?.[0]?.count ?? 0);

  // ── 6. Recommended actions ────────────────────────────────────────────
  const actions: DailyBrief['actions'] = [];
  if (dormantCount > 0) {
    actions.push({
      kind: 'send_reminder',
      title: `أرسل رسالة واتساب لـ ${dormantCount} عميل غائب`,
      hint: 'عملاء كانوا ينزلون عندك وتوقفوا من ٣٠ يوم. رسالة واحدة قد ترجعهم.',
      payload: { dormantCount },
    });
  }
  if (milestones.length > 0) {
    actions.push({
      kind: 'celebrate',
      title: 'أنجزت هدف — شارك الفريق',
      hint: milestones[0],
    });
  }

  // ── 7. Headline ───────────────────────────────────────────────────────
  let headline: DailyBrief['headline'];
  if (milestones.length > 0) {
    headline = { kind: 'milestone', text: milestones[0] };
  } else if (revenueDeltaPct >= 15) {
    headline = { kind: 'up', text: `الإيراد أمس أعلى بـ ${revenueDeltaPct}% من المتوسط` };
  } else if (revenueDeltaPct <= -15) {
    headline = { kind: 'down', text: `الإيراد أمس أقل بـ ${Math.abs(revenueDeltaPct)}% من المتوسط` };
  } else {
    headline = { kind: 'flat', text: 'يوم هادئ — الأرقام قريبة من المعتاد' };
  }

  // ── 8. Narrative ──────────────────────────────────────────────────────
  const vendor = await db.select({ nameAr: vendors.nameAr })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const shopName = vendor[0]?.nameAr ?? 'متجرك';

  const templateNarrative = buildTemplateNarrative({
    shopName,
    yBookings, yRevenue, avg7dBookings, avg7dRevenue, revenueDeltaPct,
    dormantCount, milestones,
  });

  let narrative = templateNarrative;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      narrative = await aiNarrative(apiKey, {
        shopName,
        yBookings, yRevenue, avg7dBookings, avg7dRevenue, revenueDeltaPct,
        dormantCount, milestones,
      });
    } catch (e) {
      console.warn('[dailyBrief] LLM narrative failed, using template');
    }
  }

  return {
    greeting: greetingFor(now),
    narrative,
    headline,
    metrics: {
      yesterdayBookings: yBookings,
      yesterdayRevenue: yRevenue,
      avg7dBookings,
      avg7dRevenue,
      revenueDeltaPct,
    },
    actions,
    milestones,
    generatedAt: now.toISOString(),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 5)  return 'سهرة خير';
  if (h < 12) return 'صباح الخير';
  if (h < 17) return 'عصر الخير';
  return 'مساء الخير';
}

interface NarrativeContext {
  shopName: string;
  yBookings: number; yRevenue: number;
  avg7dBookings: number; avg7dRevenue: number;
  revenueDeltaPct: number;
  dormantCount: number;
  milestones: string[];
}

function buildTemplateNarrative(c: NarrativeContext): string {
  const parts: string[] = [];
  if (c.yBookings === 0) {
    parts.push('ما وصلك أي حجز أمس.');
  } else if (c.revenueDeltaPct >= 15) {
    parts.push(`أمس يوم ممتاز — ${c.yBookings} حجز بإيراد ${c.yRevenue} ر.س، أعلى بـ ${c.revenueDeltaPct}% من المتوسط.`);
  } else if (c.revenueDeltaPct <= -15) {
    parts.push(`أمس أهدى من المعتاد — ${c.yBookings} حجز، الإيراد ${c.yRevenue} ر.س (-${Math.abs(c.revenueDeltaPct)}%).`);
  } else {
    parts.push(`أمس ${c.yBookings} حجز بإيراد ${c.yRevenue} ر.س — قريب من المعتاد.`);
  }
  if (c.dormantCount >= 5) {
    parts.push(`عندك ${c.dormantCount} عميل ما زاروك من شهر — رسالة قصيرة قد ترجعهم.`);
  }
  if (c.milestones.length > 0) {
    parts.push(c.milestones[0]);
  }
  return parts.join(' ');
}

async function aiNarrative(apiKey: string, c: NarrativeContext): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const system = `أنت محلل أعمال سعودي. اكتب تلخيصاً يومياً للتاجر بـ 2-3 جمل قصيرة، بلهجة سعودية طبيعية (لا تستخدم "حضرتك" ولا "سعادتك"). ابدأ بالأهم، واذكر رقماً واحداً محدداً، واختم بنصيحة عملية قصيرة. لا تستخدم emoji. لا تخترع أرقاماً.`;
  const user = `متجر: ${c.shopName}
  أمس: ${c.yBookings} حجز، إيراد ${c.yRevenue} ر.س.
  المتوسط اليومي (آخر ٧ أيام): ${c.avg7dBookings} حجز، ${c.avg7dRevenue} ر.س.
  تغيّر الإيراد: ${c.revenueDeltaPct >= 0 ? '+' : ''}${c.revenueDeltaPct}%.
  ${c.dormantCount > 0 ? `عملاء غائبون منذ ٣٠+ يوم: ${c.dormantCount}.` : ''}
  ${c.milestones.length > 0 ? `إنجازات: ${c.milestones.join('، ')}` : ''}`;
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.5,
    max_tokens: 180,
  });
  return completion.choices[0]?.message?.content?.trim() || buildTemplateNarrative(c);
}
