import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

const STORAGE_KEY = 'push-prompt-dismissed';

async function subscribeUserToPush(token: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    ...(vapidKey ? { applicationServerKey: vapidKey } : {}),
  });

  // Serialize to plain JSON — PushSubscription.toJSON() gives { endpoint, keys: { p256dh, auth } }
  const subJson = subscription.toJSON();
  await axios.post(
    '/api/push/subscribe',
    {
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export default function PushPrompt() {
  const { token } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const enable = async () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && token) {
        await subscribeUserToPush(token);
      }
    } catch {
      // silently ignore push subscription errors
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-4 inset-x-4 z-50 flex items-center gap-3 bg-slate-900 border border-slate-700/60 rounded-2xl px-4 py-3 shadow-2xl max-w-lg mx-auto"
          dir="rtl"
        >
          <Bell className="w-5 h-5 text-blue-400 shrink-0" />
          <p className="text-sm text-white flex-1 leading-snug">
            فعّل الإشعارات لتعرف حالة طلبك فوراً
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={enable}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-xl transition-colors"
            >
              تفعيل
            </button>
            <button
              onClick={dismiss}
              className="bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
            >
              لاحقاً
            </button>
          </div>
          <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
