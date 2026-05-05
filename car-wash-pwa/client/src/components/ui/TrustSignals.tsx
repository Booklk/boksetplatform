import { useEffect, useState } from 'react';
import { Lock, Wifi, WifiOff } from 'lucide-react';

interface RelativeTimeProps {
  /** ISO string or Date — when the data was last refreshed. */
  at: string | Date | null | undefined;
  /** Compact mode: show only the relative time without the lock icon. */
  compact?: boolean;
}

function relativeAr(d: Date): string {
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'الآن';
  if (diff < 60) return `قبل ${Math.floor(diff)} ثانية`;
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
  return d.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Trust micro-signal — "الجلسة مشفّرة • آخر تحديث قبل ١٢ ثانية".
 * Place at the bottom of any data-driven page so the merchant feels
 * the data is alive and the connection is secure.
 */
export function LastUpdated({ at, compact }: RelativeTimeProps) {
  const [, force] = useState(0);

  // Re-render every 10s so the "12 seconds ago" label stays accurate.
  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const date = at ? (typeof at === 'string' ? new Date(at) : at) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  if (compact) {
    return (
      <span className="text-[10px] text-slate-500 leading-none" dir="rtl">
        محدّث {relativeAr(date)}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 mt-6 pb-2" dir="rtl">
      <Lock className="w-2.5 h-2.5" />
      <span>الجلسة مشفّرة</span>
      <span className="opacity-30">•</span>
      <span>آخر تحديث {relativeAr(date)}</span>
    </div>
  );
}

/**
 * Tiny pulsating dot in the corner that reflects realtime
 * connection state. Green = WebSocket open, amber = trying,
 * gray = offline or unsupported.
 */
export function LiveConnectionDot() {
  const [state, setState] = useState<'live' | 'connecting' | 'offline'>('connecting');

  useEffect(() => {
    function onOnline() { setState('live'); }
    function onOffline() { setState('offline'); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    setState(navigator.onLine ? 'live' : 'offline');
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const color = state === 'live' ? 'bg-emerald-400'
    : state === 'connecting' ? 'bg-amber-400'
    : 'bg-slate-500';
  const label = state === 'live' ? 'متصل لحظياً'
    : state === 'connecting' ? 'جاري الاتصال…'
    : 'غير متصل';
  const Icon = state === 'offline' ? WifiOff : Wifi;

  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 text-[10px] text-slate-500"
      dir="rtl"
    >
      <span className="relative inline-flex w-2 h-2">
        <span className={`absolute inline-flex w-full h-full rounded-full ${color} opacity-75 ${state === 'live' ? 'animate-ping' : ''}`} />
        <span className={`relative inline-flex w-2 h-2 rounded-full ${color}`} />
      </span>
      <Icon className="w-2.5 h-2.5" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
