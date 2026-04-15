import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  CheckCircle, ChevronLeft, ChevronRight, Sparkles, Building2,
  Phone, Mail, MapPin, MessageCircle,
  ArrowLeft, Check, Gift, Lock, User, Star,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface OnboardForm {
  ownerName: string;
  nameAr: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  plan: string;
  industry: string;
  washType: '' | 'bike' | 'car' | 'fixed';
  password: string;
}

const INDUSTRY_OPTIONS = [
  { id: 'car_wash', label: 'مغسلة سيارات', icon: '🚗' },
  { id: 'home_cleaning', label: 'تنظيف منازل', icon: '🏠' },
  { id: 'ac_maintenance', label: 'صيانة مكيفات', icon: '❄️' },
  { id: 'plumbing', label: 'سباكة', icon: '🔧' },
  { id: 'electrical', label: 'كهرباء', icon: '⚡' },
  { id: 'salon', label: 'صالون / حلاق', icon: '💈' },
  { id: 'beauty_home', label: 'تجميل منزلي / سبا', icon: '💄' },
  { id: 'freelancer', label: 'فري لانسر', icon: '💼' },
  { id: 'other', label: 'خدمات أخرى', icon: '⭐' },
];

const PLAN_TYPES = [
  {
    id: 'free',
    emoji: '🚀',
    nameAr: 'مجاني',
    desc: 'ابدأ بدون أي تكلفة',
    price: 0,
    color: 'from-slate-500 to-slate-400',
    border: 'border-slate-500/30',
    activeBorder: 'border-slate-400',
    features: ['موقع حجز خاص', 'حتى 30 حجز/شهر', 'إشعارات واتساب', '3 ثيمات'],
  },
  {
    id: 'pro',
    emoji: '⭐',
    nameAr: 'Pro',
    desc: 'كل شيء مفتوح — بدون حدود',
    price: 99,
    badge: '⭐ الأفضل قيمة',
    color: 'from-indigo-500 to-purple-500',
    border: 'border-indigo-500/30',
    activeBorder: 'border-indigo-400',
    features: ['حجوزات غير محدودة', 'موظفون غير محدودون', 'GPS + كاشير + مدفوعات', 'CRM + ولاء + AI', 'كل الثيمات (20)', 'تقارير VAT + رواتب'],
  },
];

const _DEPRECATED_PLAN_TYPES = [
  {
    id: 'branches_2_3',
    emoji: '🏪',
    nameAr: 'فروع (2-3)',
    desc: 'إدارة عدة فروع',
    price: 349,
    color: 'from-violet-500 to-purple-500',
    border: 'border-violet-500/30',
    activeBorder: 'border-violet-400',
    features: ['إدارة 2-3 فروع', 'لوحة تحكم موحدة', 'تقارير لكل فرع', 'موظفون غير محدودون'],
  },
];

// Maps washType to a suggested plan id
const WASH_TYPE_PLAN_MAP: Record<string, string> = {
  bike: 'bike_solo',
  car: 'car_solo',
  fixed: 'fixed_wash',
};

const SAUDI_CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الأحساء', 'الطائف', 'بريدة', 'تبوك', 'خميس مشيط',
  'حائل', 'نجران', 'الجبيل', 'أبها', 'ينبع',
];

// ─── Custom City Picker (dark theme) ─────────────────────────────────────────
function CityPicker({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div>
      <label className="label">المدينة *</label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="input-field pr-10 text-right w-full flex items-center justify-between"
        >
          <MapPin size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <span className={value ? 'text-white pr-6' : 'text-slate-500 pr-6'}>{value || 'اختر المدينة'}</span>
          <ChevronLeft size={14} className={`text-slate-500 transition-transform ${open ? 'rotate-90' : '-rotate-90'}`} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute z-50 top-full mt-1 inset-x-0 bg-[#0d1a30] border border-white/[0.1] rounded-xl shadow-2xl shadow-black/50 max-h-56 overflow-y-auto"
            >
              {SAUDI_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => { onChange(city); setOpen(false); }}
                  className={`w-full text-right px-4 py-2.5 text-sm transition-colors ${
                    value === city
                      ? 'bg-blue-600/20 text-blue-400 font-bold'
                      : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {city}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const STEP_LABELS = ['المعلومات الأساسية', 'اختر الباقة', 'التأكيد'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEP_LABELS.map((label, idx) => (
        <div key={idx} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <motion.div
              animate={{
                scale: current === idx ? 1.15 : 1,
                backgroundColor: current > idx ? '#10b981' : current === idx ? '#8b5cf6' : '#1e293b',
                borderColor: current > idx ? '#10b981' : current === idx ? '#8b5cf6' : '#334155',
              }}
              transition={{ duration: 0.3 }}
              className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm text-white"
            >
              {current > idx ? <Check size={16} /> : idx + 1}
            </motion.div>
            <span
              className={`text-xs font-semibold hidden sm:block ${
                current === idx ? 'text-purple-400' : current > idx ? 'text-emerald-500' : 'text-slate-600'
              }`}
            >
              {label}
            </span>
          </div>
          {idx < STEP_LABELS.length - 1 && (
            <motion.div
              animate={{ backgroundColor: current > idx ? '#10b981' : '#1e293b' }}
              transition={{ duration: 0.3 }}
              className="w-16 sm:w-24 h-0.5 mx-1 mb-5"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function VendorOnboarding() {
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<OnboardForm>({
    ownerName: '',
    nameAr: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    plan: 'free',
    industry: '',
    washType: '',
    password: '',
  });
  const { login } = useAuth();
  const navigate = useNavigate();

  const { mutate: submitOnboard, isPending } = useMutation({
    mutationFn: (data: OnboardForm) => api.post('/vendors/onboard', data).then((r) => r.data),
    onSuccess: (res) => {
      // Auto-login the vendor admin immediately
      if (res.token && res.user) {
        login(res.token, res.user);
        toast.success('مرحباً بك! تم إنشاء حسابك بنجاح 🎉');
        navigate('/vendor/wizard');
      } else {
        setSuccess(true);
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'حدث خطأ، يرجى المحاولة مجدداً');
    },
  });

  function handleStep1Next() {
    if (!form.ownerName.trim()) { toast.error('أدخل اسمك'); return; }
    if (!form.nameAr.trim()) { toast.error('أدخل اسم مشروعك'); return; }
    if (!form.phone.trim()) { toast.error('أدخل رقم الجوال'); return; }
    if (!form.password || form.password.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    if (!form.industry) { toast.error('اختر نوع مشروعك'); return; }
    if (!form.city) { toast.error('اختر المدينة'); return; }
    setStep(1);
  }

  function handleStep2Next() {
    setStep(2);
  }

  function handleSubmit() {
    submitOnboard(form);
  }

  function handleWashTypeChange(type: OnboardForm['washType']) {
    const suggestedPlan = type ? WASH_TYPE_PLAN_MAP[type] ?? form.plan : form.plan;
    setForm({ ...form, washType: type, plan: suggestedPlan });
  }

  const selectedPlan = PLAN_TYPES.find((p) => p.id === form.plan) ?? PLAN_TYPES[2];
  const whatsappOnboard = `https://wa.me/966500000000?text=${encodeURIComponent(`مرحباً، أريد الانضمام إلى منصة Jdawil - ${form.nameAr}`)}`;

  if (success) {
    return (
      <div className="min-h-screen bg-surface-1 font-arabic flex items-center justify-center px-4" dir="rtl">
        {/* Background */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-purple-900/15 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
          className="relative z-10 max-w-md w-full text-center"
        >
          {/* Celebratory ring */}
          <div className="relative w-28 h-28 mx-auto mb-6">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30"
            />
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.3 }}
              className="absolute inset-0 rounded-full bg-emerald-400/10 border border-emerald-400/20"
            />
            <div className="relative w-full h-full bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center">
              <CheckCircle size={52} className="text-emerald-400" />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-black text-white mb-2">🎉 مرحباً بك في Jdawil!</h2>
            <p className="text-slate-300 text-lg mb-1">
              تجربتك المجانية لمدة{' '}
              <span className="text-emerald-400 font-bold">14 يوم</span>{' '}
              بدأت الآن
            </p>
            <p className="text-slate-500 text-sm mb-6">
              سيتواصل معك فريقنا على {form.phone} خلال 24 ساعة لإعداد حسابك
            </p>
          </motion.div>

          <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 mb-4 text-right">
            <p className="text-slate-400 text-xs mb-3">ملخص طلبك</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">{form.nameAr}</span>
                <span className="text-slate-500 text-sm">{form.city}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">الباقة المختارة</span>
                <span className="font-bold text-sm text-emerald-400">
                  {selectedPlan.emoji} {selectedPlan.nameAr} — {selectedPlan.price} ر.س/شهر
                </span>
              </div>
            </div>
          </div>

          {/* Free trial note */}
          <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-3 mb-5 flex items-center justify-center gap-2">
            <Gift size={16} className="text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-sm font-semibold">
              سيبدأ اشتراكك بعد 14 يوم من التجربة المجانية
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={whatsappOnboard}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-2xl transition-all active:scale-95"
            >
              <MessageCircle size={18} />
              تواصل عبر واتساب الآن
            </a>
            <Link to="/marketplace" className="btn-outline py-3 rounded-2xl text-center">
              العودة للسوق
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-blue-900/15 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-indigo-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-sm mb-6"
          >
            <ArrowLeft size={15} />
            العودة للسوق
          </Link>

          {/* Hero: free trial badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-sm px-5 py-2.5 rounded-full mb-4"
          >
            <Gift size={16} className="shrink-0" />
            <span>تجربة مجانية 14 يوم — بدون بطاقة ائتمان</span>
          </motion.div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles size={24} className="text-purple-400" />
            <h1 className="text-3xl sm:text-4xl font-black text-white">انضم بمغسلتك</h1>
            <Sparkles size={24} className="text-blue-400" />
          </div>

          <p className="text-slate-300 text-base font-semibold mb-1">
            سجّل مغسلتك في 3 دقائق وابدأ فوراً
          </p>
          <p className="text-slate-500 text-xs">
            كل يوم بدون Jdawil هو يوم تخسر فيه حجوزات
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Steps */}
        <AnimatePresence mode="wait">
          {/* ─── STEP 1: Basic Info ───────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
              className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-900/40 border border-purple-700/40 rounded-xl flex items-center justify-center">
                  <Building2 size={20} className="text-purple-400" />
                </div>
                <div>
                  <h2 className="font-black text-white text-lg">معلومات مشروعك</h2>
                  <p className="text-slate-500 text-xs">أدخل البيانات الأساسية</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">اسمك الكامل *</label>
                  <div className="relative">
                    <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={form.ownerName}
                      onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                      placeholder="اسمك الكامل"
                      className="input-field pr-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">اسم المشروع * *</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={form.nameAr}
                      onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                      placeholder="مثال: صالون الأناقة، شركة النظافة، مغسلة النجوم"
                      className="input-field pr-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">رقم الجوال *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="05xxxxxxxx"
                      className="input-field pr-10"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="example@email.com"
                      className="input-field pr-10"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">كلمة المرور *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="6 أحرف على الأقل"
                      className="input-field pr-10"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Industry selector */}
                <div>
                  <label className="label">نوع مشروعك *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {INDUSTRY_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setForm({ ...form, industry: opt.id })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all ${
                          form.industry === opt.id
                            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                            : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.15]'
                        }`}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <span className="text-[11px] font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <CityPicker value={form.city} onChange={(city) => setForm({ ...form, city })} />

                <div>
                  <label className="label">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="الحي، الشارع..."
                    className="input-field"
                  />
                </div>

                {/* Wash type selector */}
                <div className="sm:col-span-2">
                  <label className="label">نوع المغسلة <span className="text-slate-600 font-normal">(اختياري — يساعدنا في اقتراح الباقة المناسبة)</span></label>
                  <div className="grid grid-cols-3 gap-3 mt-1">
                    {[
                      { value: 'bike' as const, emoji: '🏍️', label: 'متنقلة بايك' },
                      { value: 'car' as const, emoji: '🚗', label: 'متنقلة سيارة' },
                      { value: 'fixed' as const, emoji: '🏪', label: 'ثابتة' },
                    ].map((option) => {
                      const isActive = form.washType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleWashTypeChange(isActive ? '' : option.value)}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all duration-200 text-center ${
                            isActive
                              ? 'border-purple-500 bg-purple-900/30 text-white'
                              : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                          }`}
                        >
                          <span className="text-xl leading-none">{option.emoji}</span>
                          <span className="text-xs font-semibold">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-start">
                <button onClick={handleStep1Next} className="btn-primary flex items-center gap-2">
                  التالي
                  <ChevronLeft size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 2: Plan Selection ───────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
            >
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-black text-white mb-1">اختر باقتك</h2>
                <p className="text-slate-400 text-sm">يمكنك الترقية أو التغيير في أي وقت</p>
                {form.washType && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-emerald-400 text-xs mt-1.5 font-semibold"
                  >
                    تم اقتراح الباقة المناسبة بناءً على نوع مغسلتك
                  </motion.p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {PLAN_TYPES.map((plan) => {
                  const isSelected = form.plan === plan.id;
                  return (
                    <motion.button
                      key={plan.id}
                      onClick={() => setForm({ ...form, plan: plan.id })}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative text-right rounded-2xl border-2 p-5 transition-all duration-300 flex flex-col ${
                        isSelected
                          ? `${plan.activeBorder} bg-gradient-to-b ${plan.color} bg-opacity-10`
                          : `${plan.border} bg-slate-900/50 hover:border-slate-600`
                      }`}
                      style={
                        isSelected
                          ? { boxShadow: '0 8px 30px rgba(139,92,246,0.2)', background: 'linear-gradient(to bottom, rgba(15,23,42,0.95), rgba(15,23,42,0.98))' }
                          : {}
                      }
                    >
                      {plan.badge && (
                        <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-amber-500 to-orange-400">
                          {plan.badge}
                        </div>
                      )}

                      {/* Free trial badge */}
                      <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        14 يوم مجاناً
                      </div>

                      <div className="text-3xl mb-2 mt-1">{plan.emoji}</div>

                      <h3 className="font-black text-white text-base mb-0.5">{plan.nameAr}</h3>
                      <p className="text-slate-500 text-xs mb-3">{plan.desc}</p>

                      <div className="mb-4">
                        <span className="text-2xl font-black text-white">{plan.price}</span>
                        <span className="text-slate-400 text-xs mr-1">ر.س/شهر</span>
                      </div>

                      <ul className="space-y-1.5 flex-1 mb-4">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                            <CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className={`w-full py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                          isSelected
                            ? 'bg-emerald-500 text-white'
                            : `bg-gradient-to-r ${plan.color} text-white opacity-80 hover:opacity-100`
                        }`}
                        onClick={(e) => { e.stopPropagation(); setForm({ ...form, plan: plan.id }); }}
                      >
                        {isSelected ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <Check size={13} />
                            تم الاختيار
                          </span>
                        ) : (
                          'اختر'
                        )}
                      </button>
                    </motion.button>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(0)}
                  className="btn-outline flex items-center gap-2"
                >
                  <ChevronRight size={18} />
                  السابق
                </button>
                <button onClick={handleStep2Next} className="btn-primary flex items-center gap-2">
                  التالي
                  <ChevronLeft size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── STEP 3: Confirmation ─────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35 }}
            >
              <div className="mb-6 text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', bounce: 0.5 }}
                  className="text-4xl mb-2"
                >
                  🎉
                </motion.div>
                <h2 className="text-2xl font-black text-white mb-1">مرحباً بك في Jdawil!</h2>
                <p className="text-slate-400 text-sm">راجع بياناتك وأرسل الطلب</p>
              </div>

              {/* Summary card */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-5">
                <h3 className="font-bold text-slate-400 text-xs mb-4 uppercase tracking-wider">بيانات المغسلة</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs">الاسم</p>
                    <p className="text-white font-bold">{form.nameAr}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">الجوال</p>
                    <p className="text-white font-bold" dir="ltr">{form.phone}</p>
                  </div>
                  {form.email && (
                    <div>
                      <p className="text-slate-500 text-xs">البريد</p>
                      <p className="text-white font-bold" dir="ltr">{form.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 text-xs">المدينة</p>
                    <p className="text-white font-bold">{form.city}</p>
                  </div>
                  {form.address && (
                    <div className="col-span-2">
                      <p className="text-slate-500 text-xs">العنوان</p>
                      <p className="text-white font-bold">{form.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Plan summary */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/10 p-5 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">الباقة المختارة</p>
                    <p className="font-black text-white text-lg">
                      {selectedPlan.emoji} {selectedPlan.nameAr}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{selectedPlan.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-400">
                      {selectedPlan.price} ر.س
                    </p>
                    <p className="text-slate-500 text-xs">شهرياً</p>
                  </div>
                </div>
              </div>

              {/* Free trial note */}
              <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-4 mb-5 flex items-start gap-3">
                <Gift size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-emerald-300 font-bold text-sm">سيبدأ اشتراكك بعد 14 يوم من التجربة المجانية</p>
                  <p className="text-slate-400 text-xs mt-0.5">لا حاجة لبطاقة ائتمان الآن — ابدأ مجاناً</p>
                </div>
              </div>

              {/* WhatsApp note */}
              <div className="bg-green-900/20 border border-green-700/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
                <MessageCircle size={18} className="text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300 font-bold text-sm">سيتم التواصل معك عبر واتساب</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    سيقوم فريقنا بالتواصل معك خلال 24 ساعة على الرقم {form.phone} لإتمام تسجيل مغسلتك
                  </p>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="btn-outline flex items-center gap-2"
                >
                  <ChevronRight size={18} />
                  السابق
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                      />
                      جارٍ الإرسال...
                    </span>
                  ) : (
                    <>
                      <Star size={16} />
                      إرسال الطلب
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
