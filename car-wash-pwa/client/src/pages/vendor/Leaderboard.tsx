import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Medal, Star, Flame, ChevronLeft, Crown,
  TrendingUp, Zap, Target, Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';

interface Badge {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface LeaderboardEntry {
  rank: number;
  employeeId: number;
  name: string;
  completedBookings: number;
  revenue: number;
  avgRating: number;
  fiveStarCount: number;
  badges: Badge[];
  xp: number;
  level: number;
  xpInLevel: number;
  xpToNextLevel: number;
}

const periods = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
];

const rankColors: Record<number, { bg: string; text: string; icon: React.ElementType; glow: string }> = {
  1: { bg: 'from-amber-500/20 to-yellow-500/20 border-amber-500/30', text: 'text-amber-400', icon: Crown, glow: 'shadow-amber-500/20' },
  2: { bg: 'from-slate-300/10 to-slate-400/10 border-slate-400/20', text: 'text-slate-300', icon: Medal, glow: 'shadow-slate-400/10' },
  3: { bg: 'from-orange-500/10 to-amber-600/10 border-orange-500/20', text: 'text-orange-400', icon: Medal, glow: 'shadow-orange-500/10' },
};

function XPBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(100, (current / total) * 100);
  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="h-full bg-gradient-to-l from-blue-500 to-cyan-400 rounded-full"
      />
    </div>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState('month');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.get(`/gamification/leaderboard?period=${period}`).then(r => r.data),
  });

  const leaderboard: LeaderboardEntry[] = data?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/vendor" className="btn-icon">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                لوحة المتصدرين
              </h1>
              <p className="text-xs text-slate-500">تحفيز وتنافس الموظفين</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Period selector */}
        <div className="flex gap-2">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                period === p.value
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.06] hover:bg-white/[0.08]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Top 3 podium */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-3">
            {[1, 0, 2].map(idx => {
              const emp = leaderboard[idx];
              if (!emp) return null;
              const rc = rankColors[emp.rank] ?? { bg: 'from-white/5 to-white/5 border-white/10', text: 'text-slate-400', icon: Award, glow: '' };
              const RankIcon = rc.icon;
              const isFirst = emp.rank === 1;

              return (
                <motion.div
                  key={emp.employeeId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.15 }}
                  className={`card-glass p-4 text-center ${isFirst ? 'md:-mt-4' : ''} ${rc.glow ? `shadow-lg ${rc.glow}` : ''}`}
                >
                  <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${rc.bg} border flex items-center justify-center mb-3`}>
                    <RankIcon className={`w-6 h-6 ${rc.text}`} />
                  </div>
                  <p className="font-black text-white text-sm truncate">{emp.name}</p>
                  <p className={`text-2xl font-black ${rc.text} mt-1`}>{emp.completedBookings}</p>
                  <p className="text-xs text-slate-500">غسلة مكتملة</p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs text-amber-400 font-bold">{emp.avgRating}</span>
                  </div>
                  {/* Badges */}
                  {emp.badges.length > 0 && (
                    <div className="flex justify-center gap-1 mt-2">
                      {emp.badges.slice(0, 3).map(b => (
                        <span key={b.id} title={b.name} className="text-sm">{b.icon}</span>
                      ))}
                    </div>
                  )}
                  {/* XP */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-blue-400">Lv.{emp.level}</span>
                      <span className="text-slate-500">{emp.xpInLevel}/{emp.xpToNextLevel} XP</span>
                    </div>
                    <XPBar current={emp.xpInLevel} total={emp.xpToNextLevel} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full list */}
        {leaderboard.length > 0 && (
          <div className="card-glass overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                الترتيب الكامل
              </h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {leaderboard.map((emp, i) => (
                <motion.div
                  key={emp.employeeId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${
                    emp.rank <= 3
                      ? `bg-gradient-to-br ${rankColors[emp.rank]?.bg ?? ''} ${rankColors[emp.rank]?.text ?? ''}`
                      : 'bg-white/[0.06] text-slate-400'
                  }`}>
                    {emp.rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center text-sm font-bold text-white border border-white/10">
                    {emp.name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm truncate">{emp.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{emp.completedBookings} غسلة</span>
                      <span>·</span>
                      <span>{emp.revenue.toFixed(0)} ر.س</span>
                      {emp.badges.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="flex gap-0.5">
                            {emp.badges.slice(0, 2).map(b => (
                              <span key={b.id}>{b.icon}</span>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-white">{emp.avgRating}</span>
                    </div>
                    <p className="text-[10px] text-blue-400">Lv.{emp.level}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && leaderboard.length === 0 && (
          <div className="card-glass p-12 text-center">
            <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-400">لا توجد بيانات بعد</h3>
            <p className="text-sm text-slate-500 mt-2">سيظهر ترتيب الموظفين بعد إتمام الحجوزات</p>
          </div>
        )}
      </div>
    </div>
  );
}
