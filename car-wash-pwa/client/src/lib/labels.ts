/**
 * Centralized UI labels based on vendor's industry.
 * ALL pages should use these instead of hardcoded "مغسلة" or "غسيل".
 *
 * Usage:
 *   const labels = getLabels('salon');
 *   labels.businessName → "الصالون"
 *   labels.booking → "الموعد"
 *   labels.employee → "المتخصص"
 */

export interface IndustryLabels {
  businessName: string;       // "المغسلة" | "الصالون" | "الشركة"
  businessNamePlural: string; // "المغاسل" | "الصالونات"
  booking: string;            // "الحجز" | "الموعد" | "الطلب"
  bookingPlural: string;      // "الحجوزات" | "المواعيد"
  customer: string;           // "العميل" | "العميلة" | "صاحب المنزل"
  customerPlural: string;     // "العملاء" | "العميلات"
  employee: string;           // "الموظف" | "الفني" | "المتخصصة"
  employeePlural: string;     // "الموظفين" | "الفنيين"
  service: string;            // "الخدمة" | "الباقة"
  onTheWay: string;           // "في الطريق إليك"
  inProgress: string;         // "جارٍ تنفيذ الخدمة"
  completed: string;          // "تمت الخدمة بنجاح"
  bookNow: string;            // "احجز الآن" | "احجزي الآن"
  searchPlaceholder: string;  // "ابحث عن..."
}

const LABELS: Record<string, IndustryLabels> = {
  car_wash: {
    businessName: 'المغسلة',
    businessNamePlural: 'المغاسل',
    booking: 'الحجز',
    bookingPlural: 'الحجوزات',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'الموظف',
    employeePlural: 'الموظفين',
    service: 'الخدمة',
    onTheWay: 'في الطريق إليك 🚗',
    inProgress: 'جارٍ تنفيذ الخدمة',
    completed: 'تمت الخدمة بنجاح ✅',
    bookNow: 'احجز الآن',
    searchPlaceholder: 'ابحث عن مغسلة...',
  },
  home_cleaning: {
    businessName: 'الشركة',
    businessNamePlural: 'شركات التنظيف',
    booking: 'الزيارة',
    bookingPlural: 'الزيارات',
    customer: 'صاحب المنزل',
    customerPlural: 'العملاء',
    employee: 'عامل النظافة',
    employeePlural: 'فريق التنظيف',
    service: 'الخدمة',
    onTheWay: 'الفريق في الطريق 🏠',
    inProgress: 'جارٍ التنظيف',
    completed: 'تم التنظيف بنجاح ✅',
    bookNow: 'احجز زيارة',
    searchPlaceholder: 'ابحث عن شركة تنظيف...',
  },
  ac_maintenance: {
    businessName: 'الشركة',
    businessNamePlural: 'شركات الصيانة',
    booking: 'طلب الصيانة',
    bookingPlural: 'طلبات الصيانة',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'الفني',
    employeePlural: 'الفنيين',
    service: 'الخدمة',
    onTheWay: 'الفني في الطريق ❄️',
    inProgress: 'جارٍ الصيانة',
    completed: 'تمت الصيانة بنجاح ✅',
    bookNow: 'اطلب صيانة',
    searchPlaceholder: 'ابحث عن فني مكيفات...',
  },
  plumbing: {
    businessName: 'الشركة',
    businessNamePlural: 'شركات السباكة',
    booking: 'طلب الصيانة',
    bookingPlural: 'طلبات الصيانة',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'السباك',
    employeePlural: 'السباكين',
    service: 'الخدمة',
    onTheWay: 'السباك في الطريق 🔧',
    inProgress: 'جارٍ الإصلاح',
    completed: 'تم الإصلاح بنجاح ✅',
    bookNow: 'اطلب سباك',
    searchPlaceholder: 'ابحث عن سباك...',
  },
  electrical: {
    businessName: 'الشركة',
    businessNamePlural: 'شركات الكهرباء',
    booking: 'طلب الصيانة',
    bookingPlural: 'طلبات الصيانة',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'الكهربائي',
    employeePlural: 'الكهربائيين',
    service: 'الخدمة',
    onTheWay: 'الكهربائي في الطريق ⚡',
    inProgress: 'جارٍ العمل',
    completed: 'تم الإصلاح بنجاح ✅',
    bookNow: 'اطلب كهربائي',
    searchPlaceholder: 'ابحث عن كهربائي...',
  },
  salon: {
    businessName: 'الصالون',
    businessNamePlural: 'الصالونات',
    booking: 'الموعد',
    bookingPlural: 'المواعيد',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'الحلاق',
    employeePlural: 'الحلاقين',
    service: 'الخدمة',
    onTheWay: 'في الطريق إليك 💈',
    inProgress: 'جارٍ تنفيذ الخدمة',
    completed: 'تمت الخدمة بنجاح ✅',
    bookNow: 'احجز موعد',
    searchPlaceholder: 'ابحث عن صالون...',
  },
  beauty_home: {
    businessName: 'المتخصصة',
    businessNamePlural: 'متخصصات التجميل',
    booking: 'الموعد',
    bookingPlural: 'المواعيد',
    customer: 'العميلة',
    customerPlural: 'العميلات',
    employee: 'المتخصصة',
    employeePlural: 'المتخصصات',
    service: 'الخدمة',
    onTheWay: 'المتخصصة في الطريق 💄',
    inProgress: 'جارٍ تنفيذ الخدمة',
    completed: 'تمت الخدمة بنجاح ✅',
    bookNow: 'احجزي موعد',
    searchPlaceholder: 'ابحثي عن متخصصة...',
  },
  freelancer: {
    businessName: 'مقدم الخدمة',
    businessNamePlural: 'مقدمي الخدمات',
    booking: 'الحجز',
    bookingPlural: 'الحجوزات',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'المنفذ',
    employeePlural: 'المنفذين',
    service: 'الخدمة',
    onTheWay: 'في الطريق إليك',
    inProgress: 'جارٍ تنفيذ الخدمة',
    completed: 'تمت الخدمة بنجاح ✅',
    bookNow: 'احجز الآن',
    searchPlaceholder: 'ابحث عن مقدم خدمة...',
  },
  other: {
    businessName: 'المشروع',
    businessNamePlural: 'المشاريع',
    booking: 'الطلب',
    bookingPlural: 'الطلبات',
    customer: 'العميل',
    customerPlural: 'العملاء',
    employee: 'الموظف',
    employeePlural: 'الموظفين',
    service: 'الخدمة',
    onTheWay: 'في الطريق إليك',
    inProgress: 'جارٍ تنفيذ الخدمة',
    completed: 'تمت الخدمة بنجاح ✅',
    bookNow: 'احجز الآن',
    searchPlaceholder: 'ابحث...',
  },
};

// Default fallback
const DEFAULT_LABELS = LABELS.other;

/**
 * Get UI labels for a given industry.
 * Falls back to generic labels if industry is unknown.
 */
export function getLabels(industry?: string | null): IndustryLabels {
  if (!industry) return DEFAULT_LABELS;
  return LABELS[industry] ?? DEFAULT_LABELS;
}

/**
 * Generic labels for the platform level (Landing page, etc.)
 * Not tied to any specific industry.
 */
export const PLATFORM_LABELS = {
  businessName: 'مشروعك',
  booking: 'الحجز',
  tagline: 'أنشئ موقع حجوزاتك بجميع المميزات اللي يحتاجها مشروعك',
} as const;
