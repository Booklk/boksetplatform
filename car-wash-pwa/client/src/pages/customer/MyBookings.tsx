import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Star, Receipt, Navigation } from 'lucide-react';
import api from '../../lib/api';
import { Booking } from '../../types';
import { formatDateTime, formatCurrency, STATUS_LABELS } from '../../lib/utils';
import StatusBadge from '../../components/StatusBadge';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { PullRefreshIndicator } from '../../components/PullRefreshIndicator';

const STATUS_STEPS = ['pending', 'confirmed', 'on_way', 'arrived', 'in_progress', 'completed'];

function BookingTimeline({ status }: { status: string }) {
  const current = STATUS_STEPS.indexOf(status);
  if (status === 'cancelled') return (
    <div className="badge status-cancelled">❌ ملغي</div>
  );
  return (
    <div className="flex items-center gap-1 mt-3">
      {STATUS_STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i <= current ? 'bg-brand-500' : 'bg-slate-600'
          }`} />
          {i < STATUS_STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 min-w-4 transition-colors ${
              i < current ? 'bg-brand-500' : 'bg-slate-600'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CustomerBookings() {
  const queryClient = useQueryClient();
  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => api.get('/bookings/my').then(r => r.data),
    refetchInterval: 30000, // Auto-refresh every 30s for live status
  });

  const { isPulling, isRefreshing, pullDistance, handlers } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  });

  if (isLoading) return (
    <div className="p-4 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-5 bg-slate-700 rounded mb-3 w-1/3" />
          <div className="h-4 bg-slate-700 rounded mb-2 w-full" />
          <div className="h-4 bg-slate-700 rounded w-2/3" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto" dir="rtl" {...handlers}>
      <PullRefreshIndicator pullDistance={pullDistance} isPulling={isPulling} isRefreshing={isRefreshing} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-white">حجوزاتي</h1>
        <Link to="/app" className="btn-outline text-sm py-2 px-4">
          حجز جديد +
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🚗</div>
          <h3 className="text-lg font-black text-white mb-2">لا توجد حجوزات</h3>
          <p className="text-slate-400 mb-6">احجز أول غسلة لسيارتك الآن!</p>
          <Link to="/app" className="btn-primary inline-block px-8">
            احجز الآن
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, i) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-400">#{booking.bookingNumber}</p>
                  <h3 className="font-black text-white">{booking.serviceName} - {booking.packageName}</h3>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="space-y-1.5 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-brand-400" />
                  {formatDateTime(booking.scheduledAt)}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-brand-400" />
                  <span className="truncate">{booking.address}</span>
                </div>
              </div>

              <BookingTimeline status={booking.status} />

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700">
                <span className="font-black gradient-text">{formatCurrency(booking.totalPrice)}</span>
                <div className="flex gap-2 flex-wrap justify-end">
                  {booking.status === 'completed' && (
                    <Link
                      to={`/app/invoice/${booking.id}`}
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm py-1.5 px-3 rounded-xl transition-colors"
                    >
                      <Receipt size={13} />
                      الفاتورة
                    </Link>
                  )}
                  {['on_way', 'arrived', 'in_progress'].includes(booking.status) && (
                    <Link
                      to={`/app/tracking/${booking.id}`}
                      className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-sm py-1.5 px-3 rounded-xl transition-colors border border-blue-500/30"
                    >
                      <Navigation size={13} />
                      تتبع
                    </Link>
                  )}
                  {booking.status === 'completed' && !booking.rating && (
                    <Link to={`/app/rate/${booking.id}`} className="btn-primary text-sm py-1.5 px-4">
                      ⭐ قيّم
                    </Link>
                  )}
                  {booking.rating && (
                    <div className="flex items-center gap-1 text-yellow-400 text-sm">
                      <Star size={13} className="fill-yellow-400" />
                      <span className="font-bold">{booking.rating}/5</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
