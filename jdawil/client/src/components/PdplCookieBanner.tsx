import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, ShieldCheck, X } from 'lucide-react';
import api from '../lib/api';

const STORAGE_KEY = 'pdpl-cookie-consent-v1';

function getOrCreateAnonId(): string {
  let id = localStorage.getItem('jdawil-anon-id');
  if (!id) {
    id = `anon_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem('jdawil-anon-id', id);
  }
  return id;
}

/**
 * One-time cookie consent banner. Logs the choice via /api/pdpl/consent
 * with anonId so we have audit-defensible proof later. Disappears once
 * the visitor has decided.
 */
export function PdplCookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Slight delay so we don't compete with first-paint LCP.
      const t = window.setTimeout(() => setShow(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, []);

  const decide = async (granted: boolean) => {
    localStorage.setItem(STORAGE_KEY, granted ? 'accepted' : 'rejected');
    setShow(false);
    try {
      await api.post('/pdpl/consent', {
        scope: 'cookies',
        granted,
        anonId: getOrCreateAnonId(),
      });
    } catch {
      // Silent — the localStorage flag still suppresses re-prompting.
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          dir="rtl"
          className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:left-auto sm:max-w-md z-[60]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="rounded-2xl border border-white/15 bg-[#0d1929]/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-300">
                <Cookie className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">نستخدم Cookies بسيطة</p>
                <p className="text-slate-400 text-xs leading-relaxed mt-1">
                  لتحسين تجربتك ومعرفة أين يحتاج الموقع تطوير. لا نبيع بياناتك أبداً —
                  متوافقون مع نظام حماية البيانات السعودي (PDPL).
                </p>
                <a href="/privacy" className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 mt-1.5">
                  <ShieldCheck className="w-3 h-3" /> سياسة الخصوصية الكاملة
                </a>
              </div>
              <button
                onClick={() => decide(false)}
                className="shrink-0 w-7 h-7 rounded-full hover:bg-white/10 text-slate-400"
                aria-label="رفض"
                title="رفض"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => decide(false)}
                className="flex-1 py-2 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
              >
                الضرورية فقط
              </button>
              <button
                onClick={() => decide(true)}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold"
              >
                موافق على الكل
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
