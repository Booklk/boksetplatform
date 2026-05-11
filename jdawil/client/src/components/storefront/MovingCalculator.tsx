/**
 * MovingCalculator — lead-magnet for movers templates.
 * Renders on /store/:slug when the vendor is a mover (industry ===
 * 'movers'). Collects from/to, rooms, floor, and needs, then opens
 * WhatsApp with a pre-filled quote request.
 *
 * No server dependency — the goal is conversion speed. The quote
 * goes to the vendor on WhatsApp exactly like the existing "اطلب
 * عرض سعر" button, but with richer detail.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Truck, MapPin, Home, ArrowLeft } from 'lucide-react';
import { CustomTheme, RADIUS_VALUES } from '../../lib/customTheme';

interface MovingCalculatorProps {
  whatsappUrl: string;
  customTheme: CustomTheme;
}

const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'الأحساء', 'الطائف', 'أبها', 'تبوك', 'بريدة'];

export default function MovingCalculator({ whatsappUrl, customTheme }: MovingCalculatorProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rooms, setRooms] = useState('3');
  const [floor, setFloor] = useState('1');
  const [hasPacking, setHasPacking] = useState(true);
  const [hasElevator, setHasElevator] = useState(true);
  const [notes, setNotes] = useState('');

  const radius = RADIUS_VALUES[customTheme.radius];
  const sameCity = from && to && from === to;

  // Rough indicative estimate so the customer sees a number. The real
  // quote still comes from the vendor via WhatsApp.
  const estimate = useMemo(() => {
    if (!from || !to) return null;
    const base = sameCity ? 600 : 1800;
    const perRoom = sameCity ? 120 : 300;
    const packingAdd = hasPacking ? (sameCity ? 200 : 500) : 0;
    const floorAdd = hasElevator ? 0 : Math.max(0, (Number(floor) || 0) - 1) * 80;
    const total = base + Number(rooms) * perRoom + packingAdd + floorAdd;
    const low = Math.round((total * 0.9) / 50) * 50;
    const high = Math.round((total * 1.15) / 50) * 50;
    return { low, high };
  }, [from, to, rooms, floor, hasPacking, hasElevator, sameCity]);

  const canSubmit = from && to && rooms;

  function handleSubmit() {
    const parts = [
      'مرحباً، أرغب في طلب عرض سعر لنقل عفش.',
      '',
      `📍 من: ${from}`,
      `📍 إلى: ${to}`,
      `🏠 عدد الغرف: ${rooms}`,
      `🏢 الدور: ${floor}${hasElevator ? ' (يوجد مصعد)' : ' (بدون مصعد)'}`,
      `📦 تعبئة وتغليف: ${hasPacking ? 'نعم' : 'لا'}`,
      notes ? `\n📝 ملاحظات: ${notes}` : '',
      estimate ? `\n💰 التقدير الأولي: ${estimate.low}–${estimate.high} ر.س (تقريبي)` : '',
    ].filter(Boolean).join('\n');

    const url = `${whatsappUrl}${whatsappUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent(parts)}`;
    window.open(url, '_blank', 'noopener');
  }

  return (
    <section className="max-w-3xl mx-auto px-5 py-10" dir="rtl">
      <div className="flex items-center gap-2 mb-5">
        <Truck size={18} style={{ color: customTheme.accent }} />
        <h2 className="text-base font-black" style={{ color: customTheme.text }}>
          احسب تكلفة نقل عفشك
        </h2>
        <span className="text-[10px] opacity-60 mr-auto" style={{ color: customTheme.text }}>
          تقدير أولي فوري
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="p-5 border"
        style={{
          background: customTheme.surface,
          borderRadius: radius,
          borderColor: `${customTheme.accent}22`,
        }}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          {/* From city */}
          <label className="block">
            <span className="text-xs font-bold opacity-70 mb-1 flex items-center gap-1.5" style={{ color: customTheme.text }}>
              <MapPin size={12} /> من مدينة
            </span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full p-2.5 text-sm outline-none border"
              style={{
                background: `${customTheme.bg}aa`,
                color: customTheme.text,
                borderColor: `${customTheme.accent}30`,
                borderRadius: radius,
              }}
            >
              <option value="">اختر المدينة</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* To city */}
          <label className="block">
            <span className="text-xs font-bold opacity-70 mb-1 flex items-center gap-1.5" style={{ color: customTheme.text }}>
              <MapPin size={12} /> إلى مدينة
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-2.5 text-sm outline-none border"
              style={{
                background: `${customTheme.bg}aa`,
                color: customTheme.text,
                borderColor: `${customTheme.accent}30`,
                borderRadius: radius,
              }}
            >
              <option value="">اختر المدينة</option>
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {/* Rooms */}
          <label className="block">
            <span className="text-xs font-bold opacity-70 mb-1 flex items-center gap-1.5" style={{ color: customTheme.text }}>
              <Home size={12} /> عدد الغرف
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
              className="w-full p-2.5 text-sm outline-none border"
              style={{
                background: `${customTheme.bg}aa`,
                color: customTheme.text,
                borderColor: `${customTheme.accent}30`,
                borderRadius: radius,
              }}
            />
          </label>

          {/* Floor */}
          <label className="block">
            <span className="text-xs font-bold opacity-70 mb-1" style={{ color: customTheme.text }}>
              الدور
            </span>
            <input
              type="number"
              min={0}
              max={50}
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="w-full p-2.5 text-sm outline-none border"
              style={{
                background: `${customTheme.bg}aa`,
                color: customTheme.text,
                borderColor: `${customTheme.accent}30`,
                borderRadius: radius,
              }}
            />
          </label>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-2 mt-3">
          <ToggleChip active={hasElevator} onChange={setHasElevator} label="يوجد مصعد" customTheme={customTheme} />
          <ToggleChip active={hasPacking} onChange={setHasPacking} label="تعبئة وتغليف" customTheme={customTheme} />
        </div>

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات إضافية (اختياري)"
          rows={2}
          className="w-full mt-3 p-2.5 text-sm outline-none border resize-none"
          style={{
            background: `${customTheme.bg}aa`,
            color: customTheme.text,
            borderColor: `${customTheme.accent}30`,
            borderRadius: radius,
          }}
        />

        {/* Estimate display */}
        {estimate && (
          <div
            className="mt-4 p-3 text-center border"
            style={{
              background: `${customTheme.accent}10`,
              borderColor: `${customTheme.accent}33`,
              borderRadius: radius,
            }}
          >
            <p className="text-[11px] opacity-70 mb-0.5" style={{ color: customTheme.text }}>
              التقدير الأولي
            </p>
            <p className="text-xl font-black" style={{ color: customTheme.accent }}>
              {estimate.low.toLocaleString('ar-SA')} – {estimate.high.toLocaleString('ar-SA')} ر.س
            </p>
            <p className="text-[10px] opacity-60 mt-1" style={{ color: customTheme.text }}>
              تقدير مبدئي — العرض النهائي من الشركة بعد التواصل
            </p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full mt-4 py-3 font-black text-white text-sm inline-flex items-center justify-center gap-2 transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ background: customTheme.button, borderRadius: radius }}
        >
          أرسل الطلب للشركة
          <ArrowLeft size={14} />
        </button>
        <p className="text-[10px] text-center mt-2 opacity-60" style={{ color: customTheme.text }}>
          يُفتح واتساب برسالة جاهزة — عدّلها قبل الإرسال إذا تحب
        </p>
      </motion.div>
    </section>
  );
}

function ToggleChip({
  active, onChange, label, customTheme,
}: { active: boolean; onChange: (v: boolean) => void; label: string; customTheme: CustomTheme }) {
  const radius = customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '4px' : '8px';
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className="px-3 py-1.5 text-xs font-bold border transition-colors"
      style={{
        background: active ? `${customTheme.accent}20` : 'transparent',
        borderColor: active ? `${customTheme.accent}55` : `${customTheme.text}20`,
        color: active ? customTheme.accent : customTheme.text,
        borderRadius: radius,
      }}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  );
}
