import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Phone, ArrowRight, KeyRound, MessageSquare } from 'lucide-react';
import api from '../../lib/api';

type Step = 'phone' | 'code';

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(params.get('phone') ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    try {
      await api.post('/auth/request-password-reset', { phone });
      toast.success('إذا كان الرقم مسجلاً، أرسلنا رمز استرجاع على واتساب');
      setStep('code');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || newPassword.length < 6) {
      toast.error('أكمل الرمز وكلمة المرور (6 أحرف على الأقل)');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { phone, code, newPassword });
      toast.success('تم تغيير كلمة المرور. سجّل الدخول الآن');
      navigate('/login');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'الرمز غير صحيح أو منتهي');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-1" dir="rtl">
      <div className="w-full max-w-md glass-premium rounded-2xl p-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 mx-auto mb-4">
          <KeyRound className="text-brand-400" size={22} />
        </div>
        <h1 className="text-2xl font-black text-center text-white mb-2">استرجاع كلمة المرور</h1>
        <p className="text-center text-slate-400 text-sm mb-6">
          {step === 'phone'
            ? 'أدخل رقم جوالك وبنرسلك رمز استرجاع على واتساب.'
            : 'اكتب الرمز اللي وصلك على واتساب وكلمة مرور جديدة.'}
        </p>

        {step === 'phone' ? (
          <form onSubmit={requestReset} className="space-y-4">
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pr-10 pl-4 text-white text-center placeholder:text-slate-500 focus:outline-none focus:border-brand-400/60"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !phone}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <MessageSquare size={16} />
              {loading ? '…' : 'إرسال رمز على واتساب'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={10}
              dir="ltr"
              required
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-4 text-white text-center tracking-widest font-mono placeholder:text-slate-500 focus:outline-none focus:border-brand-400/60"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              required
              minLength={6}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-4 text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-400/60"
            />
            <button
              type="submit"
              disabled={loading || !code || newPassword.length < 6}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? '…' : 'تأكيد وتغيير كلمة المرور'}
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-xs text-slate-400 hover:text-brand-300 transition-colors"
            >
              ما وصلني رمز — إعادة إرسال
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-xs text-slate-400 hover:text-brand-300 transition-colors">
            ← رجوع لتسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
