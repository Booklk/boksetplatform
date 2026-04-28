/**
 * Mobile App Builder — vendor pays once to convert their store into a
 * native iOS/Android app project (source code + assets + manual).
 *
 * Three plans + a-la-carte support hours. Pricing is the source of truth
 * here; the UI / payment flow / refund logic all read from this catalog.
 */
export type MobileAppPlanId = 'android' | 'ios' | 'both' | 'support_hour';

export interface MobileAppPlan {
  id: MobileAppPlanId;
  nameAr: string;
  nameEn: string;
  priceSar: number;
  durationDays: number;       // expected delivery window
  supportHoursIncluded: number;
  features: string[];
  category: 'one_time' | 'support';
}

export const MOBILE_APP_PLANS: Record<MobileAppPlanId, MobileAppPlan> = {
  android: {
    id: 'android',
    nameAr: 'تطبيق Android فقط',
    nameEn: 'Android Only',
    priceSar: 2500,
    durationDays: 5,
    supportHoursIncluded: 2,
    category: 'one_time',
    features: [
      'مشروع Android Studio جاهز',
      'ملف APK / AAB موقّع جاهز للنشر',
      'كل الأيقونات بكل المقاسات',
      'Splash screens لكل دقة',
      'Screenshots احترافية للمتجر',
      'وصف عربي + إنجليزي',
      'دليل النشر على Google Play (PDF)',
      'ضمان توافق Android 8+ (95% من الأجهزة)',
      'ساعتان دعم تقني مجاناً',
    ],
  },
  ios: {
    id: 'ios',
    nameAr: 'تطبيق iOS فقط',
    nameEn: 'iOS Only',
    priceSar: 3500,
    durationDays: 7,
    supportHoursIncluded: 2,
    category: 'one_time',
    features: [
      'مشروع Xcode جاهز',
      'كل الأيقونات بكل المقاسات (16x16 → 1024x1024)',
      'Launch screens لكل iPhone/iPad',
      'Screenshots احترافية لـ App Store',
      'وصف وكلمات مفتاحية محسّنة',
      'دليل النشر على App Store (PDF)',
      'ضمان توافق iOS 15+ (98% من الأجهزة)',
      'دعم Apple Sign-In',
      'ساعتان دعم تقني مجاناً',
    ],
  },
  both: {
    id: 'both',
    nameAr: 'iOS + Android معاً',
    nameEn: 'iOS + Android Bundle',
    priceSar: 5000,
    durationDays: 7,
    supportHoursIncluded: 4,
    category: 'one_time',
    features: [
      'كل ميزات Android فقط',
      'كل ميزات iOS فقط',
      '٤ ساعات دعم تقني مجاناً (بدل ساعتين)',
      'GitHub repo خاص بمتجرك',
      'وفّر 1,000 ر.س مقارنةً بشراء كل واحد منفصلاً',
    ],
  },
  support_hour: {
    id: 'support_hour',
    nameAr: 'ساعة دعم مطوّر',
    nameEn: 'Developer Support Hour',
    priceSar: 300,
    durationDays: 1,
    supportHoursIncluded: 1,
    category: 'support',
    features: [
      'مكالمة Zoom أو دعم عبر واتساب',
      'مساعدة في رفع التطبيق',
      'حل مشاكل البناء',
      'تخصيصات إضافية على الكود',
      'دعم بعد انتهاء الساعات المجانية المضمنة',
    ],
  },
};

export function getPlan(id: string): MobileAppPlan | null {
  return MOBILE_APP_PLANS[id as MobileAppPlanId] ?? null;
}

export function listOneTimePlans(): MobileAppPlan[] {
  return Object.values(MOBILE_APP_PLANS).filter((p) => p.category === 'one_time');
}
