import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Loader2 } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const DISMISSED_KEY = 'push-banner-dismissed';

export default function PushNotificationBanner() {
  const { isSupported, isSubscribed, isLoading, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === '1';
  });

  // Re-check dismiss flag on mount (handles SSR hydration edge case)
  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === '1') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const handleSubscribe = async () => {
    await subscribe();
    // Once subscribed the banner will hide automatically (isSubscribed flips)
  };

  const isVisible = isSupported && !isSubscribed && !dismissed;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="push-banner"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full bg-[#0d1929] border-b border-blue-500/20"
          dir="rtl"
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-2.5">
            {/* Icon */}
            <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-blue-400" />
            </div>

            {/* Text */}
            <p className="flex-1 text-sm text-slate-300 leading-snug">
              فعّل الإشعارات لتلقّي تنبيهات الحجوزات الفورية
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSubscribe}
                disabled={isLoading}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-all"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                تفعيل
              </button>
              <button
                onClick={handleDismiss}
                aria-label="إغلاق"
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-slate-700/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
