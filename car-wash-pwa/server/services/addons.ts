/**
 * Vendor Add-ons catalog — paid extensions on top of the base plan.
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

export type AddonId = 'financials' | 'ai_bot' | 'gps_basic' | 'gps_pro';

export interface Addon {
  id: AddonId;
  nameAr: string;
  descriptionAr: string;
  priceSar: number;
  /** Routes/features this add-on unlocks */
  features: string[];
  /** Recurring per-use fee on top of monthly (e.g. AI overflow per message) */
  overflow?: { unit: string; pricePerUnit: number; included: number };
  category: 'finance' | 'automation' | 'tracking';
}

export const ADDONS: Record<AddonId, Addon> = {
  financials: {
    id: 'financials',
    nameAr: 'القوائم المالية والرواتب',
    descriptionAr: 'كشوف الرواتب، الفواتير، تقارير الأرباح والخسائر، وضريبة القيمة المضافة — كل ما يحتاجه محاسبك',
    priceSar: 39,
    category: 'finance',
    features: [
      'كشوف الرواتب الشهرية + العمولات',
      'القوائم المالية (دخل / مصروفات / أرباح)',
      'تقارير ضريبة القيمة المضافة',
      'تتبع المصروفات + التصنيف',
      'حاسبة الأرباح لكل خدمة',
      'تصدير Excel / PDF',
    ],
  },

  ai_bot: {
    id: 'ai_bot',
    nameAr: 'بوت AI ذكي للواتساب',
    descriptionAr: 'بوت يفهم أي صياغة، يقترح، يقنع، ويسوي حجوزات تلقائياً — بلهجة سعودية أو إنجليزي',
    priceSar: 79,
    category: 'automation',
    overflow: { unit: 'رسالة', pricePerUnit: 0.3, included: 300 },
    features: [
      '300 رسالة AI شهرياً',
      'لهجة سعودية + تبديل تلقائي للإنجليزي',
      'يفهم أي صياغة بدون قوالب',
      'يحجز فعلياً في النظام',
      'يقترح خصومات مناسبة',
      'تسليم تلقائي للموظف عند الشكوى',
      'بعد 300 رسالة: 0.30 ر.س لكل رسالة',
    ],
  },

  gps_basic: {
    id: 'gps_basic',
    nameAr: 'تتبع GPS أساسي',
    descriptionAr: 'تتبع لحظي للموظفين على الخريطة + رابط تتبع للعميل أثناء توصيل الخدمة',
    priceSar: 39,
    category: 'tracking',
    features: [
      'موقع لحظي للموظفين',
      'رابط تتبع لكل عميل',
      'خريطة الأسطول للتاجر',
      'سجل المواقع 7 أيام',
      'تنبيه وصول الموظف',
    ],
  },

  gps_pro: {
    id: 'gps_pro',
    nameAr: 'تتبع GPS احترافي',
    descriptionAr: 'كل ميزات الأساسي + التوزيع الذكي + ETA + Geofence + سجل ٣٠ يوم',
    priceSar: 89,
    category: 'tracking',
    features: [
      'كل ميزات GPS الأساسي',
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
 */
export async function isAddonActive(vendorId: number, addonId: AddonId): Promise<boolean> {
  const [v] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) return false;

  const active = ((v.settings ?? {}) as { addons?: string[] }).addons ?? [];
  if (active.includes(addonId)) return true;

  // gps_pro covers gps_basic
  if (addonId === 'gps_basic' && active.includes('gps_pro')) return true;

  return false;
}

/** Toggle an add-on for a vendor. Returns the updated addon list. */
export async function toggleAddon(
  vendorId: number,
  addonId: AddonId,
  enable: boolean,
): Promise<string[]> {
  const [v] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!v) throw new Error('vendor not found');

  const current = (v.settings ?? {}) as Record<string, unknown>;
  const addons = new Set<string>(((current.addons as string[]) ?? []));
  if (enable) addons.add(addonId);
  else addons.delete(addonId);

  // Mutual exclusion: can't have both gps_basic and gps_pro
  if (addonId === 'gps_pro' && enable) addons.delete('gps_basic');
  if (addonId === 'gps_basic' && enable) addons.delete('gps_pro');

  const list = Array.from(addons);
  await db.update(vendors)
    .set({ settings: { ...current, addons: list }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  return list;
}
