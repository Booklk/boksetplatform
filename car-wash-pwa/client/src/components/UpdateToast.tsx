/**
 * UpdateToast — bottom-centered floater that offers a one-click reload
 * when a new app version is waiting. Only appears if the user was
 * mid-typing when the update landed (see useAppUpdate for the logic).
 * Uses the same formal palette as the rest of the platform.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateToast() {
  const { updateAvailable, apply } = useAppUpdate();

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[60] max-w-md mx-auto"
          dir="rtl"
        >
          <button
            onClick={apply}
            className="w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 transition-colors"
          >
            <RefreshCw size={16} className="shrink-0" />
            <div className="flex-1 text-right">
              <p className="font-black text-sm">نسخة جديدة جاهزة</p>
              <p className="text-[11px] opacity-80">اضغط للتحديث — بياناتك الحالية محفوظة</p>
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
