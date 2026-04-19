import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Eye, Save, Palette, Layout, Type,
  CheckCircle, Globe, Star, Lock,
  MapPin, Phone, CalendarCheck, Sparkles, Monitor,
  MessageCircle, ExternalLink, Copy, Crown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ═══════════════════════════════════════════════════════════════════════════════
// THEME SYSTEM — 20 Professional Templates (1 Free + 19 Pro)
// Free plan: single default template ("clean-modern"). All others require Pro.
// ═══════════════════════════════════════════════════════════════════════════════

interface StoreTheme {
  id: string;
  name: string;
  desc: string;
  category: 'free' | 'premium';
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
  // ── FREE THEME (1) ── Default template — available on every plan
  {
    id: 'clean-modern', name: 'عصري نظيف', desc: 'تصميم نظيف بسيط — يناسب كل القطاعات', category: 'free',
    gradient: 'from-slate-800 to-slate-900', accent: '#3b82f6',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },

  // ── PRO THEMES (19) ── Subscribers only
  {
    id: 'premium-dark', name: 'بريميوم داكن', desc: 'تصميم فاخر مع تأثيرات ضوئية', category: 'premium',
    gradient: 'from-blue-900 to-slate-900', accent: '#2563eb',
    preview: { heroStyle: 'full-cover', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'mesh',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'bold-gradient', name: 'تدرج جريء', desc: 'تدرجات لونية جريئة', category: 'premium',
    gradient: 'from-purple-900 to-blue-900', accent: '#8b5cf6',
    preview: { heroStyle: 'gradient-split', cardStyle: 'gradient-border', ctaStyle: 'pill', bgPattern: 'gradient',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'wave-water', name: 'موجة مائية', desc: 'مستوحى من الماء مع تموجات', category: 'premium',
    gradient: 'from-cyan-900 to-blue-950', accent: '#06b6d4',
    preview: { heroStyle: 'wave-bg', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'wave',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'minimal-speed', name: 'سريع ومختصر', desc: 'أقل عناصر — حجز أسرع', category: 'premium',
    gradient: 'from-zinc-800 to-zinc-900', accent: '#a1a1aa',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'solid', ctaStyle: 'pill', bgPattern: 'clean',
      showRating: true, showAreas: false, showSlots: true, showReviews: false, showWhatsApp: false, showCallButton: false, accentGlow: false },
  },

  // ── Existing Pro themes (continued)
  {
    id: 'neon-glow', name: 'نيون متوهج', desc: 'تأثيرات نيون مع توهج كهربائي', category: 'premium',
    gradient: 'from-violet-950 to-black', accent: '#a855f7',
    preview: { heroStyle: 'bold-centered', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'neon',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'saudi-royal', name: 'ملكي سعودي', desc: 'مستوحى من التراث السعودي — أخضر وذهبي', category: 'premium',
    gradient: 'from-emerald-950 to-green-900', accent: '#059669',
    preview: { heroStyle: 'full-cover', cardStyle: 'elevated', ctaStyle: 'rounded', bgPattern: 'pattern',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },
  {
    id: 'desert-sand', name: 'رمال الصحراء', desc: 'دافئ بألوان الصحراء والرمال', category: 'premium',
    gradient: 'from-amber-950 to-orange-950', accent: '#d97706',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'dots',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },
  {
    id: 'ice-crystal', name: 'كريستال ثلجي', desc: 'بارد ونقي بألوان جليدية', category: 'premium',
    gradient: 'from-sky-950 to-cyan-950', accent: '#0ea5e9',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'glass', ctaStyle: 'pill', bgPattern: 'mesh',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: true },
  },
  {
    id: 'carbon-fiber', name: 'ألياف كربونية', desc: 'تقني وعصري بنمط كربوني', category: 'premium',
    gradient: 'from-neutral-900 to-neutral-950', accent: '#525252',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'grid',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },
  {
    id: 'sunset-horizon', name: 'غروب الأفق', desc: 'دافئ بألوان الغروب البرتقالية والبنفسجية', category: 'premium',
    gradient: 'from-orange-950 to-purple-950', accent: '#f97316',
    preview: { heroStyle: 'full-cover', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'gradient',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'forest-green', name: 'غابة خضراء', desc: 'طبيعي ومريح بدرجات الأخضر', category: 'premium',
    gradient: 'from-green-950 to-emerald-950', accent: '#10b981',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'clean',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: false, accentGlow: false },
  },
  {
    id: 'rose-gold', name: 'وردي ذهبي', desc: 'أنيق وفخم بالوردي والذهبي', category: 'premium',
    gradient: 'from-rose-950 to-pink-950', accent: '#e11d48',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'gradient-border', ctaStyle: 'pill', bgPattern: 'dots',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'ocean-deep', name: 'أعماق المحيط', desc: 'أزرق عميق مثل قاع البحر', category: 'premium',
    gradient: 'from-blue-950 to-indigo-950', accent: '#1d4ed8',
    preview: { heroStyle: 'wave-bg', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'wave',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'marble-luxury', name: 'رخام فاخر', desc: 'كلاسيكي فاخر بتأثير رخامي', category: 'premium',
    gradient: 'from-stone-900 to-stone-950', accent: '#78716c',
    preview: { heroStyle: 'bold-centered', cardStyle: 'elevated', ctaStyle: 'rounded', bgPattern: 'pattern',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },
  {
    id: 'midnight-purple', name: 'بنفسج منتصف الليل', desc: 'غامق وغامض بدرجات البنفسجي', category: 'premium',
    gradient: 'from-purple-950 to-indigo-950', accent: '#7c3aed',
    preview: { heroStyle: 'full-cover', cardStyle: 'glass', ctaStyle: 'glow', bgPattern: 'neon',
      showRating: true, showAreas: false, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
  },
  {
    id: 'golden-hour', name: 'الساعة الذهبية', desc: 'دافئ بإضاءة ذهبية', category: 'premium',
    gradient: 'from-yellow-950 to-amber-950', accent: '#ca8a04',
    preview: { heroStyle: 'gradient-split', cardStyle: 'bordered', ctaStyle: 'rounded', bgPattern: 'gradient',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: false },
  },
  {
    id: 'arctic-frost', name: 'صقيع قطبي', desc: 'أبيض مزرق هادئ ونظيف', category: 'premium',
    gradient: 'from-sky-950 to-slate-900', accent: '#38bdf8',
    preview: { heroStyle: 'minimal-clean', cardStyle: 'bordered', ctaStyle: 'pill', bgPattern: 'clean',
      showRating: true, showAreas: false, showSlots: true, showReviews: false, showWhatsApp: true, showCallButton: false, accentGlow: true },
  },
  {
    id: 'volcanic-red', name: 'أحمر بركاني', desc: 'جريء وقوي بالأحمر الداكن', category: 'premium',
    gradient: 'from-red-950 to-rose-950', accent: '#dc2626',
    preview: { heroStyle: 'bold-centered', cardStyle: 'solid', ctaStyle: 'square', bgPattern: 'gradient',
      showRating: true, showAreas: true, showSlots: true, showReviews: true, showWhatsApp: true, showCallButton: true, accentGlow: true },
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

      <div className="p-2.5 bg-surface-2">
        <p className={`text-xs font-bold ${selected ? 'text-blue-400' : 'text-white'} truncate`}>{theme.name}</p>
        <p className="text-[10px] text-slate-500 truncate">{theme.desc}</p>
      </div>
    </motion.button>
  );
}

// ─── Main Store Builder ──────────────────────────────────────────────────────

export default function StoreBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTheme, setSelectedTheme] = useState('premium-dark');
  const [heroTextId, setHeroTextId] = useState('classic');
  const [customTagline, setCustomTagline] = useState('');
  const [tab, setTab] = useState<'theme' | 'content' | 'sections'>('theme');
  const [themeFilter, setThemeFilter] = useState('all');

  // Section toggles
  const [sections, setSections] = useState({
    showRating: true, showAreas: true, showSlots: true,
    showReviews: true, showWhatsApp: true, showCallButton: true,
  });

  // Load vendor data
  const { data: vendor } = useQuery({
    queryKey: ['vendor-branding'],
    queryFn: () => api.get('/vendors/my').then(r => r.data),
  });

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
      toast.error('هذا الثيم متاح للمشتركين فقط. فعّل اشتراكك للوصول لـ 20 ثيم!');
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
      primaryColor: activeTheme.accent,
      settings: {
        ...(vendor?.settings ?? {}),
        storeTheme: selectedTheme,
        heroTextId,
        customTagline,
        storeSections: sections,
      },
    }),
    onSuccess: () => {
      toast.success('تم حفظ الثيم بنجاح!');
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
                { id: 'theme' as const, icon: Layout, label: `الثيمات (${THEMES.length})` },
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
                      {isPaidSubscriber ? '20 ثيم متاح' : 'ثيم واحد مجاني — الباقي مع اشتراك برو'}
                    </span>
                  </div>

                  {/* Premium upsell banner */}
                  {!isPaidSubscriber && themeFilter !== 'free' && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center gap-3">
                        <Crown className="w-8 h-8 text-amber-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">اشتراك برو يفتح 19 قالب احترافي + إخفاء علامة بوكست</p>
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
