import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Smartphone } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'vendor-push-prompt-state-v1';

interface PromptState {
  status: 'pending' | 'snoozed' | 'enabled' | 'denied';
  snoozedUntil?: number;
}

function loadState(): PromptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { status: 'pending' };
}
function saveState(s: PromptState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Vendor-side push subscription prompt.
 *
 * Shows a polite banner at the top of the dashboard the first time a
 * vendor admin / employee logs in. Once enabled, it stays out of the
 * way. Snooze hides it for 7 days. After the third decline, gives up
 * and only re-asks if the user clears storage.
 */
export function VendorPushPrompt() {
  const { user } = useAuth();
  const [state, setState] = useState<PromptState>(() => loadState());
  const [installing, setInstalling] = useState(false);

  const isVendorSide = user?.role === 'vendor_admin' || user?.role === 'admin' || user?.role === 'employee';
  const supports = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

  useEffect(() => {
    if (!supports || !isVendorSide) return;
    if (Notification.permission === 'granted') {
      setState((s) => ({ ...s, status: 'enabled' }));
    } else if (Notification.permission === 'denied') {
      setState((s) => ({ ...s, status: 'denied' }));
    }
  }, [supports, isVendorSide]);

  if (!isVendorSide || !supports) return null;
  if (state.status === 'enabled' || state.status === 'denied') return null;
  if (state.status === 'snoozed' && state.snoozedUntil && Date.now() < state.snoozedUntil) return null;

  const enable = async () => {
    setInstalling(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        const next: PromptState = { status: permission === 'denied' ? 'denied' : 'snoozed', snoozedUntil: Date.now() + 7 * 86400_000 };
        saveState(next);
        setState(next);
        return;
      }

      const { data } = await api.get<{ publicKey: string | null }>('/push/vapid-public-key');
      if (!data.publicKey) {
        toast.error('الخدمة غير مهيّأة بعد على الخادم');
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });

      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        deviceType: 'web',
      });

      const next: PromptState = { status: 'enabled' };
      saveState(next);
      setState(next);
      toast.success('تم تفعيل الإشعارات — لن تفوتك أي حجز');
    } catch (e: any) {
      console.error('[vendor push subscribe]', e);
      toast.error('تعذّر التفعيل — تحقق من إعدادات المتصفح');
    } finally {
      setInstalling(false);
    }
  };

  const snooze = () => {
    const next: PromptState = { status: 'snoozed', snoozedUntil: Date.now() + 7 * 86400_000 };
    saveState(next);
    setState(next);
  };

  return (
    <AnimatePresence>
      {state.status === 'pending' && (
        <motion.div
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          dir="rtl"
          className="mx-3 sm:mx-4 mt-3 mb-2"
        >
          <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-bl from-blue-500/10 to-blue-500/[0.03] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-300">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">لا تفوّت حجز جديد</p>
                <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                  فعّل الإشعارات الفورية على هذا الجهاز — إشعار صوتي + اهتزاز + شارة على أيقونة Jdawil
                  حتى لو الصفحة مغلقة. <span className="text-slate-400 inline-flex items-center gap-1"><Smartphone className="w-3 h-3" /> ثبّت Jdawil على شاشتك الرئيسية لأفضل تجربة.</span>
                </p>
              </div>
              <button
                aria-label="إغلاق"
                onClick={snooze}
                className="shrink-0 w-7 h-7 rounded-full hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={snooze}
                className="text-xs text-slate-400 hover:text-white px-3 py-2 rounded-lg"
              >
                لاحقاً
              </button>
              <button
                onClick={enable}
                disabled={installing}
                className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {installing ? 'جاري التفعيل…' : 'فعّل الإشعارات'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
