import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AchievementToastData {
  id: string;
  emoji: string;
  title: string;
  points: number;
}

interface AchievementToastProps {
  data: AchievementToastData;
  onDismiss: () => void;
  duration?: number;
}

export function AchievementToast({
  data,
  onDismiss,
  duration = 4000,
}: AchievementToastProps) {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(interval);
        setVisible(false);
        setTimeout(onDismiss, 400);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ x: 120, opacity: 0, scale: 0.85 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          exit={{ x: 120, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="relative overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #78350f 0%, #b45309 45%, #d97706 100%)',
            minWidth: 280,
            maxWidth: 340,
          }}
          dir="rtl"
        >
          {/* Sparkle overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-yellow-200 rounded-full"
                style={{
                  top: `${15 + Math.random() * 70}%`,
                  left: `${10 + Math.random() * 80}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            {/* Emoji */}
            <motion.div
              animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl shrink-0"
            >
              {data.emoji}
            </motion.div>

            {/* Text */}
            <div className="flex-1">
              <p className="text-xs text-amber-200 font-bold mb-0.5">🏅 إنجاز جديد!</p>
              <p className="text-white font-black text-base leading-tight">{data.title}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-yellow-300 font-black text-sm">+{data.points}</span>
                <span className="text-amber-200 text-xs">نقطة</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-amber-900/40">
            <motion.div
              className="h-full bg-yellow-300/80"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper: show achievement toast via react-hot-toast custom renderer
import toast from 'react-hot-toast';

export function showAchievementToast(data: AchievementToastData) {
  toast.custom(
    (t) => (
      <AchievementToast
        data={data}
        onDismiss={() => toast.dismiss(t.id)}
        duration={4000}
      />
    ),
    { duration: 5000, position: 'top-left' }
  );
}
