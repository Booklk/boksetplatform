import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Phone, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { sendOTP } from '../../lib/firebase';

type Step = 'phone' | 'otp' | 'password';

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

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'employee') navigate('/employee');
      else navigate('/app');
    }
  }, [user]);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Check if admin/employee (they use password, not OTP)
      const { data } = await api.post('/auth/login', { phone, firebaseUid: '__check__' }).catch(() => ({ data: null }));
      if (data?.user?.role === 'admin' || data?.user?.role === 'employee') {
        setStep('password');
        return;
      }
      // Customer: send OTP via Firebase
      const confirmation = await sendOTP(phone, 'recaptcha-container');
      setConfirmationResult(confirmation);
      setStep('otp');
      toast.success('تم إرسال رمز التحقق');
    } catch (err: any) {
      // If error is about invalid UID, it's a customer - send OTP
      try {
        const confirmation = await sendOTP(phone, 'recaptcha-container');
        setConfirmationResult(confirmation);
        setStep('otp');
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
    <div className="min-h-screen water-bg flex items-center justify-center p-4" dir="rtl">
      {/* Invisible recaptcha */}
      <div id="recaptcha-container" ref={recaptchaRef} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-600 to-water-deep rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-glow">
            💧
          </div>
          <h1 className="text-2xl font-black text-white">مغسلة Bokset</h1>
          <p className="text-slate-400 text-sm mt-1">تسجيل الدخول</p>
        </div>

        <div className="card">
          {step === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label className="label">رقم الجوال</label>
                <div className="relative">
                  <Phone size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="input-field pr-9"
                    required
                    dir="ltr"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || !phone} className="btn-primary w-full">
                {loading ? 'جاري الإرسال...' : 'متابعة'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <button type="button" onClick={() => setStep('phone')} className="flex items-center gap-2 text-brand-400 text-sm mb-2">
                <ArrowLeft size={14} /> تغيير الرقم
              </button>
              <div>
                <label className="label">رمز التحقق (OTP)</label>
                <p className="text-xs text-slate-400 mb-2">تم إرسال رمز مكون من 6 أرقام إلى {phone}</p>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="123456"
                  className="input-field text-center text-2xl tracking-widest"
                  maxLength={6}
                  required
                  dir="ltr"
                />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
                {loading ? 'جاري التحقق...' : 'تحقق'}
              </button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <button type="button" onClick={() => setStep('phone')} className="flex items-center gap-2 text-brand-400 text-sm mb-2">
                <ArrowLeft size={14} /> تغيير الرقم
              </button>
              <div>
                <label className="label">كلمة المرور</label>
                <div className="relative">
                  <Lock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pr-9"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || !password} className="btn-primary w-full">
                {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-sm mt-4">
          مستخدم جديد؟{' '}
          <Link to="/register" className="text-brand-400 font-bold hover:text-brand-300">
            سجل الآن
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
