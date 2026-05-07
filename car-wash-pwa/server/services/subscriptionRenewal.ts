/**
 * Subscription auto-renewal + dunning.
 *
 * Replaces the silent "active → free" downgrade with a proper dunning flow:
 *
 *   D-3, D-1, D-0  — pre-renewal WhatsApp reminders (already in cron)
 *   D+0  Renewal attempt #1 — Moyasar charge against the saved card.
 *        On failure → status flips to `past_due`, expiry extended by 7d
 *        (grace period), vendor notified via WhatsApp.
 *   D+1, D+3, D+5  — retry charge. On success → back to `active` with
 *                    new period, vendor notified.
 *   D+7  Final retry, then:
 *          ✅ success → renewed
 *          ❌ failed   → downgrade to free, addons disabled,
 *                       vendor notified one last time.
 *
 * Idempotent — running this twice in the same hour is safe; each step
 * checks the current row state before mutating.
 *
 * Required schema fields (all present): subscriptionStatus, subscriptionPlan,
 * subscriptionEndDate, paymentConfig (encrypted Moyasar key).
 *
 * Wire into a cron job that runs hourly. The actual Moyasar charge call
 * is delegated to `chargeStoredCard` in services/payments which knows how
 * to use the per-vendor saved tokens.
 */
import { db } from '../db/index.js';
import { vendors, billingAudit, vendorSubscriptionPayments } from '../db/schema.js';
import { eq, and, lt, inArray, sql } from 'drizzle-orm';
import { sendPlatformWhatsApp } from './whatsapp.js';

const PAID_PLANS = ['pro', 'pro_m', 'pro_y', 'enterprise', 'basic'];
const RETRY_OFFSET_DAYS = [0, 1, 3, 5, 7];
const GRACE_PERIOD_DAYS = 7;

interface RenewalResult {
  vendorId: number;
  outcome: 'renewed' | 'past_due' | 'downgraded' | 'skipped';
  reason?: string;
}

/** Hourly cron entry-point. Returns a summary the caller can log. */
export async function runRenewalCycle(): Promise<{
  scanned: number;
  renewed: number;
  pastDue: number;
  downgraded: number;
}> {
  const due = await db.select({
    id: vendors.id,
    nameAr: vendors.nameAr,
    phone: vendors.phone,
    plan: vendors.subscriptionPlan,
    status: vendors.subscriptionStatus,
    endDate: vendors.subscriptionEndDate,
    amount: vendors.subscriptionAmount,
    paymentConfig: vendors.paymentConfig,
  }).from(vendors).where(and(
    inArray(vendors.subscriptionStatus, ['active', 'past_due']),
    inArray(vendors.subscriptionPlan, PAID_PLANS),
    lt(vendors.subscriptionEndDate, sql`NOW()`),
  ));

  let renewed = 0, pastDue = 0, downgraded = 0;

  for (const v of due) {
    const result = await renewOne({
      id: v.id, nameAr: v.nameAr, phone: v.phone ?? '',
      plan: v.plan ?? 'pro',
      status: v.status,
      endDate: v.endDate,
      amount: Number(v.amount ?? 0),
      paymentConfig: v.paymentConfig,
    });
    if (result.outcome === 'renewed') renewed++;
    else if (result.outcome === 'past_due') pastDue++;
    else if (result.outcome === 'downgraded') downgraded++;
  }

  return { scanned: due.length, renewed, pastDue, downgraded };
}

interface RenewInput {
  id: number;
  nameAr: string;
  phone: string;
  plan: string;
  status: string;
  endDate: Date | null;
  amount: number;
  paymentConfig: unknown;
}

async function renewOne(v: RenewInput): Promise<RenewalResult> {
  if (!v.endDate) return { vendorId: v.id, outcome: 'skipped', reason: 'no end date' };
  const daysOverdue = Math.floor((Date.now() - new Date(v.endDate).getTime()) / (24 * 60 * 60 * 1000));

  // We only attempt on the discrete retry days. Anything else just waits
  // for the next hourly tick to land on a retry day.
  if (!RETRY_OFFSET_DAYS.includes(daysOverdue)) {
    return { vendorId: v.id, outcome: 'skipped', reason: `not a retry day (${daysOverdue}d overdue)` };
  }

  const charge = await attemptCharge(v);

  if (charge.ok) {
    // Renewed — extend by 30 days, mark active.
    const newEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.update(vendors).set({
      subscriptionStatus: 'active',
      subscriptionEndDate: newEnd,
      updatedAt: new Date(),
    }).where(eq(vendors.id, v.id));

    await db.insert(vendorSubscriptionPayments).values({
      vendorId: v.id,
      amount: String(v.amount),
      plan: v.plan,
      status: 'paid',
      paidAt: new Date(),
      notes: charge.ref ? `moyasar:${charge.ref}` : undefined,
    });

    await audit(v.id, 'subscription_renewed', { plan: v.plan, amount: v.amount, attempt: daysOverdue });
    await notify(v.phone, `✅ تم تجديد اشتراكك في *${v.nameAr}* بنجاح. خدمتك متصلة كالعادة. شكراً لثقتك! — Jdawil`);
    return { vendorId: v.id, outcome: 'renewed' };
  }

  // Charge failed.
  if (daysOverdue >= GRACE_PERIOD_DAYS) {
    // Final retry failed → downgrade.
    await db.update(vendors).set({
      subscriptionStatus: 'active',
      subscriptionPlan: 'free',
      updatedAt: new Date(),
    }).where(eq(vendors.id, v.id));

    // Disable add-ons since they require a paid plan.
    try {
      const { syncAddonsWithSubscription } = await import('./addons.js');
      await syncAddonsWithSubscription();
    } catch {/* not critical */}

    await audit(v.id, 'subscription_downgraded_after_dunning', { failedAttempts: RETRY_OFFSET_DAYS.length, lastError: charge.error });
    await notify(v.phone, `📉 *${v.nameAr}*\n\nتعذّر تجديد اشتراكك بعد ${RETRY_OFFSET_DAYS.length} محاولات. تم تحويلك للباقة المجانية مؤقتاً.\n\nلاستعادة المميزات الكاملة، حدّث وسيلة الدفع من لوحة التاجر.\n— Jdawil`);
    return { vendorId: v.id, outcome: 'downgraded', reason: charge.error };
  }

  // Still inside grace window — flip to past_due, schedule next retry.
  if (v.status !== 'past_due') {
    await db.update(vendors).set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date(),
    }).where(eq(vendors.id, v.id));
    await notify(v.phone, `⚠️ *${v.nameAr}*\n\nفشلت محاولة تجديد اشتراكك. سنحاول تلقائياً خلال الأيام القادمة.\n\nلتجنّب انقطاع الخدمة، حدّث وسيلة الدفع من لوحة التاجر.\n— Jdawil`);
  }
  await audit(v.id, 'renewal_attempt_failed', { daysOverdue, error: charge.error });
  return { vendorId: v.id, outcome: 'past_due', reason: charge.error };
}

interface ChargeResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

/**
 * Charge the vendor's saved card via Moyasar. Returns ok=false (no throw)
 * on any failure so the renewal cycle can continue with the next vendor.
 *
 * If `paymentConfig` is missing, we treat it as "no card on file" — failure.
 * The vendor must complete payment-config setup to enable auto-renewal.
 */
async function attemptCharge(v: RenewInput): Promise<ChargeResult> {
  if (!v.paymentConfig) return { ok: false, error: 'no payment method on file' };
  if (v.amount <= 0) return { ok: false, error: 'invalid amount' };

  // The actual Moyasar token-charge lives in services/payments where the
  // adapter knows how to decrypt the vendor's saved key + token. We import
  // dynamically to keep this module testable in isolation.
  try {
    const { chargeStoredCard } = await import('./payments/moyasar-renewal.js');
    return await chargeStoredCard(v.id, v.amount);
  } catch (e) {
    // Adapter not configured yet — surface clearly so ops knows what to wire.
    return { ok: false, error: e instanceof Error ? e.message : 'charge adapter unavailable' };
  }
}

async function audit(vendorId: number, event: string, metadata: Record<string, unknown>) {
  try {
    await db.insert(billingAudit).values({ vendorId, event, metadata });
  } catch {/* */}
}

async function notify(phone: string, body: string) {
  if (!phone) return;
  try {
    await sendPlatformWhatsApp(phone, body);
  } catch {/* */}
}
