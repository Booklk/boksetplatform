import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Calendar, X, User, MapPin, Wrench } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  confirmed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  on_way: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  in_progress: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  on_way: 'في الطريق',
  in_progress: 'جارٍ التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8am–8pm

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function VendorCalendar() {
  const { token } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-bookings', formatDate(weekStart)],
    queryFn: async () => {
      const { data } = await axios.get(
        `/api/bookings?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}&limit=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    enabled: !!token,
  });

  const bookings: any[] = data?.bookings ?? data ?? [];

  // Map bookings to { [dayIndex]: { [hour]: booking[] } }
  const bookingMap = useMemo(() => {
    const map: Record<number, Record<number, any[]>> = {};
    bookings.forEach((b) => {
      const d = new Date(b.scheduledAt ?? b.createdAt);
      const dayIdx = Math.floor((d.getTime() - weekStart.getTime()) / 86400000);
      const hour = d.getHours();
      if (dayIdx < 0 || dayIdx > 6) return;
      if (!map[dayIdx]) map[dayIdx] = {};
      if (!map[dayIdx][hour]) map[dayIdx][hour] = [];
      map[dayIdx][hour].push(b);
    });
    return map;
  }, [bookings, weekStart]);

  const goToPrev = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const goToNext = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToCurrentWeek = () => setWeekStart(getWeekStart(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">التقويم</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              className="p-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
            <button
              onClick={goToCurrentWeek}
              className="px-4 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 text-sm rounded-xl transition-colors"
            >
              هذا الأسبوع
            </button>
            <button
              onClick={goToNext}
              className="p-2 bg-slate-800/60 hover:bg-slate-700/60 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        </div>

        {/* Week range label */}
        <p className="text-slate-400 text-sm mb-4 text-center">
          {weekStart.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' })} —{' '}
          {weekEnd.toLocaleDateString('ar-SA', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {/* Calendar Grid */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-auto">
          {isLoading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              {/* Day headers */}
              <thead>
                <tr>
                  <th className="w-16 border-b border-slate-700/50 p-3 text-slate-500 text-xs font-medium" />
                  {weekDays.map((day, i) => {
                    const isToday = formatDate(day) === formatDate(new Date());
                    return (
                      <th key={i} className={`border-b border-slate-700/50 p-3 text-center ${isToday ? 'bg-blue-600/10' : ''}`}>
                        <p className={`text-sm font-semibold ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                          {DAY_NAMES[day.getDay()]}
                        </p>
                        <p className={`text-xs mt-0.5 ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                          {day.getDate()}
                        </p>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-slate-800/60">
                    <td className="p-2 text-center text-slate-500 text-xs w-16">
                      {hour}:00
                    </td>
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const cellBookings = bookingMap[dayIdx]?.[hour] ?? [];
                      return (
                        <td key={dayIdx} className="p-1 align-top border-r border-slate-800/40 first:border-r-0 min-h-[52px]" style={{ minWidth: 110, height: 52 }}>
                          {cellBookings.map((b) => (
                            <button
                              key={b.id}
                              onClick={() => setSelectedBooking(b)}
                              className={`w-full text-right text-xs px-2 py-1 rounded-lg border mb-1 truncate transition-opacity hover:opacity-80 ${STATUS_COLOR[b.status] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/30'}`}
                            >
                              {b.customer?.nameAr ?? b.customerName ?? `#${b.id}`}
                            </button>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Side Drawer */}
      <AnimatePresence>
        {selectedBooking && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBooking(null)}
            />
            <motion.div
              className="fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-700/50 z-50 p-6 overflow-y-auto"
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">تفاصيل الحجز</h2>
                <button onClick={() => setSelectedBooking(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex justify-end">
                  <span className={`text-sm px-3 py-1 rounded-xl border font-medium ${STATUS_COLOR[selectedBooking.status] ?? 'bg-slate-700/40 text-slate-300 border-slate-600/30'}`}>
                    {STATUS_LABEL[selectedBooking.status] ?? selectedBooking.status}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 bg-slate-800/40 rounded-xl p-3">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-xs mb-0.5">العميل</p>
                      <p className="text-white font-medium">{selectedBooking.customer?.nameAr ?? selectedBooking.customerName ?? '—'}</p>
                      {selectedBooking.customer?.phone && (
                        <p className="text-slate-400">{selectedBooking.customer.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-800/40 rounded-xl p-3">
                    <Wrench className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-slate-400 text-xs mb-0.5">الخدمة</p>
                      <p className="text-white font-medium">{selectedBooking.service?.nameAr ?? selectedBooking.serviceName ?? '—'}</p>
                      {selectedBooking.price && (
                        <p className="text-green-400 font-semibold mt-1">{selectedBooking.price} ريال</p>
                      )}
                    </div>
                  </div>

                  {(selectedBooking.address || selectedBooking.addressText) && (
                    <div className="flex items-start gap-3 bg-slate-800/40 rounded-xl p-3">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-slate-400 text-xs mb-0.5">العنوان</p>
                        <p className="text-white">{selectedBooking.address ?? selectedBooking.addressText}</p>
                      </div>
                    </div>
                  )}

                  {selectedBooking.scheduledAt && (
                    <div className="bg-slate-800/40 rounded-xl p-3">
                      <p className="text-slate-400 text-xs mb-0.5">وقت الحجز</p>
                      <p className="text-white">
                        {new Date(selectedBooking.scheduledAt).toLocaleString('ar-SA', {
                          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
