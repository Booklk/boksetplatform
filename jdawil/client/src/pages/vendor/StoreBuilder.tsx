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
import { STORE_THEMES as THEMES, StoreTheme, getFreeTemplateIds } from '../../lib/storeThemes';
// Theme catalogue (STORE_THEMES + StoreTheme) lives in src/lib/storeThemes.ts


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

  // White-label: Pro feature — hides the "Powered by Jdawil" mark on /store/:slug
  const [whiteLabel, setWhiteLabel] = useState(false);

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
    if (typeof s.whiteLabel === 'boolean') setWhiteLabel(s.whiteLabel);
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

  // Free plan: restrict picker to the 3 templates curated for the
  // vendor's industry. Pro opens the entire catalogue. A vendor in trial
  // is treated like Pro so they can evaluate anything.
  const freeTemplateIds = getFreeTemplateIds(vendor?.industry);
  const canUseAnyTemplate = isPaidSubscriber || vendor?.subscriptionStatus === 'trial';
  const isFreeTemplate = (t: StoreTheme) => freeTemplateIds.includes(t.id);

  // Filter themes
  const filteredThemes = (themeFilter === 'all' ? THEMES
    : themeFilter === 'free' ? THEMES.filter(isFreeTemplate)
    : THEMES.filter(t => t.category === themeFilter && !isFreeTemplate(t)));

  // Handle theme selection
  function handleThemeSelect(theme: StoreTheme) {
    const locked = !canUseAnyTemplate && !isFreeTemplate(theme);
    if (locked) {
      toast.error('هذا القالب متاح لمشتركي برو. الباقة المجانية تعرض 3 قوالب مخصصة لنشاطك.');
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
        // White-label is only honoured when the vendor is actually on Pro;
        // the UI also prevents toggling it for free vendors, but the server
        // is the source of truth for entitlement.
        whiteLabel: isPaidSubscriber ? whiteLabel : false,
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
              <p className="text-xs text-slate-500">اختر ثيم وصمّم صفحة حجز احترافية لمتجرك</p>
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
                      {canUseAnyTemplate ? `${THEMES.length} قالب احترافي مفتوح لك` : '3 قوالب مختارة لنشاطك — الباقي مع برو'}
                    </span>
                  </div>

                  {/* Premium upsell banner */}
                  {!isPaidSubscriber && themeFilter !== 'free' && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center gap-3">
                        <Crown className="w-8 h-8 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">اشتراك برو يفتح كل الـ {THEMES.length} قالب + كل أدوات التشغيل</p>
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
                        locked={!canUseAnyTemplate && !isFreeTemplate(theme)}
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

                  {/* White-label (Pro-only) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-300">العلامة التجارية</p>
                      {!isPaidSubscriber && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5 flex items-center gap-1">
                          <Crown className="w-3 h-3" /> برو فقط
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!isPaidSubscriber) {
                          toast.error('إخفاء علامة جداول متاح لمشتركي برو فقط');
                          return;
                        }
                        setWhiteLabel((v) => !v);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-right transition-all ${
                        !isPaidSubscriber
                          ? 'border-white/[0.04] opacity-60 cursor-not-allowed'
                          : whiteLabel
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-white/[0.06] hover:border-white/[0.15]'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold text-white">إخفاء علامة "جداول"</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {whiteLabel && isPaidSubscriber
                            ? 'علامة جداول مخفيّة — موقعك يظهر باسمك فقط'
                            : 'يظهر "Powered by Jdawil" في أسفل صفحة موقعك'}
                        </p>
                      </div>
                      <div
                        className={`w-10 h-6 rounded-full flex items-center transition-colors ${
                          whiteLabel && isPaidSubscriber ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
                        } p-0.5`}
                      >
                        <div className="w-5 h-5 rounded-full bg-white" />
                      </div>
                    </button>
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
                            {ht.subtitle.replace('{name}', vendor?.nameAr ?? 'متجرك').replace('{rating}', '4.9')}
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

              {/* Phone frame — renders the real CustomTheme tokens so every
                  colour / radius / mode change updates instantly, exactly
                  as the customer will see it on /store/:slug. */}
              <div className="mx-auto w-full max-w-[280px]">
                <div className="rounded-[2.5rem] border-2 border-white/10 bg-surface-2 p-2 shadow-2xl">
                  <div
                    className="relative rounded-[2rem] overflow-hidden"
                    style={{ aspectRatio: '9/19', background: customTheme.bg, color: customTheme.text }}
                  >
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-20" />

                    {/* ── Mini hero — shape varies by heroStyle ── */}
                    {(() => {
                      const hs = activeTheme.preview.heroStyle;
                      const br = customTheme.radius === 'pill' ? '9999px'
                        : customTheme.radius === 'square' ? '4px' : '10px';

                      // Hero background per archetype
                      const heroBg = hs === 'full-cover' || hs === 'wave-bg'
                        ? `linear-gradient(135deg, ${customTheme.accent}55, ${customTheme.button}44, ${customTheme.bg})`
                        : hs === 'gradient-split'
                        ? `linear-gradient(100deg, ${customTheme.surface} 40%, ${customTheme.accent}22)`
                        : hs === 'bold-centered'
                        ? customTheme.surface
                        : customTheme.bg;

                      return (
                        <div className="h-28 relative" style={{ background: heroBg }}>
                          {hs === 'wave-bg' && (
                            <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-10 opacity-40">
                              <path d="M0 20 C 30 5, 60 35, 100 15 L 100 40 L 0 40 Z" fill={customTheme.accent} />
                            </svg>
                          )}
                          {activeTheme.preview.accentGlow && (
                            <div
                              className="absolute top-0 right-0 w-16 h-16 rounded-full blur-xl opacity-50"
                              style={{ background: customTheme.accent }}
                            />
                          )}
                          <div className="absolute bottom-3 right-3 left-3">
                            {/* Logo square */}
                            <div
                              className="w-7 h-7 mb-1"
                              style={{
                                background: customTheme.accent,
                                borderRadius: br,
                                opacity: 0.85,
                              }}
                            />
                            {/* Title */}
                            <div
                              className="h-2 w-3/4 rounded-full mb-1"
                              style={{ background: `${customTheme.text}aa` }}
                            />
                            {/* Subtitle */}
                            <div
                              className="h-1.5 w-1/2 rounded-full"
                              style={{ background: `${customTheme.text}55` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── Content — cards, calendar slots, CTA ── */}
                    <div className="p-2.5 space-y-2">
                      {sections.showRating && (
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-sm" style={{ background: `${customTheme.accent}b0` }} />
                          ))}
                        </div>
                      )}

                      {sections.showAreas && (
                        <div className="flex gap-1">
                          {['', '', ''].map((_, i) => (
                            <span
                              key={i}
                              className="h-3 w-10"
                              style={{
                                background: `${customTheme.text}08`,
                                border: `1px solid ${customTheme.text}12`,
                                borderRadius: customTheme.radius === 'pill' ? '9999px' : '4px',
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Package cards — reflect cardStyle */}
                      <div className="space-y-1.5">
                        {[1, 2].map((i) => {
                          const cs = activeTheme.preview.cardStyle;
                          const cardBr = customTheme.radius === 'pill' ? '14px' : customTheme.radius === 'square' ? '3px' : '8px';
                          const cardStyle: React.CSSProperties = {
                            borderRadius: cardBr,
                            ...(cs === 'glass'
                              ? { background: `${customTheme.surface}cc`, border: `1px solid ${customTheme.text}10`, backdropFilter: 'blur(6px)' }
                              : cs === 'elevated'
                              ? { background: customTheme.surface, boxShadow: `0 4px 10px -4px ${customTheme.accent}30` }
                              : cs === 'solid'
                              ? { background: customTheme.surface }
                              : cs === 'gradient-border'
                              ? { background: `linear-gradient(${customTheme.surface}, ${customTheme.surface}) padding-box, linear-gradient(135deg, ${customTheme.accent}, ${customTheme.button}) border-box`, border: '1px solid transparent' }
                              : { background: customTheme.surface, border: `1px solid ${customTheme.text}12` }),
                          };
                          return (
                            <div key={i} className="p-2" style={cardStyle}>
                              <div className="h-1.5 w-2/3 rounded-full mb-1" style={{ background: `${customTheme.text}aa` }} />
                              <div className="h-1 w-1/3 rounded-full" style={{ background: customTheme.button }} />
                            </div>
                          );
                        })}
                      </div>

                      {/* CTA */}
                      <div
                        className="h-6 flex items-center justify-center"
                        style={{
                          background: customTheme.button,
                          borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '3px' : '8px',
                          boxShadow: activeTheme.preview.accentGlow ? `0 4px 16px ${customTheme.button}66` : 'none',
                        }}
                      >
                        <span className="text-[8px] text-white font-bold">احجز الآن</span>
                      </div>

                      {/* Calendar slots preview — picks up customTheme.calendar */}
                      {sections.showSlots && (
                        <div className="flex gap-1">
                          {['09', '10', '11'].map((t, i) => (
                            <div
                              key={t}
                              className="flex-1 py-1 text-center font-mono"
                              style={{
                                background: i === 1 ? customTheme.calendar : customTheme.surface,
                                color: i === 1 ? '#fff' : customTheme.text,
                                borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '3px' : '6px',
                                fontSize: '7px',
                                border: i === 1 ? 'none' : `1px solid ${customTheme.text}15`,
                              }}
                            >
                              {t}:00
                            </div>
                          ))}
                        </div>
                      )}

                      {sections.showReviews && (
                        <div
                          className="p-1.5"
                          style={{
                            background: `${customTheme.surface}cc`,
                            border: `1px solid ${customTheme.text}08`,
                            borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '3px' : '6px',
                          }}
                        >
                          <div className="h-1 w-full rounded-full mb-0.5" style={{ background: `${customTheme.text}20` }} />
                          <div className="h-1 w-3/4 rounded-full" style={{ background: `${customTheme.text}0d` }} />
                        </div>
                      )}
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
