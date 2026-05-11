import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Droplets, X, Download } from 'lucide-react';
import { useVendorTheme } from '../store/vendorTheme';

// Extend Window for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const SESSION_KEY_BASE = 'install-prompt-dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroid, setShowAndroid] = useState(false);
  const [showIOS, setShowIOS] = useState(false);

  // When a customer is browsing a vendor storefront, vendorTheme is populated
  // and we want the prompt to advertise that vendor's app, not generic بُكسِت.
  const vendor = useVendorTheme();
  const isVendorScoped = !!vendor.slug;
  const sessionKey = isVendorScoped ? `${SESSION_KEY_BASE}:${vendor.slug}` : SESSION_KEY_BASE;
  const accentColor = isVendorScoped ? vendor.primaryColor : '#3b82f6';
  const displayName = isVendorScoped && vendor.nameAr ? vendor.nameAr : 'التطبيق';

  useEffect(() => {
    // Don't show if already dismissed this session for the current scope.
    if (sessionStorage.getItem(sessionKey)) {
      setShowAndroid(false);
      setShowIOS(false);
      return;
    }

    // Detect iOS Safari (not standalone)
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !('standalone' in navigator && (navigator as any).standalone);

    if (isIOS) {
      setShowIOS(true);
      return;
    }

    // Listen for Chrome / Android beforeinstallprompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroid(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [sessionKey]);

  const dismiss = () => {
    sessionStorage.setItem(sessionKey, '1');
    setShowAndroid(false);
    setShowIOS(false);
    setDeferredPrompt(null);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      dismiss();
    }
  };

  const isVisible = showAndroid || showIOS;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="install-prompt"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-20 md:bottom-6 inset-x-3 z-50 max-w-md mx-auto"
          dir="rtl"
        >
          <div
            className="bg-[#0d1929] rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
            style={{
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: `${accentColor}55`,
              boxShadow: `0 24px 48px -16px ${accentColor}44`,
            }}
          >
            {/* App icon — vendor logo when on a storefront, fallback otherwise */}
            <div
              className="shrink-0 w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shadow-lg"
              style={{ background: isVendorScoped ? `${accentColor}33` : `linear-gradient(135deg, ${accentColor}, #22d3ee)` }}
            >
              {isVendorScoped && vendor.logoUrl ? (
                <img src={vendor.logoUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <Droplets className="w-6 h-6 text-white" />
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              {showAndroid ? (
                <>
                  <p className="text-sm font-semibold text-white leading-tight truncate">
                    {isVendorScoped ? `ثبّت تطبيق ${displayName}` : 'ثبّت التطبيق على هاتفك'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                    {isVendorScoped ? 'احجز بسرعة في أي وقت — بدون متصفح' : 'استخدمه بدون إنترنت وأسرع'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white leading-tight truncate">
                    {isVendorScoped ? `أضف ${displayName} للشاشة الرئيسية` : 'أضف التطبيق للشاشة الرئيسية'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    اضغط زر المشاركة ثم &apos;إضافة إلى الشاشة الرئيسية&apos;
                  </p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {showAndroid && (
                <button
                  onClick={install}
                  className="flex items-center gap-1.5 active:scale-95 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-all"
                  style={{ background: accentColor }}
                >
                  <Download className="w-3.5 h-3.5" />
                  تثبيت
                </button>
              )}
              <button
                onClick={dismiss}
                aria-label="إغلاق"
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
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
