/**
 * ProTrialBanner — friendly "جرّب Pro شهر على حسابنا" card.
 *
 * Shows on the vendor dashboard for vendors who are eligible
 * (free plan, never used the trial). If the vendor is currently
 * in a trial, shows a gentle countdown + what's unlocked. Once
 * the trial expires or the vendor converts to paid Pro, this
 * component renders nothing.
 *
 * Tone: warm, supportive, not pushy. The point is "we want you to
 * feel the value, not feel pressured".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Sparkles, Gift, Clock, ArrowLeft, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface TrialStatus {
  eligible: boolean;
  status: 'free' | 'trial' | 'active' | 'suspended' | 'expired';
  trialEndsAt: string | null;
  daysRemaining: number;
  justExpired?: boolean;
}

export default function ProTrialBanner() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TrialStatus>({
    queryKey: ['trial-status'],
    queryFn: () => api.get('/vendors/my/trial-status').then((r) => r.data),
  });

  const startTrial = useMutation({
    mutationFn: () => api.post('/vendors/my/start-trial').then((r) => r.data),
    onSuccess: (res) => {
      toast.success(res.message ?? 'بدأت التجربة! مبروك عليك Pro', { duration: 5000 });
      qc.invalidateQueries({ queryKey: ['trial-status'] });
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      qc.invalidateQueries({ queryKey: ['vendor-me'] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? 'تعذّر بدء التجربة'),
  });

  if (isLoading || !data) return null;
  // Active Pro subscriber — nothing to show.
  if (data.status === 'active') return null;

  // Currently in trial — show countdown card.
  // Tone ramps up gently as the deadline approaches:
  //   > 3 days    : relaxed "enjoy Pro"
  //   2-3 days    : soft nudge "3 days left — hope it's useful"
  //   1 day       : explicit "tomorrow we flip back to free"
  //   0 days same : last-day call to action
  if (data.status === 'trial' && data.daysRemaining > 0) {
    const d = data.daysRemaining;
    const urgent = d <= 3;
    const lastDay = d <= 1;
    const headline =
      lastDay ? 'آخر يوم في تجربة Pro'
      : urgent ? `باقي ${d} ${d === 2 ? 'يومين' : 'أيام'} في تجربة Pro`
      : 'أنت في تجربة Pro — استمتع 🌿';
    const body =
      lastDay
        ? 'بكرا نرجعك للباقة المجانية تلقائياً. بياناتك كلها محفوظة — ما تخسر شي. إذا عجبتك Pro، تقدر تشترك من صفحة الاشتراك.'
      : urgent
        ? `بعد ${d} ${d === 2 ? 'يومين' : 'أيام'} نرجعك للباقة المجانية تلقائياً بدون أي خصومات. اذا حبيت Pro تقدر تكمّل بـ 99 ر.س/شهر.`
        : 'كل أدوات Pro مفتوحة — واتساب، POS، مخزون، CRM، المستشار الذكي، وكل الـ 40 قالب. نبيك تجرّب براحتك قبل أي قرار.';

    const tone = lastDay
      ? 'border-amber-500/30 from-amber-500/10'
      : urgent
      ? 'border-amber-500/20 from-amber-500/5'
      : 'border-indigo-500/20 from-indigo-500/10';
    const iconWrap = urgent
      ? 'bg-amber-500/20 border-amber-500/30'
      : 'bg-indigo-500/20 border-indigo-500/30';
    const iconCls = urgent ? 'text-amber-300' : 'text-indigo-300';
    const badge = urgent
      ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
      : 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border bg-gradient-to-br via-slate-900/40 to-transparent p-5 ${tone}`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${iconWrap}`}>
            <Sparkles className={`w-5 h-5 ${iconCls}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <p className="font-black text-white">{headline}</p>
              <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${badge}`}>
                <Clock size={10} />
                {d} {d === 1 ? 'يوم' : 'يوم'} متبقي
              </span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
            {urgent && (
              <a
                href="/vendor/platform-sub"
                className="inline-flex items-center gap-1.5 mt-3 text-indigo-300 hover:text-white text-sm font-bold transition-colors"
              >
                كمّل على Pro
                <ArrowLeft size={12} />
              </a>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Trial just expired — friendly goodbye (shown once).
  if (data.justExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-rose-300" />
          </div>
          <div className="flex-1">
            <p className="font-black text-white mb-1">انتهت تجربة Pro — شكراً لك</p>
            <p className="text-slate-400 text-sm leading-relaxed mb-3">
              رجعناك للباقة المجانية. متجرك وكل بياناتك محفوظة كما هي.
              إذا عجبتك أدوات Pro، تقدر تشترك وقتما تحب.
            </p>
            <a
              href="/vendor/platform-sub"
              className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-white text-sm font-bold transition-colors"
            >
              شوف باقات Pro
              <ArrowLeft size={12} />
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  // Not eligible any more and not trial — hide.
  if (!data.eligible) return null;

  // ─── The actual "try Pro free" offer ──────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-900/30 via-slate-900 to-violet-900/20 p-5 sm:p-6"
    >
      <Sparkles className="absolute top-4 left-4 w-5 h-5 text-indigo-400/40 pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Gift className="w-7 h-7 text-indigo-300" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-black text-white text-lg">تبي تجرّب Pro قبل ما تقرّر؟</h3>
            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              على حسابنا
            </span>
          </div>

          <p className="text-slate-300 text-sm mb-4 leading-relaxed max-w-xl">
            ٣٠ يوم Pro كاملة — بدون بطاقة، بدون التزام.
            تجرّب كل الأدوات براحتك، وإذا حسّيت إنها تخدمك اشترك. وإذا ما عجبتك،
            نرجعك للباقة المجانية بكل بياناتك كما هي — ما تخسر شي.
          </p>

          <ul className="text-xs text-slate-400 space-y-1.5 mb-5">
            <li>✓ واتساب (إشعارات + حملات + أتمتة)</li>
            <li>✓ POS + كاشير + مخزون + موردين</li>
            <li>✓ CRM + تصنيف عملاء + برنامج ولاء</li>
            <li>✓ إدارة موظفين + رواتب + بونصات + GPS</li>
            <li>✓ قوائم مالية متقدمة + Google Maps</li>
            <li>✓ 40 قالب + المستشار الذكي AI</li>
          </ul>

          <button
            onClick={() => startTrial.mutate()}
            disabled={startTrial.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            {startTrial.isPending ? 'لحظة...' : 'ابدأ تجربة الشهر'}
            <ArrowLeft size={14} />
          </button>

          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            ما نأخذ منك رقم بطاقة. بعد ٣٠ يوم نرجعك للباقة المجانية تلقائياً إلا إذا
            اخترت الاشتراك.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
