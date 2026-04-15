/**
 * Platform Feature Registry
 *
 * كل ميزة في المنصة مسجلة هنا. الأدمن يتحكم أي ميزة تنفتح في أي باقة.
 * الفرونت يستخدم useFeature() hook للتحقق قبل عرض أي صفحة.
 */

export interface FeatureDef {
  id: string;
  nameAr: string;
  category: string;
  description: string;
}

export const FEATURE_REGISTRY: FeatureDef[] = [
  // أساسيات — مفتوحة للكل
  { id: 'bookings', nameAr: 'حجوزات', category: 'أساسي', description: 'استقبال وإدارة الحجوزات' },
  { id: 'store_page', nameAr: 'موقع حجز خاص', category: 'أساسي', description: 'صفحة حجز بتصميم خاص' },
  { id: 'whatsapp', nameAr: 'إشعارات واتساب', category: 'أساسي', description: 'إرسال تأكيدات وتذكيرات' },
  { id: 'basic_reports', nameAr: 'تقارير مبسطة', category: 'أساسي', description: 'إحصائيات وتقارير أساسية' },
  { id: 'basic_themes', nameAr: 'ثيمات مجانية', category: 'أساسي', description: '5 ثيمات لموقع الحجز' },

  // احترافي
  { id: 'gps_tracking', nameAr: 'تتبع GPS', category: 'احترافي', description: 'تتبع مواقع الموظفين' },
  { id: 'pos', nameAr: 'نقطة بيع (كاشير)', category: 'احترافي', description: 'كاشير متكامل للبيع المباشر' },
  { id: 'payments', nameAr: 'مدفوعات إلكترونية', category: 'احترافي', description: 'STC Pay, مدى, Apple Pay' },
  { id: 'inventory', nameAr: 'إدارة مخزون', category: 'احترافي', description: 'تتبع المخزون والمواد' },
  { id: 'campaigns', nameAr: 'حملات واتساب', category: 'احترافي', description: 'إرسال حملات تسويقية' },
  { id: 'dispatch', nameAr: 'التوزيع والإرسال', category: 'احترافي', description: 'توزيع الحجوزات على الموظفين' },

  // أعمال
  { id: 'queue', nameAr: 'طابور ذكي', category: 'أعمال', description: 'نظام طابور انتظار للمواقع الثابتة' },
  { id: 'loyalty', nameAr: 'برنامج ولاء', category: 'أعمال', description: 'نقاط وبطاقات ختم للعملاء' },
  { id: 'crm', nameAr: 'CRM عملاء', category: 'أعمال', description: 'إدارة علاقات العملاء المتقدمة' },
  { id: 'ai_advisor', nameAr: 'مستشار ذكي AI', category: 'أعمال', description: 'تحليل وتوصيات بالذكاء الاصطناعي' },
  { id: 'vat_reports', nameAr: 'تقارير VAT', category: 'أعمال', description: 'تقارير ضريبة القيمة المضافة' },
  { id: 'financial_statements', nameAr: 'قوائم مالية', category: 'أعمال', description: 'قائمة دخل وميزانية' },
  { id: 'premium_themes', nameAr: 'ثيمات بريميوم', category: 'أعمال', description: 'كل الثيمات (20 ثيم)' },
  { id: 'automations', nameAr: 'أتمتة تسويقية', category: 'أعمال', description: 'أتمتة الرسائل والعروض' },
  { id: 'customer_segments', nameAr: 'تصنيف عملاء', category: 'أعمال', description: 'تصنيف ذكي للعملاء' },

  // مؤسسي
  { id: 'unlimited_employees', nameAr: 'موظفون غير محدودون', category: 'مؤسسي', description: 'بدون حد لعدد الموظفين' },
  { id: 'payroll', nameAr: 'رواتب تلقائية', category: 'مؤسسي', description: 'حساب وصرف الرواتب' },
  { id: 'multi_branch', nameAr: 'فروع متعددة', category: 'مؤسسي', description: 'إدارة عدة فروع' },
  { id: 'webhooks', nameAr: 'Webhooks / API', category: 'مؤسسي', description: 'ربط مع أنظمة خارجية' },
  { id: 'advanced_analytics', nameAr: 'تحليلات متقدمة', category: 'مؤسسي', description: 'تحليلات وتقارير متقدمة' },
  { id: 'priority_support', nameAr: 'أولوية دعم', category: 'مؤسسي', description: 'دعم فني بأولوية عالية' },
];

// Feature IDs grouped by category for quick reference
export const FEATURE_CATEGORIES = {
  basic: ['bookings', 'store_page', 'whatsapp', 'basic_reports', 'basic_themes'],
  professional: ['gps_tracking', 'pos', 'payments', 'inventory', 'campaigns', 'dispatch'],
  business: ['queue', 'loyalty', 'crm', 'ai_advisor', 'vat_reports', 'financial_statements', 'premium_themes', 'automations', 'customer_segments'],
  enterprise: ['unlimited_employees', 'payroll', 'multi_branch', 'webhooks', 'advanced_analytics', 'priority_support'],
};

// Default feature gates for each plan tier
export const DEFAULT_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  starter: Object.fromEntries([
    ...FEATURE_CATEGORIES.basic.map(f => [f, true]),
    ...FEATURE_CATEGORIES.professional.map(f => [f, false]),
    ...FEATURE_CATEGORIES.business.map(f => [f, false]),
    ...FEATURE_CATEGORIES.enterprise.map(f => [f, false]),
  ]),
  professional: Object.fromEntries([
    ...FEATURE_CATEGORIES.basic.map(f => [f, true]),
    ...FEATURE_CATEGORIES.professional.map(f => [f, true]),
    ...FEATURE_CATEGORIES.business.map(f => [f, false]),
    ...FEATURE_CATEGORIES.enterprise.map(f => [f, false]),
  ]),
  business: Object.fromEntries([
    ...FEATURE_CATEGORIES.basic.map(f => [f, true]),
    ...FEATURE_CATEGORIES.professional.map(f => [f, true]),
    ...FEATURE_CATEGORIES.business.map(f => [f, true]),
    ...FEATURE_CATEGORIES.enterprise.map(f => [f, false]),
  ]),
  enterprise: Object.fromEntries([
    ...FEATURE_CATEGORIES.basic.map(f => [f, true]),
    ...FEATURE_CATEGORIES.professional.map(f => [f, true]),
    ...FEATURE_CATEGORIES.business.map(f => [f, true]),
    ...FEATURE_CATEGORIES.enterprise.map(f => [f, true]),
  ]),
};

// Map route paths to feature IDs
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/vendor/pos': 'pos',
  '/vendor/queue': 'queue',
  '/vendor/livemap': 'gps_tracking',
  '/vendor/dispatch': 'dispatch',
  '/vendor/inventory': 'inventory',  // not exact but covers the concept
  '/vendor/crm': 'crm',
  '/vendor/segments': 'customer_segments',
  '/vendor/automations': 'automations',
  '/vendor/campaigns': 'campaigns',
  '/vendor/ai-advisor': 'ai_advisor',
  '/vendor/advanced-analytics': 'advanced_analytics',
  '/vendor/financial-statements': 'financial_statements',
  '/vendor/vat-report': 'vat_reports',
  '/vendor/payroll': 'payroll',
  '/vendor/webhooks': 'webhooks',
  '/vendor/leaderboard': 'gps_tracking', // comes with pro
};
