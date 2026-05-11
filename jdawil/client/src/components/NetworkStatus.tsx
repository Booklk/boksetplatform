import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[100] bg-amber-600 text-white px-4 py-2.5 text-center shadow-lg"
          dir="rtl"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-bold">
            <WifiOff className="w-4 h-4" />
            <span>لا يوجد اتصال بالإنترنت</span>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[100] bg-emerald-600 text-white px-4 py-2.5 text-center shadow-lg"
          dir="rtl"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-bold">
            <Wifi className="w-4 h-4" />
            <span>تم استعادة الاتصال</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
