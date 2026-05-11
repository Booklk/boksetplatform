import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Star, DollarSign, CheckCircle, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

const PERIODS = [
  { label: 'آخر 7 أيام', days: 7 },
  { label: 'آخر 30 يوم', days: 30 },
  { label: 'آخر 90 يوم', days: 90 },
];

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export default function EmployeePerformance() {
  const [period, setPeriod] = useState(30);

  const fromDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  const toDate = new Date().toISOString();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['emp-performance', period],
    queryFn: () => api.get(`/reports/employee-performance?from=${fromDate}&to=${toDate}`).then(r => r.data),
  });

  const totalCompleted = rows.reduce((s: number, r: any) => s + Number(r.totalCompleted), 0);
  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.totalRevenue), 0);

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-blue-400" />
            أداء الموظفين
          </h1>
          <p className="text-slate-400 text-sm mt-1">مقارنة الأداء والإيراد لكل موظف</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`text-xs px-4 py-2 rounded-xl border transition-all font-bold ${period === p.days ? 'bg-blue-500/30 border-blue-500/60 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <p className="text-white font-black text-xl">{totalCompleted}</p>
              <p className="text-slate-400 text-xs">غسلة مكتملة</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <DollarSign className="w-6 h-6 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-black text-xl">{totalRevenue.toFixed(0)}</p>
              <p className="text-slate-400 text-xs">ريال إجمالي</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <Trophy className="w-6 h-6 text-purple-400 mx-auto mb-1" />
              <p className="text-white font-black text-xl">{rows.length}</p>
              <p className="text-slate-400 text-xs">موظف نشط</p>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد بيانات أداء في هذه الفترة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((emp: any, idx: number) => {
              const completed = Number(emp.totalCompleted);
              const revenue = Number(emp.totalRevenue);
              const rating = emp.avgRating ? Number(emp.avgRating) : null;
              const maxCompleted = Number(rows[0]?.totalCompleted ?? 1);
              const progress = maxCompleted > 0 ? (completed / maxCompleted) * 100 : 0;

              return (
                <motion.div key={emp.employeeId} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`bg-white/5 border rounded-2xl p-5 ${idx === 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-2xl flex-shrink-0 w-8 text-center">
                      {MEDAL[idx] ?? `#${idx + 1}`}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-white font-bold">{emp.employeeName}</p>
                        {rating && (
                          <span className="flex items-center gap-0.5 text-amber-400 text-xs font-bold">
                            <Star size={11} fill="currentColor" />
                            {rating}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.05 }}
                          className={`h-full rounded-full ${idx === 0 ? 'bg-amber-400' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-orange-400' : 'bg-blue-500'}`}
                        />
                      </div>
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span><span className="text-white font-bold">{completed}</span> غسلة</span>
                        <span><span className="text-emerald-400 font-bold">{revenue.toFixed(0)}</span> ر.س</span>
                        {emp.fiveStar > 0 && <span><span className="text-amber-400 font-bold">{emp.fiveStar}</span> تقييم ⭐</span>}
                      </div>
                    </div>

                    {/* Revenue badge */}
                    <div className="flex-shrink-0 text-left">
                      <p className="text-white font-black text-lg">{(revenue / (completed || 1)).toFixed(0)}</p>
                      <p className="text-slate-500 text-xs">ر.س / غسلة</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
