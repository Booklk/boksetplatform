import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Navigation, NavigationOff, Wifi } from 'lucide-react';
import api from '../lib/api';

interface LocationSharingProps {
  bookingId?: number;
  onLocation?: (lat: number, lng: number) => void;
}

export default function LocationSharing({ bookingId, onLocation }: LocationSharingProps) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  function startSharing() {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع');
      return;
    }

    setActive(true);
    setError(null);

    // Connect WebSocket for real-time broadcast
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    if (bookingId) {
      ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: `booking:${bookingId}` }));
    }

    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;

          // Send to REST API (persisted in DB)
          api.post('/tracking/location', {
            lat, lng, accuracy, heading, speed,
            bookingId: bookingId ?? null,
          }).catch(console.error);

          // Broadcast via WebSocket (real-time)
          if (ws.readyState === WebSocket.OPEN && bookingId) {
            ws.send(JSON.stringify({
              type: 'location',
              room: `booking:${bookingId}`,
              lat, lng, heading, speed,
            }));
          }

          setLastSent(new Date());
          onLocation?.(lat, lng);
        },
        (err) => setError(`خطأ في الموقع: ${err.message}`),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }, 8000); // every 8 seconds
  }

  function stopSharing() {
    setActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            active ? 'bg-emerald-500/20 animate-pulse' : 'bg-white/10'
          }`}>
            {active ? (
              <Navigation className="w-5 h-5 text-emerald-400" />
            ) : (
              <NavigationOff className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-sm">مشاركة الموقع</p>
            {active ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-xs">
                  {lastSent ? `آخر إرسال: ${lastSent.toLocaleTimeString('ar-SA')}` : 'يتصل...'}
                </span>
              </div>
            ) : (
              <p className="text-slate-500 text-xs mt-0.5">مُعطَّل</p>
            )}
          </div>
        </div>

        <button
          onClick={active ? stopSharing : startSharing}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
            active
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
          }`}
        >
          {active ? 'إيقاف' : 'تشغيل'}
        </button>
      </div>

      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-red-400 text-xs mt-2 p-2 bg-red-500/10 rounded-lg">
          {error}
        </motion.p>
      )}

      {active && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-white/10">
          <p className="text-slate-400 text-xs text-center">
            📍 موقعك يُرسَل كل 8 ثوانٍ إلى العميل والإدارة
          </p>
        </motion.div>
      )}
    </div>
  );
}
