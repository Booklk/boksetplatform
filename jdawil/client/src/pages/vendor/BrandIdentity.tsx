/**
 * /vendor/brand-identity — the full brand-identity editor (Pro only).
 *
 * Five panels:
 *   1. الألوان         — 5-role palette with live preview
 *   2. الخطوط          — pick heading + body from a curated Arabic list
 *   3. التنسيق          — hero alignment, services layout, type scale, button shape
 *   4. ميديا الهوية      — logo, favicon, OG image URLs
 *   5. ترتيب الأقسام    — up/down reorder of storefront sections
 *
 * At the top we surface the vendor's short merchant code (JW-XXXX) —
 * unique per tenant and copy-ready for receipts / QR / business cards.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Palette, Type, LayoutGrid, ImageIcon, ListOrdered,
  ArrowUp, ArrowDown, Save, Copy, CheckCircle2, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton,
} from '../../components/ui';
import UpgradeGate from '../../components/UpgradeGate';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

type HeroAlignment  = 'center' | 'start' | 'end' | 'full';
type ServicesLayout = 'grid' | 'list' | 'cards';
type TypeScale      = 'compact' | 'comfortable' | 'spacious';
type ButtonShape    = 'rounded' | 'pill' | 'square';

interface Brand {
  colors: { primary: string; accent: string; background: string; surface: string; text: string };
  fonts:  { heading: string; body: string };
  typographyScale: TypeScale;
  buttonShape: ButtonShape;
  layout: { heroAlignment: HeroAlignment; servicesLayout: ServicesLayout; sectionsOrder: string[] };
  identity: { logoUrl: string; faviconUrl: string; ogImageUrl: string };
}

interface Settings { brand: Brand; merchantNumber: string }
interface FontSpec { id: string; label: string; familyCss: string; weight: string }

const SECTION_LABELS: Record<string, string> = {
  announcement: 'البانر الإعلاني',
  hero:         'الهيرو',
  services:     'الخدمات',
  gallery:      'معرض الصور',
  testimonials: 'شهادات العملاء',
  faq:          'الأسئلة الشائعة',
  location:     'الموقع',
  contact:      'تواصل',
};

const COLOR_MOODS: Array<{ name: string; colors: Brand['colors'] }> = [
  { name: 'عصري', colors: { primary: '#4f46e5', accent: '#0ea5e9', background: '#0b1220', surface: '#12131e', text: '#ffffff' } },
  { name: 'فاخر', colors: { primary: '#d4a437', accent: '#7c2d12', background: '#0a0a0a', surface: '#1a1a1a', text: '#f8f8f8' } },
  { name: 'دافئ', colors: { primary: '#ea580c', accent: '#f59e0b', background: '#1c1917', surface: '#292524', text: '#fafaf9' } },
  { name: 'طبيعي',colors: { primary: '#15803d', accent: '#84cc16', background: '#0a1612', surface: '#132321', text: '#f0fdf4' } },
  { name: 'أنيق', colors: { primary: '#be185d', accent: '#f472b6', background: '#1a0f1a', surface: '#2a1a2a', text: '#ffffff' } },
  { name: 'ملكي', colors: { primary: '#7e22ce', accent: '#a855f7', background: '#0f0a1f', surface: '#1a142a', text: '#f5f3ff' } },
];

const TABS = [
  { id: 'colors',   label: 'الألوان',     icon: Palette },
  { id: 'fonts',    label: 'الخطوط',      icon: Type },
  { id: 'layout',   label: 'التنسيق',      icon: LayoutGrid },
  { id: 'identity', label: 'ميديا الهوية', icon: ImageIcon },
  { id: 'order',    label: 'ترتيب الأقسام', icon: ListOrdered },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function BrandIdentity() {
  return (
    <UpgradeGate featureId="announcement_banner">
      <Inner />
    </UpgradeGate>
  );
}

function Inner() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('colors');

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ['storefront-settings'],
    queryFn: async () => (await api.get('/vendor-storefront/settings')).data,
  });
  const { data: fontsData } = useQuery<{ fonts: FontSpec[] }>({
    queryKey: ['storefront-fonts'],
    queryFn: async () => (await api.get('/vendor-storefront/fonts')).data,
  });

  const [local, setLocal] = useState<Brand | null>(null);
  useEffect(() => { if (data?.brand) setLocal(data.brand); }, [data]);

  const save = useMutation({
    mutationFn: (brand: Partial<Brand>) =>
      api.put('/vendor-storefront/settings', { brand }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['storefront-settings'] });
      qc.invalidateQueries({ queryKey: ['storefront-public'] });
      toast.success('حفظت');
    },
    onError: (e: any) => {
      if (e?.response?.status === 402) {
        toast.error('هذه الميزة للباقة Pro — تجربة مجانية شهر كاملة متوفّرة');
      } else {
        toast.error(e?.response?.data?.error ?? 'فشل الحفظ');
      }
    },
  });

  if (isLoading || !local || !data) {
    return (
      <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-[360px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={<Sparkles size={20} />}
          title="الهوية البصرية"
          subtitle="كستمز متجرك بهوية كاملة — ألوان، خطوط، تنسيق، ميديا، وترتيب الأقسام."
          actions={<Badge tone="primary" size="md">Pro</Badge>}
        />

        {/* Merchant number — unique id per store */}
        <MerchantNumberCard code={data.merchantNumber} />

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  active
                    ? 'bg-primary-500 text-white'
                    : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1fr,380px] gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={springs.gentle}
            >
              {tab === 'colors' && (
                <ColorsPanel
                  value={local.colors}
                  onChange={(colors) => setLocal({ ...local, colors })}
                  onSave={() => save.mutate({ colors: local.colors })}
                  busy={save.isPending}
                />
              )}
              {tab === 'fonts' && (
                <FontsPanel
                  value={local.fonts}
                  fonts={fontsData?.fonts ?? []}
                  scale={local.typographyScale}
                  onChange={(fonts) => setLocal({ ...local, fonts })}
                  onScaleChange={(typographyScale) => setLocal({ ...local, typographyScale })}
                  onSave={() => save.mutate({ fonts: local.fonts, typographyScale: local.typographyScale })}
                  busy={save.isPending}
                />
              )}
              {tab === 'layout' && (
                <LayoutPanel
                  heroAlignment={local.layout.heroAlignment}
                  servicesLayout={local.layout.servicesLayout}
                  buttonShape={local.buttonShape}
                  onChange={(patch) => setLocal({
                    ...local,
                    layout: { ...local.layout, ...patch.layout },
                    buttonShape: patch.buttonShape ?? local.buttonShape,
                  })}
                  onSave={() => save.mutate({
                    layout: { ...local.layout },
                    buttonShape: local.buttonShape,
                  })}
                  busy={save.isPending}
                />
              )}
              {tab === 'identity' && (
                <IdentityPanel
                  value={local.identity}
                  onChange={(identity) => setLocal({ ...local, identity })}
                  onSave={() => save.mutate({ identity: local.identity })}
                  busy={save.isPending}
                />
              )}
              {tab === 'order' && (
                <OrderPanel
                  order={local.layout.sectionsOrder}
                  onChange={(sectionsOrder) => setLocal({
                    ...local, layout: { ...local.layout, sectionsOrder },
                  })}
                  onSave={() => save.mutate({ layout: { ...local.layout } })}
                  busy={save.isPending}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Sticky live preview card on the right on large screens */}
          <div className="hidden lg:block">
            <LivePreview brand={local} fonts={fontsData?.fonts ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function MerchantNumberCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <Card variant="elevated" padding="md" className="mb-4 bg-gradient-to-br from-primary-500/10 to-transparent border-primary-500/20">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">رقم متجرك الفريد</p>
          <p className="text-2xl font-black tabular-nums font-mono mt-0.5" dir="ltr">{code}</p>
          <p className="text-[11px] text-ink-500 mt-1">حطّه في فواتيرك، على بطاقات العمل، وفي QR الكود.</p>
        </div>
        <Button size="sm" variant="secondary" leftIcon={copied ? <CheckCircle2 size={13} /> : <Copy size={13} />} onClick={copy}>
          {copied ? 'نسخ' : 'نسخ'}
        </Button>
      </div>
    </Card>
  );
}

// ── COLORS ────────────────────────────────────────────────────────────────

function ColorsPanel({
  value, onChange, onSave, busy,
}: {
  value: Brand['colors'];
  onChange: (v: Brand['colors']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <Palette size={15} className="text-primary-400" />
        <h3 className="font-bold">لوحة الألوان</h3>
      </div>

      {/* Mood presets */}
      <div>
        <p className="text-xs font-bold text-ink-400 mb-2">قوالب جاهزة</p>
        <div className="grid grid-cols-3 gap-2">
          {COLOR_MOODS.map((mood) => (
            <button
              key={mood.name}
              onClick={() => onChange(mood.colors)}
              className="rounded-xl border-2 border-white/[0.06] hover:border-white/[0.15] p-2 transition-all text-right"
            >
              <div className="flex -space-x-1 mb-1.5 rtl:space-x-reverse">
                {(Object.values(mood.colors) as string[]).slice(0, 4).map((c, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 rounded-full border border-black/20"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-xs font-bold">{mood.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-3 border-t border-white/[0.06]">
        {([
          { key: 'primary',    label: 'اللون الأساسي',  hint: 'الأزرار، الروابط، العناصر المميّزة' },
          { key: 'accent',     label: 'اللون الثانوي',  hint: 'تمييزات أقل بروزاً' },
          { key: 'background', label: 'خلفية الصفحة',   hint: 'أغلب المساحة' },
          { key: 'surface',    label: 'خلفية البطاقات', hint: 'الكاردات والعناصر المرتفعة' },
          { key: 'text',       label: 'لون النص',       hint: 'نص أساسي' },
        ] as const).map(({ key, label, hint }) => (
          <div key={key} className="flex items-center gap-3">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(value[key]) ? value[key] : '#000000'}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              className="w-12 h-9 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer"
            />
            <Input
              dir="ltr"
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
              containerClassName="flex-1"
              label={<span>{label}<span className="text-ink-600 font-normal"> — {hint}</span></span>}
            />
          </div>
        ))}
      </div>

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ الألوان
      </Button>
    </Card>
  );
}

// ── FONTS ─────────────────────────────────────────────────────────────────

function FontsPanel({
  value, fonts, scale, onChange, onScaleChange, onSave, busy,
}: {
  value: Brand['fonts'];
  fonts: FontSpec[];
  scale: TypeScale;
  onChange: (v: Brand['fonts']) => void;
  onScaleChange: (s: TypeScale) => void;
  onSave: () => void;
  busy: boolean;
}) {
  // Lazy-load google fonts for preview on this page only.
  useEffect(() => {
    const existing = document.getElementById('brand-fonts-preview');
    if (existing) return;
    const families = fonts.map((f) => `family=${f.label.replace(/ /g, '+')}:wght@${f.weight}`).join('&');
    if (!families) return;
    const link = document.createElement('link');
    link.id = 'brand-fonts-preview';
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, [fonts]);

  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <Type size={15} className="text-accent" />
        <h3 className="font-bold">الخطوط العربية</h3>
      </div>

      {(['heading','body'] as const).map((slot) => (
        <div key={slot}>
          <p className="text-xs font-bold text-ink-400 mb-2">
            {slot === 'heading' ? 'خط العناوين' : 'خط النصوص'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {fonts.map((f) => {
              const active = value[slot] === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onChange({ ...value, [slot]: f.id })}
                  className={`p-3 rounded-xl border-2 text-right transition-all ${
                    active
                      ? 'border-primary-500/60 bg-primary-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                >
                  <p className="text-[10px] text-ink-400 font-mono mb-1" dir="ltr">{f.label}</p>
                  <p className="text-base font-bold text-white" style={{ fontFamily: f.familyCss }}>
                    أبجد هوز {slot === 'heading' ? 'عنوان جميل' : 'نص تجريبي'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-3 border-t border-white/[0.06]">
        <p className="text-xs font-bold text-ink-400 mb-2">حجم النصوص العام</p>
        <div className="flex gap-1.5">
          {(['compact','comfortable','spacious'] as TypeScale[]).map((s) => (
            <button
              key={s}
              onClick={() => onScaleChange(s)}
              className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
                scale === s ? 'bg-primary-500 text-white' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
              }`}
            >
              {s === 'compact' ? 'مضغوط' : s === 'comfortable' ? 'متوازن' : 'فسيح'}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ الخطوط
      </Button>
    </Card>
  );
}

// ── LAYOUT ────────────────────────────────────────────────────────────────

function LayoutPanel({
  heroAlignment, servicesLayout, buttonShape, onChange, onSave, busy,
}: {
  heroAlignment:  HeroAlignment;
  servicesLayout: ServicesLayout;
  buttonShape:    ButtonShape;
  onChange: (patch: { layout?: Partial<Brand['layout']>; buttonShape?: ButtonShape }) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid size={15} className="text-success-400" />
        <h3 className="font-bold">التنسيق العام</h3>
      </div>

      <ChipRow
        label="محاذاة الهيرو"
        options={[
          { value: 'center', label: 'في المنتصف' },
          { value: 'start',  label: 'يمين' },
          { value: 'end',    label: 'يسار' },
          { value: 'full',   label: 'عرض كامل' },
        ]}
        active={heroAlignment}
        onSelect={(v) => onChange({ layout: { heroAlignment: v as HeroAlignment } })}
      />
      <ChipRow
        label="عرض الخدمات"
        options={[
          { value: 'grid',  label: 'شبكة' },
          { value: 'list',  label: 'قائمة' },
          { value: 'cards', label: 'كروت كبيرة' },
        ]}
        active={servicesLayout}
        onSelect={(v) => onChange({ layout: { servicesLayout: v as ServicesLayout } })}
      />
      <ChipRow
        label="شكل الأزرار"
        options={[
          { value: 'rounded', label: 'مدوّر قليلاً' },
          { value: 'pill',    label: 'مدوّر كامل' },
          { value: 'square',  label: 'زاوية حادة' },
        ]}
        active={buttonShape}
        onSelect={(v) => onChange({ buttonShape: v as ButtonShape })}
      />

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ التنسيق
      </Button>
    </Card>
  );
}

function ChipRow({
  label, options, active, onSelect,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold text-ink-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
              active === o.value ? 'bg-primary-500 text-white' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── IDENTITY ───────────────────────────────────────────────────────────────

function IdentityPanel({
  value, onChange, onSave, busy,
}: {
  value: Brand['identity'];
  onChange: (v: Brand['identity']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon size={15} className="text-warn-400" />
        <h3 className="font-bold">ميديا الهوية</h3>
      </div>
      <Input
        label="رابط اللوقو"
        dir="ltr"
        value={value.logoUrl}
        onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
        placeholder="/uploads/... أو https://..."
        help="يظهر في الهيدر والفاتورة وإشعارات الواتساب"
      />
      <Input
        label="أيقونة المتصفّح (Favicon)"
        dir="ltr"
        value={value.faviconUrl}
        onChange={(e) => onChange({ ...value, faviconUrl: e.target.value })}
        placeholder="/uploads/... أو https://..."
        help="تظهر في تبويب المتصفّح وعلى الجوال"
      />
      <Input
        label="صورة المشاركة (Open Graph)"
        dir="ltr"
        value={value.ogImageUrl}
        onChange={(e) => onChange({ ...value, ogImageUrl: e.target.value })}
        placeholder="/uploads/... أو https://..."
        help="الصورة التي تظهر لما يشارك أحد متجرك على واتساب أو تويتر"
      />

      {/* Tiny previews */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.06]">
        {[
          { label: 'لوقو',    src: value.logoUrl },
          { label: 'Favicon', src: value.faviconUrl },
          { label: 'OG',       src: value.ogImageUrl },
        ].map((a) => (
          <div key={a.label} className="aspect-square rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
            {a.src ? (
              <img src={a.src} alt={a.label} className="w-full h-full object-contain p-2" />
            ) : (
              <span className="text-[10px] text-ink-500">{a.label}</span>
            )}
          </div>
        ))}
      </div>

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ الميديا
      </Button>
    </Card>
  );
}

// ── ORDER ──────────────────────────────────────────────────────────────────

function OrderPanel({
  order, onChange, onSave, busy,
}: {
  order: string[];
  onChange: (o: string[]) => void;
  onSave: () => void;
  busy: boolean;
}) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <Card variant="default" padding="md" className="space-y-3">
      <div className="flex items-center gap-2">
        <ListOrdered size={15} className="text-primary-400" />
        <h3 className="font-bold">ترتيب الأقسام</h3>
      </div>
      <p className="text-xs text-ink-400 leading-relaxed">
        رتّب الأقسام كما تريد أن تظهر على صفحة متجرك. الأعلى = يظهر أولاً.
      </p>
      <motion.ul
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-1.5"
      >
        {order.map((key, i) => (
          <motion.li key={key} variants={fadeInUp} layout>
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm font-bold text-white">
                {i + 1}. {SECTION_LABELS[key] ?? key}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30"
                  aria-label="تحريك لأعلى"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30"
                  aria-label="تحريك لأسفل"
                >
                  <ArrowDown size={13} />
                </button>
              </div>
            </div>
          </motion.li>
        ))}
      </motion.ul>
      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ الترتيب
      </Button>
    </Card>
  );
}

// ── LIVE PREVIEW ────────────────────────────────────────────────────────

function LivePreview({ brand, fonts }: { brand: Brand; fonts: FontSpec[] }) {
  const headingFont = useMemo(
    () => fonts.find((f) => f.id === brand.fonts.heading)?.familyCss ?? '"Tajawal", sans-serif',
    [brand.fonts.heading, fonts],
  );
  const bodyFont = useMemo(
    () => fonts.find((f) => f.id === brand.fonts.body)?.familyCss ?? '"Tajawal", sans-serif',
    [brand.fonts.body, fonts],
  );
  const btnRadius = brand.buttonShape === 'pill' ? '9999px'
                  : brand.buttonShape === 'square' ? '0.25rem'
                  : '0.75rem';
  return (
    <div className="sticky top-4">
      <Card variant="elevated" padding="none" className="overflow-hidden">
        <div className="px-3 py-2 border-b border-white/[0.06] text-[11px] font-bold text-ink-400">
          معاينة سريعة
        </div>
        <div
          className="p-6"
          style={{
            background: brand.colors.background,
            color:      brand.colors.text,
            fontFamily: bodyFont,
          }}
        >
          <h1 className="text-2xl font-black mb-1" style={{ fontFamily: headingFont }}>
            عنوان رئيسي
          </h1>
          <p className="text-sm opacity-80 mb-4">نص توضيحي يُظهر الخط، المسافة، والألوان المختارة.</p>
          <div
            className="rounded-xl p-3 mb-3"
            style={{ background: brand.colors.surface }}
          >
            <p className="text-xs opacity-70">بطاقة</p>
            <p className="text-sm font-bold">محتوى على السطح الثانوي</p>
          </div>
          <button
            className="px-4 h-10 font-bold text-sm text-white"
            style={{ background: brand.colors.primary, borderRadius: btnRadius }}
          >
            زر أساسي
          </button>
          <button
            className="px-4 h-10 font-bold text-sm ms-2"
            style={{ background: 'transparent', color: brand.colors.accent, border: `1px solid ${brand.colors.accent}`, borderRadius: btnRadius }}
          >
            زر ثانوي
          </button>
        </div>
      </Card>
    </div>
  );
}
