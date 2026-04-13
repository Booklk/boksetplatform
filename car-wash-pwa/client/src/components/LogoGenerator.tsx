import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShapeType = 'circle' | 'rounded-square' | 'hexagon' | 'water-drop' | 'shield';

interface Gradient {
  id: string;
  label: string;
  from: string;
  to: string;
}

interface LogoGeneratorProps {
  onSave: (dataUrl: string) => void;
  initialLetter?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHAPES: { id: ShapeType; label: string }[] = [
  { id: 'circle', label: 'دائرة' },
  { id: 'rounded-square', label: 'مربع' },
  { id: 'hexagon', label: 'سداسي' },
  { id: 'water-drop', label: 'قطرة' },
  { id: 'shield', label: 'درع' },
];

const GRADIENTS: Gradient[] = [
  { id: 'blue-cyan', label: 'أزرق سماوي', from: '#2563EB', to: '#22D3EE' },
  { id: 'purple-pink', label: 'بنفسجي وردي', from: '#9333EA', to: '#EC4899' },
  { id: 'emerald-teal', label: 'زمردي فيروزي', from: '#059669', to: '#14B8A6' },
  { id: 'orange-amber', label: 'برتقالي عنبري', from: '#EA580C', to: '#F59E0B' },
  { id: 'rose-pink', label: 'وردي فاتح', from: '#E11D48', to: '#F472B6' },
  { id: 'indigo-blue', label: 'نيلي أزرق', from: '#4F46E5', to: '#3B82F6' },
  { id: 'slate-gray', label: 'رمادي فضي', from: '#475569', to: '#94A3B8' },
  { id: 'gold-yellow', label: 'ذهبي أصفر', from: '#B45309', to: '#EAB308' },
  { id: 'red-orange', label: 'أحمر برتقالي', from: '#DC2626', to: '#F97316' },
  { id: 'green-lime', label: 'أخضر ليموني', from: '#16A34A', to: '#84CC16' },
  { id: 'sky-blue', label: 'أزرق سماء', from: '#0284C7', to: '#38BDF8' },
  { id: 'violet-purple', label: 'بنفسجي غامق', from: '#7C3AED', to: '#A855F7' },
];

// ─── SVG shape path helpers ────────────────────────────────────────────────────

function getShapeElement(shape: ShapeType, gradientId: string): string {
  const fill = `url(#${gradientId})`;
  switch (shape) {
    case 'circle':
      return `<circle cx="50" cy="50" r="50" fill="${fill}"/>`;
    case 'rounded-square':
      return `<rect x="5" y="5" rx="20" ry="20" width="90" height="90" fill="${fill}"/>`;
    case 'hexagon':
      return `<polygon points="50,2 93,25 93,75 50,98 7,75 7,25" fill="${fill}"/>`;
    case 'water-drop':
      return `<path d="M50 5 C20 35 5 55 5 68 C5 84 26 97 50 97 C74 97 95 84 95 68 C95 55 80 35 50 5Z" fill="${fill}"/>`;
    case 'shield':
      return `<path d="M50 5 L90 20 L90 55 C90 78 70 93 50 97 C30 93 10 78 10 55 L10 20 Z" fill="${fill}"/>`;
  }
}

function buildSvgString(letter: string, shape: ShapeType, gradient: Gradient, size = 100): string {
  const gradId = `grad-${gradient.id}`;
  const shapeEl = getShapeElement(shape, gradId);
  const displayLetter = letter.trim().slice(0, 2) || '؟';
  const fontSize = displayLetter.length > 1 ? 34 : 44;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient.from}"/>
      <stop offset="100%" stop-color="${gradient.to}"/>
    </linearGradient>
  </defs>
  ${shapeEl}
  <text
    x="50"
    y="50"
    dominant-baseline="central"
    text-anchor="middle"
    fill="white"
    font-size="${fontSize}"
    font-weight="bold"
    font-family="Cairo, Arial, sans-serif"
  >${displayLetter}</text>
</svg>`;
}

// ─── Small shape button preview ────────────────────────────────────────────────

function ShapePreview({ shape, selected, onClick }: { shape: ShapeType; selected: boolean; onClick: () => void }) {
  const previewSvg = buildSvgString('أ', shape, GRADIENTS[0], 48);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/30'
      }`}
    >
      <div dangerouslySetInnerHTML={{ __html: previewSvg }} />
      <span className={`text-xs font-bold ${selected ? 'text-blue-400' : 'text-white/50'}`}>
        {SHAPES.find((s) => s.id === shape)?.label}
      </span>
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function LogoGenerator({ onSave, initialLetter = '' }: LogoGeneratorProps) {
  const [letter, setLetter] = useState(initialLetter || 'م');
  const [shape, setShape] = useState<ShapeType>('circle');
  const [gradientId, setGradientId] = useState(GRADIENTS[0].id);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeGradient = GRADIENTS.find((g) => g.id === gradientId) ?? GRADIENTS[0];
  const previewSvg = buildSvgString(letter, shape, activeGradient, 120);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const svgString = buildSvgString(letter, shape, activeGradient, 200);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, 200, 200);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        onSave(dataUrl);
        setSaving(false);
      };
      img.onerror = () => {
        // Fallback: return SVG data URL directly
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
        URL.revokeObjectURL(url);
        onSave(svgDataUrl);
        setSaving(false);
      };
      img.src = url;
    } catch {
      setSaving(false);
    }
  }, [letter, shape, activeGradient, onSave]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Step 1 — الحرف */}
      <div>
        <p className="text-sm font-bold text-white/70 mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black ml-1.5">١</span>
          الحرف
        </p>
        <input
          type="text"
          value={letter}
          onChange={(e) => setLetter(e.target.value.slice(0, 2))}
          maxLength={2}
          placeholder="أ"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-black placeholder-white/25 focus:outline-none focus:border-blue-500/60 transition-all"
          style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
        />
        <p className="text-xs text-white/30 mt-1 text-center">اكتب حرفاً أو حرفين (مثال: غ أو رك)</p>
      </div>

      {/* Step 2 — الشكل */}
      <div>
        <p className="text-sm font-bold text-white/70 mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black ml-1.5">٢</span>
          الشكل
        </p>
        <div className="grid grid-cols-5 gap-2">
          {SHAPES.map((s) => (
            <ShapePreview
              key={s.id}
              shape={s.id}
              selected={shape === s.id}
              onClick={() => setShape(s.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 3 — اللون */}
      <div>
        <p className="text-sm font-bold text-white/70 mb-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black ml-1.5">٣</span>
          اللون
        </p>
        <div className="grid grid-cols-6 gap-2">
          {GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGradientId(g.id)}
              title={g.label}
              className={`h-8 rounded-lg border-2 transition-all ${
                gradientId === g.id
                  ? 'border-white scale-110 shadow-lg'
                  : 'border-transparent hover:border-white/40'
              }`}
              style={{
                background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="flex flex-col items-center gap-3 py-4">
        <p className="text-sm font-bold text-white/50">معاينة</p>
        <motion.div
          key={`${letter}-${shape}-${gradientId}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          dangerouslySetInnerHTML={{ __html: previewSvg }}
          className="rounded-2xl overflow-hidden shadow-2xl"
        />
        <p className="text-xs text-white/30">يتحدث فورياً مع كل تغيير</p>
      </div>

      {/* Save button */}
      <motion.button
        type="button"
        onClick={handleSave}
        disabled={saving || !letter.trim()}
        whileTap={{ scale: 0.97 }}
        className="w-full py-3.5 rounded-xl font-black text-white bg-gradient-to-l from-blue-700 to-blue-500 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
      >
        <Download size={18} />
        {saving ? 'جاري الحفظ...' : 'حفظ الشعار'}
      </motion.button>

      {/* Hidden canvas for PNG conversion */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
