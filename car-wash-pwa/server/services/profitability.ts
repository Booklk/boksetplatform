/**
 * Per-vendor profitability — for the super-admin "هل أكسب أم أخسر من هذا التاجر؟"
 * dashboard. All numbers are computed from real DB state (subscription
 * plan + active add-ons + this month's monthly_usage counters), never
 * cached estimates.
 *
 * Cost model (the source of truth — change here only):
 *   - bookings:           0.002 SAR each (DB write + WhatsApp confirm)
 *   - ai_messages:        0.10 SAR each  (gpt-4o-mini + WA + DB)
 *   - whatsapp_marketing: 0.15 SAR each  (Meta template fee KSA)
 *   - storage_mb:         0.001 SAR per MB-month
 *   - fixed share:        2.4 SAR per vendor per month (infra @ 300 vendors)
 *
 * Revenue includes:
 *   - subscription plan price
 *   - active add-on prices
 *   - this month's overflow_amount_sar already accrued
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vendors, monthlyUsage } from '../db/schema.js';
import { ADDONS, AddonId } from './addons.js';

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  pro: 99,
  pro_m: 99,
  pro_y: 84, // pro yearly = ~999/12
  enterprise: 799,
};

const COST_PER_UNIT = {
  bookings: 0.002,
  ai_messages: 0.10,
  whatsapp_marketing: 0.15,
  storage_mb: 0.001,
};

const FIXED_COST_PER_VENDOR = 2.4;

export interface VendorProfitability {
  vendorId: number;
  nameAr: string;
  slug: string;
  status: string;
  plan: string;
  addons: string[];
  // Revenue side
  subscriptionRevenue: number;
  addonsRevenue: number;
  overflowRevenue: number;
  totalRevenue: number;
  // Cost side
  variableCost: number;
  fixedCost: number;
  totalCost: number;
  // Result
  netMargin: number;
  marginPercent: number;
  health: 'profitable' | 'thin' | 'losing' | 'inactive';
  // Usage (for context)
  usage: {
    bookings: number;
    ai_messages: number;
    whatsapp_marketing: number;
    storage_mb: number;
  };
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function computeProfitability(vendorId: number): Promise<VendorProfitability> {
  const [v] = await db.select({
    id: vendors.id,
    nameAr: vendors.nameAr,
    slug: vendors.slug,
    status: vendors.subscriptionStatus,
    plan: vendors.subscriptionPlan,
    settings: vendors.settings,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) throw new Error('vendor not found');

  const period = currentPeriod();
  const settings = (v.settings ?? {}) as { addons?: string[] };
  const addons = settings.addons ?? [];
  const inactive = !['trial', 'active'].includes(v.status);

  const subscriptionRevenue = inactive ? 0 : (PLAN_PRICES[v.plan ?? 'free'] ?? 0);
  const addonsRevenue = inactive ? 0 : addons.reduce((sum, id) => sum + (ADDONS[id as AddonId]?.priceSar ?? 0), 0);

  // Pull this month's usage rows
  const usageRows = await db.select({
    resource: monthlyUsage.resource,
    used: monthlyUsage.used,
    overflowAmountSar: monthlyUsage.overflowAmountSar,
  })
    .from(monthlyUsage)
    .where(and(eq(monthlyUsage.vendorId, vendorId), eq(monthlyUsage.period, period)));

  const usage = { bookings: 0, ai_messages: 0, whatsapp_marketing: 0, storage_mb: 0 };
  let overflowRevenue = 0;
  for (const r of usageRows) {
    if (r.resource in usage) {
      (usage as Record<string, number>)[r.resource] = r.used;
    }
    overflowRevenue += parseFloat(r.overflowAmountSar ?? '0');
  }

  const variableCost =
    usage.bookings * COST_PER_UNIT.bookings +
    usage.ai_messages * COST_PER_UNIT.ai_messages +
    usage.whatsapp_marketing * COST_PER_UNIT.whatsapp_marketing +
    usage.storage_mb * COST_PER_UNIT.storage_mb;

  const fixedCost = inactive ? 0 : FIXED_COST_PER_VENDOR;
  const totalCost = variableCost + fixedCost;
  const totalRevenue = subscriptionRevenue + addonsRevenue + overflowRevenue;
  const netMargin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0
    ? Math.round((netMargin / totalRevenue) * 100)
    : (netMargin < 0 ? -100 : 0);

  const health: VendorProfitability['health'] =
    inactive       ? 'inactive' :
    netMargin < 0  ? 'losing' :
    marginPercent < 30 ? 'thin' :
    'profitable';

  return {
    vendorId: v.id,
    nameAr: v.nameAr,
    slug: v.slug,
    status: v.status,
    plan: v.plan ?? 'free',
    addons,
    subscriptionRevenue: round2(subscriptionRevenue),
    addonsRevenue: round2(addonsRevenue),
    overflowRevenue: round2(overflowRevenue),
    totalRevenue: round2(totalRevenue),
    variableCost: round2(variableCost),
    fixedCost: round2(fixedCost),
    totalCost: round2(totalCost),
    netMargin: round2(netMargin),
    marginPercent,
    health,
    usage,
  };
}

export async function computeAllProfitability(): Promise<{
  vendors: VendorProfitability[];
  totals: {
    revenue: number;
    cost: number;
    margin: number;
    losingCount: number;
    thinCount: number;
    profitableCount: number;
    inactiveCount: number;
  };
}> {
  const all = await db.select({ id: vendors.id }).from(vendors);
  const rows = await Promise.all(all.map((v) => computeProfitability(v.id)));

  const totals = rows.reduce((acc, r) => {
    acc.revenue += r.totalRevenue;
    acc.cost += r.totalCost;
    if (r.health === 'losing') acc.losingCount++;
    else if (r.health === 'thin') acc.thinCount++;
    else if (r.health === 'profitable') acc.profitableCount++;
    else if (r.health === 'inactive') acc.inactiveCount++;
    return acc;
  }, { revenue: 0, cost: 0, margin: 0, losingCount: 0, thinCount: 0, profitableCount: 0, inactiveCount: 0 });

  totals.revenue = round2(totals.revenue);
  totals.cost = round2(totals.cost);
  totals.margin = round2(totals.revenue - totals.cost);

  // Sort: losing first, then thin, then by lowest margin
  rows.sort((a, b) => {
    const order: Record<string, number> = { losing: 0, thin: 1, inactive: 2, profitable: 3 };
    if (order[a.health] !== order[b.health]) return order[a.health] - order[b.health];
    return a.netMargin - b.netMargin;
  });

  return { vendors: rows, totals };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
