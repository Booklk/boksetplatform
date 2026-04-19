/**
 * Interactive 6-step vendor onboarding wizard.
 * Route: /vendor/wizard
 *
 * Steps:
 *  1 – اسم مشروعك
 *  2 – نوع نشاطك
 *  3 – شعارك وهويتك (LogoGenerator)
 *  4 – رقم الواتساب
 *  5 – أول خدمة
 *  6 – انتهيت 🎉
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Upload, Palette } from 'lucide-react';
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
}

const TOTAL_STEPS = 7;

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

// ─── Step 6: انتهيت 🎉 ────────────────────────────────────────────────────────

function Step6({ nameAr, slug }: { nameAr: string; slug: string }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const storeUrl = `jdawil.sa/store/${slug || 'your-store'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${storeUrl}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `مرحباً! يسعدنا خدمتكم في ${nameAr} 🚗✨\nاحجز الآن عبر: https://${storeUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6 text-center relative overflow-hidden">
      {/* CSS confetti */}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall linear infinite;
          pointer-events: none;
        }
      `}</style>
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            left: `${(i * 5 + 3) % 100}%`,
            top: '-20px',
            backgroundColor: ['#3B82F6', '#22D3EE', '#22C55E', '#EAB308', '#A855F7'][i % 5],
            animationDuration: `${2 + (i % 5) * 0.4}s`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}

      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
        className="relative z-10 flex justify-center mb-2"
      >
        <svg width="96" height="96" viewBox="0 0 100 100" fill="none">
          <motion.circle
            cx="50" cy="50" r="44"
            stroke="#22C55E" strokeWidth="5" fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          />
          <motion.path
            d="M30 50 L44 64 L70 38"
            stroke="#22C55E" strokeWidth="6"
            strokeLinecap="round" strokeLinejoin="round" fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative z-10 space-y-2"
      >
        <h2 className="text-3xl font-black text-white">مشروعك جاهز! 🎉</h2>
        <p className="text-white/40">
          {nameAr ? `أهلاً بـ ${nameAr} في منصة ركيزة` : 'أهلاً بك في منصة ركيزة'}
        </p>
      </motion.div>

      {/* Store link */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
      >
        <p className="text-xs text-white/40 mb-1">رابط متجرك</p>
        <p className="text-blue-300 font-mono text-sm font-bold break-all">{storeUrl}</p>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="relative z-10 space-y-3"
      >
        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-3.5 rounded-xl font-black text-white bg-white/10 border border-white/15 hover:bg-white/15 transition-colors flex items-center justify-center gap-2"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'تم النسخ!' : '📋 انسخ الرابط'}
        </button>

        <button
          type="button"
          onClick={handleWhatsApp}
          className="w-full py-3.5 rounded-xl font-black text-white bg-green-600/80 border border-green-500/30 hover:bg-green-600 transition-colors"
        >
          💬 شارك على واتساب
        </button>

        <button
          type="button"
          onClick={() => navigate('/vendor/dashboard')}
          className="w-full py-3.5 rounded-xl font-black text-white bg-gradient-to-l from-blue-700 to-blue-500 shadow-lg"
        >
          🚀 اذهب للوحة التحكم
        </button>
      </motion.div>
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
  });

  const { user } = useAuth();
  const vendorId = user?.vendorId;

  const patch = (update: Partial<WizardState>) =>
    setState((prev) => ({ ...prev, ...update }));

  const goNext = useCallback(async (extraPatch?: Partial<WizardState>) => {
    if (extraPatch) patch(extraPatch);

    // API calls on specific steps
    if (step === 2 && (extraPatch?.logoUrl || state.logoUrl) && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, {
          logoUrl: extraPatch?.logoUrl ?? state.logoUrl,
        });
      } catch {/* best-effort */}
    }

    if (step === 3 && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, {
          phone: extraPatch?.whatsapp ?? state.whatsapp,
        });
      } catch {/* best-effort */}
    }

    // On arriving at step 6, save name + wash type
    if (step === 4 && vendorId) {
      try {
        await api.put(`/vendors/${vendorId}`, {
          nameAr: state.nameAr,
          washType: (extraPatch?.washTypes ?? state.washTypes)?.[0] ?? state.washTypes?.[0],
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
                  <Step6 nameAr={state.nameAr} slug={slug} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
