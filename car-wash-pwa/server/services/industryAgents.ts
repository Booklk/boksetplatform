/**
 * Industry Agents — per-sector system prompts + Saudi market data.
 * Picked by the AI advisor based on vendors.industry, so each vendor
 * gets a consultant who actually speaks their language and knows
 * their segment's numbers.
 *
 * Every prompt includes:
 *   1. Role: specialist financial + operations advisor (not generic AI).
 *   2. Saudi market benchmarks (prices, margins, peak hours).
 *   3. Tone: Saudi dialect, direct, data-backed.
 *   4. Tool-use instructions so the model knows to call
 *      get_financial_summary / get_inventory_status / etc. when it
 *      needs real numbers.
 */

export type AgentIndustry =
  | 'salon' | 'barber' | 'beauty_home'
  | 'car_wash' | 'car_wash_mobile' | 'car_wash_fixed'
  | 'cleaning' | 'movers' | 'spa' | 'universal';

export interface IndustryMarketData {
  /** Short Arabic label for the dashboard. */
  label: string;
  /** Typical service price range in SAR for Saudi Arabia. */
  priceRangeSar: string;
  /** Expected gross profit margin after direct costs. */
  margingPct: string;
  /** Peak hours/days to optimise for. */
  peakPattern: string;
  /** Most common pitfalls the advisor should probe for. */
  commonPitfalls: string[];
  /** Levers the advisor should suggest first. */
  growthLevers: string[];
}

const UNIVERSAL_CONTEXT = `
## دورك
أنت مستشار مالي وأعمال متخصص للأعمال الخدمية في السعودية.
تعمل داخل منصة "جداول" وتتابع أرقام التاجر لحظة بلحظة.

## كيف تفكّر
- لا تعطي نصائح عامة. كل نصيحة لازم تكون مدعومة برقم من بيانات التاجر أو السوق.
- استدعِ الأدوات (tools) لجلب بيانات حقيقية قبل ما تقترح أي شي.
- قارن دايماً: أرقام التاجر vs متوسط قطاعه vs الشهر السابق.
- قبل أي توصية، اسأل نفسك: "هل يقدر يطبقها اليوم؟"

## أسلوب الردّ
- لهجة سعودية طبيعية (مو فصحى ثقيلة، مو مصطلحات أجنبية).
- قصير ومباشر. نقاط، أرقام، وأفعال.
- ابدأ بالاستنتاج ثم أرقامه.
- إذا ما عندك بيانات كافية قل "أحتاج أفحص X" واستدعِ الأداة المناسبة.

## الأدوات المتاحة
- get_financial_summary(periodDays): إيرادات، مصروفات، ربح، هامش.
- get_inventory_status(): مخزون منخفض، نفاد، قيمة.
- get_top_packages(periodDays): أعلى الباقات مبيعاً.
- get_customer_metrics(): عدد العملاء، نسبة العودة.
- get_employee_productivity(periodDays): أداء الموظفين.
- get_peak_pattern(): ساعات وأيام الذروة.

## ما لا تفعله
- لا تعد بأرقام ما تقدر تثبتها.
- لا تقترح زيادة السعر فوق 20٪ دفعة وحدة.
- لا تتجاهل المصروفات لما تحسب الربح.
- لا تعطي نصائح تتعارض مع أنظمة السعودية (ضريبة القيمة المضافة ١٥٪ إلزامية).
`;

export const INDUSTRY_MARKET_DATA: Record<AgentIndustry, IndustryMarketData> = {
  salon: {
    label: 'صالونات نسائية ومراكز تجميل',
    priceRangeSar: '80 – 600 ر.س للخدمة حسب النوع (قصة 80-150، صبغة 250-600، باقة عروس 800-2500)',
    margingPct: '45-65٪ بعد استبعاد المواد ورواتب الموظفات',
    peakPattern: 'الخميس والجمعة + قبل العيد والمناسبات، الذروة اليومية 4-9 مساءً',
    commonPitfalls: [
      'مخزون الصبغات والمستلزمات بدون تتبع — هدر 15-20٪',
      'عمولات الموظفات عالية بدون ربطها بالأداء',
      'فوضى المواعيد تُنفّر الزبونات الدائمات',
      'عدم بيع باقات (ولاء) — الزبونة تجي لخدمة واحدة وتختفي',
    ],
    growthLevers: [
      'إطلاق باقات اشتراك شهري (قصة + صبغة) بخصم 15٪',
      'عروض "يوم الزبونات الدائمات" في اليوم الأقل ازدحاماً',
      'تحويل الزبونات لمسار مكياج للمناسبات = أعلى ticket',
      'برنامج ولاء: 5 زيارات = جلسة مجانية',
    ],
  },
  barber: {
    label: 'صالونات حلاقة رجالية',
    priceRangeSar: '30 – 150 ر.س للخدمة (قصة عادية 40-60، قصة + ذقن 70-120، أطفال 30-50)',
    margingPct: '55-70٪ — مصاريف مواد قليلة، العمالة هي الأهم',
    peakPattern: 'الأربعاء-الجمعة + قبل العيد، الذروة 5-10 مساءً',
    commonPitfalls: [
      'طوابير طويلة = زبائن يتركون قبل دورهم',
      'عدم متابعة إنتاجية كل حلاق (قصات/ساعة)',
      'أسعار منخفضة جداً بدون "خدمة مميزة" تبرّر رفعها',
    ],
    growthLevers: [
      'نظام طابور رقمي يقلل الانتظار المرئي',
      'باقة "قصة + ذقن + غسيل" بسعر مجمّع',
      'اشتراك شهري (4 قصات) بخصم 10٪',
      'حجز مسبق لمسائي الخميس برسوم أولوية صغيرة',
    ],
  },
  beauty_home: {
    label: 'خدمات التجميل المنزلية',
    priceRangeSar: '200 – 1500 ر.س للجلسة (مكياج 300-800، حناء 200-600، باقة عروس 1500-5000)',
    margingPct: '60-75٪ — بدون إيجار محل، العمالة والمواصلات هي التكلفة',
    peakPattern: 'مواسم الأعراس (مارس-يونيو، سبتمبر-نوفمبر) + قبل العيد',
    commonPitfalls: [
      'تكلفة المواصلات ما تُحسب في السعر',
      'عدم التصوير المستمر للأعمال = ضعف التسويق',
      'حجوزات متداخلة بسبب سوء تقدير الوقت بين المواعيد',
    ],
    growthLevers: [
      'رفع سعر مواعيد العرائس 20-30٪ عن السعر العادي',
      'باقات "قبل العرس" (تجربة + يوم العرس) = ticket أعلى',
      'معرض صور احترافي للأعمال يضاعف الحجوزات',
      'اشتراك رعاية شهري (لايف ستايل) للزبونات الدائمات',
    ],
  },
  spa: {
    label: 'مراكز السبا والاسترخاء',
    priceRangeSar: '150 – 800 ر.س للجلسة (مساج 200-500، فيشل 250-600، باقات 800-2500)',
    margingPct: '50-65٪',
    peakPattern: 'الخميس والجمعة والسبت، الذروة المسائية',
    commonPitfalls: [
      'المخزون (زيوت، كريمات) بدون تتبع يومي',
      'غرف فاضية نصف اليوم',
      'عدم بيع منتجات للزبونة بعد الجلسة',
    ],
    growthLevers: [
      'باقات اشتراك (4 جلسات شهرياً بخصم 20٪)',
      'عروض "ساعة الاسترخاء" في الساعات الفاضية بخصم',
      'بيع منتجات ما بعد الجلسة (+15٪ إيراد)',
      'برنامج عضوية ذهبية (خصم دائم مقابل رسم سنوي)',
    ],
  },
  car_wash: {
    label: 'مغاسل السيارات (عام)',
    priceRangeSar: '25 – 300 ر.س (غسيل خارجي 25-60، داخلي+خارجي 60-120، بولش 150-400)',
    margingPct: '35-55٪',
    peakPattern: 'الخميس والجمعة، الذروة 3-8 مساءً',
    commonPitfalls: [
      'الاعتماد على غسيل رخيص بهامش منخفض',
      'عدم بيع خدمات مكمّلة (تعطير، ملمّع)',
    ],
    growthLevers: [
      'بيع باقات بولش + حماية سيراميك',
      'اشتراك شهري (4 غسلات) بخصم',
      'عروض الأسبوع الهادئ (السبت-الثلاثاء)',
    ],
  },
  car_wash_mobile: {
    label: 'مغاسل السيارات المتنقلة',
    priceRangeSar: '60 – 250 ر.س (غسيل متنقل 60-100، بولش متنقل 180-350)',
    margingPct: '40-55٪ بعد استبعاد الوقود والعمالة والمواصلات',
    peakPattern: 'صباح السبت + الخميس-الجمعة مساء، + الفترات الحارة صيفاً',
    commonPitfalls: [
      'تكلفة الوقود والمواصلات ما تُحسب بدقة',
      'توزيع سيء للمواعيد = ساعات ضايعة بين حجز وآخر',
      'عدم وجود GPS = فقدان الثقة مع العميل',
    ],
    growthLevers: [
      'اشتراك شهري "غسلتين + بولش" بخصم يربط العميل',
      'تجميع حجوزات نفس الحي = تقليل الوقود',
      'عقود B2B مع أبراج مكاتب (50+ سيارة)',
      'رفع السعر 15٪ للمواعيد الطارئة (نفس اليوم)',
    ],
  },
  car_wash_fixed: {
    label: 'مغاسل السيارات الثابتة',
    priceRangeSar: '25 – 300 ر.س',
    margingPct: '35-55٪',
    peakPattern: 'الخميس والجمعة ذروة، الصباح أقل ازدحاماً',
    commonPitfalls: [
      'طابور السيارات الطويل يفقد عملاء',
      'عدم استغلال ساعات النهار الفاضية',
      'الاعتماد على الماء الرخيص بدون مبيعات إضافية',
    ],
    growthLevers: [
      'نظام طابور رقمي يزيد الرضا ويقلل الفقد',
      'باقة VIP (بولش + سيراميك) لعملاء السيارات الفاخرة',
      'عرض "صباحي" 20-30٪ خصم للأوقات الهادئة',
      'خدمة استلام وتسليم للمشتركين',
    ],
  },
  cleaning: {
    label: 'شركات التنظيف',
    priceRangeSar: '300 – 5000 ر.س/عقد (زيارة منزل 300-800، فيلا 600-1500، عقد شركة شهري 2000-10000)',
    margingPct: '25-45٪ — كثافة العمالة تخفض الهامش',
    peakPattern: 'نهاية/بداية الشهر + قبل الأعياد والمناسبات',
    commonPitfalls: [
      'تسعير بالساعة بدون تقدير المتطلبات = خسارة',
      'عدم وجود عقود سنوية = دخل غير مستقر',
      'إهدار المواد (صابون، معدات) بدون مراقبة',
    ],
    growthLevers: [
      'عقود شهرية/سنوية مع شركات (B2B) = دخل ثابت',
      'باقات "تنظيف عميق فصلي" = ticket أعلى',
      'تسعير حسب مساحة المتر² (مش ساعة) = ربح أوضح',
      'تخصّص في التنظيف ما بعد المناسبات (هامش عالٍ)',
    ],
  },
  movers: {
    label: 'شركات نقل العفش',
    priceRangeSar: '600 – 8000 ر.س (نقل داخل المدينة 600-2000، بين المدن 1500-8000)',
    margingPct: '30-50٪ بعد الوقود والعمالة والسيارات',
    peakPattern: 'عطلات نهاية الأسبوع، مواسم نقل (بداية/نهاية الشهر + قبل المدارس)',
    commonPitfalls: [
      'تسعير قليل من الواتساب بدون معاينة = خسارة',
      'عدم احتساب التعبئة والتغليف كخدمة منفصلة',
      'سيارات فاضية في الأيام الهادئة',
    ],
    growthLevers: [
      'خدمة التعبئة والتغليف منفصلة = +20-30٪ ticket',
      'عقود إخلاء مع مكاتب العقار = طلبات ثابتة',
      'تخزين مؤقت (سعر شهري) = إيراد مستمر',
      'خدمة تركيب أثاث جاهزة = رفع هامش',
    ],
  },
  universal: {
    label: 'أعمال خدمية متنوعة',
    priceRangeSar: 'متغير حسب الخدمة',
    margingPct: '30-60٪ حسب نوع النشاط',
    peakPattern: 'يختلف حسب القطاع',
    commonPitfalls: [
      'عدم تتبع الربح الفعلي لكل خدمة',
      'مخزون ومصروفات بدون نظام',
      'تسويق بدون قياس العائد',
    ],
    growthLevers: [
      'باقات بدل خدمات منفردة',
      'اشتراك شهري للعملاء الدائمين',
      'رفع الأسعار تدريجياً (5-10٪ كل 6 أشهر)',
    ],
  },
};

export function getAgentIndustry(vendorIndustry?: string | null): AgentIndustry {
  const mapping: Record<string, AgentIndustry> = {
    'salon': 'salon',
    'salon_women': 'salon',
    'barber': 'barber',
    'beauty_home': 'beauty_home',
    'spa': 'spa',
    'car_wash': 'car_wash',
    'car_wash_mobile': 'car_wash_mobile',
    'car_wash_fixed': 'car_wash_fixed',
    'home_cleaning': 'cleaning',
    'cleaning': 'cleaning',
    'movers': 'movers',
  };
  if (vendorIndustry && mapping[vendorIndustry]) return mapping[vendorIndustry];
  return 'universal';
}

/** Build the full system prompt for a vendor's industry agent. */
export function buildAgentSystemPrompt(params: {
  industry: AgentIndustry;
  vendorNameAr: string;
  vendorCity?: string | null;
}): string {
  const data = INDUSTRY_MARKET_DATA[params.industry];
  return [
    UNIVERSAL_CONTEXT,
    '',
    `## معلومات التاجر الحالي`,
    `- الاسم: ${params.vendorNameAr}`,
    params.vendorCity ? `- المدينة: ${params.vendorCity}` : '',
    `- القطاع: ${data.label}`,
    '',
    `## معايير السوق السعودي لهذا القطاع`,
    `- نطاق الأسعار المعتاد: ${data.priceRangeSar}`,
    `- هامش الربح المتوقع: ${data.margingPct}`,
    `- أوقات الذروة: ${data.peakPattern}`,
    '',
    `## أخطاء شائعة في هذا القطاع`,
    ...data.commonPitfalls.map((p) => `- ${p}`),
    '',
    `## محاور النمو الأساسية في هذا القطاع`,
    ...data.growthLevers.map((l) => `- ${l}`),
    '',
    `## مهمتك`,
    'استخدم الأدوات لجلب أرقام التاجر، قارنها بمعايير السوق أعلاه، واقترح خطوات محددة قابلة للتنفيذ هذا الأسبوع.',
  ].filter(Boolean).join('\n');
}
