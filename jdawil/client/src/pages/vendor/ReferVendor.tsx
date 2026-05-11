import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Users, Gift, Copy, Share2, ChevronLeft, CheckCircle,
  MessageSquare, QrCode, Link2, Star, Award, Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';

export default function ReferVendor() {
  const [copied, setCopied] = useState(false);

  // Generate or get referral code
  const generateMutation = useMutation({
    mutationFn: () => api.post('/vendor-referral/generate').then(r => r.data),
  });

  // My referral stats
  const { data: referralData } = useQuery({
    queryKey: ['my-vendor-referrals'],
    queryFn: () => api.get('/vendor-referral/my-referrals').then(r => r.data),
  });

  const code = generateMutation.data?.code;
  const link = generateMutation.data?.link;
  const whatsappMsg = generateMutation.data?.whatsappMessage;
  const stats = referralData?.stats;
  const referrals = referralData?.referrals ?? [];

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم النسخ!');
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    if (!whatsappMsg) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/vendor" className="btn-icon"><ChevronLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-amber-400" />
              ادعُ صاحب مغسلة
            </h1>
            <p className="text-xs text-slate-500">اكسب شهر مجاني عن كل مغسلة تنضم بإحالتك</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass p-6 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
              <Gift className="w-10 h-10 text-amber-400" />
            </motion.div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">ادعُ مغسلة واكسب شهر مجاني</h2>
          <p className="text-slate-400 max-w-lg mx-auto mb-4 leading-relaxed">
            شارك رابط الإحالة مع أصحاب مغاسل تعرفهم. المُحال يحصل على
            <span className="text-emerald-400 font-bold"> 7 أيام إضافية</span> فوق التجربة المجانية.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 max-w-md mx-auto mb-6">
            <p className="text-amber-400 text-sm font-bold">
              المكافأة تُمنح بعد اشتراك التاجر المُحال فعلياً (دفع) — وليس فقط التجربة المجانية
            </p>
          </div>

          {!code ? (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="btn-primary text-lg px-8 py-4 mx-auto"
            >
              {generateMutation.isPending ? 'جاري الإنشاء...' : 'أنشئ رابط الإحالة'}
            </motion.button>
          ) : (
            <div className="space-y-4">
              {/* Referral Code */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 max-w-md mx-auto">
                <p className="text-xs text-slate-500 mb-2">كود الإحالة</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-2xl font-black text-amber-400 tracking-widest text-center" dir="ltr">
                    {code}
                  </span>
                  <button
                    onClick={() => copyToClipboard(code)}
                    className="btn-icon"
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Referral Link */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 max-w-md mx-auto">
                <p className="text-xs text-slate-500 mb-2">رابط الإحالة</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-blue-400 truncate" dir="ltr">{link}</span>
                  <button onClick={() => copyToClipboard(link!)} className="btn-icon">
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Share Buttons */}
              <div className="flex gap-3 justify-center flex-wrap max-w-md mx-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={shareWhatsApp}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-bold text-sm hover:bg-emerald-600/30 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  شارك عبر واتساب
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => copyToClipboard(whatsappMsg!)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/20 font-bold text-sm hover:bg-blue-600/30 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  انسخ الرسالة
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Send, label: 'إحالات مرسلة', value: stats.total, color: 'text-blue-400' },
              { icon: Users, label: 'سجّلوا (تجربة)', value: stats.registered ?? 0, color: 'text-purple-400' },
              { icon: CheckCircle, label: 'اشتركوا (دفعوا)', value: stats.converted, color: 'text-emerald-400' },
              { icon: Award, label: 'مكافآت مكتسبة', value: stats.rewardsEarned, color: 'text-amber-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card-glass p-4 text-center"
              >
                <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Referral History */}
        {referrals.length > 0 && (
          <div className="card-glass overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="font-bold text-white">سجل الإحالات</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {referrals.map((ref: any) => (
                <div key={ref.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                    ref.status === 'rewarded' ? 'bg-amber-500/10 text-amber-400' :
                    ref.status === 'converted' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {ref.status === 'rewarded' ? <Star className="w-4 h-4" /> :
                     ref.status === 'converted' ? <CheckCircle className="w-4 h-4" /> :
                     <Users className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">
                      {ref.referredVendorName ?? 'في انتظار التسجيل'}
                    </p>
                    <p className="text-xs text-slate-500">
                      كود: {ref.code} · {
                        ref.status === 'pending' ? 'لم يُستخدم بعد' :
                        ref.status === 'registered' ? '⏳ سجّل (فترة تجربة)' :
                        ref.status === 'converted' ? '✅ اشترك ودفع' :
                        ref.status === 'rewarded' ? '🎁 تم منح المكافأة' :
                        ref.status === 'expired' ? '❌ انتهت التجربة بدون اشتراك' :
                        ref.status
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="card-glass p-6">
          <h3 className="text-lg font-bold text-white mb-4">كيف يعمل البرنامج؟</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: '1', icon: Share2, title: 'شارك الرابط', desc: 'أرسل رابط الإحالة لأصحاب مغاسل تعرفهم عبر واتساب' },
              { step: '2', icon: Users, title: 'يسجلون مجاناً', desc: 'صاحب المغسلة يسجل ويجرب المنصة 14+7 يوم مجاناً' },
              { step: '3', icon: Gift, title: 'تكسب شهر مجاني', desc: 'عندما يفعّل اشتراكه تحصل على شهر مجاني تلقائياً' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-blue-400" />
                </div>
                <p className="font-bold text-white text-sm mb-1">{item.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
