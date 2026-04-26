/**
 * Interactive vendor onboarding wizard.
 * Route: /vendor/wizard
 *
 * Steps:
 *  1 – اسم مشروعك
 *  2 – نوع نشاطك
 *  3 – شعارك وهويتك (LogoGenerator)
 *  4 – رقم الواتساب
 *  5 – أول خدمة
 *  6 – ساعات العمل
 *  7 – طريقة الدفع
 *  8 – جاهز للبدء (مع قائمة الناقص)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Check, Upload, Palette, Clock, CreditCard, ChevronLeft,
  Calendar, MapPin, Users, MessageCircle, BarChart3, FileText,
  Receipt, Gift, Tag, UserPlus, Bell, Repeat, Briefcase, ShoppingBag,
  Zap, Award, TrendingUp, Settings as SettingsIcon, ArrowLeft,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import LogoGenerator from '../../components/LogoGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  nameAr: string;
  washTypes: string[];
  logoUrl: string;
  whatsapp: string;
  serviceName: string;
  servicePrice: string;
  workingDays: number[];
  startTime: string;
  endTime: string;
  acceptCash: boolean;
  acceptCard: boolean;
}

const TOTAL_STEPS = 8;

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100);
  return (
    <div className="w-full px-6 pt-5 pb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-white/40">
          خطوة {step + 1} من {TOTAL_STEPS}
        </span>
        <span className="text-xs font-bold text-blue-400">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-l from-blue-500 to-cyan-400 rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Nav Buttons ──────────────────────────────────────────────────────────────

function NavButtons({
  step,
  onPrev,
  onNext,
  nextLabel = 'التالي',
  nextDisabled = false,
  loading = false,
}: {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-4">
      {step > 0 && step < TOTAL_STEPS - 1 && (
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 py-3.5 rounded-xl font-bold text-white/60 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
        >
          السابق
        </button>
      )}
      {step < TOTAL_STEPS - 1 && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="flex-1 py-3.5 rounded-xl font-black text-white bg-gradient-to-l from-blue-700 to-blue-500 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {loading ? 'جاري الحفظ...' : nextLabel}
        </button>
      )}
    </div>
  );
}

// ─── Step 1: اسم مشروعك ───────────────────────────────────────────────────────

function Step1({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const canNext = value.trim().length > 0;
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-3">🏪</div>
        <h2 className="text-2xl font-black text-white">ما اسم مشروعك؟</h2>
        <p className="text-white/40 text-sm">هذا ما سيراه عملاؤك</p>
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="مثال: مثال: صالون الأناقة، شركة النظافة"
        autoFocus
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-xl text-center font-bold placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all"
        style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
        onKeyDown={(e) => e.key === 'Enter' && canNext && onNext()}
      />

      {value.trim() && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3 text-center"
        >
          <p className="text-blue-300 text-sm font-bold">
            مرحباً بك في{' '}
            <span className="text-white">{value.trim()}</span>
          </p>
        </motion.div>
      )}

      <NavButtons step={0} onPrev={() => {}} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

// ─── Step 2: نوع نشاطك ────────────────────────────────────────────────────────

const WASH_TYPES = [
  { id: 'bike', emoji: '🏍️', label: 'خدمة متنقلة (بايك)', badge: 'الأكثر شيوعاً' },
  { id: 'car', emoji: '🚗', label: 'خدمة متنقلة (سيارة)', badge: '' },
  { id: 'fixed', emoji: '🏪', label: 'موقع ثابت (محل/مكتب)', badge: '' },
];

function Step2({
  selected,
  onToggle,
  onPrev,
  onNext,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const canNext = selected.length > 0;
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-3">🚗</div>
        <h2 className="text-2xl font-black text-white">نوع نشاطك</h2>
        <p className="text-white/40 text-sm">يمكنك اختيار أكثر من نوع</p>
      </div>

      <div className="space-y-3">
        {WASH_TYPES.map((t) => {
          const active = selected.includes(t.id);
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggle(t.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-right transition-all ${
                active
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <span className="text-3xl">{t.emoji}</span>
              <div className="flex-1">
                <p className={`font-black text-base ${active ? 'text-white' : 'text-white/70'}`}>
                  {t.label}
                </p>
                {t.badge && (
                  <span className="text-xs text-blue-400 font-bold">{t.badge}</span>
                )}
              </div>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  active ? 'border-blue-500 bg-blue-500' : 'border-white/20'
                }`}
              >
                {active && <Check size={13} className="text-white" />}
              </div>
            </motion.button>
          );
        })}
      </div>

      <NavButtons step={1} onPrev={onPrev} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

// ─── Step 3: شعارك وهويتك ─────────────────────────────────────────────────────

function Step3({
  nameAr,
  logoUrl,
  onLogoSave,
  onPrev,
  onNext,
  onSkip,
}: {
  nameAr: string;
  logoUrl: string;
  onLogoSave: (url: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<'choose' | 'generate' | 'upload'>('choose');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('الحد الأقصى 2 ميغابايت'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onLogoSave(dataUrl);
      setMode('choose');
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-3">🎨</div>
        <h2 className="text-2xl font-black text-white">شعارك وهويتك</h2>
        <p className="text-white/40 text-sm">ارفع شعارك أو أنشئ واحداً في ثوانٍ</p>
      </div>

      {logoUrl ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-3 py-3"
        >
          <img src={logoUrl} alt="الشعار" className="w-24 h-24 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-lg" />
          <p className="text-green-400 text-sm font-bold flex items-center gap-1"><Check size={14} /> تم حفظ الشعار</p>
          <button type="button" onClick={() => { onLogoSave(''); setMode('choose'); }} className="text-xs text-white/40 underline">تغيير الشعار</button>
          <NavButtons step={2} onPrev={onPrev} onNext={onNext} />
        </motion.div>
      ) : mode === 'choose' ? (
        <div className="space-y-3">
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:border-indigo-500/40 text-right transition-all">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center"><Upload className="w-5 h-5 text-indigo-400" /></div>
            <div><p className="font-bold text-white">رفع شعار جاهز</p><p className="text-xs text-slate-500">PNG أو JPG — أقصى 2 ميغابايت</p></div>
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileUpload} className="hidden" />

          <button onClick={() => setMode('generate')}
            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:border-indigo-500/40 text-right transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center"><Palette className="w-5 h-5 text-purple-400" /></div>
            <div><p className="font-bold text-white">أنشئ شعار الآن</p><p className="text-xs text-slate-500">اختر تصميم وألوان — جاهز بثوانٍ</p></div>
          </button>

          <NavButtons step={2} onPrev={onPrev} onNext={onSkip} nextLabel="تخطي" />
        </div>
      ) : mode === 'generate' ? (
        <div>
          <button onClick={() => setMode('choose')} className="text-xs text-indigo-400 mb-3">← رجوع</button>
          <LogoGenerator initialLetter={nameAr?.charAt(0) ?? ''} onSave={(url) => { onLogoSave(url); setMode('choose'); }} />
          <NavButtons step={2} onPrev={onPrev} onNext={onSkip} nextLabel="تخطي" />
        </div>
      ) : null}
    </div>
  );
}

// ─── Step 4: رقم الواتساب ─────────────────────────────────────────────────────

function Step4({
  value,
  onChange,
  onPrev,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isValid = value.trim().startsWith('05') && value.trim().length >= 10;
  const canNext = isValid;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-3">📱</div>
        <h2 className="text-2xl font-black text-white">رقم الواتساب</h2>
        <p className="text-white/40 text-sm">ستصلك إشعارات كل حجز وتأكيد على هذا الرقم</p>
      </div>

      <div className="flex gap-2 items-center">
        <div className="flex items-center gap-1.5 px-3 py-4 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-white/60 shrink-0">
          <span>🇸🇦</span>
          <span>+966</span>
        </div>
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="05xxxxxxxx"
          autoFocus
          dir="ltr"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-lg font-bold placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all tracking-widest"
          onKeyDown={(e) => e.key === 'Enter' && canNext && onNext()}
        />
      </div>

      {value.length > 0 && !isValid && (
        <p className="text-rose-400 text-xs font-bold text-center">
          يجب أن يبدأ الرقم بـ 05 ويكون 10 أرقام
        </p>
      )}

      <NavButtons step={3} onPrev={onPrev} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

// ─── Step 5: أول خدمة ────────────────────────────────────────────────────────

const SERVICE_PRESETS = [
  { name: 'غسيل خارجي', price: '30' },
  { name: 'غسيل كامل', price: '60' },
  { name: 'تلميع', price: '120' },
];

function Step5({
  nameAr: _nameAr,
  onPrev,
  onNext,
}: {
  nameAr: string;
  onPrev: () => void;
  onNext: (name: string, price: string) => void;
}) {
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const canNext = serviceName.trim().length > 0 && servicePrice.trim().length > 0;

  const handleNext = async () => {
    if (!canNext) return;
    setLoading(true);
    try {
      await api.post('/services', {
        nameAr: serviceName.trim(),
        price: parseFloat(servicePrice),
        vendorId: user?.vendorId,
      });
    } catch {
      // best-effort
    } finally {
      setLoading(false);
      onNext(serviceName, servicePrice);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="text-4xl mb-3">💧</div>
        <h2 className="text-2xl font-black text-white">أضف أول خدمة</h2>
        <p className="text-white/40 text-sm">حتى يبدأ عملاؤك بالحجز</p>
      </div>

      {/* Quick presets */}
      <div>
        <p className="text-xs font-bold text-white/40 mb-2">اختر بسرعة:</p>
        <div className="flex gap-2 flex-wrap">
          {SERVICE_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { setServiceName(p.name); setServicePrice(p.price); }}
              className="px-3 py-1.5 rounded-lg text-sm font-bold border border-white/15 bg-white/5 text-white/60 hover:border-blue-500/60 hover:text-blue-300 transition-all"
            >
              {p.name} — {p.price} ر
            </button>
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-3">
        <input
          type="text"
          value={serviceName}
          onChange={(e) => setServiceName(e.target.value)}
          placeholder="اسم الخدمة"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all"
          style={{ fontFamily: 'Cairo, Arial, sans-serif' }}
        />
        <div className="relative">
          <input
            type="number"
            value={servicePrice}
            onChange={(e) => setServicePrice(e.target.value)}
            placeholder="السعر"
            min={0}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white font-bold placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all pl-14"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold text-sm">ر.س</span>
        </div>
      </div>

      <NavButtons
        step={4}
        onPrev={onPrev}
        onNext={handleNext}
        nextDisabled={!canNext}
        loading={loading}
        nextLabel="إضافة الخدمة"
      />
    </div>
  );
}

// ─── Step 6: ساعات العمل ──────────────────────────────────────────────────────

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function StepHours({
  workingDays,
  startTime,
  endTime,
  onPatch,
  onPrev,
  onNext,
}: {
  workingDays: number[];
  startTime: string;
  endTime: string;
  onPatch: (p: { workingDays?: number[]; startTime?: string; endTime?: string }) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const toggleDay = (d: number) => {
    onPatch({
      workingDays: workingDays.includes(d)
        ? workingDays.filter((x) => x !== d)
        : [...workingDays, d].sort(),
    });
  };
  const canNext = workingDays.length > 0 && startTime && endTime && startTime < endTime;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <Clock className="w-10 h-10 text-orange-400 mx-auto mb-3" />
        <h2 className="text-2xl font-black text-white">متى يقدر العميل يحجز؟</h2>
        <p className="text-white/40 text-sm">حدّد أيام عملك وساعات الدوام</p>
      </div>

      <div>
        <p className="text-xs font-bold text-white/40 mb-3">أيام العمل</p>
        <div className="grid grid-cols-4 gap-2">
          {AR_DAYS.map((day, i) => {
            const active = workingDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                  active
                    ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                    : 'border-white/10 bg-white/5 text-white/40'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold text-white/40 mb-2">بداية الدوام</p>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onPatch({ startTime: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-sm focus:outline-none focus:border-orange-500/60"
          />
        </div>
        <div>
          <p className="text-xs font-bold text-white/40 mb-2">نهاية الدوام</p>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onPatch({ endTime: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white font-bold text-sm focus:outline-none focus:border-orange-500/60"
          />
        </div>
      </div>

      <NavButtons step={5} onPrev={onPrev} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

// ─── Step 7: طريقة الدفع ─────────────────────────────────────────────────────

function StepPayment({
  acceptCash,
  acceptCard,
  onPatch,
  onPrev,
  onNext,
}: {
  acceptCash: boolean;
  acceptCard: boolean;
  onPatch: (p: { acceptCash?: boolean; acceptCard?: boolean }) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const canNext = acceptCash || acceptCard;
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <CreditCard className="w-10 h-10 text-orange-400 mx-auto mb-3" />
        <h2 className="text-2xl font-black text-white">كيف يدفع العميل؟</h2>
        <p className="text-white/40 text-sm">اختر طرق الدفع المتاحة — تقدر تضيف أكثر لاحقاً</p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPatch({ acceptCash: !acceptCash })}
          className={`w-full p-4 rounded-2xl border-2 text-right transition-all ${
            acceptCash ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-white text-sm">كاش عند الاستلام</p>
              <p className="text-xs text-white/40 mt-0.5">يدفع العميل عند وصول الخدمة — بدون أي إعداد</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              acceptCash ? 'border-orange-500 bg-orange-500' : 'border-white/20'
            }`}>
              {acceptCash && <Check size={12} className="text-white" />}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPatch({ acceptCard: !acceptCard })}
          className={`w-full p-4 rounded-2xl border-2 text-right transition-all ${
            acceptCard ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-white text-sm">بطاقة / مدى / Apple Pay / STC Pay</p>
              <p className="text-xs text-white/40 mt-0.5">تحتاج ربط Moyasar — تقدر تضيف المفتاح بعدين من الإعدادات</p>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              acceptCard ? 'border-orange-500 bg-orange-500' : 'border-white/20'
            }`}>
              {acceptCard && <Check size={12} className="text-white" />}
            </div>
          </div>
        </button>
      </div>

      <NavButtons step={6} onPrev={onPrev} onNext={onNext} nextDisabled={!canNext} />
    </div>
  );
}

// ─── Step 8: جاهز للبدء (مع قائمة الناقص) ─────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  path: string;
  desc: string;
  optional?: boolean;
}
interface ChecklistResponse {
  steps: ChecklistItem[];
  completedCount: number;
  totalSteps: number;
  percent: number;
  isComplete: boolean;
}

// ─── Feature showcase data ────────────────────────────────────────────────────

interface Feature {
  icon: React.ElementType;
  label: string;
  desc: string;
  path: string;
}

const FEATURE_CATEGORIES: Array<{ title: string; features: Feature[] }> = [
  {
    title: 'إدارة العمليات اليومية',
    features: [
      { icon: Calendar,    label: 'الجدول الزمني',     desc: 'مواعيد وحجوزات حسب الساعة',          path: '/vendor/schedule' },
      { icon: Users,       label: 'طابور الانتظار',    desc: 'للعملاء الحاضرين بدون موعد',         path: '/vendor/queue' },
      { icon: MapPin,      label: 'GPS مباشر',         desc: 'موقع الموظفين والمركبات لحظياً',      path: '/vendor/livemap' },
      { icon: Repeat,      label: 'التوزيع الذكي',     desc: 'يربط الحجز بأقرب موظف متاح تلقائياً', path: '/vendor/dispatch' },
    ],
  },
  {
    title: 'الحجوزات والعملاء',
    features: [
      { icon: MessageCircle, label: 'تأكيدات واتساب',   desc: 'تأكيد + تذكير + متابعة بعد الخدمة',   path: '/vendor/settings?tab=integrations' },
      { icon: UserPlus,    label: 'إدارة العملاء (CRM)', desc: 'بيانات + سجل + شرائح + ملاحظات',     path: '/vendor/crm' },
      { icon: Zap,         label: 'الأتمتة التسويقية',  desc: 'رسائل تلقائية حسب سلوك العميل',       path: '/vendor/automations' },
      { icon: Award,       label: 'تقييمات + مراجعات', desc: 'قياس الرضا وروابط Google',            path: '/vendor/ratings' },
    ],
  },
  {
    title: 'المال والمحاسبة',
    features: [
      { icon: ShoppingBag, label: 'نقطة البيع',         desc: 'كاشير سريع للمبيعات الفورية',         path: '/vendor/pos' },
      { icon: Receipt,     label: 'فواتير PDF',         desc: 'فواتير تلقائية بضريبة القيمة المضافة', path: '/vendor/invoices' },
      { icon: FileText,    label: 'تقارير مالية',        desc: 'دخل + مصروف + هامش ربح',              path: '/vendor/financial-statements' },
      { icon: Briefcase,   label: 'الرواتب',            desc: 'حساب الرواتب + العمولات + التقييم',   path: '/vendor/payroll' },
    ],
  },
  {
    title: 'النمو والتسويق',
    features: [
      { icon: Tag,         label: 'أكواد خصم',          desc: 'كوبونات نسبية أو ثابتة بشروط مرنة',   path: '/vendor/promos' },
      { icon: Gift,        label: 'بطاقات هدايا',       desc: 'يبيعها العميل لشخص آخر برصيد محدد',   path: '/vendor/gift-cards' },
      { icon: Award,       label: 'برنامج ولاء',         desc: 'نقاط ومستويات للعملاء المتكررين',     path: '/vendor/branding' },
      { icon: TrendingUp,  label: 'حملات واتساب',       desc: 'بث رسائل لشريحة محددة من العملاء',    path: '/vendor/campaigns' },
    ],
  },
  {
    title: 'التحليلات والرقابة',
    features: [
      { icon: BarChart3,   label: 'لوحة تحكم ذكية',     desc: 'مؤشرات أداء فورية لكل ما يحدث',        path: '/vendor/dashboard' },
      { icon: TrendingUp,  label: 'تحليلات متقدمة',     desc: 'اتجاهات + مقارنات + توقعات',           path: '/vendor/advanced-analytics' },
      { icon: Award,       label: 'أداء الموظفين',       desc: 'إنتاجية + تقييمات + مكافآت',           path: '/vendor/employee-performance' },
      { icon: Bell,        label: 'إشعارات لحظية',      desc: 'تنبيهات فورية بكل حدث مهم',            path: '/vendor/notifications' },
    ],
  },
];

function StepDone({ nameAr, slug }: { nameAr: string; slug: string }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const storeUrl = `${window.location.host}/store/${slug || 'your-store'}`;

  const { data: checklist, isLoading } = useQuery<ChecklistResponse>({
    queryKey: ['setup-checklist'],
    queryFn: () => api.get('/vendors/setup-checklist').then((r) => r.data),
    refetchOnWindowFocus: false,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${storeUrl}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const remaining = (checklist?.steps ?? []).filter((s) => !s.done && !s.optional);
  const isComplete = checklist?.isComplete ?? false;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-orange-500/15 items-center justify-center mb-2">
          <Check className="w-6 h-6 text-orange-400" />
        </div>
        <h2 className="text-2xl font-black text-white">
          {isComplete ? 'متجرك جاهز للحجوزات' : 'تم إنشاء حسابك'}
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
          {isComplete
            ? `أهلاً ${nameAr} — كل شي مهيأ. شارك رابط متجرك مع عملائك ليبدؤوا الحجز.`
            : `أهلاً ${nameAr || ''} — أكمل الخطوات أدناه ليصبح متجرك جاهزاً لاستقبال أول حجز.`}
        </p>
      </div>

      {/* Progress bar */}
      {checklist && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/60">جاهزية المتجر</span>
            <span className="text-sm font-black text-orange-400">{checklist.percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${checklist.percent}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-orange-500 rounded-full"
            />
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            {checklist.completedCount} من {checklist.totalSteps} خطوات أساسية
          </p>
        </div>
      )}

      {/* Store URL */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-xs font-bold text-white/40 mb-2">رابط متجرك</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm text-orange-300 truncate">{storeUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'تم النسخ' : 'نسخ'}
          </button>
        </div>
      </div>

      {/* Remaining checklist (only if not complete) */}
      {!isComplete && !isLoading && remaining.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-white/60 px-1">الخطوات المتبقية:</p>
          {remaining.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className="w-full text-right p-3.5 rounded-xl bg-white/5 border border-white/10 hover:border-orange-500/40 hover:bg-orange-500/5 transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{item.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">{item.desc}</p>
                </div>
                <ChevronLeft className="w-4 h-4 text-white/30 flex-shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Features showcase — what the platform actually does */}
      <div className="border-t border-white/8 pt-6">
        <button
          type="button"
          onClick={() => setShowFeatures(!showFeatures)}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 transition-all"
        >
          <div className="text-right">
            <p className="text-sm font-black text-white">ماذا تستطيع أن تفعل بمتجرك؟</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {FEATURE_CATEGORIES.reduce((n, c) => n + c.features.length, 0)} ميزة جاهزة في {FEATURE_CATEGORIES.length} فئات
            </p>
          </div>
          <motion.div animate={{ rotate: showFeatures ? -90 : 0 }}>
            <ChevronLeft className="w-5 h-5 text-white/40" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {showFeatures && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-5 pt-5">
                {FEATURE_CATEGORIES.map((cat) => (
                  <div key={cat.title}>
                    <p className="text-xs font-black text-orange-400 mb-2.5 px-1">{cat.title}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.features.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => navigate(f.path)}
                          className="text-right p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 hover:border-orange-500/30 transition-all flex items-start gap-3"
                        >
                          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                            <f.icon size={16} className="text-orange-400" />
                          </div>
                          <div className="flex-1 min-w-0 text-right">
                            <p className="text-sm font-bold text-white truncate">{f.label}</p>
                            <p className="text-[11px] text-white/40 leading-snug mt-0.5">{f.desc}</p>
                          </div>
                          <ArrowLeft size={12} className="text-white/20 flex-shrink-0 mt-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => navigate('/vendor/dashboard')}
        className="w-full py-3.5 rounded-xl font-black text-white bg-orange-500 hover:bg-orange-400 transition-colors"
      >
        اذهب للوحة التحكم
      </button>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
};

export default function VendorWizard() {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const dirRef = useRef(1);

  const [state, setState] = useState<WizardState>({
    nameAr: '',
    washTypes: [],
    logoUrl: '',
    whatsapp: '',
    serviceName: '',
    servicePrice: '',
    workingDays: [0, 1, 2, 3, 4, 6], // كل الأيام عدا الجمعة افتراضياً
    startTime: '09:00',
    endTime: '22:00',
    acceptCash: true,
    acceptCard: false,
  });

  const { user } = useAuth();
  const vendorId = user?.vendorId;

  const patch = (update: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...update }));

  const goNext = useCallback(async (extraPatch?: Partial<WizardState>) => {
    if (extraPatch) patch(extraPatch);
    const merged = { ...state, ...(extraPatch ?? {}) };

    if (step === 2 && merged.logoUrl && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, { logoUrl: merged.logoUrl });
      } catch {/* best-effort */}
    }

    if (step === 3 && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, { phone: merged.whatsapp });
      } catch {/* best-effort */}
    }

    if (step === 4 && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, {
          nameAr: merged.nameAr,
          washType: merged.washTypes?.[0],
        });
      } catch {/* best-effort */}
    }

    // Step 5 → 6: save working hours
    if (step === 5 && vendorId) {
      try {
        await api.put('/appointments/config', {
          workingDays: merged.workingDays,
          startTime: merged.startTime,
          endTime: merged.endTime,
          slotDurationMin: 30,
          carsPerSlot: 2,
          advanceBookingDays: 14,
          isAppointmentMode: true,
        });
      } catch {/* best-effort */}
    }

    // Step 6 → 7: save payment preferences in vendor.settings
    if (step === 6 && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, {
          settings: { acceptCash: merged.acceptCash, acceptCard: merged.acceptCard },
        });
      } catch {/* best-effort */}
    }

    dirRef.current = 1;
    setDir(1);
    setStep((s) => s + 1);
  }, [step, state, vendorId]);

  const goPrev = useCallback(() => {
    dirRef.current = -1;
    setDir(-1);
    setStep((s) => s - 1);
  }, []);

  const toggleWashType = (id: string) => {
    patch({
      washTypes: state.washTypes.includes(id)
        ? state.washTypes.filter((t) => t !== id)
        : [...state.washTypes, id],
    });
  };

  const slug = user?.vendorId ? String(user.vendorId) : 'store';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#030711', fontFamily: 'Cairo, Arial, sans-serif' }}
      dir="rtl"
    >
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-blue-600/8 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-cyan-500/6 blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col max-w-lg mx-auto w-full">
        {/* Progress */}
        <ProgressBar step={step} />

        {/* Card */}
        <div className="flex-1 flex items-center px-5 pb-8">
          <div className="w-full bg-white/3 border border-white/8 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
            <AnimatePresence custom={dir} mode="wait">
              <motion.div
                key={step}
                custom={dirRef.current}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              >
                {step === 0 && (
                  <Step1
                    value={state.nameAr}
                    onChange={(v) => patch({ nameAr: v })}
                    onNext={() => goNext()}
                  />
                )}
                {step === 1 && (
                  <Step2
                    selected={state.washTypes}
                    onToggle={toggleWashType}
                    onPrev={goPrev}
                    onNext={() => goNext()}
                  />
                )}
                {step === 2 && (
                  <Step3
                    nameAr={state.nameAr}
                    logoUrl={state.logoUrl}
                    onLogoSave={(url) => patch({ logoUrl: url })}
                    onPrev={goPrev}
                    onNext={() => goNext()}
                    onSkip={() => goNext()}
                  />
                )}
                {step === 3 && (
                  <Step4
                    value={state.whatsapp}
                    onChange={(v) => patch({ whatsapp: v })}
                    onPrev={goPrev}
                    onNext={() => goNext()}
                  />
                )}
                {step === 4 && (
                  <Step5
                    nameAr={state.nameAr}
                    onPrev={goPrev}
                    onNext={(name, price) => goNext({ serviceName: name, servicePrice: price })}
                  />
                )}
                {step === 5 && (
                  <StepHours
                    workingDays={state.workingDays}
                    startTime={state.startTime}
                    endTime={state.endTime}
                    onPatch={(p) => patch(p)}
                    onPrev={goPrev}
                    onNext={() => goNext()}
                  />
                )}
                {step === 6 && (
                  <StepPayment
                    acceptCash={state.acceptCash}
                    acceptCard={state.acceptCard}
                    onPatch={(p) => patch(p)}
                    onPrev={goPrev}
                    onNext={() => goNext()}
                  />
                )}
                {step === 7 && (
                  <StepDone nameAr={state.nameAr} slug={slug} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
