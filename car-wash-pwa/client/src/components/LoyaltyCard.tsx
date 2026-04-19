import { Gift, Star } from 'lucide-react';
import { motion } from 'framer-motion';

interface LoyaltyCardProps {
  programType: 'points' | 'punch_card' | 'disabled';
  balance?: number;
  stampsEarned?: number;
  stampsRequired?: number;
  tierName?: string;
  mini?: boolean;
}

export default function LoyaltyCard({
  programType,
  balance = 0,
  stampsEarned = 0,
  stampsRequired = 10,
  tierName,
  mini = false,
}: LoyaltyCardProps) {
  if (programType === 'disabled') {
    return (
      <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6 text-center">
        <p className="text-slate-500 text-sm">برنامج الولاء غير مفعّل</p>
      </div>
    );
  }

  if (mini) {
    return (
      <div className="bg-amber-900/30 backdrop-blur border border-amber-700/40 rounded-2xl px-4 py-3 flex items-center justify-between gap-4" dir="rtl">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
          {programType === 'points' ? (
            <span className="text-amber-300 font-bold text-lg">
              {balance?.toLocaleString('ar-SA')}
              <span className="text-amber-400/70 text-xs font-normal mr-1">نقطة</span>
            </span>
          ) : (
            <span className="text-amber-300 font-bold text-lg">
              {stampsEarned}/{stampsRequired}
            </span>
          )}
        </div>
        {tierName && (
          <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded-lg border border-amber-500/30 font-medium">
            {tierName}
          </span>
        )}
      </div>
    );
  }

  if (programType === 'points') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-amber-900/60 to-yellow-900/40 backdrop-blur border border-amber-700/40 rounded-2xl p-6"
        dir="rtl"
      >
        <div className="flex items-start justify-between mb-4">
          <Star className="w-6 h-6 text-amber-400" fill="currentColor" />
          {tierName && (
            <span className="bg-amber-500/20 text-amber-300 text-sm px-3 py-1 rounded-xl border border-amber-500/30 font-medium">
              {tierName}
            </span>
          )}
        </div>
        <div className="text-center py-4">
          <p className="text-amber-200/60 text-sm mb-1">رصيد نقاطك</p>
          <p className="text-5xl font-bold text-amber-300 mb-1">
            {balance?.toLocaleString('ar-SA')}
          </p>
          <p className="text-amber-400/70 text-sm">نقطة</p>
        </div>
      </motion.div>
    );
  }

  // punch_card
  const stamps = Array.from({ length: stampsRequired }, (_, i) => i);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-900/60 to-yellow-900/40 backdrop-blur border border-amber-700/40 rounded-2xl p-6"
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-amber-200 font-semibold">بطاقة الطوابع</p>
        {tierName && (
          <span className="bg-amber-500/20 text-amber-300 text-sm px-3 py-1 rounded-xl border border-amber-500/30 font-medium">
            {tierName}
          </span>
        )}
      </div>
      <p className="text-amber-200/60 text-xs mb-4">
        {stampsEarned} من {stampsRequired} طابع
      </p>
      <div className="flex flex-wrap gap-2 justify-center">
        {stamps.map((i) => {
          const isFilled = i < stampsEarned;
          const isLast = i === stampsRequired - 1;
          return (
            <div
              key={i}
              className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                isFilled
                  ? 'bg-amber-500 border-amber-400'
                  : 'bg-amber-900/30 border-amber-700/50'
              }`}
            >
              {isLast ? (
                <Gift className={`w-4 h-4 ${isFilled ? 'text-white' : 'text-amber-700'}`} />
              ) : (
                <Star
                  className={`w-4 h-4 ${isFilled ? 'text-white' : 'text-amber-700/40'}`}
                  fill={isFilled ? 'currentColor' : 'none'}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
