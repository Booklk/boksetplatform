/**
 * LiveBookingNotifier — mounted once at the app shell. Listens for
 * `booking.created` / `booking.updated` events over WebSocket and:
 *   1. Invalidates React-Query caches so lists refresh without a poll.
 *   2. Fires a toast + short haptic pulse (if available) so the vendor
 *      feels the new booking, not just sees it later.
 *
 * Silent for customer users — they get push notifications instead.
 */

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';
import { useAuth } from '../hooks/useAuth';

function vibrate(pattern: number | number[]) {
  try { (navigator as any).vibrate?.(pattern); } catch { /* ignore */ }
}

export default function LiveBookingNotifier() {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user || user.role === 'customer') return;

    const unsubCreated = subscribe<{ bookingNumber: string; packageName: string }>(
      'booking.created',
      (ev) => {
        qc.invalidateQueries({ queryKey: ['bookings'] });
        qc.invalidateQueries({ queryKey: ['operations-summary'] });
        qc.invalidateQueries({ queryKey: ['vendor-dashboard'] });
        vibrate([40, 30, 40]);
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-in slide-in-from-top-2' : 'animate-out fade-out'}
                bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-2xl shadow-lg
                px-4 py-3 flex items-center gap-3 max-w-sm`}
              dir="rtl"
              role="status"
            >
              <Sparkles size={18} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black">حجز جديد!</p>
                <p className="text-xs opacity-90 truncate">
                  #{ev.payload.bookingNumber} · {ev.payload.packageName}
                </p>
              </div>
            </div>
          ),
          { duration: 5000, position: 'top-center' },
        );
      },
    );

    const unsubUpdated = subscribe<{ bookingNumber: string; status: string }>(
      'booking.updated',
      () => {
        qc.invalidateQueries({ queryKey: ['bookings'] });
        qc.invalidateQueries({ queryKey: ['operations-summary'] });
      },
    );

    return () => { unsubCreated(); unsubUpdated(); };
  }, [user?.id, user?.role, subscribe, qc]);

  return null;
}
