import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';
import { sendOTP } from '../../lib/firebase';
import { VEHICLE_TYPES } from '../../lib/utils';

type Step = 'phone' | 'otp' | 'info';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<Step>(params.get('phone') ? 'otp' : 'phone');
  const [firebaseUid, setFirebaseUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    vehicleType: '',
    vehiclePlate: '',
    vehicleColor: '',
    vehicleModel: '',
  });

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const confirmation = await sendOTP(phone, 'recaptcha-container');
      setConfirmationResult(confirmation);
      setStep('otp');
      toast.success('تم إرسال رمز التحقق');
    } catch (e: any) {
      toast.error(e?.message ?? 'فشل في إرسال الرمز');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    try {
      const result = await confirmationResult.confirm(otp);
      setFirebaseUid(result.user.uid);
      setStep('info');
    } catch {
      toast.error('رمز التحقق غير صحيح');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        phone,
        firebaseUid,
        name: form.name,
        vehicleType: form.vehicleType || undefined,
        vehiclePlate: form.vehiclePlate || undefined,
        vehicleColor: form.vehicleColor || undefined,
        vehicleModel: form.vehicleModel || undefined,
      });
      login(data.token, data.user);
      toast.success(`مرحباً ${data.user.name}! تم التسجيل بنجاح`);
      navigate('/app');
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'فشل في التسجيل');
    } finally {
      setLoading(false);
    }
  }

  // If came from login with phone already verified
  useEffect(() => {
    if (params.get('phone') && step === 'otp') {
      // Trigger OTP send automatically
      setTimeout(() => {
        const btn = document.getElementById('send-otp-btn');
        btn?.click();
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen water-bg flex items-center justify-center p-4" dir="rtl">
      <div id="recaptcha-container" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-600 to-water-deep rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-glow">
            💧
          </div>
          <h1 className="text-2xl font-black text-white">إنشاء حساب جديد</h1>
          <p className="text-slate-400 text-sm mt-1">مغسلة Jadawel</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {['phone', 'otp', 'info'].map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${
              ['phone', 'otp', 'info'].indexOf(step) >= i ? 'bg-brand-600' : 'bg-slate-700'
            }`} />
          ))}
        </div>

        <div className="card">
          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <h2 className="text-lg font-black text-white">رقم جوالك</h2>
              <div>
                <label className="label">رقم الجوال السعودي</label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="input-field"
                  required
                  dir="ltr"
                />
              </div>
              <button id="send-otp-btn" type="submit" disabled={loading || !phone} className="btn-primary w-full">
                {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <button type="button" onClick={() => setStep('phone')} className="flex items-center gap-2 text-brand-400 text-sm">
                <ArrowLeft size={14} /> تغيير الرقم
              </button>
              <h2 className="text-lg font-black text-white">رمز التحقق</h2>
              <p className="text-sm text-slate-400">أدخل الرمز المرسل إلى {phone}</p>
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
              <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full">
                {loading ? 'جاري التحقق...' : 'تأكيد'}
              </button>
            </form>
          )}

          {step === 'info' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-black text-white">بياناتك الشخصية</h2>

              <div>
                <label className="label">الاسم الكامل *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="الاسم الثلاثي"
                  className="input-field"
                  required
                />
              </div>

              <div className="border-t border-slate-700 pt-4">
                <p className="text-sm font-semibold text-slate-300 mb-3">بيانات السيارة (اختياري)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">نوع السيارة</label>
                    <select
                      value={form.vehicleType}
                      onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">اختر...</option>
                      {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">رقم اللوحة</label>
                    <input
                      type="text"
                      value={form.vehiclePlate}
                      onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                      placeholder="أ ب ج 1234"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">الموديل</label>
                    <input
                      type="text"
                      value={form.vehicleModel}
                      onChange={e => setForm(f => ({ ...f, vehicleModel: e.target.value }))}
                      placeholder="كامري 2023"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">اللون</label>
                    <input
                      type="text"
                      value={form.vehicleColor}
                      onChange={e => setForm(f => ({ ...f, vehicleColor: e.target.value }))}
                      placeholder="أبيض"
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading || !form.name} className="btn-primary w-full mt-2">
                {loading ? 'جاري التسجيل...' : 'إنشاء الحساب'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-slate-400 text-sm mt-4">
          لديك حساب؟{' '}
          <Link to="/login" className="text-brand-400 font-bold hover:text-brand-300">
            سجل الدخول
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
