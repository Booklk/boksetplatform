import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, Bell } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VehicleType {
  id: string;
  label: string;
  emoji: string;
}

const VEHICLE_TYPES: VehicleType[] = [
  { id: 'sedan', label: 'سيدان', emoji: '🚗' },
  { id: 'suv', label: 'SUV', emoji: '🚙' },
  { id: 'pickup', label: 'بيك آب', emoji: '🛻' },
  { id: 'van', label: 'فان', emoji: '🚐' },
  { id: 'motorcycle', label: 'دراجة', emoji: '🏍️' },
  { id: 'other', label: 'أخرى', emoji: '🚘' },
];

const VEHICLE_COLORS = [
  { id: 'white', label: 'أبيض', hex: '#F8FAFC' },
  { id: 'black', label: 'أسود', hex: '#0F172A' },
  { id: 'silver', label: 'فضي', hex: '#94A3B8' },
  { id: 'red', label: 'أحمر', hex: '#EF4444' },
  { id: 'blue', label: 'أزرق', hex: '#3B82F6' },
  { id: 'green', label: 'أخضر', hex: '#22C55E' },
  { id: 'gold', label: 'ذهبي', hex: '#EAB308' },
  { id: 'brown', label: 'بني', hex: '#92400E' },
];

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center relative overflow-hidden">
      {/* Animated particles */}
      {[...Array(16)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-brand-500/20"
          style={{
            width: 6 + (i % 3) * 6,
            height: 6 + (i % 3) * 6,
            left: `${(i * 7 + 5) % 90}%`,
            top: `${(i * 13 + 8) % 85}%`,
          }}
          animate={{
            y: [-12, 12, -12],
            opacity: [0.3, 0.8, 0.3],
          }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: i * 0.3,
          }}
        />
      ))}

      {/* Car wash illustration */}
      <div className="relative mb-8">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          {/* Car body */}
          <div className="relative w-40 h-16 mx-auto">
            <div className="absolute bottom-0 w-40 h-10 bg-blue-500 rounded-xl" />
            <div className="absolute bottom-9 left-8 w-24 h-9 bg-blue-400 rounded-t-xl rounded-b-sm" />
            {/* Wheels */}
            <div className="absolute -bottom-3 left-4 w-8 h-8 bg-slate-700 rounded-full border-2 border-slate-500" />
            <div className="absolute -bottom-3 right-4 w-8 h-8 bg-slate-700 rounded-full border-2 border-slate-500" />
          </div>
        </motion.div>

        {/* Bubbles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 rounded-full border-2 border-blue-300/50"
            style={{ left: 20 + i * 28, top: -8 }}
            animate={{ y: [-8, -32], opacity: [0.8, 0], scale: [0.8, 1.4] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.25,
            }}
          />
        ))}
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-black text-white mb-2"
      >
        مرحباً {name} 👋
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-slate-400 text-lg mb-10"
      >
        نحن سعداء بانضمامك
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={onNext}
        className="relative overflow-hidden w-full max-w-xs py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-l from-brand-700 to-brand-500 shadow-brand"
      >
        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        />
        ابدأ الرحلة
      </motion.button>
    </div>
  );
}

// ─── Step 2: Vehicle ──────────────────────────────────────────────────────────

function StepVehicle({
  onNext,
}: {
  onNext: (data: { vehicleType: string; vehicleColor: string; vehiclePlate: string }) => void;
}) {
  const [selectedType, setSelectedType] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [plate, setPlate] = useState('');

  const canContinue = selectedType !== '';

  return (
    <div className="min-h-screen flex flex-col p-6" dir="rtl">
      <h2 className="text-2xl font-black text-white mb-1">أخبرنا عن سيارتك</h2>
      <p className="text-slate-400 text-sm mb-6">لنقدم لك أفضل خدمة</p>

      {/* Vehicle type selector */}
      <div className="mb-6">
        <p className="text-slate-300 font-bold text-sm mb-3">نوع المركبة</p>
        <div className="grid grid-cols-3 gap-3">
          {VEHICLE_TYPES.map((v) => (
            <motion.button
              key={v.id}
              whileTap={{ scale: 0.93 }}
              onClick={() => setSelectedType(v.id)}
              className={`rounded-2xl py-3 flex flex-col items-center gap-1 border-2 transition-all ${
                selectedType === v.id
                  ? 'border-brand-500 bg-brand-600/20 shadow-brand'
                  : 'border-slate-700/50 bg-slate-800/60'
              }`}
            >
              <AnimatePresence mode="wait">
                {selectedType === v.id ? (
                  <motion.span
                    key="selected"
                    initial={{ scale: 0.7 }}
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.4 }}
                    className="text-3xl"
                  >
                    {v.emoji}
                  </motion.span>
                ) : (
                  <motion.span key="normal" className="text-3xl">
                    {v.emoji}
                  </motion.span>
                )}
              </AnimatePresence>
              <span
                className={`text-xs font-bold ${
                  selectedType === v.id ? 'text-brand-300' : 'text-slate-400'
                }`}
              >
                {v.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="mb-6">
        <p className="text-slate-300 font-bold text-sm mb-3">لون المركبة</p>
        <div className="flex flex-wrap gap-3">
          {VEHICLE_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedColor(c.id)}
              className={`w-9 h-9 rounded-full border-4 transition-all ${
                selectedColor === c.id
                  ? 'border-brand-400 scale-110 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                  : 'border-slate-700/60'
              }`}
              style={{ backgroundColor: c.hex }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Plate input */}
      <div className="mb-8">
        <p className="text-slate-300 font-bold text-sm mb-2">رقم اللوحة (اختياري)</p>
        <input
          type="text"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          placeholder="مثال: أ ب ج 1234"
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-right focus:outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      <div className="flex-1" />

      <button
        onClick={() =>
          onNext({ vehicleType: selectedType, vehicleColor: selectedColor, vehiclePlate: plate })
        }
        disabled={!canContinue}
        className="w-full py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-l from-brand-700 to-brand-500 shadow-brand disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        التالي
      </button>
    </div>
  );
}

// ─── Step 3: Notifications ────────────────────────────────────────────────────

function StepNotifications({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { token } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setGranted(true);
    }
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setGranted(true);
        // Attempt to subscribe to push (best effort)
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: undefined,
            });
            await axios.post(
              '/api/push/subscribe',
              sub.toJSON(),
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } catch {
            // Push subscription is best-effort
          }
        }
      }
    } catch {
      /* ignore */
    } finally {
      setRequesting(false);
    }
  };

  const benefits = [
    'تعرف فوراً عندما يصل الموظف',
    'احصل على تذكير قبل موعدك',
    'لا تفوّت عروض المغسلة',
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" dir="rtl">
      {/* Illustration */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.5, repeat: Infinity }}
        className="relative mb-8"
      >
        <div className="w-24 h-40 bg-slate-700 rounded-3xl mx-auto flex items-center justify-center border-4 border-slate-600">
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [-5, 5, -5] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <Bell size={40} className="text-brand-400" />
          </motion.div>
        </div>
        {/* Notification ping */}
        <motion.div
          className="absolute top-2 right-8 w-4 h-4 bg-brand-500 rounded-full"
          animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>

      <h2 className="text-2xl font-black text-white mb-2">فعّل الإشعارات</h2>
      <p className="text-slate-400 text-sm mb-8">كن على اطلاع دائم بحجوزاتك</p>

      {/* Benefits */}
      <div className="w-full max-w-xs space-y-3 mb-8 text-right">
        {benefits.map((b, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.2 }}
            className="flex items-center gap-3"
          >
            <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0">
              <Check size={12} className="text-green-400" />
            </div>
            <p className="text-slate-300 text-sm font-bold">{b}</p>
          </motion.div>
        ))}
      </div>

      {granted ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-white text-lg bg-green-600 flex items-center justify-center gap-2 mb-4"
          onClick={onNext}
        >
          <Check size={20} />
          تم التفعيل! التالي
        </motion.div>
      ) : (
        <button
          onClick={async () => { await handleEnable(); onNext(); }}
          disabled={requesting}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-l from-brand-700 to-brand-500 shadow-brand disabled:opacity-60 mb-4 transition-opacity"
        >
          {requesting ? 'جاري التفعيل...' : 'فعّل الإشعارات 🔔'}
        </button>
      )}

      <button
        onClick={onSkip}
        className="text-slate-500 text-sm font-bold underline underline-offset-2 hover:text-slate-400 transition-colors"
      >
        تخطي
      </button>
    </div>
  );
}

// ─── Step 4: Ready ────────────────────────────────────────────────────────────

function StepReady({ onBooking, onExplore }: { onBooking: () => void; onExplore: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden" dir="rtl">
      {/* Confetti */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${(i * 5 + 3) % 100}%`,
            backgroundColor: ['#EF4444', '#3B82F6', '#22C55E', '#EAB308', '#A855F7'][i % 5],
          }}
          initial={{ top: -20, rotate: 0, opacity: 1 }}
          animate={{
            top: '110%',
            rotate: 360 * (i % 3 === 0 ? 1 : -1),
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 2.5 + (i % 4) * 0.5,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'linear',
          }}
        />
      ))}

      {/* SVG checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.1 }}
        className="mb-8 relative"
      >
        <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
          <motion.circle
            cx="50"
            cy="50"
            r="44"
            stroke="#22C55E"
            strokeWidth="5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          />
          <motion.path
            d="M30 50 L44 64 L70 38"
            stroke="#22C55E"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.9, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-3xl font-black text-white mb-2"
      >
        أنت جاهز! 🎉
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="text-slate-400 mb-10"
      >
        مرحباً بك في منصة ركيزة
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="w-full max-w-xs space-y-3"
      >
        <button
          onClick={onBooking}
          className="w-full py-4 rounded-2xl font-black text-white text-lg bg-gradient-to-l from-brand-700 to-brand-500 shadow-brand"
        >
          ابدأ أول حجز 🚗
        </button>
        <button
          onClick={onExplore}
          className="w-full py-4 rounded-2xl font-black text-slate-300 text-lg bg-slate-800/80 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
        >
          استعرض التطبيق
        </button>
      </motion.div>
    </div>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {[...Array(total)].map((_, i) => (
        <div key={i} className="relative flex items-center">
          {/* Connector line */}
          {i > 0 && (
            <div
              className={`w-8 h-0.5 -mx-1 transition-colors ${
                i <= current ? 'bg-brand-500' : 'bg-slate-700'
              }`}
            />
          )}
          <motion.div
            animate={i === current ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              i === current
                ? 'bg-brand-500 border-brand-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
                : i < current
                ? 'bg-brand-700 border-brand-600'
                : 'bg-slate-800 border-slate-700'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main Onboarding component ────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const name = user?.name ?? 'بك';

  const complete = (dest: string) => {
    localStorage.setItem('onboarding-complete', 'true');
    navigate(dest, { replace: true });
  };

  const slideVariants = {
    enter: { x: -300, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: 300, opacity: 0 },
  };

  return (
    <div className="min-h-screen bg-[#040812] relative" dir="rtl">
      {/* Back button (steps 1+) */}
      {step > 0 && step < 3 && (
        <button
          onClick={() => setStep((s) => s - 1)}
          className="absolute top-4 left-4 z-20 p-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Progress dots */}
      <div className="absolute top-0 left-0 right-0 z-10 pt-4">
        <ProgressDots total={4} current={step} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="min-h-screen pt-12"
        >
          {step === 0 && (
            <StepWelcome name={name} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <StepVehicle
              onNext={async (vehicleData) => {
                // Save vehicle data best-effort
                if (vehicleData.vehicleType) {
                  try {
                    await axios.post(
                      '/api/vehicles',
                      {
                        type: vehicleData.vehicleType,
                        color: vehicleData.vehicleColor,
                        plate: vehicleData.vehiclePlate,
                      },
                      { headers: { Authorization: `Bearer ${token}` } }
                    );
                  } catch {
                    /* ignore */
                  }
                }
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <StepNotifications
              onNext={() => setStep(3)}
              onSkip={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <StepReady
              onBooking={() => complete('/marketplace')}
              onExplore={() => complete('/app')}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
