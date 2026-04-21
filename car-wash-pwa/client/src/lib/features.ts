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
  { id: 'basic_themes', nameAr: 'ثيمات مجانية', category: 'أساسي', description: 'قوالب موقع الحجز' },
  { id: 'custom_pages', nameAr: 'صفحات مخصصة', category: 'أساسي', description: 'أسعار، شروط، FAQ، أي صفحة تبي' },
  { id: 'white_label', nameAr: 'إخفاء علامة جداول', category: 'أساسي', description: 'موقعك بعلامتك فقط' },
  { id: 'custom_domain', nameAr: 'دومين مخصص', category: 'أساسي', description: 'اربط دومينك الخاص' },

  // Pro — ميزات المالك المتقدمة
  { id: 'google_maps', nameAr: 'Google Maps', category: 'Pro', description: 'تفعيل خرائط Google داخل موقعك' },
  { id: 'financial_statements', nameAr: 'قوائم مالية متقدمة', category: 'Pro', description: 'P&L + Cashflow + VAT مفصّلة' },
  { id: 'employee_management', nameAr: 'إدارة موظفين متعدد', category: 'Pro', description: 'موظفون غير محدودون + GPS + رواتب' },
  { id: 'advanced_dashboard', nameAr: 'لوحة تحكم متقدمة', category: 'Pro', description: 'تحليلات + تنبؤات + Benchmarks' },
  { id: 'ai_advisor', nameAr: 'المستشار الذكي AI', category: 'Pro', description: 'مستشار مالي وتشغيلي بالـ AI' },

  // احترافي
  { id: 'gps_tracking', nameAr: 'تتبع GPS', category: 'احترافي', description: 'تتبع مواقع الموظفين' },
  { id: 'pos', nameAr: 'نقطة بيع (كاشير)', category: 'احترافي', description: 'كاشير متكامل للبيع المباشر' },
  { id: 'payments', nameAr: 'مدفوعات إلكترونية', category: 'احترافي', description: 'STC Pay, مدى, Apple Pay' },
  { id: 'inventory', nameAr: 'إدارة مخزون', category: 'احترافي', description: 'تتبع المخزون والمواد' },
  { id: 'campaigns', nameAr: 'حملات واتساب', category: 'احترافي', description: 'إرسال حملات تسويقية' },
  { id: 'dispatch', nameAr: 'التوزيع والإرسال', category: 'احترافي', description: 'توزيع الحجوزات على الموظفين' },

  // أعمال — كلها مجانية الآن
  { id: 'queue', nameAr: 'طابور ذكي', category: 'أعمال', description: 'نظام طابور انتظار للمواقع الثابتة' },
  { id: 'loyalty', nameAr: 'برنامج ولاء', category: 'أعمال', description: 'نقاط وبطاقات ختم للعملاء' },
  { id: 'crm', nameAr: 'CRM عملاء', category: 'أعمال', description: 'إدارة علاقات العملاء المتقدمة' },
  { id: 'vat_reports', nameAr: 'تقارير VAT', category: 'أعمال', description: 'تقارير ضريبة القيمة المضافة' },
  { id: 'premium_themes', nameAr: 'كل القوالب (40)', category: 'أعمال', description: 'كل قوالب المنصة مفتوحة' },
  { id: 'automations', nameAr: 'أتمتة تسويقية', category: 'أعمال', description: 'أتمتة الرسائل والعروض' },
  { id: 'customer_segments', nameAr: 'تصنيف عملاء', category: 'أعمال', description: 'تصنيف ذكي للعملاء' },

  // ميزات تابعة لـ Pro (دعم قانوني / فني)
  { id: 'gps_tracking', nameAr: 'تتبع GPS للموظفين', category: 'Pro', description: 'جزء من إدارة الموظفين' },
  { id: 'unlimited_employees', nameAr: 'موظفون غير محدودون', category: 'Pro', description: 'جزء من إدارة الموظفين' },
  { id: 'payroll', nameAr: 'رواتب تلقائية', category: 'Pro', description: 'جزء من إدارة الموظفين' },
  { id: 'multi_branch', nameAr: 'فروع متعددة', category: 'Pro', description: 'إدارة عدة فروع' },
  { id: 'webhooks', nameAr: 'Webhooks / API', category: 'Pro', description: 'ربط مع أنظمة خارجية' },
  { id: 'priority_support', nameAr: 'أولوية دعم', category: 'Pro', description: 'دعم فني بأولوية عالية' },

  // احترافي — مجانية
  { id: 'pos', nameAr: 'نقطة بيع (كاشير)', category: 'احترافي', description: 'كاشير متكامل للبيع المباشر' },
  { id: 'payments', nameAr: 'مدفوعات إلكترونية', category: 'احترافي', description: 'STC Pay, مدى, Apple Pay' },
  { id: 'inventory', nameAr: 'إدارة مخزون', category: 'احترافي', description: 'تتبع المخزون والمواد' },
  { id: 'campaigns', nameAr: 'حملات واتساب', category: 'احترافي', description: 'إرسال حملات تسويقية' },
  { id: 'dispatch', nameAr: 'التوزيع والإرسال', category: 'احترافي', description: 'توزيع الحجوزات على الموظفين' },
];

// Feature IDs grouped by plan.
//
// FREE = the storefront essentials. A vendor can publish a beautiful
// store, take unlimited bookings, run a queue + gallery, paint the
// whole UI with their own colours, and add custom pages (FAQ, prices,
// terms). That's it — no messaging, no ops tooling, no analytics.
//
// PRO = the full operations toolkit. Everything related to talking to
// customers (WhatsApp, campaigns, automations), running the register
// (POS, inventory), managing people (employees, GPS, payroll, bonuses),
// and understanding the business (Google Maps, financial statements,
// advanced dashboard, AI advisor).
export const FEATURE_CATEGORIES = {
  free: [
    'bookings', 'store_page', 'basic_reports',
    'basic_themes', 'queue', // 3 free templates per industry, queue + gallery included
  ],
  pro: [
    // Messaging
    'whatsapp', 'campaigns', 'automations',
    // Point of sale + inventory
    'pos', 'payments', 'inventory',
    // CRM
    'crm', 'loyalty', 'customer_segments',
    // Templates
    'premium_themes',
    // Ops
    'dispatch', 'vat_reports',
    // Owner tools
    'google_maps', 'financial_statements',
    'employee_management', 'unlimited_employees', 'payroll', 'gps_tracking',
    'advanced_dashboard', 'ai_advisor',
    'multi_branch', 'webhooks', 'priority_support',
  ],
};

// Default feature gates for 2-plan model
export const DEFAULT_PLAN_FEATURES: Record<string, Record<string, boolean>> = {
  free: Object.fromEntries([
    ...FEATURE_CATEGORIES.free.map(f => [f, true]),
    ...FEATURE_CATEGORIES.pro.map(f => [f, false]),
  ]),
  pro: Object.fromEntries([
    ...FEATURE_CATEGORIES.free.map(f => [f, true]),
    ...FEATURE_CATEGORIES.pro.map(f => [f, true]),
  ]),
};

// Route → feature gate. Only Pro-gated routes listed here; anything
// not mapped is open on every plan.
export const ROUTE_FEATURE_MAP: Record<string, string> = {
  // Messaging / marketing (Pro)
  '/vendor/campaigns':            'campaigns',
  '/vendor/automations':          'automations',
  // POS + inventory (Pro)
  '/vendor/pos':                  'pos',
  '/vendor/inventory':            'inventory',
  '/vendor/suppliers':            'inventory',
  // CRM + loyalty (Pro)
  '/vendor/crm':                  'crm',
  '/vendor/segments':             'customer_segments',
  '/vendor/customer-import':      'crm',
  '/vendor/gift-cards':           'loyalty',
  // Ops (Pro)
  '/vendor/dispatch':             'dispatch',
  '/vendor/livemap':              'gps_tracking',
  // Employees / payroll (Pro)
  '/vendor/employees':            'employee_management',
  '/vendor/payroll':              'employee_management',
  '/vendor/employee-performance': 'employee_management',
  '/vendor/leaderboard':          'employee_management',
  '/vendor/shifts':               'employee_management',
  // Financials (Pro)
  '/vendor/financial-statements': 'financial_statements',
  '/vendor/vat-report':           'vat_reports',
  // Owner tools (Pro)
  '/vendor/advanced-analytics':   'advanced_dashboard',
  '/vendor/ai-advisor':           'ai_advisor',
  '/vendor/webhooks':             'webhooks',
};
