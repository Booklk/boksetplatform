import { motion, AnimatePresence } from 'framer-motion';

interface PullRefreshIndicatorProps {
  pullDistance: number;
  isPulling: boolean;
  isRefreshing: boolean;
}

export function PullRefreshIndicator({ pullDistance, isPulling, isRefreshing }: PullRefreshIndicatorProps) {
  const visible = pullDistance > 8 || isRefreshing;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex items-center justify-center py-3 pointer-events-none select-none"
          style={{ height: Math.min(pullDistance, 72) }}
        >
          <div className="flex items-center gap-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700/60 rounded-full px-4 py-2 shadow-xl">
            {isRefreshing ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                  className="text-base leading-none"
                >
                  ⟳
                </motion.span>
                <span className="text-sm font-bold text-brand-300">جاري التحديث</span>
              </>
            ) : (
              <>
                <motion.span
                  animate={{ y: isPulling ? 2 : -2 }}
                  transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.6 }}
                  className="text-base leading-none"
                >
                  ↓
                </motion.span>
                <span className="text-sm font-bold text-slate-300">
                  {isPulling ? 'أفلت للتحديث' : 'اسحب للتحديث'}
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
