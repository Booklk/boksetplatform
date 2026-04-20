/**
 * Store Themes catalogue — shared between StoreBuilder (vendor picks one)
 * and VendorLanding (storefront reads theme.features and renders queue /
 * GPS / gallery / quote / privacy sections based on them).
 */

export type StoreIndustry =
  | 'universal' | 'barber' | 'salon' | 'b2b_cleaning' | 'home_services'
  | 'spa' | 'mobile_wash' | 'fixed_wash' | 'clinic' | 'studio'
  | 'movers' | 'general_cleaning';

export interface ThemeFeatures {
  queue?: boolean;        // 🎫 live queue position + "take a number" flow
  gps?: boolean;          // 📍 live employee GPS tracking after booking
  gallery?: boolean;      // 📸 image gallery section
  b2b?: boolean;          // 🏢 corporate contracts / bulk pricing
  privacy?: boolean;      // 🔒 women-only / confidential branding
  quote?: boolean;        // 💬 quote-request form instead of instant booking
}

export interface StoreTheme {
  id: string;
  name: string;
  desc: string;
  category: 'free' | 'premium';
  industry: StoreIndustry;
  industryLabel: string;
  features: ThemeFeatures;
  gradient: string; // CSS gradient for the StoreBuilder preview card only
  accent: string;   // Seed accent used before the vendor customises colours
  preview: {
    heroStyle: string;
    cardStyle: string;
    ctaStyle: string;
    bgPattern: string;
    showRating: boolean;
    showAreas: boolean;
    showSlots: boolean;
    showReviews: boolean;
    showWhatsApp: boolean;
    showCallButton: boolean;
    accentGlow: boolean;
  };
}

export const STORE_THEMES: StoreTheme[] = [
  // ── FREE (1) ─ Universal default for any small business ─
  {
    id: 'universal-clean',
    name: 'العام النظيف',
    desc: 'يناسب أي بزنس صغير يحتاج موقع حجوزات بسيط',
    category: 'free',
    industry: 'universal',
    industryLabel: 'لأي بزنس صغير',
    features: {},
    gradient: 'from-slate-800 to-slate-900', accent: '#475569',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // ── PRO (12) ─ Industry-specific templates ─

  // 1. Barber — حلاق رجالي + queue
  {
    id: 'barber-queue',
    name: 'صالون حلاقة رجالي',
    desc: 'تصميم كلاسيكي للحلاقين — مع نظام طابور رقمي',
    category: 'premium',
    industry: 'barber',
    industryLabel: 'حلاق رجالي',
    features: { queue: true },
    gradient: 'from-amber-950 to-stone-900', accent: '#b45309',
    preview: { heroStyle: 'bold-centered', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'pattern',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 2. Salon — صالون نسائي + queue + privacy
  {
    id: 'salon-queue',
    name: 'صالون نسائي',
    desc: 'أنيق وراقٍ — طابور رقمي وخصوصية تامة',
    category: 'premium',
    industry: 'salon',
    industryLabel: 'صالون نسائي',
    features: { queue: true, privacy: true, gallery: true },
    gradient: 'from-rose-950 to-pink-950', accent: '#be185d',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'clean',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 3. Beauty At Home — مساج / ميك اب منزلي للنساء
  {
    id: 'beauty-at-home',
    name: 'تجميل منزلي للنساء',
    desc: 'ميك اب ومساج وخدمات تجميل بمنزل العميلة',
    category: 'premium',
    industry: 'spa',
    industryLabel: 'ميك اب / مساج منزلي',
    features: { privacy: true, gallery: true },
    gradient: 'from-fuchsia-950 to-rose-950', accent: '#a21caf',
    preview: { heroStyle: 'gradient-split', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'dots',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 4. B2B Cleaning — شركة تنظيف مباني
  {
    id: 'cleaning-pro-b2b',
    name: 'شركة تنظيف مباني',
    desc: 'صفحة شركات احترافية — عقود تنظيف وعروض أسعار جملة',
    category: 'premium',
    industry: 'b2b_cleaning',
    industryLabel: 'تنظيف مباني (B2B)',
    features: { b2b: true, quote: true },
    gradient: 'from-teal-950 to-slate-900', accent: '#0f766e',
    preview: { heroStyle: 'full-cover', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: true, showSlots: false, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 5. Home Services — سباكة/كهرباء/مكيفات
  {
    id: 'home-services',
    name: 'خدمات منزلية',
    desc: 'سباكة، كهرباء، مكيفات — مواعيد منزلية بسرعة',
    category: 'premium',
    industry: 'home_services',
    industryLabel: 'خدمات منزلية',
    features: {},
    gradient: 'from-orange-950 to-red-950', accent: '#c2410c',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 6. Spa — مراكز سبا + gallery + باقات
  {
    id: 'spa-sanctuary',
    name: 'مركز سبا',
    desc: 'هادئ ومريح — معرض صور وباقات استرخاء',
    category: 'premium',
    industry: 'spa',
    industryLabel: 'مراكز سبا',
    features: { gallery: true, privacy: true },
    gradient: 'from-emerald-950 to-teal-950', accent: '#047857',
    preview: { heroStyle: 'full-cover', cardStyle: 'glass', ctaStyle: 'pill', bgPattern: 'pattern',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 7. Mobile Wash — مغاسل سيارات متنقلة + GPS
  {
    id: 'mobile-wash-gps',
    name: 'مغسلة سيارات متنقلة',
    desc: 'تصميم ديناميكي مع تتبع GPS مباشر للموظفين',
    category: 'premium',
    industry: 'mobile_wash',
    industryLabel: 'مغسلة متنقلة',
    features: { gps: true },
    gradient: 'from-cyan-950 to-blue-950', accent: '#0e7490',
    preview: { heroStyle: 'wave-bg', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'wave',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },

  // 8. Fixed Wash — مغسلة سيارات ثابتة + queue
  {
    id: 'fixed-wash-queue',
    name: 'مغسلة سيارات ثابتة',
    desc: 'صفحة موقع ثابت — رقم طابور السيارة الحالي',
    category: 'premium',
    industry: 'fixed_wash',
    industryLabel: 'مغسلة ثابتة',
    features: { queue: true },
    gradient: 'from-blue-950 to-indigo-950', accent: '#1d4ed8',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 9. Clinic — عيادات (طبية / تجميلية)
  {
    id: 'clinic-pro',
    name: 'عيادة طبية',
    desc: 'صفحة عيادة احترافية — سرّية وثقة طبية',
    category: 'premium',
    industry: 'clinic',
    industryLabel: 'عيادات',
    features: { privacy: true },
    gradient: 'from-sky-950 to-slate-900', accent: '#0369a1',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: false, showCallButton: true, accentGlow: false },
  },

  // 10. Studio — استوديوهات تصوير + portfolio
  {
    id: 'studio-portfolio',
    name: 'استوديو تصوير',
    desc: 'معرض أعمال كبير — صور قبل/بعد لكل جلسة',
    category: 'premium',
    industry: 'studio',
    industryLabel: 'استوديوهات تصوير',
    features: { gallery: true, quote: true },
    gradient: 'from-neutral-900 to-zinc-950', accent: '#27272a',
    preview: { heroStyle: 'gradient-split', cardStyle: 'elevated', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 11. Movers — نقل عفش + طلب عرض سعر
  {
    id: 'movers-quote',
    name: 'نقل عفش',
    desc: 'طلب عرض سعر فوري + جدولة موعد النقل',
    category: 'premium',
    industry: 'movers',
    industryLabel: 'نقل العفش',
    features: { quote: true, gps: true },
    gradient: 'from-amber-950 to-orange-950', accent: '#b45309',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'pattern',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 12. General Cleaning — نظافة عامة (afterclean / event)
  {
    id: 'cleaning-general',
    name: 'نظافة عامة',
    desc: 'نظافة منازل وفلل ومناسبات — مواعيد ونطاقات تغطية',
    category: 'premium',
    industry: 'general_cleaning',
    industryLabel: 'نظافة عامة',
    features: { quote: true },
    gradient: 'from-sky-950 to-cyan-950', accent: '#0284c7',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // ── TIER 2 (13 additional templates) ─ More choice within each focus family ─

  // 13. Cleaning — Carpet & upholstery
  {
    id: 'cleaning-carpet',
    name: 'تنظيف سجاد وموكيت',
    desc: 'شركات تنظيف السجاد والكنب والستائر بالبخار',
    category: 'premium',
    industry: 'general_cleaning',
    industryLabel: 'تنظيف سجاد',
    features: { quote: true },
    gradient: 'from-cyan-950 to-teal-950', accent: '#0891b2',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 14. Cleaning — Water tanks
  {
    id: 'cleaning-tanks',
    name: 'تنظيف وتعقيم خزانات',
    desc: 'تنظيف وتعقيم خزانات المياه للمنازل والمنشآت',
    category: 'premium',
    industry: 'general_cleaning',
    industryLabel: 'تنظيف خزانات',
    features: { quote: true, b2b: true },
    gradient: 'from-sky-950 to-blue-950', accent: '#0369a1',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 15. Cleaning — Building facades / high-rise
  {
    id: 'cleaning-facade',
    name: 'تنظيف واجهات المباني',
    desc: 'تنظيف واجهات زجاجية وارتفاعات — معدات متخصصة',
    category: 'premium',
    industry: 'b2b_cleaning',
    industryLabel: 'واجهات وارتفاعات',
    features: { quote: true, b2b: true, gallery: true },
    gradient: 'from-slate-900 to-zinc-900', accent: '#475569',
    preview: { heroStyle: 'full-cover', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: true, showSlots: false, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 16. Cleaning — Post-event cleanup
  {
    id: 'cleaning-postevent',
    name: 'تنظيف ما بعد المناسبات',
    desc: 'تنظيف قاعات وفلل بعد الأعراس والحفلات',
    category: 'premium',
    industry: 'general_cleaning',
    industryLabel: 'تنظيف مناسبات',
    features: { quote: true },
    gradient: 'from-indigo-950 to-purple-950', accent: '#7c3aed',
    preview: { heroStyle: 'gradient-split', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'dots',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 17. Salon — Luxury women
  {
    id: 'salon-luxury',
    name: 'صالون نسائي فاخر',
    desc: 'تصميم راقٍ بلمسات ذهبية — طابور + معرض + خصوصية',
    category: 'premium',
    industry: 'salon',
    industryLabel: 'صالون فاخر',
    features: { queue: true, privacy: true, gallery: true },
    gradient: 'from-amber-950 to-rose-950', accent: '#b45309',
    preview: { heroStyle: 'full-cover', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'pattern',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 18. Salon — Nails studio
  {
    id: 'nails-studio',
    name: 'مركز عناية بالأظافر',
    desc: 'مانيكير وباديكير وتركيب أظافر — معرض تصاميم',
    category: 'premium',
    industry: 'salon',
    industryLabel: 'مركز أظافر',
    features: { gallery: true, privacy: true },
    gradient: 'from-pink-950 to-rose-950', accent: '#db2777',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'dots',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 19. Salon — Brow & lash center
  {
    id: 'brow-lash',
    name: 'مركز حواجب ورموش',
    desc: 'ميكروبليدنج، رموش، وحواجب — صور قبل/بعد',
    category: 'premium',
    industry: 'salon',
    industryLabel: 'حواجب ورموش',
    features: { gallery: true, privacy: true },
    gradient: 'from-rose-950 to-fuchsia-950', accent: '#c026d3',
    preview: { heroStyle: 'gradient-split', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'dots',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 20. Salon — Kids salon
  {
    id: 'kids-salon',
    name: 'صالون أطفال',
    desc: 'قصات شعر وعناية للأطفال — أجواء ممتعة للعائلات',
    category: 'premium',
    industry: 'salon',
    industryLabel: 'صالون أطفال',
    features: { queue: true, gallery: true },
    gradient: 'from-orange-950 to-amber-950', accent: '#ea580c',
    preview: { heroStyle: 'bold-centered', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'pattern',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 21. Beauty — Henna & bridal
  {
    id: 'henna-studio',
    name: 'استوديو حناء ومناسبات',
    desc: 'حناء وتزيين للعرائس والمناسبات — معرض أعمال',
    category: 'premium',
    industry: 'spa',
    industryLabel: 'حناء ومناسبات',
    features: { gallery: true, quote: true, privacy: true },
    gradient: 'from-amber-950 to-orange-950', accent: '#a16207',
    preview: { heroStyle: 'full-cover', cardStyle: 'elevated', ctaStyle: 'pill', bgPattern: 'pattern',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // 22. Car Wash — Fleet (multi-vehicle mobile)
  {
    id: 'mobile-wash-fleet',
    name: 'مغسلة متنقلة بأسطول',
    desc: 'عدة سيارات غسيل متنقلة — توزيع ذكي وتتبّع GPS لكل سيارة',
    category: 'premium',
    industry: 'mobile_wash',
    industryLabel: 'أسطول مغاسل',
    features: { gps: true, b2b: true },
    gradient: 'from-blue-950 to-slate-900', accent: '#1e40af',
    preview: { heroStyle: 'wave-bg', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'wave',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },

  // 23. Car Wash — Premium detail (polish, ceramic, interior)
  {
    id: 'premium-wash-detail',
    name: 'مغسلة VIP وتلميع',
    desc: 'بولش، سيراميك، وتلميع فاخر — معرض قبل/بعد',
    category: 'premium',
    industry: 'fixed_wash',
    industryLabel: 'مغسلة VIP',
    features: { gallery: true, quote: true },
    gradient: 'from-neutral-950 to-zinc-900', accent: '#a16207',
    preview: { heroStyle: 'full-cover', cardStyle: 'elevated', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 24. Movers — Intercity with packing
  {
    id: 'movers-intercity',
    name: 'نقل عفش بين المدن',
    desc: 'تعبئة، تغليف، وشحن بين المدن — طلب عرض سعر + تتبّع',
    category: 'premium',
    industry: 'movers',
    industryLabel: 'نقل بين المدن',
    features: { quote: true, gps: true, b2b: true },
    gradient: 'from-stone-900 to-amber-950', accent: '#92400e',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'pattern',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },

  // 25. Integrated — All features on (for multi-service companies)
  {
    id: 'integrated-pro',
    name: 'المتكامل',
    desc: 'كل المميزات مفتوحة — للشركات الكبيرة متعددة الخدمات',
    category: 'premium',
    industry: 'universal',
    industryLabel: 'متعدد الخدمات',
    features: { queue: true, gps: true, gallery: true, b2b: true, privacy: true, quote: true },
    gradient: 'from-slate-900 to-indigo-950', accent: '#6366f1',
    preview: { heroStyle: 'full-cover', cardStyle: 'elevated', ctaStyle: 'rounded', bgPattern: 'mesh',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
];

/** Look up a theme by id; falls back to universal-clean. */
export function getTheme(id: string | undefined | null): StoreTheme {
  return STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];
}

/** Features for the theme id — safe to call with anything. */
export function getThemeFeatures(id: string | undefined | null): ThemeFeatures {
  return getTheme(id).features;
}
