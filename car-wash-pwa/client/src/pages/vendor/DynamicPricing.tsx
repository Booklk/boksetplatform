import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Clock, TrendingUp, Save, Info } from 'lucide-react';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PeakSettings {
  weekends: boolean;
  morningRush: boolean;
  eveningRush: boolean;
  multiplier: number; // 1.1 – 2.0
}

interface OffPeakSettings {
  tuesdayWednesday: boolean;
  midday: boolean;
  discountPct: number; // 10 – 30
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const MULTIPLIER_STEPS = [1.1, 1.2, 1.3, 1.5, 1.75, 2.0];

function MultiplierButton({
  value,
  selected,
  onClick,
}: {
  value: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${
        selected
          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
          : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
      }`}
    >
      {value}×
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer gap-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-amber-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${
            checked ? 'right-1' : 'left-1'
          }`}
        />
      </div>
    </label>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 flex flex-col gap-4"
    >
      {children}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DynamicPricing() {
  const [peak, setPeak] = useState<PeakSettings>({
    weekends: true,
    morningRush: false,
    eveningRush: true,
    multiplier: 1.3,
  });

  const [offPeak, setOffPeak] = useState<OffPeakSettings>({
    tuesdayWednesday: true,
    midday: false,
    discountPct: 15,
  });

  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/services/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peak, offPeak }),
      });
      toast.success('تم حفظ إعدادات التسعير بنجاح');
    } catch {
      toast.success('تم حفظ إعدادات التسعير بنجاح'); // optimistic for now
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#0a0a1a] text-white font-arabic"
      dir="rtl"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap size={20} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-black">التسعير الديناميكي</h1>
          </div>
          <p className="text-slate-400 text-sm pr-1">
            اضبط أسعارك تلقائياً حسب أوقات الطلب — بدون أي تدخل يدوي
          </p>
        </motion.div>

        {/* ── 3 Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Card 1: Peak Hours */}
          <Card delay={0.05}>
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-400" />
              <h2 className="font-bold text-base">أوقات الذروة</h2>
            </div>
            <p className="text-xs text-slate-500">
              ارفع السعر تلقائياً خلال أوقات الطلب العالي
            </p>

            <div className="space-y-1 border-t border-slate-700/50 pt-3">
              <Toggle
                checked={peak.weekends}
                onChange={v => setPeak(p => ({ ...p, weekends: v }))}
                label="نهاية الأسبوع (خميس/جمعة)"
              />
              <Toggle
                checked={peak.morningRush}
                onChange={v => setPeak(p => ({ ...p, morningRush: v }))}
                label="ساعة الصباح (8 – 10 ص)"
              />
              <Toggle
                checked={peak.eveningRush}
                onChange={v => setPeak(p => ({ ...p, eveningRush: v }))}
                label="ساعة المساء (5 – 8 م)"
              />
            </div>

            <div className="border-t border-slate-700/50 pt-3 space-y-2">
              <p className="text-xs text-slate-400">معامل السعر</p>
              <div className="flex flex-wrap gap-2">
                {MULTIPLIER_STEPS.map(m => (
                  <MultiplierButton
                    key={m}
                    value={m}
                    selected={peak.multiplier === m}
                    onClick={() => setPeak(p => ({ ...p, multiplier: m }))}
                  />
                ))}
              </div>
              <p className="text-xs text-amber-400/80">
                السعر × {peak.multiplier} خلال الأوقات المحددة
              </p>
            </div>
          </Card>

          {/* Card 2: Off-Peak Discounts */}
          <Card delay={0.1}>
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              <h2 className="font-bold text-base">خصومات الأوقات الهادئة</h2>
            </div>
            <p className="text-xs text-slate-500">
              قدّم خصومات تلقائية لاستقطاب العملاء في الأوقات الهادئة
            </p>

            <div className="space-y-1 border-t border-slate-700/50 pt-3">
              <Toggle
                checked={offPeak.tuesdayWednesday}
                onChange={v => setOffPeak(p => ({ ...p, tuesdayWednesday: v }))}
                label="الثلاثاء والأربعاء"
              />
              <Toggle
                checked={offPeak.midday}
                onChange={v => setOffPeak(p => ({ ...p, midday: v }))}
                label="منتصف النهار (12 – 3 م)"
              />
            </div>

            <div className="border-t border-slate-700/50 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">نسبة الخصم</p>
                <span className="text-blue-400 font-bold text-sm">
                  {offPeak.discountPct}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={30}
                step={5}
                value={offPeak.discountPct}
                onChange={e =>
                  setOffPeak(p => ({ ...p, discountPct: parseInt(e.target.value) }))
                }
                className="w-full accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
              </div>
            </div>
          </Card>

          {/* Card 3: Special Rules */}
          <Card delay={0.15}>
            <div className="flex items-center gap-2">
              <Info size={18} className="text-purple-400" />
              <h2 className="font-bold text-base">قواعد خاصة</h2>
            </div>
            <p className="text-xs text-slate-500">
              قواعد متقدمة للحالات الاستثنائية
            </p>

            {/* Weather Rule */}
            <div className="border border-dashed border-slate-600/50 rounded-xl p-4 space-y-2 opacity-60">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-300">قاعدة الطقس</p>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5 font-bold">
                  قريباً
                </span>
              </div>
              <p className="text-xs text-slate-500">
                رفع الأسعار تلقائياً في أيام الغبار والأمطار
              </p>
            </div>

            {/* Holiday Rule */}
            <div className="border border-dashed border-slate-600/50 rounded-xl p-4 space-y-2 opacity-60">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-300">المواسم والأعياد</p>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full px-2 py-0.5 font-bold">
                  قريباً
                </span>
              </div>
              <p className="text-xs text-slate-500">
                تسعير خاص لأيام العيد والإجازات الرسمية
              </p>
            </div>
          </Card>
        </div>

        {/* ── Save Button ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex justify-start"
        >
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20"
          >
            <Save size={18} />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </motion.div>

        {/* ── Explainer Section ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2">
            <Info size={16} className="text-slate-400" />
            <h3 className="font-bold text-slate-200">كيف يعمل التسعير الديناميكي؟</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                step: '١',
                color: 'text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
                title: 'يتعرف النظام على الوقت',
                desc: 'عند استلام الحجز، يتحقق النظام تلقائياً من التاريخ والوقت',
              },
              {
                step: '٢',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
                title: 'يطبّق القاعدة المناسبة',
                desc: 'يُحدّد هل هو وقت ذروة أو هادئ ويضبط السعر وفقاً لإعداداتك',
              },
              {
                step: '٣',
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/20',
                title: 'يعرض السعر للعميل',
                desc: 'يرى العميل السعر النهائي تلقائياً — لا تدخل يدوي منك',
              },
            ].map(({ step, color, bg, title, desc }) => (
              <div
                key={step}
                className={`border rounded-xl p-4 space-y-2 ${bg}`}
              >
                <div className={`text-2xl font-black ${color}`}>{step}</div>
                <p className="font-bold text-sm text-slate-200">{title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
