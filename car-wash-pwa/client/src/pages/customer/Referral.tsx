import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Copy, Share2, Users, Gift, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface MyCode {
  code: string;
  vendorName: string;
  vendorSlug: string;
}

interface ReferralStats {
  totalReferred: number;
  totalConverted: number;
  totalRewards: string;
}

export default function CustomerReferral() {
  const [copied, setCopied] = useState(false);

  const { data: myCode, isLoading: codeLoading } = useQuery<MyCode>({
    queryKey: ['referral-code'],
    queryFn: () => api.get('/referrals/my-code').then((r) => r.data),
    retry: 1,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ['referral-stats'],
    queryFn: () => api.get('/referrals/stats').then((r) => r.data),
    retry: 1,
  });

  const referralLink = myCode
    ? `https://jdawil.sa/store/${myCode.vendorSlug}/book?ref=${myCode.code}`
    : '';

  function copyCode() {
    if (!myCode?.code) return;
    navigator.clipboard.writeText(myCode.code).then(() => {
      setCopied(true);
      toast.success('تم نسخ الكود!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    if (!myCode) return;
    const msg = encodeURIComponent(
      `جرب ${myCode.vendorName} لغسيل السيارة — استخدم كودي *${myCode.code}* واحصل على خصم 10%! 🚗\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  function copyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      toast.success('تم نسخ الرابط!');
    });
  }

  const isLoading = codeLoading || statsLoading;

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-900/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-2"
        >
          <h1 className="text-2xl font-black text-white">برنامج الإحالة</h1>
          <p className="text-slate-400 text-sm mt-0.5">ادعُ أصدقاءك واربح مكافآت</p>
        </motion.div>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-brand-900/80 to-purple-900/40 border border-brand-700/30 rounded-3xl p-6 text-center"
        >
          <div className="text-5xl mb-3">🎁</div>
          <h2 className="text-white font-black text-xl mb-1">شارك مغسلتك المفضلة</h2>
          <p className="text-slate-300 text-sm">
            كل صديق يسجل باستخدام كودك — تحصل أنت وهو على خصم في الحجز القادم!
          </p>
        </motion.div>

        {/* Referral code card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/60 border border-white/10 rounded-2xl p-5"
        >
          <p className="text-slate-400 text-xs font-bold mb-3">كود الإحالة الخاص بك</p>

          {isLoading ? (
            <div className="h-14 bg-slate-800/40 rounded-xl animate-pulse" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-800/60 border border-white/10 rounded-xl px-5 py-3 text-center">
                <span className="text-white font-black text-3xl tracking-widest">
                  {myCode?.code ?? '------'}
                </span>
              </div>
              <button
                onClick={copyCode}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${
                  copied
                    ? 'bg-green-600/80 border border-green-500/40'
                    : 'bg-slate-800/60 border border-white/10 hover:bg-slate-700'
                }`}
              >
                {copied ? (
                  <Check size={18} className="text-green-300" />
                ) : (
                  <Copy size={18} className="text-slate-400" />
                )}
              </button>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
            <Users size={18} className="text-brand-400 mx-auto mb-2" />
            <p className="text-white font-black text-2xl leading-none">
              {stats?.totalReferred ?? '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1">أصدقاء دُعوا</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
            <ChevronRight size={18} className="text-green-400 mx-auto mb-2 rotate-90" />
            <p className="text-white font-black text-2xl leading-none">
              {stats?.totalConverted ?? '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1">سجّلوا فعلاً</p>
          </div>
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-center">
            <Gift size={18} className="text-amber-400 mx-auto mb-2" />
            <p className="text-white font-black text-xl leading-none">
              {stats ? `${parseFloat(stats.totalRewards).toLocaleString('ar-SA')}` : '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1">ر.س مكافآت</p>
          </div>
        </motion.div>

        {/* Share actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <button
            onClick={shareWhatsApp}
            disabled={!myCode}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-green-600/90 hover:bg-green-500 disabled:opacity-50 text-white font-black text-base transition-all active:scale-98"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            شارك عبر واتساب
          </button>

          <button
            onClick={copyLink}
            disabled={!myCode}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-slate-800/60 border border-white/10 hover:bg-slate-700/60 disabled:opacity-50 text-white font-bold text-sm transition-all active:scale-98"
          >
            <Share2 size={16} className="text-slate-400" />
            نسخ رابط الإحالة
          </button>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-900/40 border border-white/5 rounded-2xl p-5"
        >
          <h3 className="text-white font-black text-sm mb-4">كيف يعمل البرنامج؟</h3>
          <div className="space-y-3">
            {[
              { step: '١', text: 'شارك كودك مع صديق' },
              { step: '٢', text: 'يسجل صديقك ويستخدم كودك عند الحجز' },
              { step: '٣', text: 'تحصل أنت وصديقك على خصم في الحجز القادم!' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-900/50 border border-brand-700/40 flex items-center justify-center text-brand-400 text-xs font-black shrink-0">
                  {item.step}
                </div>
                <p className="text-slate-300 text-sm">{item.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
