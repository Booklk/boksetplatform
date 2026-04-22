import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

interface Insight {
  id: string;
  type: 'opportunity' | 'impact' | 'suggestion' | 'win';
  emoji: string;
  title: string;
  body: string;
  value: string | null;
  actionLabel: string;
  actionUrl: string;
  color: 'amber' | 'blue' | 'emerald' | 'purple' | 'rose';
}

interface InsightsMeta {
  monthBookings: number;
  timeSavedHours: number;
  inactiveCustomers: number;
  hasLoyalty: boolean;
  growth: number | null;
  curIncome: number;
  prevIncome: number;
}

const colorMap: Record<string, { bg: string; border: string; badge: string; btn: string; icon: string }> = {
  amber:   { bg: 'from-amber-900/30 to-yellow-950/20',   border: 'border-amber-500/25',   badge: 'bg-amber-500/20 text-amber-300',   btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30',   icon: 'text-amber-400' },
  blue:    { bg: 'from-blue-900/30 to-cyan-950/20',      border: 'border-blue-500/25',     badge: 'bg-blue-500/20 text-blue-300',     btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30',     icon: 'text-blue-400' },
  emerald: { bg: 'from-emerald-900/30 to-teal-950/20',   border: 'border-emerald-500/25',  badge: 'bg-emerald-500/20 text-emerald-300', btn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30', icon: 'text-emerald-400' },
  purple:  { bg: 'from-purple-900/30 to-violet-950/20',  border: 'border-purple-500/25',   badge: 'bg-purple-500/20 text-purple-300', btn: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30', icon: 'text-purple-400' },
  rose:    { bg: 'from-rose-900/30 to-pink-950/20',      border: 'border-rose-500/25',     badge: 'bg-rose-500/20 text-rose-300',     btn: 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30',     icon: 'text-rose-400' },
};

const typeLabel: Record<string, string> = {
  opportunity: 'فرصة',
  impact: 'إنجاز',
  suggestion: 'اقتراح',
  win: 'نمو',
};

export default function SmartInsights() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{ insights: Insight[]; meta: InsightsMeta }>({
    queryKey: ['smart-insights', user?.vendorId],
    queryFn: () => api.get('/reports/insights').then(r => r.data),
    enabled: !!user?.vendorId,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="h-5 w-36 bg-slate-800 rounded mb-3 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="h-28 bg-slate-800/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const insights = data?.insights ?? [];
  const meta = data?.meta;

  if (insights.length === 0) return null;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h2 className="text-white font-black text-sm">رؤى ذكية مخصصة لمتجرك</h2>
        </div>
        {meta && (
          <span className="text-xs text-slate-500">
            بناءً على {meta.monthBookings} حجز هذا الشهر
          </span>
        )}
      </div>

      {/* Impact summary bar */}
      {meta && (meta.timeSavedHours > 0 || meta.curIncome > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex flex-wrap gap-3 bg-slate-800/40 border border-slate-700/40 rounded-2xl px-4 py-3"
        >
          {meta.timeSavedHours > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-base">⚡</span>
              <div>
                <div className="text-white font-black text-sm">{meta.timeSavedHours} ساعة</div>
                <div className="text-slate-500 text-[10px]">وُفّرت من العمل اليدوي</div>
              </div>
            </div>
          )}
          {meta.curIncome > 0 && (
            <>
              <div className="w-px bg-slate-700/60 self-stretch hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-base">💰</span>
                <div>
                  <div className="text-white font-black text-sm">{meta.curIncome.toLocaleString('ar-SA')} ر.س</div>
                  <div className="text-slate-500 text-[10px]">دخل هذا الشهر</div>
                </div>
              </div>
            </>
          )}
          {meta.growth !== null && (
            <>
              <div className="w-px bg-slate-700/60 self-stretch hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className={`text-base ${meta.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {meta.growth >= 0 ? '📈' : '📉'}
                </span>
                <div>
                  <div className={`font-black text-sm ${meta.growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {meta.growth >= 0 ? '+' : ''}{meta.growth}%
                  </div>
                  <div className="text-slate-500 text-[10px]">مقارنة بالشهر الماضي</div>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Insight cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {insights.map((insight, idx) => {
          const c = colorMap[insight.color] ?? colorMap.blue;
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
              className={`relative bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4 flex flex-col gap-3`}
            >
              {/* Type badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{insight.emoji}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
                    {typeLabel[insight.type]}
                  </span>
                </div>
                {insight.value && (
                  <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {insight.value}
                  </span>
                )}
              </div>

              {/* Content */}
              <div>
                <p className="text-white font-black text-sm leading-snug">{insight.title}</p>
                <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{insight.body}</p>
              </div>

              {/* Action */}
              <Link
                to={insight.actionUrl}
                className={`self-start text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${c.btn}`}
              >
                {insight.actionLabel} ←
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
