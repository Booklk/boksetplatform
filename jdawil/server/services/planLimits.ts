/**
 * Plan-based usage limits.
 *
 * Free plan: hard cap of 100 bookings/month. After the cap, the booking
 * endpoints return 402 with an upgrade prompt; the customer is informed
 * the store is temporarily not accepting online bookings, and the vendor
 * gets a notification to upgrade.
 *
 * Pro plan and above: unlimited.
 */
import { db } from '../db/index.js';
import { vendors, bookings } from '../db/schema.js';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

export interface PlanLimits {
  monthlyBookings: number | null; // null = unlimited
}

const FREE_LIMITS: PlanLimits = { monthlyBookings: 100 };
const PAID_LIMITS: PlanLimits = { monthlyBookings: null };

export function getLimitsForPlan(plan: string | null | undefined): PlanLimits {
  if (!plan || plan === 'free') return FREE_LIMITS;
  return PAID_LIMITS;
}

/** Returns { count, limit, remaining, percent } for the current month. */
export async function getMonthlyBookingUsage(vendorId: number): Promise<{
  count: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  plan: string;
}> {
  const [v] = await db.select({ plan: vendors.subscriptionPlan })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const plan = v?.plan ?? 'free';
  const limits = getLimitsForPlan(plan);

  const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
  const next = new Date(start); next.setMonth(next.getMonth() + 1);

  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      gte(bookings.createdAt, start),
      lt(bookings.createdAt, next),
    ));

  const count = Number(row?.c ?? 0);
  const limit = limits.monthlyBookings;
  const remaining = limit == null ? null : Math.max(0, limit - count);
  const percent = limit == null ? 0 : Math.min(100, Math.round((count / limit) * 100));
  return { count, limit, remaining, percent, plan };
}

/** Throw-style helper for booking creation. Returns null if allowed, or a 402-style error object. */
export async function checkBookingAllowed(vendorId: number): Promise<{
  allowed: boolean;
  usage?: Awaited<ReturnType<typeof getMonthlyBookingUsage>>;
  error?: string;
}> {
  const usage = await getMonthlyBookingUsage(vendorId);
  if (usage.limit != null && usage.count >= usage.limit) {
    return {
      allowed: false,
      usage,
      error: `وصل المتجر للحد الشهري للباقة المجانية (${usage.limit} حجز). يرجى الترقية لاستقبال المزيد.`,
    };
  }
  return { allowed: true, usage };
}
