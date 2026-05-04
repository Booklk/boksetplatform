import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, TrendingDown, AlertCircle, Lightbulb, Sparkles, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';

interface Stat {
  label: string;
  value: number;
  suffix?: string;
  deltaPct: number;
  invertDelta?: boolean;
}
interface Recommendation {
  priority: 'high' | 'normal' | 'low';
  title: string;
  body: string;
  action?: { label: string; link: string };
}
interface WeeklyResponse {
  vendor: { nameAr: string; industry: string; industryLabel: string };
  thisWeek: { bookings: number; revenue: number; noShow: number; completed: number; cancelled: number };
  lastWeek: { bookings: number; revenue: number; noShow: number; completed: number; cancelled: number };
  stats: Stat[];
  benchmark: { priceRangeSar: string; margingPct: string; peakPattern: string };
  recommendations: Recommendation[];
  generatedAt: string;
}

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-rose-500/40 bg-rose-500/5',
  normal: 'border-blue-500/30 bg-blue-500/5',
  low: 'border-slate-500/20 bg-slate-500/5',
};
const PRIORITY_ICON: Record<string, typeof AlertCircle> = {
  high: AlertCircle,
  normal: Lightbulb,
  low: Sparkles,
};

export default function VendorAiWeekly() {
  const { data, isLoading } = useQuery<WeeklyResponse>({
    queryKey: ['ai-weekly'],
    queryFn: async () => (await api.get('/ai-weekly/me')).data,
  });

  if (isLoading || !data) {
    return <div className="p-6 text-center text-slate-400" dir="rtl">جاري تجهيز التقرير الأسبوعي…</div>;
  }

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-indigo-500/30 bg-gradient-to-bl from-indigo-500/10 to-transparent p-6 sm:p-8 mb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <Brain className="w-7 h-7 text-indigo-300" />
          <h1 className="text-2xl sm:text-3xl font-black text-white">تقريرك الأسبوعي</h1>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          تحليل بيانات آخر 7 أيام مقارنة بالأسبوع السابق + توصيات لقطاع{' '}
          <span className="text-indigo-300 font-bold">{data.vendor.industryLabel}</span>.
        </p>
        <p className="text-slate-500 text-xs mt-2">
          آخر تحديث: {new Date(data.generatedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      </motion.div>

      {/* Vital stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {data.stats.map((s, i) => {
          const isUp = s.deltaPct > 0;
          const goodDelta = s.invertDelta ? !isUp : isUp;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="text-xs text-slate-400 mb-1">{s.label}</p>
              <p className="text-2xl font-black text-white">
                {s.value.toLocaleString('ar-SA')}
                {s.suffix && <span className="text-sm font-normal text-slate-400 mr-1">{s.suffix}</span>}
              </p>
              {s.deltaPct !== 0 && (
                <div className={`flex items-center gap-1 text-xs mt-1.5 font-bold ${goodDelta ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(s.deltaPct)}٪ مقارنة بالأسبوع السابق
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Sector benchmark */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5 mb-6"
      >
        <h2 className="text-amber-200 font-bold text-sm mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          معايير قطاع {data.vendor.industryLabel}
        </h2>
        <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
          <li><span className="text-slate-500">نطاق الأسعار:</span> {data.benchmark.priceRangeSar}</li>
          <li><span className="text-slate-500">هامش الربح:</span> {data.benchmark.margingPct}</li>
          <li><span className="text-slate-500">الذروة:</span> {data.benchmark.peakPattern}</li>
        </ul>
      </motion.div>

      {/* Recommendations */}
      <h2 className="text-white font-bold text-base mb-3">توصيات لهذا الأسبوع</h2>
      <div className="space-y-2">
        {data.recommendations.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">لا توجد توصيات — الأسبوع ممتاز 🎉</p>
        ) : (
          data.recommendations.map((r, i) => {
            const Icon = PRIORITY_ICON[r.priority];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-4 ${PRIORITY_BORDER[r.priority]}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm">{r.title}</h3>
                    <p className="text-slate-300 text-xs mt-1 leading-relaxed">{r.body}</p>
                    {r.action && (
                      <Link
                        to={r.action.link}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-indigo-300 hover:text-indigo-200 font-bold"
                      >
                        {r.action.label}
                        <ArrowLeft className="w-3 h-3 rotate-180" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
