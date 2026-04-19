import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Phone, Lock, ArrowLeft, Shield, KeyRound, Fingerprint } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { sendOTP } from '../../lib/firebase';

type Step = 'phone' | 'otp' | 'password';

/* ── Animated gradient mesh background ── */
function MeshBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {/* Base dark */}
      <div className="absolute inset-0 bg-surface-1" />

      {/* Gradient mesh orbs */}
      <div
        className="absolute rounded-full"
        style={{
          width: '60vmax',
          height: '60vmax',
          top: '-20%',
          right: '-15%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)',
          animation: 'meshFloat1 12s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '50vmax',
          height: '50vmax',
          bottom: '-25%',
          left: '-10%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)',
          animation: 'meshFloat2 15s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: '35vmax',
          height: '35vmax',
          top: '40%',
          left: '30%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          animation: 'meshFloat3 10s ease-in-out infinite',
        }}
      />

      {/* Particle dots */}
      <div className="absolute inset-0">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              background: `rgba(${Math.random() > 0.5 ? '56,189,248' : '96,165,250'}, ${Math.random() * 0.4 + 0.1})`,
              animation: `particlePulse ${Math.random() * 4 + 3}s ease-in-out ${Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Subtle noise overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/* ── Animated Logo ── */
function AnimatedLogo() {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
      className="relative mx-auto mb-6"
      style={{ width: 80, height: 80 }}
    >
      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-[22px]"
        style={{
          background: 'linear-gradient(135deg, #2563eb, #0ea5e9, #6366f1)',
          filter: 'blur(20px)',
          opacity: 0.4,
        }}
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Logo container */}
      <div
        className="relative w-full h-full rounded-[22px] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 50%, #6366f1 100%)',
          boxShadow: '0 0 40px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
      >
        {/* Inner shimmer */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
          }}
        />

        {/* The "B" letter */}
        <motion.span
          className="relative font-black text-white"
          style={{
            fontSize: '2.5rem',
            lineHeight: 1,
            textShadow: '0 2px 10px rgba(0,0,0,0.3)',
            fontFamily: '"SF Pro Display", "Tajawal", system-ui, sans-serif',
          }}
          animate={{ y: [0, -2, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          B
        </motion.span>
      </div>
    </motion.div>
  );
}

/* ── Modern Spinner ── */
function Spinner() {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-white"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ── OTP Input (6 separate boxes) ── */
function OtpBoxes({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = useCallback(
    (index: number, char: string) => {
      if (!/^\d?$/.test(char)) return;
      const arr = value.split('');
      arr[index] = char;
      // Ensure length stays at 6 with empty placeholders
      while (arr.length < 6) arr.push('');
      const next = arr.join('').slice(0, 6);
      onChange(next);
      if (char && index < 5) {
        refs.current[index + 1]?.focus();
      }
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        refs.current[index - 1]?.focus();
      }
    },
    [value]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, 5);
      refs.current[focusIdx]?.focus();
    },
    [onChange]
  );

  return (
    <div className="flex gap-2.5 justify-center" dir="ltr" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i + 0.2 }}
          className="w-12 h-14 rounded-xl text-center text-xl font-bold
                     bg-white/[0.04] border border-white/[0.08] text-white
                     focus:outline-none focus:border-brand-400 focus:bg-white/[0.08]
                     focus:shadow-[0_0_20px_rgba(59,130,246,0.2)]
                     transition-all duration-300 caret-brand-400"
          style={{
            backdropFilter: 'blur(10px)',
          }}
        />
      ))}
    </div>
  );
}

/* ── Animated Input Field ── */
function GlassInput({
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  dir,
  required,
}: {
  icon: typeof Phone;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  dir?: string;
  required?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className="relative"
      animate={focused ? { scale: 1.02 } : { scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`
          relative flex items-center rounded-xl overflow-hidden transition-all duration-300
          ${focused
            ? 'bg-white/[0.08] border border-brand-400/60 shadow-[0_0_25px_rgba(59,130,246,0.15)]'
            : 'bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15]'}
        `}
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <motion.div
          className="flex items-center justify-center w-12 h-full"
          animate={focused ? { color: '#60a5fa', scale: 1.1 } : { color: '#64748b', scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Icon size={18} />
        </motion.div>

        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          required={required}
          dir={dir}
          className="w-full bg-transparent py-3.5 pl-4 pr-1 text-white placeholder:text-slate-500
                     focus:outline-none text-[15px]"
        />
      </div>

      {/* Animated underline glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, #3b82f6, #0ea5e9, transparent)' }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={focused ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}

/* ── Step Indicator ── */
function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; icon: typeof Phone; label: string }[] = [
    { key: 'phone', icon: Phone, label: 'الجوال' },
    { key: 'otp', icon: Shield, label: 'التحقق' },
    { key: 'password', icon: KeyRound, label: 'المرور' },
  ];

  const currentIdx = step === 'phone' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => {
        const isActive = i === currentIdx;
        const isPast = i < currentIdx;
        return (
          <motion.div
            key={s.key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
              isActive
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : isPast
                ? 'bg-green-500/10 text-green-400/70 border border-green-500/20'
                : 'bg-white/[0.03] text-slate-600 border border-white/[0.05]'
            }`}
            animate={isActive ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <s.icon size={12} />
            {s.label}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Slide variants ── */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
  }),
};

/* ═══════════════════════════════════════════
   Main Login Component
   ═══════════════════════════════════════════ */

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'employee') navigate('/employee');
      else navigate('/app');
    }
  }, [user]);

  function goToStep(next: Step) {
    const order: Step[] = ['phone', 'otp', 'password'];
    setDirection(order.indexOf(next) > order.indexOf(step) ? 1 : -1);
    setStep(next);
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Check if admin/employee (they use password, not OTP)
      const { data } = await api.post('/auth/login', { phone, firebaseUid: '__check__' }).catch(() => ({ data: null }));
      if (data?.user?.role === 'admin' || data?.user?.role === 'employee') {
        goToStep('password');
        return;
      }
      // Customer: send OTP via Firebase
      const confirmation = await sendOTP(phone, 'recaptcha-container');
      setConfirmationResult(confirmation);
      goToStep('otp');
      toast.success('تم إرسال رمز التحقق');
    } catch (err: any) {
      // If error is about invalid UID, it's a customer - send OTP
      try {
        const confirmation = await sendOTP(phone, 'recaptcha-container');
        setConfirmationResult(confirmation);
        goToStep('otp');
        toast.success('تم إرسال رمز التحقق');
      } catch (e: any) {
        toast.error(e?.message ?? 'فشل في إرسال الرمز');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      const firebaseUid = result.user.uid;

      const { data } = await api.post('/auth/login', { phone, firebaseUid });
      login(data.token, data.user);

      toast.success(`أهلاً ${data.user.name}!`);
      if (data.user.role === 'customer') navigate('/app');
      else navigate('/');
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // New user - redirect to register
        navigate(`/register?phone=${encodeURIComponent(phone)}`);
      } else {
        toast.error(err?.response?.data?.error ?? 'رمز التحقق غير صحيح');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      login(data.token, data.user);
      toast.success(`أهلاً ${data.user.name}!`);
      if (data.user.role === 'admin') navigate('/admin');
      else navigate('/employee');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'بيانات غير صحيحة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* CSS keyframes for mesh background */}
      <style>{`
        @keyframes meshFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.05); }
          66% { transform: translate(20px, -15px) scale(0.95); }
        }
        @keyframes meshFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, -20px) scale(1.08); }
          66% { transform: translate(-20px, 25px) scale(0.92); }
        }
        @keyframes meshFloat3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, 15px) scale(1.1); }
        }
        @keyframes particlePulse {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.8); }
        }
      `}</style>

      <div className="min-h-screen flex items-center justify-center p-4 relative" dir="rtl">
        <MeshBackground />

        {/* Invisible recaptcha */}
        <div id="recaptcha-container" ref={recaptchaRef} />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo */}
          <AnimatedLogo />

          {/* Title */}
          <motion.div
            className="text-center mb-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <h1 className="text-3xl font-black">
              <span className="gradient-text">Jadawel</span>{' '}
              <span className="text-white"></span>
            </h1>
            <p className="text-slate-500 text-sm mt-2 font-medium">تسجيل الدخول إلى حسابك</p>
          </motion.div>

          {/* Step Indicator */}
          <StepIndicator step={step} />

          {/* Glass Card */}
          <motion.div
            className="glass-premium rounded-2xl p-6 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {/* Card border glow */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 40%, transparent 60%, rgba(14,165,233,0.08) 100%)',
              }}
              animate={{
                background: [
                  'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 40%, transparent 60%, rgba(14,165,233,0.08) 100%)',
                  'linear-gradient(225deg, rgba(59,130,246,0.08) 0%, transparent 40%, transparent 60%, rgba(14,165,233,0.1) 100%)',
                  'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, transparent 40%, transparent 60%, rgba(14,165,233,0.08) 100%)',
                ],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="relative" style={{ minHeight: 180 }}>
              <AnimatePresence mode="wait" custom={direction}>
                {/* ── Phone Step ── */}
                {step === 'phone' && (
                  <motion.form
                    key="phone"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handlePhoneSubmit}
                    className="space-y-5"
                  >
                    <div className="text-center mb-2">
                      <motion.div
                        className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-3"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Phone size={20} className="text-brand-400" />
                      </motion.div>
                      <p className="text-sm text-slate-400">أدخل رقم جوالك للمتابعة</p>
                    </div>

                    <GlassInput
                      icon={Phone}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      required
                    />

                    <motion.button
                      type="submit"
                      disabled={loading || !phone}
                      className="btn-primary w-full relative overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? <Spinner /> : 'متابعة'}
                    </motion.button>
                  </motion.form>
                )}

                {/* ── OTP Step ── */}
                {step === 'otp' && (
                  <motion.form
                    key="otp"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handleOtpSubmit}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <motion.button
                        type="button"
                        onClick={() => goToStep('phone')}
                        className="flex items-center gap-1.5 text-brand-400/80 text-xs font-medium
                                   hover:text-brand-300 transition-colors"
                        whileHover={{ x: -3 }}
                      >
                        <ArrowLeft size={13} />
                        تغيير الرقم
                      </motion.button>
                    </div>

                    <div className="text-center mb-2">
                      <motion.div
                        className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Fingerprint size={20} className="text-emerald-400" />
                      </motion.div>
                      <p className="text-sm text-slate-400">
                        رمز التحقق المرسل إلى{' '}
                        <span className="text-white font-semibold" dir="ltr">{phone}</span>
                      </p>
                    </div>

                    <OtpBoxes value={otp} onChange={setOtp} />

                    <motion.button
                      type="submit"
                      disabled={loading || otp.replace(/\s/g, '').length !== 6}
                      className="btn-primary w-full relative overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? <Spinner /> : 'تحقق'}
                    </motion.button>
                  </motion.form>
                )}

                {/* ── Password Step ── */}
                {step === 'password' && (
                  <motion.form
                    key="password"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handlePasswordSubmit}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <motion.button
                        type="button"
                        onClick={() => goToStep('phone')}
                        className="flex items-center gap-1.5 text-brand-400/80 text-xs font-medium
                                   hover:text-brand-300 transition-colors"
                        whileHover={{ x: -3 }}
                      >
                        <ArrowLeft size={13} />
                        تغيير الرقم
                      </motion.button>
                    </div>

                    <div className="text-center mb-2">
                      <motion.div
                        className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <Lock size={20} className="text-purple-400" />
                      </motion.div>
                      <p className="text-sm text-slate-400">أدخل كلمة المرور الخاصة بك</p>
                    </div>

                    <GlassInput
                      icon={Lock}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="كلمة المرور"
                      required
                    />

                    <motion.button
                      type="submit"
                      disabled={loading || !password}
                      className="btn-primary w-full relative overflow-hidden"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {loading ? <Spinner /> : 'تسجيل الدخول'}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Register link */}
          <motion.p
            className="text-center text-slate-500 text-sm mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            مستخدم جديد؟{' '}
            <Link
              to="/register"
              className="gradient-text font-bold hover:opacity-80 transition-opacity"
            >
              سجل الآن
            </Link>
          </motion.p>

          {/* Bottom decorative line */}
          <motion.div
            className="mt-8 h-[1px] mx-auto"
            style={{
              width: '60%',
              background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent)',
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          />
        </motion.div>
      </div>
    </>
  );
}
