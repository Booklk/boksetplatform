import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Eye, Save, Palette, Layout, Type,
  CheckCircle, Globe, Star, Lock,
  MapPin, Phone, CalendarCheck, Sparkles, Monitor,
  MessageCircle, ExternalLink, Copy, Crown, RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import {
  CustomTheme, CustomThemeRadius, CustomThemeMode,
  PALETTE_PRESETS, getPreset, paletteToTheme,
  TEMPLATE_DEFAULT_PALETTE, DEFAULT_CUSTOM_THEME,
} from '../../lib/customTheme';

// ═══════════════════════════════════════════════════════════════════════════════
// THEME SYSTEM — 12 Industry-Specific Templates (1 Free + 11 Pro)
// Each template targets a real Saudi business segment with the features
// that segment actually needs (queue, GPS, gallery, B2B, privacy, quote).
// ═══════════════════════════════════════════════════════════════════════════════

type StoreIndustry =
  | 'universal' | 'barber' | 'salon' | 'b2b_cleaning' | 'home_services'
  | 'spa' | 'mobile_wash' | 'fixed_wash' | 'clinic' | 'studio'
  | 'movers' | 'general_cleaning';

interface ThemeFeatures {
  queue?: boolean;        // 🎫 رقم طابور لحظي
  gps?: boolean;          // 📍 تتبع GPS مباشر
  gallery?: boolean;      // 📸 معرض أعمال / صور
  b2b?: boolean;          // 🏢 عقود شركات / عروض أسعار جملة
  privacy?: boolean;      // 🔒 سرّية (صالون نسائي / عيادات)
  quote?: boolean;        // 💬 طلب عرض سعر مخصص
}

interface StoreTheme {
  id: string;
  name: string;
  desc: string;
  category: 'free' | 'premium';
  industry: StoreIndustry;
  industryLabel: string;
  features: ThemeFeatures;
  gradient: string; // CSS gradient for preview card
  accent: string;   // Primary accent hex
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

const THEMES: StoreTheme[] = [
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
];

const THEME_CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'free', label: 'مجانية' },
  { id: 'premium', label: 'بريميوم' },
];

// ─── Hero text templates ─────────────────────────────────────────────────────

const HERO_TEXTS = [
  { id: 'classic', title: '{name}', subtitle: 'احجز خدمتك الآن بسهولة' },
  { id: 'trust', title: '{name}', subtitle: 'خدمة موثوقة بتقييم {rating} من أصل 5' },
  { id: 'speed', title: 'غسيل فوري مع {name}', subtitle: 'احجز في ثوانٍ — نوصلك في الوقت' },
  { id: 'quality', title: '{name}', subtitle: 'نظافة لا تقبل المنافسة — جرّب بنفسك' },
  { id: 'promo', title: 'أهلاً في {name}!', subtitle: 'أول غسلة بخصم خاص — لا تفوّت الفرصة' },
];

// ─── Theme Preview Card ──────────────────────────────────────────────────────

function ThemeCard({ theme, selected, locked, onClick }: {
  theme: StoreTheme; selected: boolean; locked: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={locked ? {} : { scale: 1.02 }}
      whileTap={locked ? {} : { scale: 0.98 }}
      className={`relative text-right rounded-2xl border-2 overflow-hidden transition-all ${
        selected ? 'border-blue-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/30'
        : locked ? 'border-white/[0.04] opacity-70'
        : 'border-white/[0.06] hover:border-white/[0.15]'
      }`}
    >
      {/* Preview gradient */}
      <div className={`h-24 bg-gradient-to-br ${theme.gradient} relative overflow-hidden`}>
        {/* Accent glow */}
        {theme.preview.accentGlow && (
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-30"
            style={{ background: theme.accent }} />
        )}
        {/* Mini UI mockup */}
        <div className="absolute bottom-2 inset-x-2 flex gap-1">
          <div className={`flex-1 h-6 rounded ${theme.preview.cardStyle === 'glass' ? 'bg-white/10' : 'bg-white/[0.06]'} border border-white/10`} />
          <div className={`flex-1 h-6 rounded ${theme.preview.cardStyle === 'glass' ? 'bg-white/10' : 'bg-white/[0.06]'} border border-white/10`} />
        </div>
        {/* Mini CTA */}
        <div className="absolute top-2 left-2 h-4 w-12 rounded-full" style={{ background: theme.accent, opacity: 0.8 }} />

        {/* Selected badge */}
        {selected && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
            <CheckCircle className="w-3 h-3 text-white" />
          </motion.div>
        )}

        {/* Lock overlay */}
        {locked && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-black/60 rounded-xl px-3 py-1.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-bold text-amber-400">مشتركين فقط</span>
            </div>
          </div>
        )}

        {/* Premium badge */}
        {theme.category === 'premium' && !locked && (
          <div className="absolute top-2 left-2">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
          </div>
        )}
      </div>

      <div className="p-3 bg-surface-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-xs font-bold ${selected ? 'text-blue-400' : 'text-white'} truncate`}>{theme.name}</p>
          <span className="text-[9px] font-semibold text-slate-400 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5 shrink-0">
            {theme.industryLabel}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-snug line-clamp-2">{theme.desc}</p>
        {Object.keys(theme.features).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {theme.features.queue && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">طابور</span>}
            {theme.features.gps && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">GPS</span>}
            {theme.features.gallery && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">معرض</span>}
            {theme.features.b2b && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">B2B</span>}
            {theme.features.privacy && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">سرّية</span>}
            {theme.features.quote && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">عرض سعر</span>}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── Main Store Builder ──────────────────────────────────────────────────────

export default function StoreBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTheme, setSelectedTheme] = useState('universal-clean');
  const [heroTextId, setHeroTextId] = useState('classic');
  const [customTagline, setCustomTagline] = useState('');
  const [tab, setTab] = useState<'theme' | 'design' | 'content' | 'sections'>('theme');
  const [themeFilter, setThemeFilter] = useState('all');

  // Section toggles
  const [sections, setSections] = useState({
    showRating: true, showAreas: true, showSlots: true,
    showReviews: true, showWhatsApp: true, showCallButton: true,
  });

  // ─── Theme Customizer state ────────────────────────────────────────────────
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_CUSTOM_THEME);
  const [activePresetId, setActivePresetId] = useState<string | null>(PALETTE_PRESETS[0].id);

  const [hydrated, setHydrated] = useState(false);

  function applyPreset(presetId: string) {
    const preset = getPreset(presetId);
    if (!preset) return;
    setCustomTheme((prev) => paletteToTheme(preset, prev.radius));
    setActivePresetId(preset.id);
  }

  function updateColor(key: keyof Omit<CustomTheme, 'radius' | 'mode'>, value: string) {
    setCustomTheme((prev) => ({ ...prev, [key]: value }));
    setActivePresetId(null); // user diverged from any preset
  }

  function updateRadius(radius: CustomThemeRadius) {
    setCustomTheme((prev) => ({ ...prev, radius }));
  }

  function updateMode(mode: CustomThemeMode) {
    setCustomTheme((prev) => ({ ...prev, mode }));
    setActivePresetId(null);
  }

  function resetToTemplateDefault() {
    const presetId = TEMPLATE_DEFAULT_PALETTE[selectedTheme] ?? PALETTE_PRESETS[0].id;
    applyPreset(presetId);
    toast.success('تمت إعادة الألوان إلى الافتراضي للقالب');
  }

  // Load vendor data
  const { data: vendor } = useQuery({
    queryKey: ['vendor-branding'],
    queryFn: () => api.get('/vendors/my').then(r => r.data),
  });

  // Hydrate state from vendor.settings once the vendor loads.
  useEffect(() => {
    if (hydrated || !vendor?.settings) return;
    const s = vendor.settings as Record<string, unknown>;
    if (typeof s.storeTheme === 'string') setSelectedTheme(s.storeTheme);
    if (typeof s.heroTextId === 'string') setHeroTextId(s.heroTextId);
    if (typeof s.customTagline === 'string') setCustomTagline(s.customTagline);
    if (s.storeSections && typeof s.storeSections === 'object') {
      setSections((prev) => ({ ...prev, ...(s.storeSections as typeof prev) }));
    }
    if (s.customTheme && typeof s.customTheme === 'object') {
      setCustomTheme(s.customTheme as CustomTheme);
      setActivePresetId(null);
    }
    setHydrated(true);
  }, [vendor, hydrated]);

  // Seed customizer with the palette that fits the selected template —
  // but only after initial hydration, so user edits aren't clobbered.
  useEffect(() => {
    if (!hydrated) return;
    const presetId = TEMPLATE_DEFAULT_PALETTE[selectedTheme];
    const preset = presetId ? getPreset(presetId) : undefined;
    if (preset) {
      setCustomTheme((prev) => paletteToTheme(preset, prev.radius));
      setActivePresetId(preset.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTheme]);

  const isSubscribed = vendor?.subscriptionStatus === 'active' || vendor?.subscriptionStatus === 'trial';
  const isPaidSubscriber = vendor?.subscriptionStatus === 'active';
  const vendorSlug = vendor?.slug;
  const activeTheme = THEMES.find(t => t.id === selectedTheme) ?? THEMES[0];

  // Filter themes
  const filteredThemes = themeFilter === 'all' ? THEMES
    : THEMES.filter(t => t.category === themeFilter);

  // Handle theme selection
  function handleThemeSelect(theme: StoreTheme) {
    const locked = theme.category === 'premium' && !isPaidSubscriber;
    if (locked) {
      toast.error('هذا القالب متاح لمشتركي برو فقط. فعّل اشتراكك للوصول لكل القوالب الـ 12 المخصصة لقطاعك.');
      return;
    }
    setSelectedTheme(theme.id);
    setSections({
      showRating: theme.preview.showRating,
      showAreas: theme.preview.showAreas,
      showSlots: theme.preview.showSlots,
      showReviews: theme.preview.showReviews,
      showWhatsApp: theme.preview.showWhatsApp,
      showCallButton: theme.preview.showCallButton,
    });
  }

  // Save
  const saveMutation = useMutation({
    mutationFn: () => api.put('/vendors/my', {
      // Keep the top-level primaryColor in sync with the chosen button
      // colour so anything reading vendor.primaryColor stays working.
      primaryColor: customTheme.button,
      settings: {
        ...(vendor?.settings ?? {}),
        storeTheme: selectedTheme,
        heroTextId,
        customTagline,
        storeSections: sections,
        customTheme,
      },
    }),
    onSuccess: () => {
      toast.success('تم حفظ التصميم بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['vendor-branding'] });
    },
    onError: () => toast.error('فشل في الحفظ'),
  });

  const storeUrl = vendorSlug ? `${window.location.origin}/store/${vendorSlug}` : '';

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/vendor/branding" className="btn-icon"><ChevronLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                منشئ صفحة الحجز
              </h1>
              <p className="text-xs text-slate-500">اختر ثيم وصمّم صفحة حجز احترافية لمغسلتك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {vendorSlug && (
              <a href={`/store/${vendorSlug}`} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> معاينة
              </a>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'حفظ...' : 'حفظ'}
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left: Controls ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
              {[
                { id: 'theme' as const, icon: Layout, label: `القوالب (${THEMES.length})` },
                { id: 'design' as const, icon: Palette, label: 'الألوان والتصميم' },
                { id: 'content' as const, icon: Type, label: 'المحتوى' },
                { id: 'sections' as const, icon: Sparkles, label: 'الأقسام' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t.id ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {/* THEMES TAB */}
              {tab === 'theme' && (
                <motion.div key="theme" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  {/* Category filter */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {THEME_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setThemeFilter(cat.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            themeFilter === cat.id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {cat.label}
                          {cat.id === 'premium' && <Crown className="w-3 h-3 inline mr-1 text-amber-400" />}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-slate-500">
                      {isPaidSubscriber ? '13 قالب مخصص لقطاعك' : 'قالب واحد مجاني — 12 قالب احترافي مع برو'}
                    </span>
                  </div>

                  {/* Premium upsell banner */}
                  {!isPaidSubscriber && themeFilter !== 'free' && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center gap-3">
                        <Crown className="w-8 h-8 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">اشتراك برو يفتح 12 قالب مخصص لقطاعك + إخفاء علامة جداول</p>
                          <p className="text-xs text-slate-400 mt-0.5">قوالب حصرية + دومين مخصص + white-label لعلامتك التجارية</p>
                        </div>
                        <Link to="/vendor/platform-sub" className="px-4 py-2 rounded-xl bg-white text-[#0b1220] text-xs font-black hover:bg-slate-100 transition-colors shrink-0">
                          ترقية لبرو
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Theme grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {filteredThemes.map(theme => (
                      <ThemeCard
                        key={theme.id}
                        theme={theme}
                        selected={selectedTheme === theme.id}
                        locked={theme.category === 'premium' && !isPaidSubscriber}
                        onClick={() => handleThemeSelect(theme)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* DESIGN TAB — colors, shape, mode */}
              {tab === 'design' && (
                <motion.div
                  key="design"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="space-y-5"
                >
                  {/* Presets row */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-300">ألوان جاهزة</p>
                      <button
                        onClick={resetToTemplateDefault}
                        className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        title="إرجاع الألوان للافتراضي لهذا القالب"
                      >
                        <RefreshCw className="w-3 h-3" /> الافتراضي للقالب
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {PALETTE_PRESETS.map((preset) => {
                        const active = activePresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset.id)}
                            className={`relative p-2 rounded-lg border-2 transition-all ${
                              active ? 'border-white shadow-lg' : 'border-white/[0.06] hover:border-white/20'
                            }`}
                            style={{ background: preset.palette.surface }}
                          >
                            <div className="flex gap-1 mb-1.5">
                              <span className="w-3 h-3 rounded-full" style={{ background: preset.palette.button }} />
                              <span className="w-3 h-3 rounded-full" style={{ background: preset.palette.accent }} />
                              <span className="w-3 h-3 rounded-full" style={{ background: preset.palette.bg, border: '1px solid rgba(255,255,255,0.1)' }} />
                            </div>
                            <p className="text-[10px] font-bold leading-tight truncate" style={{ color: preset.palette.text }}>
                              {preset.name}
                            </p>
                            {active && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                                <CheckCircle className="w-3 h-3 text-slate-900" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color pickers grid */}
                  <div>
                    <p className="text-xs font-bold text-slate-300 mb-2">تخصيص الألوان</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'bg', label: 'خلفية الموقع' },
                        { key: 'surface', label: 'خلفية البطاقات' },
                        { key: 'button', label: 'لون الأزرار' },
                        { key: 'accent', label: 'لون التفاصيل' },
                        { key: 'text', label: 'لون النص' },
                        { key: 'calendar', label: 'لون الكالندر' },
                      ].map((field) => (
                        <label
                          key={field.key}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors cursor-pointer"
                        >
                          <input
                            type="color"
                            value={customTheme[field.key as keyof CustomTheme] as string}
                            onChange={(e) => updateColor(field.key as keyof Omit<CustomTheme, 'radius' | 'mode'>, e.target.value)}
                            className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{field.label}</p>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              {customTheme[field.key as keyof CustomTheme] as string}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Shape / radius */}
                  <div>
                    <p className="text-xs font-bold text-slate-300 mb-2">شكل الزوايا</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'square', label: 'حادة', radius: '4px' },
                        { id: 'rounded', label: 'متوسطة', radius: '12px' },
                        { id: 'pill', label: 'كبسولة', radius: '9999px' },
                      ] as const).map((opt) => {
                        const active = customTheme.radius === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => updateRadius(opt.id)}
                            className={`p-3 border-2 transition-all ${
                              active ? 'border-white bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/[0.15]'
                            }`}
                            style={{ borderRadius: opt.radius }}
                          >
                            <div
                              className="w-full h-6 mb-1.5"
                              style={{ background: customTheme.button, borderRadius: opt.radius }}
                            />
                            <p className="text-[11px] font-bold text-white">{opt.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode */}
                  <div>
                    <p className="text-xs font-bold text-slate-300 mb-2">وضع الخلفية</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: 'dark', label: 'داكن', desc: 'مناسب للعرض على الجوال' },
                        { id: 'light', label: 'فاتح', desc: 'رسمي وهادئ' },
                      ] as const).map((opt) => {
                        const active = customTheme.mode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={() => updateMode(opt.id)}
                            className={`p-3 rounded-lg border-2 text-right transition-all ${
                              active ? 'border-white bg-white/[0.05]' : 'border-white/[0.06] hover:border-white/[0.15]'
                            }`}
                          >
                            <p className="text-xs font-bold text-white">{opt.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live mini preview */}
                  <div
                    className="p-4 border border-white/[0.08]"
                    style={{
                      background: customTheme.bg,
                      borderRadius: customTheme.radius === 'pill' ? '24px' : customTheme.radius === 'rounded' ? '16px' : '6px',
                    }}
                  >
                    <p className="text-[10px] font-bold mb-2 opacity-60" style={{ color: customTheme.text }}>معاينة مباشرة</p>
                    <div
                      className="p-3 mb-3"
                      style={{
                        background: customTheme.surface,
                        borderRadius: customTheme.radius === 'pill' ? '18px' : customTheme.radius === 'rounded' ? '12px' : '4px',
                      }}
                    >
                      <p className="text-sm font-bold mb-1" style={{ color: customTheme.text }}>
                        اسم الخدمة
                      </p>
                      <p className="text-xs mb-2 opacity-70" style={{ color: customTheme.text }}>وصف مختصر للخدمة</p>
                      <div className="flex gap-2 items-center">
                        <button
                          className="px-4 py-1.5 text-xs font-bold text-white"
                          style={{
                            background: customTheme.button,
                            borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'rounded' ? '8px' : '3px',
                          }}
                        >
                          احجز الآن
                        </button>
                        <span className="text-xs font-semibold" style={{ color: customTheme.accent }}>
                          اعرف المزيد ←
                        </span>
                      </div>
                    </div>
                    {/* Calendar slot preview */}
                    <div className="flex gap-1.5">
                      {['09:00', '10:00', '11:00'].map((t, i) => (
                        <div
                          key={t}
                          className="flex-1 py-1.5 text-center text-[10px] font-bold font-mono"
                          style={{
                            background: i === 1 ? customTheme.calendar : customTheme.surface,
                            color: i === 1 ? '#fff' : customTheme.text,
                            borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'rounded' ? '6px' : '3px',
                          }}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* CONTENT TAB */}
              {tab === 'content' && (
                <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <div>
                    <label className="label">نص الترحيب</label>
                    <div className="space-y-2">
                      {HERO_TEXTS.map(ht => (
                        <button
                          key={ht.id}
                          onClick={() => setHeroTextId(ht.id)}
                          className={`w-full text-right p-3 rounded-xl border transition-all ${
                            heroTextId === ht.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                          }`}
                        >
                          <p className={`text-sm font-bold ${heroTextId === ht.id ? 'text-blue-400' : 'text-white'}`}>
                            {ht.subtitle.replace('{name}', vendor?.nameAr ?? 'مغسلتك').replace('{rating}', '4.9')}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">أو اكتب نصاً مخصصاً</label>
                    <input type="text" value={customTagline} onChange={e => setCustomTagline(e.target.value)}
                      placeholder="مثال: أفضل مغسلة متنقلة في الرياض" className="input-field" maxLength={60} />
                    <p className="text-xs text-slate-500 mt-1">{customTagline.length}/60</p>
                  </div>
                </motion.div>
              )}

              {/* SECTIONS TAB */}
              {tab === 'sections' && (
                <motion.div key="sections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2">
                  <p className="text-sm text-slate-400 mb-3">تحكم بالأقسام التي تظهر في صفحة الحجز:</p>
                  {[
                    { key: 'showRating' as const, icon: Star, label: 'التقييمات', desc: 'عرض تقييم المغسلة' },
                    { key: 'showAreas' as const, icon: MapPin, label: 'مناطق الخدمة', desc: 'الأحياء التي تخدمها' },
                    { key: 'showSlots' as const, icon: CalendarCheck, label: 'المواعيد', desc: 'أقرب المواعيد المتاحة' },
                    { key: 'showReviews' as const, icon: MessageCircle, label: 'آراء العملاء', desc: 'تقييمات وتعليقات' },
                    { key: 'showWhatsApp' as const, icon: Phone, label: 'واتساب', desc: 'زر التواصل' },
                    { key: 'showCallButton' as const, icon: Phone, label: 'اتصال', desc: 'زر الاتصال المباشر' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setSections(s => ({ ...s, [item.key]: !s[item.key] }))}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-right ${
                        sections[item.key] ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${sections[item.key] ? 'text-blue-400' : 'text-slate-600'}`} />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        <p className="text-[11px] text-slate-500">{item.desc}</p>
                      </div>
                      <div className={`w-9 h-5 rounded-full transition-all ${sections[item.key] ? 'bg-blue-500' : 'bg-white/10'}`}>
                        <motion.div animate={{ x: sections[item.key] ? 16 : 2 }} className="w-4 h-4 mt-0.5 rounded-full bg-white shadow" />
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Live Preview ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <p className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                <Monitor className="w-4 h-4" /> معاينة — {activeTheme.name}
              </p>

              {/* Phone frame */}
              <div className="mx-auto w-full max-w-[280px]">
                <div className="rounded-[2.5rem] border-2 border-white/10 bg-surface-2 p-2 shadow-2xl">
                  <div className="relative rounded-[2rem] overflow-hidden bg-surface-1" style={{ aspectRatio: '9/19' }}>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-20" />

                    {/* Mini page */}
                    <div className="h-full overflow-hidden">
                      {/* Hero */}
                      <div className={`h-28 relative bg-gradient-to-br ${activeTheme.gradient}`}>
                        {activeTheme.preview.accentGlow && (
                          <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-xl opacity-40" style={{ background: activeTheme.accent }} />
                        )}
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute bottom-3 right-3 left-3">
                          <div className="w-7 h-7 rounded-lg mb-1" style={{ background: `${activeTheme.accent}40` }} />
                          <div className="h-2 w-3/4 bg-white/40 rounded-full mb-1" />
                          <div className="h-1.5 w-1/2 bg-white/20 rounded-full" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-2.5 space-y-2">
                        {sections.showRating && (
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="w-2 h-2 rounded-sm bg-amber-400/70" />
                            ))}
                          </div>
                        )}
                        {sections.showAreas && (
                          <div className="flex gap-1">
                            {['', '', ''].map((_, i) => (
                              <span key={i} className="h-3 w-10 rounded-full border border-white/10 bg-white/[0.04]" />
                            ))}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {[1, 2].map(i => (
                            <div key={i} className={`p-2 rounded-lg border border-white/[0.06] ${
                              activeTheme.preview.cardStyle === 'glass' ? 'bg-white/[0.04]' : 'bg-surface-3/50'
                            }`}>
                              <div className="h-1.5 w-2/3 bg-white/20 rounded-full mb-1" />
                              <div className="h-1 w-1/3 rounded-full" style={{ background: `${activeTheme.accent}50` }} />
                            </div>
                          ))}
                        </div>
                        <div
                          className={`h-6 flex items-center justify-center ${
                            activeTheme.preview.ctaStyle === 'pill' ? 'rounded-full' : 'rounded-lg'
                          }`}
                          style={{
                            background: activeTheme.accent,
                            boxShadow: activeTheme.preview.accentGlow ? `0 4px 16px ${activeTheme.accent}50` : 'none',
                          }}
                        >
                          <span className="text-[8px] text-white font-bold">احجز الآن</span>
                        </div>
                        {sections.showReviews && (
                          <div className="p-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <div className="h-1 w-full bg-white/10 rounded-full mb-0.5" />
                            <div className="h-1 w-3/4 bg-white/[0.05] rounded-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Store URL */}
              {storeUrl && (
                <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  <p className="text-xs text-slate-500 mb-1.5">رابط صفحة الحجز</p>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-xs text-blue-400 truncate" dir="ltr">{storeUrl}</span>
                    <button onClick={() => { navigator.clipboard.writeText(storeUrl); toast.success('تم النسخ!'); }} className="btn-icon w-7 h-7">
                      <Copy className="w-3 h-3" />
                    </button>
                    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-icon w-7 h-7">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Theme info */}
              <div className="mt-3 text-center">
                <p className="text-[10px] text-slate-600">
                  {activeTheme.category === 'premium' && <Crown className="w-3 h-3 inline text-amber-400 ml-1" />}
                  {activeTheme.name} · {activeTheme.desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
