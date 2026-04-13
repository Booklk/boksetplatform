// Setup wizard modal for new vendors — guides through 5 onboarding steps
// Appears as a dark modal overlay with step indicator and smooth transitions

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Package, UserPlus, Palette, Share2, PartyPopper,
  ChevronLeft, ChevronRight, Copy, Check, Loader2,
  MessageCircle, Clock, Sparkles,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorSlug: string;
  vendorId: number;
}

const STEPS = [
  { icon: Package, label: 'أضف أول خدمة' },
  { icon: UserPlus, label: 'أضف موظف' },
  { icon: Palette, label: 'أكمل هويتك' },
  { icon: Share2, label: 'شارك رابطك' },
  { icon: PartyPopper, label: 'مبروك!' },
];

const PRESET_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0 }),
};

export function SetupWizardModal({ isOpen, onClose, vendorSlug, vendorId }: SetupWizardModalProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [copied, setCopied] = useState(false);

  // Step 1 — Service form
  const [serviceName, setServiceName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');

  // Step 2 — Employee form
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');

  // Step 3 — Branding
  const [primaryColor, setPrimaryColor] = useState(PRESET_COLORS[0]);

  const storeUrl = `${window.location.origin}/store/${vendorSlug}`;

  const goNext = () => { setDirection(1); setStep(s => Math.min(s + 1, 4)); };
  const goBack = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); };

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const addService = useMutation({
    mutationFn: () =>
      api.post('/services', {
        name: serviceName,
        packages: [{ name: packageName, price: Number(price), durationMinutes: Number(duration) }],
      }),
    onSuccess: () => { toast.success('تمت إضافة الخدمة'); goNext(); },
    onError: () => toast.error('فشل في إضافة الخدمة'),
  });

  const addEmployee = useMutation({
    mutationFn: () => api.post('/employees', { name: empName, phone: empPhone }),
    onSuccess: () => { toast.success('تمت إضافة الموظف'); goNext(); },
    onError: () => toast.error('فشل في إضافة الموظف'),
  });

  const saveBranding = useMutation({
    mutationFn: () => api.put(`/vendors/${vendorId}`, { primaryColor }),
    onSuccess: () => { toast.success('تم حفظ الهوية'); goNext(); },
    onError: () => toast.error('فشل في الحفظ'),
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    await navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    toast.success('تم نسخ الرابط');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`تفضل رابط مغسلتي:\n${storeUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // ─── Step Content ─────────────────────────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">أضف أول خدمة مع باقة وسعر حتى يقدر العميل يحجز.</p>
            <input value={serviceName} onChange={e => setServiceName(e.target.value)} placeholder="اسم الخدمة (مثلاً: غسيل خارجي)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
            <input value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="اسم الباقة (مثلاً: عادي)" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="السعر (ريال)" className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="المدة (دقيقة)" className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
            </div>
            <button
              onClick={() => addService.mutate()}
              disabled={!serviceName.trim() || !packageName.trim() || !price || !duration || addService.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {addService.isPending ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
              أضف الخدمة
            </button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">أضف أول موظف حتى تقدر توزّع عليه الحجوزات.</p>
            <input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="اسم الموظف" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
            <input type="tel" value={empPhone} onChange={e => setEmpPhone(e.target.value)} placeholder="رقم الجوال (05xxxxxxxx)" dir="ltr" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
            <button
              onClick={() => addEmployee.mutate()}
              disabled={!empName.trim() || !empPhone.trim() || addEmployee.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {addEmployee.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              أضف الموظف
            </button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">خصّص هوية مغسلتك حتى يتعرف عليها العملاء.</p>
            {/* Logo placeholder */}
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center">
              <Sparkles size={28} className="text-slate-500 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">رفع الشعار — قريباً</p>
            </div>
            {/* Color picker */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">اللون الرئيسي</label>
              <div className="flex items-center gap-3">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setPrimaryColor(color)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${primaryColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => saveBranding.mutate()}
              disabled={saveBranding.isPending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              {saveBranding.isPending ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
              حفظ
            </button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">شارك رابط متجرك مع عملائك عبر واتساب أو أي قناة.</p>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="flex-1 text-sm text-white truncate" dir="ltr">{storeUrl}</span>
              <button onClick={handleCopy} className="flex-shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
            <button
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              <MessageCircle size={16} />
              شارك عبر واتساب
            </button>
            <button
              onClick={goNext}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              التالي
              <ChevronLeft size={16} />
            </button>
          </div>
        );

      case 4:
        return (
          <div className="text-center space-y-4 py-4">
            <div className="text-6xl">🎉</div>
            <h3 className="text-xl font-bold text-white">مبروك!</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              مغسلتك جاهزة! ابدأ استقبل الحجوزات<br />وتابع كل شي من لوحة التحكم.
            </p>
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-l from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-3 rounded-xl text-sm font-bold transition-colors"
            >
              <PartyPopper size={16} />
              ابدأ استقبل الحجوزات
            </button>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget && step < 4) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="bg-slate-800 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
            dir="rtl"
          >
            {/* Header + close */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="font-bold text-lg text-white">{STEPS[step].label}</h2>
              {step < 4 && (
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 px-6 pb-4">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                    i <= step ? 'bg-blue-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            {/* Step content with slide animation */}
            <div className="px-6 pb-6 min-h-[260px] relative overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation — back only (steps handle their own "next") */}
            {step > 0 && step < 4 && (
              <div className="px-6 pb-5">
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight size={16} />
                  رجوع
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
