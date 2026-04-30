import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../lib/api';

export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'super_admin') navigate('/super-admin');
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/admin-login', { phone, password });
      login(data.token, data.user);
      navigate('/super-admin');
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060e1e] flex items-center justify-center p-4" dir="rtl">
      {/* Subtle bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-blue-900/20 blur-[150px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-xl font-black text-white">Jdawil Admin</h1>
          <p className="text-sm text-slate-600 mt-1">لوحة تحكم المنصة</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الجوال</label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                required
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pr-10 pl-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-500/40 transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !phone || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-700 mt-6">
          هذه اللوحة مخصصة لمدراء منصة Jdawil فقط
        </p>
      </motion.div>
    </div>
  );
}
