/**
 * Usage governance — the source of truth for "is this vendor allowed to do
 * this billable action right now?".
 *
 * Every cost-incurring code path (AI message, WhatsApp marketing send,
 * booking creation on free plan, file upload above N MB, etc.) MUST go
 * through `checkAndRecord()` BEFORE incurring the cost. The function:
 *
 *   1. Validates the vendor's subscription is in a usable state (trial /
 *      active). suspended/expired/cancelled are blocked unconditionally.
 *   2. Resolves the resolved monthly limit for this resource based on
 *      plan + active add-ons (NOT what the vendor claims, NOT cached).
 *   3. Atomically increments the monthly_usage counter using SQL
 *      `UPDATE ... SET used = used + N WHERE used + N <= limit` so two
 *      concurrent requests can't both squeak under the cap.
 *   4. Falls back to overflow billing if the resource supports it AND
 *      the vendor has explicitly opted in (overflow_enabled flag).
 *   5. Writes a billing_audit row for every quota-exceeded / overflow
 *      event — never silently denied.
 *
 * Subscription guard: a vendor with subscriptionStatus in
 * (suspended, expired, cancelled, past_due) gets `denied: true` with a
 * specific `denyReason` so the UI can prompt the right action.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vendors, monthlyUsage, billingAudit } from '../db/schema.js';
import { isAddonActive } from './addons.js';

export type Resource = 'bookings' | 'ai_messages' | 'whatsapp_marketing' | 'storage_mb';

interface CheckOptions {
  vendorId: number;
  resource: Resource;
  amount?: number; // default 1
  /** If true, the resource is allowed to overflow with per-unit billing. */
  allowOverflow?: boolean;
  /** Per-unit overflow price in SAR (only used when allowOverflow=true). */
  overflowPriceSar?: number;
}

interface CheckResult {
  allowed: boolean;
  denyReason?:
    | 'subscription_inactive'
    | 'quota_exceeded'
    | 'overflow_disabled'
    | 'plan_locked';
  used: number;
  limit: number | null;
  remaining: number | null;
  overflowCharged?: number;
}

const USABLE_STATUSES = new Set(['trial', 'active']);

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Resolve the effective monthly limit for a vendor + resource based on the
 * subscriptionPlan and any active add-ons. The numbers below are the
 * SOURCE OF TRUTH — change them only here, never split into the UI.
 */
async function resolveLimit(vendorId: number, resource: Resource): Promise<{
  limit: number | null;
  overflowAllowed: boolean;
  overflowPriceSar: number;
}> {
  const [v] = await db.select({
    plan: vendors.subscriptionPlan,
    settings: vendors.settings,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

  const plan = v?.plan ?? 'free';
  const settings = (v?.settings ?? {}) as { addons?: string[]; overflowEnabled?: boolean };
  const overflowEnabled = settings.overflowEnabled === true;

  switch (resource) {
    case 'bookings': {
      // Free: 100/month hard cap, no overflow. Pro+: unlimited.
      if (plan === 'free') return { limit: 100, overflowAllowed: false, overflowPriceSar: 0 };
      return { limit: null, overflowAllowed: false, overflowPriceSar: 0 };
    }
    case 'ai_messages': {
      // Requires ai_bot add-on. 300 included; overflow at 0.30 SAR/msg if opted in.
      const hasAddon = await isAddonActive(vendorId, 'ai_bot');
      if (!hasAddon) return { limit: 0, overflowAllowed: false, overflowPriceSar: 0 };
      return { limit: 300, overflowAllowed: overflowEnabled, overflowPriceSar: 0.30 };
    }
    case 'whatsapp_marketing': {
      // 1000 marketing template sends/month included with bot add-on; overflow blocked unless opted in.
      const hasAddon = await isAddonActive(vendorId, 'ai_bot');
      if (!hasAddon) return { limit: 100, overflowAllowed: false, overflowPriceSar: 0 };
      return { limit: 1000, overflowAllowed: overflowEnabled, overflowPriceSar: 0.20 };
    }
    case 'storage_mb': {
      // Free: 50 MB. Pro: 500 MB. No overflow — vendor must delete or upgrade.
      if (plan === 'free') return { limit: 50, overflowAllowed: false, overflowPriceSar: 0 };
      return { limit: 500, overflowAllowed: false, overflowPriceSar: 0 };
    }
  }
}

async function logAudit(
  vendorId: number,
  event: string,
  resource: Resource | null,
  amount: number | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(billingAudit).values({
      vendorId,
      event,
      resource: resource ?? undefined,
      amount: amount != null ? String(amount) : undefined,
      metadata,
    });
  } catch {/* audit must never block the main flow */}
}

/**
 * THE one function every billable code path must call.
 *
 * Returns `{ allowed: false, denyReason }` for any reason that should
 * block the action; the caller is responsible for surfacing that to the
 * vendor (402 / inline error / silent skip per context).
 */
export async function checkAndRecord(opts: CheckOptions): Promise<CheckResult> {
  const { vendorId, resource } = opts;
  const amount = Math.max(1, opts.amount ?? 1);
  const period = currentPeriod();

  // 1) Subscription gate — never let suspended/expired vendors run paid features.
  const [v] = await db.select({
    status: vendors.subscriptionStatus,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);

  if (!v || !USABLE_STATUSES.has(v.status)) {
    await logAudit(vendorId, 'denied_subscription_inactive', resource, amount, { status: v?.status });
    return {
      allowed: false,
      denyReason: 'subscription_inactive',
      used: 0,
      limit: null,
      remaining: 0,
    };
  }

  // 2) Resolve real limit
  const { limit, overflowAllowed, overflowPriceSar } = await resolveLimit(vendorId, resource);

  // limit=0 means resource locked behind a feature/addon the vendor doesn't have
  if (limit === 0) {
    await logAudit(vendorId, 'denied_plan_locked', resource, amount);
    return { allowed: false, denyReason: 'plan_locked', used: 0, limit: 0, remaining: 0 };
  }

  // Ensure the row exists for this period (idempotent insert)
  await db.insert(monthlyUsage)
    .values({ vendorId, resource, period, used: 0, limit })
    .onConflictDoNothing();

  // 3) Atomic conditional increment.
  //    For unlimited (limit=null): increment unconditionally.
  //    For capped: only increment if used + amount <= limit.
  if (limit == null) {
    const updated = await db.update(monthlyUsage)
      .set({ used: sql`${monthlyUsage.used} + ${amount}`, updatedAt: new Date() })
      .where(and(
        eq(monthlyUsage.vendorId, vendorId),
        eq(monthlyUsage.resource, resource),
        eq(monthlyUsage.period, period),
      ))
      .returning({ used: monthlyUsage.used });
    const used = updated[0]?.used ?? amount;
    return { allowed: true, used, limit: null, remaining: null };
  }

  const updated = await db.update(monthlyUsage)
    .set({ used: sql`${monthlyUsage.used} + ${amount}`, updatedAt: new Date() })
    .where(and(
      eq(monthlyUsage.vendorId, vendorId),
      eq(monthlyUsage.resource, resource),
      eq(monthlyUsage.period, period),
      sql`${monthlyUsage.used} + ${amount} <= ${monthlyUsage.limit}`,
    ))
    .returning({ used: monthlyUsage.used });

  if (updated.length > 0) {
    const used = updated[0].used;
    return { allowed: true, used, limit, remaining: limit - used };
  }

  // 4) Capped + over: try overflow billing if allowed
  if (overflowAllowed && opts.allowOverflow !== false) {
    const overflowCost = amount * (opts.overflowPriceSar ?? overflowPriceSar);
    const overflowResult = await db.update(monthlyUsage)
      .set({
        used: sql`${monthlyUsage.used} + ${amount}`,
        overflowCount: sql`${monthlyUsage.overflowCount} + ${amount}`,
        overflowAmountSar: sql`${monthlyUsage.overflowAmountSar} + ${overflowCost}`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(monthlyUsage.vendorId, vendorId),
        eq(monthlyUsage.resource, resource),
        eq(monthlyUsage.period, period),
      ))
      .returning({ used: monthlyUsage.used });
    await logAudit(vendorId, 'overflow_charged', resource, overflowCost, { amount, period });
    return {
      allowed: true,
      used: overflowResult[0]?.used ?? amount,
      limit,
      remaining: 0,
      overflowCharged: overflowCost,
    };
  }

  // 5) Hard deny
  const [row] = await db.select({ used: monthlyUsage.used })
    .from(monthlyUsage)
    .where(and(
      eq(monthlyUsage.vendorId, vendorId),
      eq(monthlyUsage.resource, resource),
      eq(monthlyUsage.period, period),
    )).limit(1);
  await logAudit(vendorId, 'quota_exceeded', resource, amount, { used: row?.used, limit });
  return {
    allowed: false,
    denyReason: overflowAllowed ? 'overflow_disabled' : 'quota_exceeded',
    used: row?.used ?? 0,
    limit,
    remaining: 0,
  };
}

/** Read-only quota status (no increment). */
export async function getQuotaStatus(vendorId: number, resource: Resource): Promise<{
  used: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  period: string;
}> {
  const period = currentPeriod();
  const { limit } = await resolveLimit(vendorId, resource);
  const [row] = await db.select({ used: monthlyUsage.used })
    .from(monthlyUsage)
    .where(and(
      eq(monthlyUsage.vendorId, vendorId),
      eq(monthlyUsage.resource, resource),
      eq(monthlyUsage.period, period),
    )).limit(1);
  const used = row?.used ?? 0;
  const remaining = limit == null ? null : Math.max(0, limit - used);
  const percent = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return { used, limit, remaining, percent, period };
}

/** All quotas for a vendor — for the dashboard widget. */
export async function getAllQuotas(vendorId: number) {
  const resources: Resource[] = ['bookings', 'ai_messages', 'whatsapp_marketing', 'storage_mb'];
  const results = await Promise.all(resources.map(async (r) => ({
    resource: r,
    ...(await getQuotaStatus(vendorId, r)),
  })));
  return results;
}
