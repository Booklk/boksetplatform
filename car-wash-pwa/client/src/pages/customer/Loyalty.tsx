import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, TrendingUp, TrendingDown, Gift, Star, Zap,
  Clock, CheckCircle, Crown, Sparkles,
} from 'lucide-react';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

interface LoyaltyBalance {
  balance: number;
}

interface LoyaltyTransaction {
  id?: number;
  transactionType: 'earn' | 'redeem' | 'expire' | 'adjust';
  points: number;
  description: string;
  createdAt: string;
}

interface LoyaltyProgram {
  programType: 'points' | 'punch_card' | 'disabled';
  pointsPerRiyal?: number;
  redeemRate?: number;
  tiers?: Array<{
    name: string;
    minPoints: number;
    multiplier: number;
  }>;
}

interface PunchCard {
  stampsEarned: number;
  stampsRequired: number;
}

function TransactionIcon({ type }: { type: string }) {
  if (type === 'earn') return <TrendingUp size={16} className="text-emerald-400" />;
  if (type === 'redeem') return <TrendingDown size={16} className="text-red-400" />;
  if (type === 'expire') return <Clock size={16} className="text-slate-500" />;
  return <Zap size={16} className="text-amber-400" />;
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`bg-slate-800/60 rounded-xl animate-pulse ${className}`} />;
}

/* ─── PUNCH CARD SECTION ─────────────────────────────────────────────── */
function PunchCardView({ punchCard }: { punchCard: PunchCard }) {
  const { stampsEarned, stampsRequired } = punchCard;
  const totalSlots = stampsRequired + 1; // +1 for the free slot

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Card */}
      <div
        className="relative overflow-hidden rounded-3xl p-7"
        style={{
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 40%, #b45309 100%)',
          boxShadow: '0 12px 50px rgba(180, 83, 9, 0.35)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/20 rounded-full blur-2xl" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-yellow-500/20 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-amber-200/70 text-xs font-semibold uppercase tracking-wider">بطاقة الطوابع</p>
              <h2 className="text-white font-black text-2xl mt-0.5">
                {stampsEarned} / {stampsRequired}
              </h2>
              <p className="text-amber-200 text-sm mt-0.5">
                {stampsRequired - stampsEarned > 0
                  ? `${stampsRequired - stampsEarned} غسلة متبقية للمكافأة`
                  : 'مبروك! حصلت على الغسلة المجانية 🎁'}
              </p>
            </div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-16 h-16 bg-amber-400/20 border border-amber-400/30 rounded-2xl flex items-center justify-center"
            >
              <Award size={32} className="text-amber-300" />
            </motion.div>
          </div>

          {/* Stamps grid */}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(totalSlots, 7)}, 1fr)` }}>
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const isFreeSlot = idx === stampsRequired;
              const isEarned = idx < stampsEarned;
              const isNext = idx === stampsEarned && !isFreeSlot;

              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative aspect-square rounded-2xl flex items-center justify-center text-xl"
                  style={{
                    background: isFreeSlot
                      ? 'rgba(245, 158, 11, 0.3)'
                      : isEarned
                      ? 'rgba(251, 191, 36, 0.9)'
                      : 'rgba(0,0,0,0.25)',
                    border: isFreeSlot
                      ? '2px dashed rgba(251, 191, 36, 0.7)'
                      : isNext
                      ? '2px dashed rgba(251, 191, 36, 0.5)'
                      : '2px solid rgba(255,255,255,0.08)',
                    boxShadow: isEarned ? '0 0 12px rgba(251,191,36,0.4)' : undefined,
                  }}
                >
                  {isFreeSlot ? (
                    <Gift size={20} className="text-amber-300" />
                  ) : isEarned ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, delay: idx * 0.05 }}
                    >
                      <CheckCircle size={20} className="text-amber-900" />
                    </motion.div>
                  ) : isNext ? (
                    <motion.div
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-3 h-3 rounded-full bg-amber-400/50"
                    />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                  )}
                  {isFreeSlot && (
                    <div className="absolute -top-2 right-0 bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      مجاني
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress info */}
      <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-slate-400">التقدم نحو المكافأة</span>
          <span className="text-amber-400 font-bold">
            {Math.round((stampsEarned / stampsRequired) * 100)}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(stampsEarned / stampsRequired) * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              boxShadow: '0 0 8px rgba(251,191,36,0.5)',
            }}
          />
        </div>
        <p className="text-slate-500 text-xs mt-2">
          اكسب طابعاً مع كل غسلة — أكمل {stampsRequired} غسلات واحصل على الغسلة القادمة مجاناً 🎁
        </p>
      </div>
    </motion.div>
  );
}

/* ─── POINTS SECTION ─────────────────────────────────────────────────── */
function PointsView({
  balance,
  program,
  history,
}: {
  balance: number;
  program: LoyaltyProgram;
  history: LoyaltyTransaction[];
}) {
  const tiers = program.tiers ?? [];

  // Determine current tier
  let currentTierIdx = -1;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (balance >= tiers[i].minPoints) {
      currentTierIdx = i;
      break;
    }
  }
  const currentTier = tiers[currentTierIdx];
  const nextTier = tiers[currentTierIdx + 1];
  const progressToNext = nextTier
    ? ((balance - (currentTier?.minPoints ?? 0)) / (nextTier.minPoints - (currentTier?.minPoints ?? 0))) * 100
    : 100;

  const tierColors: Record<string, string> = {
    برونزي: '#cd7f32',
    فضي: '#94a3b8',
    ذهبي: '#f59e0b',
    بلاتيني: '#818cf8',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Balance Card */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)',
          boxShadow: '0 12px 50px rgba(120, 53, 15, 0.4)',
        }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-600/15 rounded-full blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Sparkles size={16} className="text-amber-400 opacity-70" />
            <p className="text-amber-200/70 text-sm font-semibold">نقاطك الحالية</p>
            <Sparkles size={16} className="text-amber-400 opacity-70" />
          </div>

          <motion.div
            key={balance}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="text-6xl font-black text-white mb-1"
          >
            {balance.toLocaleString('ar-SA')}
          </motion.div>
          <p className="text-amber-300 text-sm font-bold">نقطة ولاء</p>

          {/* Tier badge */}
          {currentTier && (
            <div
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-1.5 rounded-full border font-bold text-sm"
              style={{
                color: tierColors[currentTier.name] ?? '#f59e0b',
                borderColor: `${tierColors[currentTier.name] ?? '#f59e0b'}50`,
                background: `${tierColors[currentTier.name] ?? '#f59e0b'}18`,
              }}
            >
              <Crown size={14} />
              مستوى {currentTier.name}
            </div>
          )}
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-slate-300 font-semibold">التقدم نحو مستوى {nextTier.name}</div>
            <div className="text-xs text-amber-400 font-bold">
              {(nextTier.minPoints - balance).toLocaleString('ar-SA')} نقطة متبقية
            </div>
          </div>
          <div className="w-full h-3 bg-slate-700/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressToNext, 100)}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                boxShadow: '0 0 10px rgba(251,191,36,0.5)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-slate-600">
            <span>{currentTier?.minPoints?.toLocaleString('ar-SA') ?? 0}</span>
            <span>{nextTier.minPoints.toLocaleString('ar-SA')}</span>
          </div>
        </div>
      )}

      {/* Earn rate info */}
      {(program.pointsPerRiyal || program.redeemRate) && (
        <div className="grid grid-cols-2 gap-3">
          {program.pointsPerRiyal && (
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-2xl p-4 text-center">
              <TrendingUp size={20} className="text-emerald-400 mx-auto mb-1.5" />
              <p className="text-2xl font-black text-white">{program.pointsPerRiyal}</p>
              <p className="text-emerald-400 text-xs font-semibold">نقطة لكل ريال</p>
            </div>
          )}
          {program.redeemRate && (
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-2xl p-4 text-center">
              <Gift size={20} className="text-blue-400 mx-auto mb-1.5" />
              <p className="text-2xl font-black text-white">{program.redeemRate}</p>
              <p className="text-blue-400 text-xs font-semibold">نقطة = 1 ريال</p>
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      {history.length > 0 && (
        <div>
          <h3 className="font-black text-white text-lg mb-4 flex items-center gap-2">
            <Star size={18} className="text-amber-400" />
            سجل النقاط
          </h3>
          <div className="space-y-2">
            {history.map((tx, idx) => (
              <motion.div
                key={tx.id ?? idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/30 rounded-2xl px-4 py-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    tx.transactionType === 'earn'
                      ? 'bg-emerald-900/40 border border-emerald-700/30'
                      : tx.transactionType === 'redeem'
                      ? 'bg-red-900/40 border border-red-700/30'
                      : 'bg-slate-700/40 border border-slate-600/30'
                  }`}
                >
                  <TransactionIcon type={tx.transactionType} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{tx.description}</p>
                  <p className="text-slate-500 text-xs">
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
                <div
                  className={`text-sm font-black shrink-0 ${
                    tx.transactionType === 'earn' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {tx.transactionType === 'earn' ? '+' : '-'}
                  {Math.abs(tx.points).toLocaleString('ar-SA')}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <Award size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">لا توجد معاملات بعد</p>
          <p className="text-xs mt-1 text-slate-600">احجز خدمة لتبدأ في كسب النقاط</p>
        </div>
      )}
    </motion.div>
  );
}

/* ─── DISABLED STATE ─────────────────────────────────────────────────── */
function DisabledState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center px-4"
    >
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-24 h-24 bg-slate-800/50 border border-slate-700/40 rounded-full flex items-center justify-center mb-5 text-5xl"
      >
        🔒
      </motion.div>
      <h3 className="text-xl font-black text-white mb-2">برنامج الولاء غير متاح</h3>
      <p className="text-slate-400 text-sm max-w-xs">
        هذه المغسلة لا تقدم برنامج ولاء حالياً — تابع التحديثات قريباً
      </p>
    </motion.div>
  );
}

/* ─── LOADING SKELETON ───────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-52 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
      <SkeletonBlock className="h-14" />
      <SkeletonBlock className="h-14" />
      <SkeletonBlock className="h-14" />
    </div>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────── */
export default function Loyalty() {
  const { data: program, isLoading: programLoading } = useQuery<LoyaltyProgram>({
    queryKey: ['loyalty-program'],
    queryFn: () => api.get('/loyalty/program').then((r) => r.data),
    retry: false,
  });

  const { data: balanceData, isLoading: balanceLoading } = useQuery<LoyaltyBalance>({
    queryKey: ['loyalty-balance'],
    queryFn: () => api.get('/loyalty/balance').then((r) => r.data),
    enabled: program?.programType === 'points',
    retry: false,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<LoyaltyTransaction[]>({
    queryKey: ['loyalty-history'],
    queryFn: () => api.get('/loyalty/history').then((r) => r.data),
    enabled: program?.programType === 'points',
    retry: false,
  });

  const { data: punchCard, isLoading: punchLoading } = useQuery<PunchCard | null>({
    queryKey: ['loyalty-punch-card'],
    queryFn: () => api.get('/loyalty/punch-card').then((r) => r.data).catch(() => null),
    enabled: program?.programType === 'punch_card',
    retry: false,
  });

  const isLoading = programLoading || balanceLoading || historyLoading || punchLoading;

  return (
    <div className="min-h-screen bg-slate-950 font-arabic" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-yellow-900/8 rounded-full blur-3xl" />
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 70% 20%, rgba(245,158,11,0.04) 0%, transparent 50%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-amber-900/40 border border-amber-700/40 rounded-2xl flex items-center justify-center">
              <Award size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">برنامج الولاء</h1>
              <p className="text-slate-400 text-xs">نقاطك ومكافآتك</p>
            </div>
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : !program || program.programType === 'disabled' ? (
            <motion.div key="disabled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DisabledState />
            </motion.div>
          ) : program.programType === 'punch_card' && punchCard ? (
            <motion.div key="punch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PunchCardView punchCard={punchCard} />
            </motion.div>
          ) : program.programType === 'punch_card' && !punchCard ? (
            <motion.div key="punch-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PunchCardView punchCard={{ stampsEarned: 0, stampsRequired: 7 }} />
            </motion.div>
          ) : program.programType === 'points' ? (
            <motion.div key="points" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PointsView
                balance={balanceData?.balance ?? 0}
                program={program}
                history={history}
              />
            </motion.div>
          ) : (
            <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DisabledState />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
