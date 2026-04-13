import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Eye, Save, Palette, Layout, Type,
  Image, CheckCircle, Globe, Smartphone, Star,
  MapPin, Phone, CalendarCheck, Sparkles, Monitor,
  MessageCircle, ExternalLink, Copy,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Theme Templates ─────────────────────────────────────────────────────────

interface StoreTheme {
  id: string;
  name: string;
  desc: string;
  preview: {
    heroStyle: 'full-cover' | 'gradient-split' | 'minimal-clean' | 'bold-centered' | 'wave-bg';
    cardStyle: 'glass' | 'solid' | 'bordered' | 'gradient-border' | 'elevated';
    ctaStyle: 'rounded' | 'pill' | 'square' | 'glow';
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
  {
    id: 'premium-dark',
    name: 'بريميوم داكن',
    desc: 'تصميم فاخر مع خلفية داكنة وتأثيرات ضوئية',
    preview: {
      heroStyle: 'full-cover',
      cardStyle: 'glass',
      ctaStyle: 'glow',
      showRating: true,
      showAreas: true,
      showSlots: true,
      showReviews: true,
      showWhatsApp: true,
      showCallButton: true,
      accentGlow: true,
    },
  },
  {
    id: 'clean-modern',
    name: 'عصري نظيف',
    desc: 'تصميم بسيط وأنيق بخطوط واضحة',
    preview: {
      heroStyle: 'minimal-clean',
      cardStyle: 'bordered',
      ctaStyle: 'rounded',
      showRating: true,
      showAreas: true,
      showSlots: true,
      showReviews: true,
      showWhatsApp: true,
      showCallButton: false,
      accentGlow: false,
    },
  },
  {
    id: 'bold-gradient',
    name: 'تدرج جريء',
    desc: 'تدرجات لونية جريئة مع تأثيرات بارزة',
    preview: {
      heroStyle: 'gradient-split',
      cardStyle: 'gradient-border',
      ctaStyle: 'pill',
      showRating: true,
      showAreas: false,
      showSlots: true,
      showReviews: true,
      showWhatsApp: true,
      showCallButton: true,
      accentGlow: true,
    },
  },
  {
    id: 'trust-focused',
    name: 'يركز على الثقة',
    desc: 'يُبرز التقييمات والآراء لبناء الثقة',
    preview: {
      heroStyle: 'bold-centered',
      cardStyle: 'elevated',
      ctaStyle: 'rounded',
      showRating: true,
      showAreas: true,
      showSlots: true,
      showReviews: true,
      showWhatsApp: true,
      showCallButton: true,
      accentGlow: false,
    },
  },
  {
    id: 'minimal-speed',
    name: 'سريع ومختصر',
    desc: 'أقل عناصر — يوصل العميل للحجز بأسرع وقت',
    preview: {
      heroStyle: 'minimal-clean',
      cardStyle: 'solid',
      ctaStyle: 'pill',
      showRating: true,
      showAreas: false,
      showSlots: true,
      showReviews: false,
      showWhatsApp: false,
      showCallButton: false,
      accentGlow: false,
    },
  },
  {
    id: 'wave-water',
    name: 'موجة مائية',
    desc: 'تصميم مستوحى من الماء مع تموجات',
    preview: {
      heroStyle: 'wave-bg',
      cardStyle: 'glass',
      ctaStyle: 'glow',
      showRating: true,
      showAreas: true,
      showSlots: true,
      showReviews: true,
      showWhatsApp: true,
      showCallButton: true,
      accentGlow: true,
    },
  },
];

// ─── Color Palettes ──────────────────────────────────────────────────────────

const COLOR_PALETTES = [
  { id: 'ocean', label: 'محيطي', color: '#0369A1', bg: 'from-sky-700 to-cyan-500' },
  { id: 'royal', label: 'ملكي', color: '#1E3A8A', bg: 'from-blue-800 to-blue-500' },
  { id: 'emerald', label: 'زمردي', color: '#065F46', bg: 'from-emerald-800 to-emerald-500' },
  { id: 'purple', label: 'بنفسجي', color: '#5B21B6', bg: 'from-violet-800 to-purple-500' },
  { id: 'crimson', label: 'قرمزي', color: '#991B1B', bg: 'from-red-800 to-rose-500' },
  { id: 'gold', label: 'ذهبي', color: '#78350F', bg: 'from-amber-800 to-amber-500' },
  { id: 'carbon', label: 'كربوني', color: '#18181B', bg: 'from-zinc-800 to-zinc-500' },
  { id: 'teal', label: 'فيروزي', color: '#115E59', bg: 'from-teal-800 to-teal-500' },
];

// ─── Hero text templates ─────────────────────────────────────────────────────

const HERO_TEXTS = [
  { id: 'classic', title: '{name}', subtitle: 'احجز خدمتك الآن بسهولة' },
  { id: 'trust', title: '{name}', subtitle: 'خدمة موثوقة بتقييم {rating} من أصل 5' },
  { id: 'speed', title: 'غسيل فوري مع {name}', subtitle: 'احجز في ثوانٍ — نوصلك في الوقت' },
  { id: 'quality', title: '{name}', subtitle: 'نظافة لا تقبل المنافسة — جرّب بنفسك' },
  { id: 'promo', title: 'أهلاً في {name}!', subtitle: 'أول غسلة بخصم خاص — لا تفوّت الفرصة' },
];

// ─── Mini Preview Component ──────────────────────────────────────────────────

function ThemePreview({ theme, color, selected, onClick }: {
  theme: StoreTheme;
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`text-right rounded-2xl border-2 overflow-hidden transition-all ${
        selected
          ? 'border-blue-500 shadow-lg shadow-blue-500/20'
          : 'border-white/[0.06] hover:border-white/[0.15]'
      }`}
    >
      {/* Mini mockup */}
      <div className="h-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}40, #0f172a)` }}>
        {/* Mini hero */}
        <div className="absolute inset-x-0 top-0 h-14" style={{ background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
          <div className="absolute bottom-2 right-3">
            <div className="w-6 h-6 rounded-lg bg-white/20" />
          </div>
        </div>
        {/* Mini cards */}
        <div className="absolute bottom-2 inset-x-2 flex gap-1.5">
          <div className={`flex-1 h-10 rounded-lg ${theme.preview.cardStyle === 'glass' ? 'bg-white/10' : 'bg-white/[0.06]'} border border-white/10`} />
          <div className={`flex-1 h-10 rounded-lg ${theme.preview.cardStyle === 'glass' ? 'bg-white/10' : 'bg-white/[0.06]'} border border-white/10`} />
        </div>
        {/* Badge */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center"
          >
            <CheckCircle className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </div>
      <div className="p-3 bg-surface-2">
        <p className={`text-sm font-bold ${selected ? 'text-blue-400' : 'text-white'}`}>{theme.name}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{theme.desc}</p>
      </div>
    </motion.button>
  );
}

// ─── Main Store Builder ──────────────────────────────────────────────────────

export default function StoreBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTheme, setSelectedTheme] = useState('premium-dark');
  const [selectedColor, setSelectedColor] = useState('ocean');
  const [heroTextId, setHeroTextId] = useState('classic');
  const [customTagline, setCustomTagline] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState<'theme' | 'color' | 'content' | 'sections'>('theme');

  // Load vendor data
  const { data: vendor } = useQuery({
    queryKey: ['vendor-branding'],
    queryFn: () => api.get('/vendors/my').then(r => r.data),
  });

  const vendorSlug = vendor?.slug;
  const vendorColor = COLOR_PALETTES.find(p => p.id === selectedColor)?.color ?? '#0369A1';
  const activeTheme = THEMES.find(t => t.id === selectedTheme) ?? THEMES[0];
  const heroText = HERO_TEXTS.find(t => t.id === heroTextId) ?? HERO_TEXTS[0];

  // Section toggles (from theme defaults)
  const [sections, setSections] = useState({
    showRating: true,
    showAreas: true,
    showSlots: true,
    showReviews: true,
    showWhatsApp: true,
    showCallButton: true,
  });

  // Update sections when theme changes
  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) {
      setSections({
        showRating: theme.preview.showRating,
        showAreas: theme.preview.showAreas,
        showSlots: theme.preview.showSlots,
        showReviews: theme.preview.showReviews,
        showWhatsApp: theme.preview.showWhatsApp,
        showCallButton: theme.preview.showCallButton,
      });
    }
  };

  // Save store settings
  const saveMutation = useMutation({
    mutationFn: () => api.put('/vendors/my', {
      primaryColor: vendorColor,
      settings: {
        ...(vendor?.settings ?? {}),
        storeTheme: selectedTheme,
        storeColor: selectedColor,
        heroTextId,
        customTagline,
        storeSections: sections,
      },
    }),
    onSuccess: () => {
      toast.success('تم حفظ إعدادات المتجر بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['vendor-branding'] });
    },
    onError: () => toast.error('فشل في الحفظ'),
  });

  const storeUrl = vendorSlug ? `${window.location.origin}/store/${vendorSlug}` : '';

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/vendor/branding" className="btn-icon"><ChevronLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                منشئ صفحة الحجز
              </h1>
              <p className="text-xs text-slate-500">صمّم صفحة الحجز الخاصة بمغسلتك</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {vendorSlug && (
              <a
                href={`/store/${vendorSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                معاينة
              </a>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </motion.button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Left: Controls ── */}
          <div className="lg:col-span-3 space-y-5">
            {/* Tab bar */}
            <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
              {[
                { id: 'theme' as const, icon: Layout, label: 'القالب' },
                { id: 'color' as const, icon: Palette, label: 'الألوان' },
                { id: 'content' as const, icon: Type, label: 'المحتوى' },
                { id: 'sections' as const, icon: Sparkles, label: 'الأقسام' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'theme' && (
                <motion.div key="theme" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <p className="text-sm text-slate-400 mb-3">اختر القالب الذي يناسب مغسلتك:</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {THEMES.map(theme => (
                      <ThemePreview
                        key={theme.id}
                        theme={theme}
                        color={vendorColor}
                        selected={selectedTheme === theme.id}
                        onClick={() => handleThemeChange(theme.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'color' && (
                <motion.div key="color" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <p className="text-sm text-slate-400 mb-3">اختر لون هوية مغسلتك:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {COLOR_PALETTES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedColor(p.id)}
                        className={`rounded-xl border-2 overflow-hidden transition-all ${
                          selectedColor === p.id
                            ? 'border-white shadow-lg scale-105'
                            : 'border-transparent hover:border-white/20'
                        }`}
                      >
                        <div className={`h-16 bg-gradient-to-br ${p.bg}`} />
                        <div className="p-2 bg-surface-2">
                          <p className={`text-xs font-bold text-center ${selectedColor === p.id ? 'text-white' : 'text-slate-400'}`}>
                            {p.label}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'content' && (
                <motion.div key="content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <div>
                    <label className="label">نص الترحيب (العنوان الفرعي)</label>
                    <div className="space-y-2">
                      {HERO_TEXTS.map(ht => (
                        <button
                          key={ht.id}
                          onClick={() => setHeroTextId(ht.id)}
                          className={`w-full text-right p-3 rounded-xl border transition-all ${
                            heroTextId === ht.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
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
                    <input
                      type="text"
                      value={customTagline}
                      onChange={e => setCustomTagline(e.target.value)}
                      placeholder="مثال: أفضل مغسلة متنقلة في الرياض"
                      className="input-field"
                      maxLength={60}
                    />
                    <p className="text-xs text-slate-500 mt-1">{customTagline.length}/60</p>
                  </div>
                </motion.div>
              )}

              {tab === 'sections' && (
                <motion.div key="sections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-2">
                  <p className="text-sm text-slate-400 mb-3">اختر الأقسام التي تظهر في صفحة الحجز:</p>
                  {[
                    { key: 'showRating' as const, icon: Star, label: 'التقييمات والنجوم', desc: 'عرض تقييم المغسلة في أعلى الصفحة' },
                    { key: 'showAreas' as const, icon: MapPin, label: 'مناطق الخدمة', desc: 'عرض قائمة الأحياء التي تخدمها' },
                    { key: 'showSlots' as const, icon: CalendarCheck, label: 'المواعيد المتاحة', desc: 'عرض أقرب المواعيد المتاحة للحجز' },
                    { key: 'showReviews' as const, icon: MessageCircle, label: 'آراء العملاء', desc: 'عرض تقييمات وتعليقات العملاء' },
                    { key: 'showWhatsApp' as const, icon: Phone, label: 'زر واتساب', desc: 'إظهار زر التواصل عبر واتساب' },
                    { key: 'showCallButton' as const, icon: Phone, label: 'زر الاتصال', desc: 'إظهار زر الاتصال المباشر' },
                  ].map(item => (
                    <button
                      key={item.key}
                      onClick={() => setSections(s => ({ ...s, [item.key]: !s[item.key] }))}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-right ${
                        sections[item.key]
                          ? 'border-blue-500/30 bg-blue-500/5'
                          : 'border-white/[0.06] bg-white/[0.02]'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        sections[item.key] ? 'bg-blue-500/20 text-blue-400' : 'bg-white/[0.06] text-slate-500'
                      }`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                      <div className={`w-10 h-6 rounded-full transition-all ${sections[item.key] ? 'bg-blue-500' : 'bg-white/10'}`}>
                        <motion.div
                          animate={{ x: sections[item.key] ? 16 : 2 }}
                          className="w-5 h-5 mt-0.5 rounded-full bg-white shadow"
                        />
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
                <Monitor className="w-4 h-4" />
                معاينة مباشرة
              </p>

              {/* Phone frame */}
              <div className="mx-auto w-full max-w-[280px]">
                <div className="rounded-[2.5rem] border-2 border-white/10 bg-surface-2 p-2 shadow-2xl">
                  {/* Notch */}
                  <div className="relative rounded-[2rem] overflow-hidden bg-surface-1" style={{ aspectRatio: '9/19' }}>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-black rounded-full z-20" />

                    {/* Mini page preview */}
                    <div className="h-full overflow-hidden">
                      {/* Hero */}
                      <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${vendorColor}, ${vendorColor}80)` }}>
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute bottom-3 right-3 left-3">
                          <div className="w-8 h-8 rounded-lg bg-white/20 mb-1.5" />
                          <div className="h-2.5 w-3/4 bg-white/40 rounded-full mb-1" />
                          <div className="h-2 w-1/2 bg-white/20 rounded-full" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3 space-y-2.5">
                        {/* Rating */}
                        {sections.showRating && (
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="w-2.5 h-2.5 rounded-sm bg-amber-400/70" />
                            ))}
                            <span className="text-[8px] text-slate-400 mr-1">4.9</span>
                          </div>
                        )}

                        {/* Areas */}
                        {sections.showAreas && (
                          <div className="flex gap-1 flex-wrap">
                            {['الياسمين', 'الملقا', 'العقيق'].map(a => (
                              <span key={a} className="text-[7px] px-1.5 py-0.5 rounded-full border border-white/10 text-slate-400">{a}</span>
                            ))}
                          </div>
                        )}

                        {/* Service cards */}
                        <div className="space-y-1.5">
                          {[1, 2].map(i => (
                            <div key={i} className={`p-2 rounded-lg border border-white/[0.06] ${
                              activeTheme.preview.cardStyle === 'glass' ? 'bg-white/[0.04]' : 'bg-surface-3/50'
                            }`}>
                              <div className="h-2 w-2/3 bg-white/20 rounded-full mb-1" />
                              <div className="h-1.5 w-1/3 bg-blue-400/30 rounded-full" />
                            </div>
                          ))}
                        </div>

                        {/* CTA */}
                        <div
                          className={`h-7 rounded-lg flex items-center justify-center ${
                            activeTheme.preview.ctaStyle === 'pill' ? 'rounded-full' :
                            activeTheme.preview.ctaStyle === 'glow' ? 'rounded-lg shadow-lg' : 'rounded-lg'
                          }`}
                          style={{
                            background: vendorColor,
                            boxShadow: activeTheme.preview.accentGlow ? `0 4px 20px ${vendorColor}60` : 'none',
                          }}
                        >
                          <span className="text-[9px] text-white font-bold">احجز الآن</span>
                        </div>

                        {/* Reviews */}
                        {sections.showReviews && (
                          <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                            <div className="h-1.5 w-full bg-white/10 rounded-full mb-1" />
                            <div className="h-1.5 w-3/4 bg-white/[0.06] rounded-full" />
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
                    <span className="flex-1 text-sm text-blue-400 truncate" dir="ltr">{storeUrl}</span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(storeUrl); toast.success('تم نسخ الرابط!'); }}
                      className="btn-icon w-8 h-8"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="btn-icon w-8 h-8">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
