/**
 * Vendor Add-ons catalog — paid extensions for features with REAL
 * marginal cost only. Anything with near-zero per-use cost (financials,
 * payroll, CRM, automations, etc.) is part of the Pro 99 SAR plan.
 *
 * Add-ons exist because Maps and OpenAI bill the platform per request.
 * The vendor pays for what actually costs us money — transparent,
 * not exploitative.
 *
 * Each add-on gates a specific bundle of features. The vendor owns
 * `vendor.settings.addons: string[]` listing the active add-on IDs.
 * Server routes call `isAddonActive(vendorId, 'addonId')` to gate.
 *
 * Pricing here is the source of truth for the UI; the actual billing
 * integration (Moyasar subscription) reads the same numbers.
 */
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type AddonId = 'ai_bot' | 'ai_bot_pro' | 'gps_basic' | 'gps_pro';

export interface Addon {
  id: AddonId;
  nameAr: string;
  descriptionAr: string;
  priceSar: number;
  /** Routes/features this add-on unlocks */
  features: string[];
  /** Recurring per-use fee on top of monthly (e.g. AI overflow per message) */
  overflow?: { unit: string; pricePerUnit: number; included: number };
  category: 'automation' | 'tracking';
  /** Why this is a paid add-on instead of bundled in Pro. */
  costExplanation: string;
}

export const ADDONS: Record<AddonId, Addon> = {
  ai_bot: {
    id: 'ai_bot',
    nameAr: 'بوت واتساب الذكي',
    descriptionAr: 'بوت AI يفهم اللهجة السعودية، يحجز ويبيع ويرد على الشكاوى — يحلّ محل موظف ردود',
    priceSar: 100,
    category: 'automation',
    overflow: { unit: 'رسالة', pricePerUnit: 0.05, included: 1000 },
    costExplanation: 'كل محادثة AI تكلّفنا فعلياً عند OpenAI + Meta WhatsApp. السعر يغطي التكلفة + هامش بسيط.',
    features: [
      '1,000 محادثة شهرياً',
      'لهجة سعودية + تبديل تلقائي للإنجليزي',
      'يفهم voice notes (صوت → نص)',
      'يفهم الصور (تشخيص أعطال، تأكيد العمل)',
      'حجز كامل عبر الواتساب + رابط دفع',
      'تعرّف على العميل العائد + Upsell ذكي',
      'تسليم تلقائي للموظف عند الشكوى',
      'بعد 1,000 محادثة: 0.05 ر.س لكل محادثة (تكلفة + هامش)',
    ],
  },

  ai_bot_pro: {
    id: 'ai_bot_pro',
    nameAr: 'بوت واتساب الذكي — Pro',
    descriptionAr: 'كل ميزات البوت + 5,000 محادثة شهرياً + استجابة أسرع — للمنشآت ذات الحجم الكبير',
    priceSar: 150,
    category: 'automation',
    overflow: { unit: 'رسالة', pricePerUnit: 0.04, included: 5000 },
    costExplanation: 'ضعف الحجم بنفس النموذج — هامش أعلى لك مع تكلفة أقل لكل محادثة.',
    features: [
      'كل ميزات البوت الذكي',
      '5,000 محادثة شهرياً',
      'استجابة أسرع (priority queue)',
      'تخصيص شخصية البوت لقطاعك',
      'تقارير محادثات أعمق',
      'بعد 5,000 محادثة: 0.04 ر.س لكل محادثة',
    ],
  },

  gps_basic: {
    id: 'gps_basic',
    nameAr: 'تتبع GPS أساسي',
    descriptionAr: 'تتبع لحظي حتى 5 موظفين + رابط تتبع للعميل أثناء توصيل الخدمة',
    priceSar: 50,
    category: 'tracking',
    costExplanation: 'كل تحديث موقع يستهلك Google Maps API. السعر يغطي التكلفة + هامش بسيط.',
    features: [
      'موقع لحظي حتى 5 موظفين',
      'رابط تتبع لكل عميل',
      'خريطة الأسطول للتاجر',
      'سجل المواقع 7 أيام',
      'تنبيه وصول الموظف',
    ],
  },

  gps_pro: {
    id: 'gps_pro',
    nameAr: 'تتبع GPS غير محدود',
    descriptionAr: 'موظفون غير محدودون + التوزيع الذكي + ETA + Geofence + سجل ٣٠ يوم',
    priceSar: 100,
    category: 'tracking',
    costExplanation: 'حجم أعلى من استهلاك الخرائط + تحليلات إضافية — للمنشآت متعددة الموظفين.',
    features: [
      'موظفون غير محدودون',
      'التوزيع الذكي (أقرب موظف للحجز)',
      'ETA لحظي يصل للعميل',
      'Geofence (تنبيه دخول/خروج المنطقة)',
      'سجل المواقع 30 يوم',
      'تقارير المسافات اليومية',
    ],
  },
};

export function getAddon(id: string): Addon | null {
  return (ADDONS as Record<string, Addon>)[id] ?? null;
}

export function listAddons(): Addon[] {
  return Object.values(ADDONS);
}

/**
 * Check whether a vendor has an active add-on. Tracking-related add-ons
 * are hierarchical: gps_pro implies gps_basic.
 *
 * Crucially: even if vendor.settings.addons still lists an add-on, this
 * returns FALSE the moment subscriptionStatus leaves (trial, active).
 * The 15-min cleanup cron is defense-in-depth, NOT the only enforcement.
 */
export async function isAddonActive(vendorId: number, addonId: AddonId): Promise<boolean> {
  const [v] = await db.select({
    settings: vendors.settings,
    status: vendors.subscriptionStatus,
  })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) return false;

  // Subscription state gate — runs BEFORE we even read the addons list.
  // Closes the cron window where status flipped to suspended but
  // settings.addons still has stale entries.
  if (!['trial', 'active'].includes(v.status)) return false;

  const active = ((v.settings ?? {}) as { addons?: string[] }).addons ?? [];
  if (active.includes(addonId)) return true;

  // gps_pro covers gps_basic
  if (addonId === 'gps_basic' && active.includes('gps_pro')) return true;

  return false;
}

/** Toggle an add-on for a vendor. Audited. Refuses if subscription is inactive. */
export async function toggleAddon(
  vendorId: number,
  addonId: AddonId,
  enable: boolean,
): Promise<string[]> {
  const [v] = await db.select({
    settings: vendors.settings,
    status: vendors.subscriptionStatus,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) throw new Error('vendor not found');

  // Block activation when subscription isn't usable.
  if (enable && !['trial', 'active'].includes(v.status)) {
    throw new Error('الاشتراك غير مفعّل — لا يمكن إضافة إضافات الآن');
  }

  const current = (v.settings ?? {}) as Record<string, unknown>;
  const addons = new Set<string>(((current.addons as string[]) ?? []));
  const wasActive = addons.has(addonId);
  if (enable) addons.add(addonId);
  else addons.delete(addonId);

  // Mutual exclusion: can't have both gps_basic and gps_pro
  if (addonId === 'gps_pro' && enable) addons.delete('gps_basic');
  if (addonId === 'gps_basic' && enable) addons.delete('gps_pro');

  const list = Array.from(addons);
  await db.update(vendors)
    .set({ settings: { ...current, addons: list }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  // Audit only on actual state change (avoid duplicate logs)
  if (wasActive !== enable) {
    const addon = ADDONS[addonId];
    try {
      const { billingAudit } = await import('../db/schema.js');
      await db.insert(billingAudit).values({
        vendorId,
        event: enable ? 'addon_activated' : 'addon_deactivated',
        resource: addonId,
        amount: enable ? String(addon.priceSar) : null,
        metadata: { addonName: addon.nameAr, monthly: addon.priceSar },
      });
    } catch {/* audit must never block */}
  }

  return list;
}

/**
 * Sync addons with subscription state — called on a cron + on subscription
 * status change. Vendors whose subscription expired/suspended/cancelled get
 * ALL their add-ons disabled atomically. Returns count of vendors affected.
 */
export async function syncAddonsWithSubscription(): Promise<number> {
  const { billingAudit } = await import('../db/schema.js');
  const all = await db.select({
    id: vendors.id,
    status: vendors.subscriptionStatus,
    settings: vendors.settings,
  }).from(vendors);

  let affected = 0;
  for (const v of all) {
    if (['trial', 'active'].includes(v.status)) continue;
    const current = (v.settings ?? {}) as { addons?: string[] };
    const had = current.addons ?? [];
    if (had.length === 0) continue;

    await db.update(vendors)
      .set({
        settings: { ...current, addons: [] },
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, v.id));

    try {
      await db.insert(billingAudit).values({
        vendorId: v.id,
        event: 'addons_disabled_subscription_inactive',
        metadata: { previousAddons: had, status: v.status },
      });
    } catch {/* noop */}
    affected++;
  }
  return affected;
}
