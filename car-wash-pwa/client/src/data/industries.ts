/**
 * Industry-specific Landing content — powers /for/:industry pages so a
 * vendor arriving from Google for a specific activity sees a page that
 * talks to them directly (pain points, solutions, recommended template).
 */

import { LucideIcon } from 'lucide-react';

export interface IndustrySolution {
  icon: string; // lucide icon name — resolved in the component
  title: string;
  body: string;
}

export interface IndustryTestimonial {
  quote: string;
  author: string;
  role: string;
}

export interface IndustryLandingContent {
  slug: string;                       // URL segment
  arName: string;                     // "مغاسل السيارات"
  enName: string;                     // "Car Wash"
  heroBadge: string;                  // small tagline above the H1
  heroTitle: string;                  // main H1
  heroSubtitle: string;               // 1–2 line subtitle
  primaryKeyword: string;             // SEO focus keyword (Arabic)
  secondaryKeywords: string[];        // related keywords for meta
  painPoints: string[];               // list of "tired of X?" bullets
  solutions: IndustrySolution[];      // 3–6 solutions
  templateHighlights: string[];       // headline features of the template
  testimonial?: IndustryTestimonial;  // optional (fill as real ones come in)
  recommendedTemplateId: string;      // template slug from storeThemes
  ctaText: string;                    // register CTA label
}

export const INDUSTRY_LANDINGS: IndustryLandingContent[] = [
  // ─── CAR WASH ──────────────────────────────────────────────────────────────
  {
    slug: 'car-wash',
    arName: 'مغاسل السيارات',
    enName: 'Car Wash',
    heroBadge: 'لأصحاب مغاسل السيارات',
    heroTitle: 'نظام إدارة مغسلة السيارات — ثابتة أو متنقلة، بدون تعب',
    heroSubtitle:
      'صفحة حجوزات خاصة بمغسلتك، طابور السيارات لحظي، تتبّع GPS للموظفين، واتساب تلقائي للعميل. كل شي في مكان واحد.',
    primaryKeyword: 'نظام إدارة مغاسل السيارات',
    secondaryKeywords: [
      'نظام مغسلة متنقلة',
      'نظام مغسلة ثابتة',
      'برنامج إدارة مغسلة',
      'تتبع GPS مغسلة سيارات',
    ],
    painPoints: [
      'ردّة فعل جوالك تسوي توتر — اتصالات وواتساب ما تتوقّف',
      'تضارب مواعيد وسيارات تجي والموظفين مشغولين',
      'ما تعرف وين موظفك الحين ولا وصل للعميل ولا لا',
      'صعوبة تحسب دخل اليوم أو الشهر — كل شي ورقة ودفتر',
      'العميل يطلب تتبّع مباشر ومعك تبرير إنك "في الطريق"',
    ],
    solutions: [
      {
        icon: 'Calendar',
        title: 'حجوزات تلقائية 24/7',
        body: 'عميلك يحجز موعده بنفسه من صفحة موقعك — حتى وأنت نايم. تأكيد واتساب فوري.',
      },
      {
        icon: 'Ticket',
        title: 'طابور سيارات رقمي (للثابتة)',
        body: 'العميل يشوف رقمه ووقت الانتظار المتوقّع قبل ما يطلع من بيته. وداعاً للازدحام.',
      },
      {
        icon: 'MapPin',
        title: 'تتبّع GPS مباشر (للمتنقلة)',
        body: 'العميل يشوف موظفك قادم على الخريطة. أنت تشوف كل موظفيك في الخريطة الحية.',
      },
      {
        icon: 'DollarSign',
        title: 'تقارير مالية لحظية',
        body: 'تعرف دخل اليوم، الأسبوع، الشهر في ثانية. فواتير PDF جاهزة + ضريبة 15٪ تلقائية.',
      },
      {
        icon: 'Users',
        title: 'إدارة الموظفين والرواتب',
        body: 'توزّع الحجوزات، تحسب الساعات، ورواتب تلقائية. مع تقييم كل موظف من العملاء.',
      },
      {
        icon: 'MessageCircle',
        title: 'تسويق تلقائي عبر واتساب',
        body: 'رسائل تذكير، عروض، بطاقات ولاء — كلها تنطلق بدون ما تلمس الجوال.',
      },
    ],
    templateHighlights: [
      'قالب "مغسلة متنقلة" — تصميم ديناميكي مع GPS',
      'قالب "مغسلة ثابتة" — مع نظام طابور واضح',
      'الألوان والشعار يختاروا حسب هويتك',
      'موقعك ينزل في 10 دقائق',
    ],
    recommendedTemplateId: 'mobile-wash-gps',
    ctaText: 'أنشئ موقع مغسلتك مجاناً',
  },

  // ─── SALON & BEAUTY ─────────────────────────────────────────────────────────
  {
    slug: 'salon',
    arName: 'الصالونات ومراكز التجميل',
    enName: 'Salons & Beauty',
    heroBadge: 'لأصحاب الصالونات ومراكز التجميل',
    heroTitle: 'نظام حجوزات صالون يخلّص فوضى المواعيد — للصالونات والتجميل المنزلي',
    heroSubtitle:
      'موقع حجز أنيق باسمك، طابور زبونات لحظي، معرض صور أعمالك، خصوصية تامة للصالونات النسائية.',
    primaryKeyword: 'نظام حجوزات صالونات',
    secondaryKeywords: [
      'نظام إدارة صالون نسائي',
      'نظام إدارة صالون حلاقة',
      'برنامج ميك اب منزلي',
      'نظام حجوزات سبا',
    ],
    painPoints: [
      'تعبتي من ردود الواتساب والاتصالات طول اليوم',
      'زبونات يجين بدون موعد ويصير ازدحام ومشاكل',
      'ما تعرفين كم زبونة اليوم ولا كم دخلت بالشهر',
      'خصوصية الصالون النسائي مهمة — وما تبغين كل أحد يشوف بياناتك',
      'موظفاتك كل وحدة عندها جدول مختلف، صعب ترتيبه',
    ],
    solutions: [
      {
        icon: 'Calendar',
        title: 'حجوزات أونلاين 24/7',
        body: 'زبونتك تحجز موعدها بنفسها، تختار الخدمة والموظفة، وتستلم تأكيد واتساب فوري.',
      },
      {
        icon: 'Ticket',
        title: 'طابور رقمي للزبونات',
        body: 'الزبونة تشوف دورها ووقت الانتظار. انتي تركّزين في خدمتها بدل ما تشرحي.',
      },
      {
        icon: 'Image',
        title: 'معرض أعمالك',
        body: 'صور قصّات، صبغات، مكياج — تجذب الزبونات الجديدات تلقائياً.',
      },
      {
        icon: 'Lock',
        title: 'خصوصية تامة',
        body: 'بيانات الزبونات محفوظة. شعار "خدمة للسيدات فقط" واضح في موقعك.',
      },
      {
        icon: 'Users',
        title: 'إدارة الموظفات',
        body: 'جدول كل موظفة، عمولاتها، وتقييم الزبونات لها. تعرفين الأفضل أداءً.',
      },
      {
        icon: 'Gift',
        title: 'برنامج ولاء للزبونات',
        body: 'نقاط، خصومات، بطاقات هدايا. الزبونة الدائمة ترجعلك أكثر.',
      },
    ],
    templateHighlights: [
      'قالب "صالون نسائي" — أنيق بوردي وخصوصية',
      'قالب "حلاق رجالي" — كلاسيكي بنحاسي دافئ',
      'قالب "تجميل منزلي" — للي يخدمون بالبيت',
      'قالب "سبا" — هادئ مع معرض صور',
    ],
    recommendedTemplateId: 'salon-queue',
    ctaText: 'أنشئ موقع صالونك مجاناً',
  },

  // ─── CLEANING COMPANIES ────────────────────────────────────────────────────
  {
    slug: 'cleaning',
    arName: 'شركات التنظيف',
    enName: 'Cleaning Companies',
    heroBadge: 'لشركات تنظيف المباني والمنازل',
    heroTitle: 'نظام إدارة شركة تنظيف — عقود، عروض أسعار، وتقارير احترافية',
    heroSubtitle:
      'استقبل طلبات عروض أسعار تلقائياً، نظّم عقود B2B، تابع فرقك، وأصدر فواتير ضريبية في ثوانٍ.',
    primaryKeyword: 'نظام إدارة شركة تنظيف',
    secondaryKeywords: [
      'نظام تنظيف مباني',
      'برنامج شركة تنظيف',
      'عقود تنظيف B2B',
      'نظام إدارة نظافة عامة',
    ],
    painPoints: [
      'عروض الأسعار تتم على واتساب وتنسى أو تضيع',
      'صعوبة متابعة فرق العمل في مواقع متفرقة',
      'عقود الشركات تحتاج تنظيم وتذكير بالتجديد',
      'محاسبة يدوية + فواتير ورقية تعطّل الشغل',
      'ما فيه تقرير منظّم تعرض للعميل B2B',
    ],
    solutions: [
      {
        icon: 'FileText',
        title: 'فورم عرض سعر تلقائي',
        body: 'العميل يطلب عرض سعر من موقعك، يصلك فوراً على الواتساب مع كل التفاصيل.',
      },
      {
        icon: 'Building2',
        title: 'إدارة عقود الشركات',
        body: 'تسجيل العملاء B2B، عقود شهرية/سنوية، تذكير بالتجديد قبل شهر.',
      },
      {
        icon: 'MapPin',
        title: 'تتبّع فرق العمل',
        body: 'تشوف كل فريق وين وكم يشتغل. تقرير ساعات فعلية، بدون "على الطريق".',
      },
      {
        icon: 'Receipt',
        title: 'فواتير ضريبية PDF',
        body: 'فاتورة ضريبة 15٪ تلقائية، جاهزة للإرسال للعميل. تصدير Excel للمحاسب.',
      },
      {
        icon: 'Users',
        title: 'جدولة الفرق والرواتب',
        body: 'وزّع الفرق على المواقع، احسب ساعاتهم، ورواتب تلقائية آخر الشهر.',
      },
      {
        icon: 'MessageCircle',
        title: 'تواصل احترافي',
        body: 'تذكير تلقائي بالموعد، تأكيد إنجاز، وطلب تقييم — كله عبر واتساب.',
      },
    ],
    templateHighlights: [
      'قالب "شركة تنظيف مباني" — رسمي مع B2B',
      'قالب "نظافة عامة" — مرن للمنازل والمناسبات',
      'فورم طلب عرض سعر بارز في الصفحة',
      'شارة "عقود شركات متاحة" على موقعك',
    ],
    recommendedTemplateId: 'cleaning-pro-b2b',
    ctaText: 'أنشئ موقع شركتك مجاناً',
  },

  // ─── MOVERS / FURNITURE TRANSPORT ──────────────────────────────────────────
  {
    slug: 'movers',
    arName: 'شركات نقل العفش',
    enName: 'Movers',
    heroBadge: 'لشركات نقل وتغليف العفش',
    heroTitle: 'نظام إدارة شركة نقل عفش — طلبات أسعار، جدولة، وتتبّع مباشر',
    heroSubtitle:
      'استقبل طلبات النقل تلقائياً، أعطِ عروض أسعار في دقائق، ووجّه فرقك عبر GPS — كل ذلك من موقع واحد باسمك.',
    primaryKeyword: 'نظام إدارة نقل عفش',
    secondaryKeywords: [
      'برنامج شركة نقل',
      'نظام طلبات نقل عفش',
      'تتبع سيارات نقل',
      'موقع حجز نقل عفش',
    ],
    painPoints: [
      'العميل يبي عرض سعر فوري وأنت في رحلة نقل ثانية',
      'صعوبة تعرف وين كل سيارة وكم شغل لها اليوم',
      'عروض الأسعار تتبدّل وتنسى أيها الصح',
      'العميل يبي يعرف متى توصل بالضبط',
      'جدولة الأسبوع تحتاج Excel وتعب',
    ],
    solutions: [
      {
        icon: 'FileText',
        title: 'فورم طلب عرض سعر',
        body: 'العميل يعبّي: من وين → إلى وين، كم غرفة، متى — يصلك الطلب فوراً.',
      },
      {
        icon: 'MapPin',
        title: 'تتبّع GPS للسيارات',
        body: 'تشوف كل سياراتك في خريطة واحدة. العميل يتابع موظفك مباشرة.',
      },
      {
        icon: 'Calendar',
        title: 'جدولة أسبوعية ذكية',
        body: 'رتّب طلبات النقل في جدول مرئي، تنبيهات التضارب، وتذكير تلقائي قبل الموعد.',
      },
      {
        icon: 'Truck',
        title: 'إدارة الأسطول',
        body: 'كل سيارة ومواصفاتها، الصيانة، والوقود. تعرف تكلفة كل رحلة.',
      },
      {
        icon: 'Receipt',
        title: 'فواتير ضريبية فورية',
        body: 'عند الإنجاز، فاتورة ضريبة 15٪ جاهزة للعميل. بدون ورق، بدون تأخير.',
      },
      {
        icon: 'MessageCircle',
        title: 'تأكيدات واتساب',
        body: 'الموعد، "في الطريق"، "وصلنا"، "تم التسليم" — رسائل تلقائية تبني ثقة العميل.',
      },
    ],
    templateHighlights: [
      'قالب "نقل عفش" — عملي مع طلب عرض سعر',
      'تتبّع GPS لكل سياراتك',
      'حاسبة تكلفة رحلة أولية للعميل',
      'شارة "شحن مؤمّن" على موقعك',
    ],
    recommendedTemplateId: 'movers-quote',
    ctaText: 'أنشئ موقع شركتك مجاناً',
  },
];

export function getIndustry(slug: string | undefined): IndustryLandingContent | undefined {
  if (!slug) return undefined;
  return INDUSTRY_LANDINGS.find((i) => i.slug === slug);
}

/** Industry slugs only — for routing / sitemap iteration. */
export const INDUSTRY_SLUGS = INDUSTRY_LANDINGS.map((i) => i.slug);
