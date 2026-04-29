import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Type, Palette, Layout, Droplets, Sparkles } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type LayoutStyle = 'icon-above' | 'icon-left' | 'icon-only' | 'text-only' | 'badge' | 'minimal';
type IconType = 'droplets' | 'car-sparkle' | 'spray' | 'water-wave' | 'shield-drop' | 'bubble' | 'diamond' | 'star-wash' | 'none';

interface Gradient {
  id: string;
  label: string;
  from: string;
  to: string;
  accent?: string;
}

interface LogoGeneratorProps {
  onSave: (dataUrl: string) => void;
  initialLetter?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADIENTS: Gradient[] = [
  { id: 'ocean', label: 'محيطي', from: '#0369A1', to: '#22D3EE', accent: '#BAE6FD' },
  { id: 'royal', label: 'ملكي', from: '#1E3A8A', to: '#3B82F6', accent: '#93C5FD' },
  { id: 'midnight', label: 'منتصف الليل', from: '#0F172A', to: '#334155', accent: '#60A5FA' },
  { id: 'sunset', label: 'غروب', from: '#9333EA', to: '#EC4899', accent: '#F9A8D4' },
  { id: 'forest', label: 'غابة', from: '#065F46', to: '#10B981', accent: '#6EE7B7' },
  { id: 'fire', label: 'ناري', from: '#B91C1C', to: '#F59E0B', accent: '#FDE68A' },
  { id: 'gold', label: 'ذهبي', from: '#78350F', to: '#D97706', accent: '#FCD34D' },
  { id: 'carbon', label: 'كربوني', from: '#18181B', to: '#3F3F46', accent: '#A1A1AA' },
  { id: 'arctic', label: 'قطبي', from: '#0C4A6E', to: '#38BDF8', accent: '#E0F2FE' },
  { id: 'lavender', label: 'لافندر', from: '#5B21B6', to: '#8B5CF6', accent: '#DDD6FE' },
  { id: 'coral', label: 'مرجاني', from: '#BE123C', to: '#FB7185', accent: '#FFE4E6' },
  { id: 'mint', label: 'نعناعي', from: '#047857', to: '#34D399', accent: '#D1FAE5' },
];

const LAYOUTS: { id: LayoutStyle; label: string; desc: string }[] = [
  { id: 'icon-above', label: 'أيقونة + نص', desc: 'الأيقونة فوق الاسم' },
  { id: 'badge', label: 'شارة', desc: 'تصميم الشارة الاحترافية' },
  { id: 'icon-only', label: 'أيقونة فقط', desc: 'أيقونة بدون نص' },
  { id: 'text-only', label: 'نص فقط', desc: 'الاسم بتصميم أنيق' },
  { id: 'minimal', label: 'حرف + خط', desc: 'حرف واحد مع خط سفلي' },
  { id: 'icon-left', label: 'أيقونة يسار', desc: 'أيقونة بجانب الاسم' },
];

const ICONS: { id: IconType; label: string }[] = [
  { id: 'droplets', label: 'قطرات ماء' },
  { id: 'car-sparkle', label: 'سيارة لامعة' },
  { id: 'spray', label: 'بخاخ' },
  { id: 'water-wave', label: 'موجة ماء' },
  { id: 'shield-drop', label: 'درع حماية' },
  { id: 'bubble', label: 'فقاعات' },
  { id: 'diamond', label: 'ماسة' },
  { id: 'star-wash', label: 'نجمة لامعة' },
  { id: 'none', label: 'بدون' },
];

// ─── SVG Icon Paths ──────────────────────────────────────────────────────────

function getIconSvg(icon: IconType, color: string, size = 40): string {
  const s = size;
  const h = s / 2;
  switch (icon) {
    case 'droplets':
      return `<g transform="translate(${h - 16}, ${h - 18})">
        <path d="M16 3C10 10 4 16 4 22a12 12 0 0024 0c0-6-6-12-12-19z" fill="${color}" opacity="0.9"/>
        <path d="M16 8c-4 5-8 9-8 13a8 8 0 0016 0c0-4-4-8-8-13z" fill="white" opacity="0.2"/>
      </g>`;
    case 'car-sparkle':
      return `<g transform="translate(${h - 18}, ${h - 12})">
        <path d="M6 18h24l4 6v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6l4-6z" fill="${color}" opacity="0.9"/>
        <path d="M8 18l3-8a2 2 0 012-2h10a2 2 0 012 2l3 8" fill="${color}"/>
        <circle cx="9" cy="28" r="2.5" fill="white" opacity="0.8"/>
        <circle cx="27" cy="28" r="2.5" fill="white" opacity="0.8"/>
        <path d="M30 4l2-2M32 8h3M30 12l2 2" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      </g>`;
    case 'spray':
      return `<g transform="translate(${h - 14}, ${h - 18})">
        <rect x="8" y="14" width="12" height="22" rx="3" fill="${color}" opacity="0.9"/>
        <rect x="10" y="10" width="8" height="6" rx="2" fill="${color}"/>
        <path d="M14 10V4M10 6l-4-4M18 6l4-4M8 2L6 0M20 2l2-2" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
        <circle cx="6" cy="8" r="1.5" fill="${color}" opacity="0.3"/>
        <circle cx="22" cy="8" r="1.5" fill="${color}" opacity="0.3"/>
        <circle cx="4" cy="4" r="1" fill="${color}" opacity="0.2"/>
      </g>`;
    case 'water-wave':
      return `<g transform="translate(${h - 16}, ${h - 10})">
        <path d="M2 12c4-4 8 0 12-4s8 0 12-4" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>
        <path d="M2 20c4-4 8 0 12-4s8 0 12-4" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7"/>
        <path d="M2 28c4-4 8 0 12-4s8 0 12-4" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
      </g>`;
    case 'shield-drop':
      return `<g transform="translate(${h - 16}, ${h - 18})">
        <path d="M16 2L30 8v12c0 10-8 16-14 18C10 36 2 30 2 20V8z" fill="${color}" opacity="0.15"/>
        <path d="M16 2L30 8v12c0 10-8 16-14 18C10 36 2 30 2 20V8z" stroke="${color}" stroke-width="2" fill="none" opacity="0.8"/>
        <path d="M16 12c-3 4-6 7-6 10a6 6 0 0012 0c0-3-3-6-6-10z" fill="${color}" opacity="0.7"/>
      </g>`;
    case 'bubble':
      return `<g transform="translate(${h - 16}, ${h - 16})">
        <circle cx="16" cy="16" r="12" fill="${color}" opacity="0.2"/>
        <circle cx="16" cy="16" r="12" stroke="${color}" stroke-width="2" fill="none" opacity="0.6"/>
        <circle cx="12" cy="12" r="3" fill="white" opacity="0.4"/>
        <circle cx="26" cy="8" r="5" fill="${color}" opacity="0.15"/>
        <circle cx="26" cy="8" r="5" stroke="${color}" stroke-width="1.5" fill="none" opacity="0.4"/>
        <circle cx="24" cy="6" r="1.5" fill="white" opacity="0.3"/>
        <circle cx="8" cy="28" r="3.5" fill="${color}" opacity="0.1"/>
        <circle cx="8" cy="28" r="3.5" stroke="${color}" stroke-width="1" fill="none" opacity="0.3"/>
      </g>`;
    case 'diamond':
      return `<g transform="translate(${h - 14}, ${h - 16})">
        <path d="M14 2L26 2L28 12L14 30L0 12L2 2Z" fill="${color}" opacity="0.85"/>
        <path d="M0 12L14 2L28 12" fill="white" opacity="0.15"/>
        <path d="M8 12L14 30L20 12" fill="white" opacity="0.1"/>
      </g>`;
    case 'star-wash':
      return `<g transform="translate(${h - 16}, ${h - 16})">
        <path d="M16 2l4.5 9 10 1.5-7 7 1.5 10L16 25l-9 4.5L8.5 19.5l-7-7 10-1.5z" fill="${color}" opacity="0.85"/>
        <path d="M16 6l3 6 7 1-5 5 1 7-6-3.5-6 3.5 1-7-5-5 7-1z" fill="white" opacity="0.15"/>
      </g>`;
    default:
      return '';
  }
}

// ─── Build Full SVG ──────────────────────────────────────────────────────────

function buildLogoSvg(
  name: string,
  icon: IconType,
  layout: LayoutStyle,
  gradient: Gradient,
  size = 200,
): string {
  const { from, to, accent } = gradient;
  const accentColor = accent ?? '#ffffff';
  const displayName = name.trim() || 'مغسلتي';
  const firstLetter = displayName.charAt(0);
  const gradId = `lg-${gradient.id}`;
  const bgGradId = `bg-${gradient.id}`;

  let content = '';
  const w = size;
  const h = size;

  // Background with rounded corners
  const bgRect = `<rect width="${w}" height="${h}" rx="24" fill="url(#${bgGradId})"/>`;
  // Subtle pattern overlay
  const pattern = `<rect width="${w}" height="${h}" rx="24" fill="url(#${gradId})" opacity="0.15"/>`;

  const defs = `<defs>
    <linearGradient id="${bgGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>`;

  // Decorative circle in background
  const decoCircle = `<circle cx="${w * 0.8}" cy="${h * 0.2}" r="${w * 0.25}" fill="white" opacity="0.05"/>
    <circle cx="${w * 0.15}" cy="${h * 0.85}" r="${w * 0.2}" fill="white" opacity="0.03"/>`;

  switch (layout) {
    case 'icon-above': {
      const iconSvg = icon !== 'none' ? getIconSvg(icon, 'white', 56) : '';
      const iconTranslate = icon !== 'none'
        ? `<g transform="translate(${w / 2 - 28}, ${h * 0.15})" filter="url(#shadow)">${getIconSvg(icon, 'white', 56)}</g>`
        : '';
      const nameY = icon !== 'none' ? h * 0.72 : h * 0.55;
      const nameSize = displayName.length > 8 ? 18 : displayName.length > 5 ? 22 : 26;
      content = `${bgRect}${pattern}${decoCircle}
        ${iconTranslate}
        <text x="${w / 2}" y="${nameY}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="${nameSize}" font-weight="800" font-family="Cairo, Tajawal, sans-serif"
          filter="url(#shadow)">${displayName}</text>
        <line x1="${w * 0.3}" y1="${nameY + nameSize * 0.8}" x2="${w * 0.7}" y2="${nameY + nameSize * 0.8}"
          stroke="${accentColor}" stroke-width="2" stroke-linecap="round" opacity="0.4"/>`;
      break;
    }

    case 'badge': {
      const badgeR = w * 0.38;
      const badgeCx = w / 2;
      const badgeCy = h / 2;
      const iconPart = icon !== 'none'
        ? `<g transform="translate(${badgeCx - 16}, ${badgeCy - 26})">${getIconSvg(icon, 'white', 32)}</g>`
        : '';
      const nameSize = displayName.length > 6 ? 14 : 18;
      content = `${bgRect}${pattern}${decoCircle}
        <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR}" fill="none" stroke="white" stroke-width="2.5" opacity="0.3"/>
        <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeR - 6}" fill="none" stroke="white" stroke-width="1" opacity="0.15"/>
        ${iconPart}
        <text x="${badgeCx}" y="${badgeCy + (icon !== 'none' ? 18 : 4)}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="${nameSize}" font-weight="800" font-family="Cairo, Tajawal, sans-serif"
          filter="url(#shadow)">${displayName}</text>`;
      break;
    }

    case 'icon-only': {
      const iconPart = icon !== 'none'
        ? `<g transform="translate(${w / 2 - 35}, ${h / 2 - 35})" filter="url(#shadow)">${getIconSvg(icon, 'white', 70)}</g>`
        : `<text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"
            fill="white" font-size="60" font-weight="900" font-family="Cairo, Tajawal, sans-serif"
            filter="url(#shadow)">${firstLetter}</text>`;
      content = `${bgRect}${pattern}${decoCircle}${iconPart}`;
      break;
    }

    case 'text-only': {
      const nameSize = displayName.length > 10 ? 20 : displayName.length > 6 ? 26 : 34;
      content = `${bgRect}${pattern}${decoCircle}
        <text x="${w / 2}" y="${h / 2 - 4}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="${nameSize}" font-weight="900" font-family="Cairo, Tajawal, sans-serif"
          letter-spacing="2" filter="url(#shadow)">${displayName}</text>
        <line x1="${w * 0.2}" y1="${h / 2 + nameSize * 0.7}" x2="${w * 0.8}" y2="${h / 2 + nameSize * 0.7}"
          stroke="${accentColor}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>`;
      break;
    }

    case 'minimal': {
      content = `${bgRect}${pattern}${decoCircle}
        <text x="${w / 2}" y="${h * 0.45}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="56" font-weight="900" font-family="Cairo, Tajawal, sans-serif"
          filter="url(#shadow)">${firstLetter}</text>
        <line x1="${w * 0.25}" y1="${h * 0.68}" x2="${w * 0.75}" y2="${h * 0.68}"
          stroke="${accentColor}" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
        <text x="${w / 2}" y="${h * 0.82}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="12" font-weight="600" font-family="Cairo, Tajawal, sans-serif"
          opacity="0.6" letter-spacing="4">${displayName.toUpperCase()}</text>`;
      break;
    }

    case 'icon-left': {
      const iconPart = icon !== 'none'
        ? `<g transform="translate(${w * 0.58}, ${h / 2 - 20})" filter="url(#shadow)">${getIconSvg(icon, 'white', 40)}</g>`
        : '';
      const nameSize = displayName.length > 8 ? 16 : displayName.length > 5 ? 20 : 24;
      const nameX = icon !== 'none' ? w * 0.42 : w / 2;
      content = `${bgRect}${pattern}${decoCircle}
        ${iconPart}
        <text x="${nameX}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"
          fill="white" font-size="${nameSize}" font-weight="800" font-family="Cairo, Tajawal, sans-serif"
          filter="url(#shadow)">${displayName}</text>`;
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    ${defs}
    ${content}
  </svg>`;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function LogoGenerator({ onSave, initialLetter = '' }: LogoGeneratorProps) {
  const [name, setName] = useState(initialLetter || 'مغسلتي');
  const [layout, setLayout] = useState<LayoutStyle>('icon-above');
  const [icon, setIcon] = useState<IconType>('droplets');
  const [gradientId, setGradientId] = useState(GRADIENTS[0].id);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeGradient = GRADIENTS.find(g => g.id === gradientId) ?? GRADIENTS[0];
  const previewSvg = buildLogoSvg(name, icon, layout, activeGradient, 200);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const svgString = buildLogoSvg(name, icon, layout, activeGradient, 512);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 512, 512);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        onSave(dataUrl);
        setSaving(false);
      };
      img.onerror = () => {
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
        URL.revokeObjectURL(url);
        onSave(svgDataUrl);
        setSaving(false);
      };
      img.src = url;
    } catch {
      setSaving(false);
    }
  }, [name, icon, layout, activeGradient, onSave]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Step tabs */}
      <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
        {[
          { n: 1, icon: Type, label: 'الاسم' },
          { n: 2, icon: Layout, label: 'التصميم' },
          { n: 3, icon: Palette, label: 'اللون' },
        ].map(s => (
          <button
            key={s.n}
            onClick={() => setStep(s.n)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              step === s.n
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div>
              <label className="label">اسم المغسلة</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: مغسلة الفخامة"
                className="input-field text-lg font-bold"
                maxLength={20}
              />
              <p className="text-xs text-slate-500 mt-1">اكتب اسم مغسلتك كما تريده أن يظهر</p>
            </div>

            <div>
              <label className="label">الأيقونة</label>
              <div className="grid grid-cols-3 gap-2">
                {ICONS.map(ic => {
                  const preview = ic.id !== 'none'
                    ? buildLogoSvg('', ic.id, 'icon-only', activeGradient, 48)
                    : '';
                  return (
                    <button
                      key={ic.id}
                      onClick={() => setIcon(ic.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                        icon === ic.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                      }`}
                    >
                      {preview ? (
                        <div className="w-8 h-8" dangerouslySetInnerHTML={{ __html: preview }} />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-xs text-slate-500">✕</div>
                      )}
                      <span className={`text-xs font-bold ${icon === ic.id ? 'text-blue-400' : 'text-slate-400'}`}>{ic.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <label className="label mb-3">نمط التصميم</label>
            <div className="grid grid-cols-2 gap-2">
              {LAYOUTS.map(l => {
                const mini = buildLogoSvg(name || 'م', icon, l.id, activeGradient, 64);
                return (
                  <button
                    key={l.id}
                    onClick={() => setLayout(l.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
                      layout === l.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                    }`}
                  >
                    <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden" dangerouslySetInnerHTML={{ __html: mini }} />
                    <div>
                      <p className={`text-sm font-bold ${layout === l.id ? 'text-blue-400' : 'text-white'}`}>{l.label}</p>
                      <p className="text-[11px] text-slate-500">{l.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <label className="label mb-3">لون الهوية</label>
            <div className="grid grid-cols-4 gap-2">
              {GRADIENTS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGradientId(g.id)}
                  className={`rounded-xl border-2 p-2 transition-all ${
                    gradientId === g.id
                      ? 'border-white scale-105 shadow-lg'
                      : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <div
                    className="h-10 rounded-lg mb-1"
                    style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                  />
                  <p className={`text-[10px] font-bold text-center ${gradientId === g.id ? 'text-white' : 'text-slate-500'}`}>
                    {g.label}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Preview */}
      <div className="pt-2">
        <p className="text-sm font-bold text-slate-400 mb-3 text-center flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          معاينة مباشرة
        </p>
        <div className="flex justify-center gap-6 items-end">
          {/* Main preview */}
          <motion.div
            key={`${name}-${icon}-${layout}-${gradientId}`}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="rounded-3xl overflow-hidden shadow-2xl shadow-black/40"
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />

          {/* Phone mockup preview */}
          <div className="hidden sm:block">
            <p className="text-[10px] text-slate-500 text-center mb-1.5">شكله على الجوال</p>
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-white/10"
              dangerouslySetInnerHTML={{ __html: buildLogoSvg(name, icon, layout, activeGradient, 64) }}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <motion.button
        type="button"
        onClick={handleSave}
        disabled={saving || !name.trim()}
        whileTap={{ scale: 0.97 }}
        className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
      >
        <Download size={18} />
        {saving ? 'جاري الحفظ...' : 'حفظ الشعار (512×512)'}
      </motion.button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
