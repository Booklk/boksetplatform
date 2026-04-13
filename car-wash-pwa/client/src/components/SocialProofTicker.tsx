import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, MapPin } from 'lucide-react';

// Simulated activity data for social proof (before real data loads)
const fallbackActivities = [
  { message: 'مغسلة الفخامة انضمت للمنصة', city: 'الرياض', minutesAgo: 3 },
  { message: 'مغسلة الكريستال أكملت 50 حجز', city: 'جدة', minutesAgo: 8 },
  { message: 'مغسلة النجمة فعّلت نظام الولاء', city: 'الدمام', minutesAgo: 15 },
  { message: 'مغسلة الألماس انضمت للمنصة', city: 'مكة', minutesAgo: 22 },
  { message: 'مغسلة الصفوة أكملت 100 حجز', city: 'الرياض', minutesAgo: 35 },
  { message: 'مغسلة المروج بدأت التجربة المجانية', city: 'الخبر', minutesAgo: 45 },
];

function timeAgo(minutes: number): string {
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.floor(hours / 24)} يوم`;
}

export default function SocialProofTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show after 3 seconds
    const showTimer = setTimeout(() => setIsVisible(true), 3000);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex(i => (i + 1) % fallbackActivities.length);
        setIsVisible(true);
      }, 500);
      // Auto-hide after 5 seconds, show next after 8
    }, 6000);
    return () => clearInterval(interval);
  }, [isVisible]);

  const activity = fallbackActivities[currentIndex];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-6 z-50 max-w-xs hidden md:block"
          dir="rtl"
        >
          <div className="glass-premium rounded-2xl p-4 flex items-start gap-3 shadow-xl shadow-black/30">
            {/* Green dot */}
            <div className="mt-0.5 w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-snug">
                {activity.message}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" />
                  {activity.city}
                </span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-500">{timeAgo(activity.minutesAgo)}</span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsVisible(false)}
              className="text-slate-500 hover:text-white text-xs mt-0.5"
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
