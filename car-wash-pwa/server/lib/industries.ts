/**
 * Industry definitions for the multi-sector home services platform.
 * Currently launched: car_wash. Infrastructure ready for all sectors.
 */

export const INDUSTRIES = {
  car_wash: {
    nameAr: 'مغاسل السيارات',
    nameEn: 'Car Wash',
    icon: 'Car',
    description: 'مغاسل سيارات متنقلة وثابتة',
    vehicleFieldsEnabled: true,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الحجز',
    defaultServices: [
      { nameAr: 'غسيل خارجي', icon: '🚿' },
      { nameAr: 'غسيل داخلي', icon: '🧹' },
      { nameAr: 'غسيل شامل', icon: '✨' },
      { nameAr: 'تلميع', icon: '💎' },
    ],
    defaultPackages: [
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي عادي', price: 50, duration: 30, features: ['غسيل بالرغوة', 'تجفيف', 'تلميع إطارات'] },
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي VIP', price: 80, duration: 45, features: ['غسيل بالرغوة', 'شمع حماية', 'تلميع إطارات', 'تنظيف جنوط'] },
      { serviceName: 'غسيل داخلي', nameAr: 'داخلي كامل', price: 80, duration: 45, features: ['تنظيف مقاعد', 'تنظيف تابلوه', 'تعطير'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل عادي', price: 120, duration: 60, features: ['خارجي + داخلي', 'تعطير', 'تلميع إطارات'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل VIP', price: 180, duration: 90, features: ['خارجي + داخلي', 'شمع حماية', 'تلميع كامل', 'تعطير فاخر'] },
    ],
    defaultInventory: [
      { nameAr: 'شامبو سيارات', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'شمع حماية', unit: 'لتر', minQuantity: 5 },
      { nameAr: 'معطر', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'فوط مايكروفايبر', unit: 'حبة', minQuantity: 30 },
    ],
  },
  home_cleaning: {
    nameAr: 'تنظيف منازل',
    nameEn: 'Home Cleaning',
    icon: 'Home',
    description: 'تنظيف شقق وفلل ومكاتب',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'صاحب المنزل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'تنظيف شامل', icon: '🏠' },
      { nameAr: 'تنظيف مطبخ', icon: '🍳' },
      { nameAr: 'تنظيف حمامات', icon: '🚿' },
      { nameAr: 'كوي وترتيب', icon: '👔' },
    ],
    defaultPackages: [
      { serviceName: 'تنظيف شامل', nameAr: 'شقة صغيرة', price: 200, duration: 120, features: ['غرفتين', 'صالة', 'مطبخ', 'حمام'] },
      { serviceName: 'تنظيف شامل', nameAr: 'شقة كبيرة', price: 350, duration: 180, features: ['4 غرف', 'صالتين', 'مطبخ', '2 حمام'] },
      { serviceName: 'تنظيف شامل', nameAr: 'فيلا', price: 600, duration: 300, features: ['فيلا كاملة', 'حديقة', 'مسبح'] },
    ],
    defaultInventory: [
      { nameAr: 'منظف أسطح', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'معقم', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'أكياس قمامة', unit: 'رول', minQuantity: 20 },
    ],
  },
  ac_maintenance: {
    nameAr: 'صيانة مكيفات',
    nameEn: 'AC Maintenance',
    icon: 'Wind',
    description: 'تنظيف وصيانة وتركيب مكيفات',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'تنظيف مكيف', icon: '❄️' },
      { nameAr: 'صيانة', icon: '🔧' },
      { nameAr: 'تركيب', icon: '⚙️' },
      { nameAr: 'فك ونقل', icon: '📦' },
    ],
    defaultPackages: [
      { serviceName: 'تنظيف مكيف', nameAr: 'سبليت', price: 100, duration: 45, features: ['تنظيف فلاتر', 'غسيل المبخر', 'تعقيم'] },
      { serviceName: 'تنظيف مكيف', nameAr: 'دولابي', price: 150, duration: 60, features: ['تنظيف كامل', 'غسيل بالضغط', 'تعقيم'] },
      { serviceName: 'صيانة', nameAr: 'فحص شامل', price: 150, duration: 60, features: ['فحص غاز', 'فحص كهرباء', 'تنظيف'] },
    ],
    defaultInventory: [
      { nameAr: 'غاز فريون', unit: 'كيلو', minQuantity: 5 },
      { nameAr: 'فلاتر', unit: 'حبة', minQuantity: 10 },
      { nameAr: 'منظف مكيفات', unit: 'لتر', minQuantity: 10 },
    ],
  },
  plumbing: {
    nameAr: 'سباكة',
    nameEn: 'Plumbing',
    icon: 'Droplets',
    description: 'صيانة وتمديد سباكة',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'تسليك مجاري', icon: '🔧' },
      { nameAr: 'كشف تسربات', icon: '💧' },
      { nameAr: 'تركيب أدوات صحية', icon: '🚿' },
    ],
    defaultPackages: [
      { serviceName: 'تسليك مجاري', nameAr: 'تسليك عادي', price: 150, duration: 60 },
      { serviceName: 'كشف تسربات', nameAr: 'كشف بالجهاز', price: 300, duration: 90 },
    ],
    defaultInventory: [
      { nameAr: 'مواسير PVC', unit: 'متر', minQuantity: 20 },
      { nameAr: 'صمامات', unit: 'حبة', minQuantity: 10 },
    ],
  },
  electrical: {
    nameAr: 'كهرباء',
    nameEn: 'Electrical',
    icon: 'Zap',
    description: 'صيانة وتمديد كهرباء',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'صيانة كهرباء', icon: '⚡' },
      { nameAr: 'تمديدات', icon: '🔌' },
      { nameAr: 'تركيب إنارة', icon: '💡' },
    ],
    defaultPackages: [
      { serviceName: 'صيانة كهرباء', nameAr: 'زيارة فحص', price: 100, duration: 60 },
      { serviceName: 'تركيب إنارة', nameAr: 'تركيب ثريا', price: 150, duration: 45 },
    ],
    defaultInventory: [
      { nameAr: 'أسلاك', unit: 'متر', minQuantity: 50 },
      { nameAr: 'مفاتيح كهرباء', unit: 'حبة', minQuantity: 20 },
    ],
  },
  pest_control: {
    nameAr: 'مكافحة حشرات',
    nameEn: 'Pest Control',
    icon: 'Bug',
    description: 'مكافحة حشرات وقوارض وتعقيم',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'رش حشرات', icon: '🪲' },
      { nameAr: 'مكافحة قوارض', icon: '🐀' },
      { nameAr: 'تعقيم', icon: '🧴' },
    ],
    defaultPackages: [
      { serviceName: 'رش حشرات', nameAr: 'شقة', price: 200, duration: 60 },
      { serviceName: 'رش حشرات', nameAr: 'فيلا', price: 400, duration: 120 },
      { serviceName: 'تعقيم', nameAr: 'تعقيم شامل', price: 300, duration: 90 },
    ],
    defaultInventory: [
      { nameAr: 'مبيد حشري', unit: 'لتر', minQuantity: 20 },
      { nameAr: 'طعوم قوارض', unit: 'حبة', minQuantity: 30 },
    ],
  },
  carpet_cleaning: {
    nameAr: 'غسيل سجاد',
    nameEn: 'Carpet Cleaning',
    icon: 'Layers',
    description: 'غسيل سجاد وموكيت وكنب',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الطلب',
    defaultServices: [
      { nameAr: 'غسيل سجاد', icon: '🧹' },
      { nameAr: 'غسيل كنب', icon: '🛋️' },
      { nameAr: 'غسيل موكيت', icon: '🏠' },
    ],
    defaultPackages: [
      { serviceName: 'غسيل سجاد', nameAr: 'سجادة صغيرة', price: 30, duration: 15 },
      { serviceName: 'غسيل سجاد', nameAr: 'سجادة كبيرة', price: 60, duration: 20 },
      { serviceName: 'غسيل كنب', nameAr: 'كنب 5 مقاعد', price: 200, duration: 60 },
    ],
    defaultInventory: [
      { nameAr: 'شامبو سجاد', unit: 'لتر', minQuantity: 20 },
      { nameAr: 'معطر أقمشة', unit: 'لتر', minQuantity: 10 },
    ],
  },
  landscaping: {
    nameAr: 'تنسيق حدائق',
    nameEn: 'Landscaping',
    icon: 'Flower2',
    description: 'تنسيق وصيانة حدائق',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'صاحب المنزل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'قص وتشذيب', icon: '✂️' },
      { nameAr: 'زراعة', icon: '🌱' },
      { nameAr: 'تركيب شبكة ري', icon: '💧' },
    ],
    defaultPackages: [
      { serviceName: 'قص وتشذيب', nameAr: 'حديقة صغيرة', price: 150, duration: 60 },
      { serviceName: 'قص وتشذيب', nameAr: 'حديقة كبيرة', price: 300, duration: 120 },
    ],
    defaultInventory: [
      { nameAr: 'سماد', unit: 'كيلو', minQuantity: 20 },
      { nameAr: 'تربة زراعية', unit: 'كيس', minQuantity: 10 },
    ],
  },
  other: {
    nameAr: 'خدمات أخرى',
    nameEn: 'Other Services',
    icon: 'Wrench',
    description: 'خدمات منزلية متنوعة',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: true,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الطلب',
    defaultServices: [],
    defaultPackages: [],
    defaultInventory: [],
  },
} as const;

export type IndustryKey = keyof typeof INDUSTRIES;

/** Get Arabic label for an industry */
export function getIndustryLabel(industry: string): string {
  return INDUSTRIES[industry as IndustryKey]?.nameAr ?? industry;
}

/** Get all active industries as array (excludes comingSoon by default) */
export function getIndustriesList(includeComingSoon = false) {
  return Object.entries(INDUSTRIES)
    .filter(([_, val]) => includeComingSoon || !val.comingSoon)
    .map(([key, val]) => ({
      key,
      ...val,
    }));
}
