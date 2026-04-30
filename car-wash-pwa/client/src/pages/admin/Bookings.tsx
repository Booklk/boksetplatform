import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, Filter, Navigation, Undo2 } from 'lucide-react';
import api from '../../lib/api';
import { Booking, Employee } from '../../types';
import { formatDateTime, formatCurrency, STATUS_LABELS } from '../../lib/utils';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import RefundDialog from '../../components/vendor/RefundDialog';

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'on_way', 'arrived', 'in_progress', 'completed', 'cancelled'];

export default function AdminBookings() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [refundFor, setRefundFor] = useState<Booking | null>(null);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['admin-bookings'],
    queryFn: () => api.get('/bookings').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data),
  });

  const { mutate: assignEmployee } = useMutation({
    mutationFn: ({ bookingId, employeeId }: { bookingId: number; employeeId: number }) =>
      api.post(`/bookings/${bookingId}/assign`, { employeeId }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast.success('تم إسناد الموظف');
      setSelectedBooking(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإسناد'),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/bookings/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      toast.success('تم تحديث الحالة');
    },
  });

  const filtered = bookings.filter(b => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q) ||
        b.customerPhone?.includes(q) ||
        b.vehiclePlate?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function openGoogleMaps(booking: Booking) {
    const url = booking.lat && booking.lng
      ? `https://www.google.com/maps?q=${booking.lat},${booking.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(booking.address + '، الرياض')}`;
    window.open(url, '_blank');
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-5" dir="rtl">
      <h1 className="text-2xl font-black text-white">إدارة الحجوزات</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث برقم الحجز، الاسم، الجوال، اللوحة..."
            className="input-field pr-9"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input-field pr-9 sm:w-48"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s ? STATUS_LABELS[s] : 'جميع الحالات'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="card animate-pulse h-20" />)}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">{filtered.length} حجز</p>
          {filtered.map((booking, i) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-slate-400">#{booking.bookingNumber}</span>
                    <StatusBadge status={booking.status} />
                  </div>
                  <h3 className="font-black text-white">{booking.customerName}</h3>
                  <p className="text-sm text-slate-300">{booking.serviceName} - {booking.packageName}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDateTime(booking.scheduledAt)}</p>
                  <p className="text-xs text-slate-400 truncate">{booking.address}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black gradient-text">{formatCurrency(booking.totalPrice)}</p>
                  {booking.rating && <p className="text-xs text-yellow-400 mt-1">⭐ {booking.rating}/5</p>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-700">
                {/* Assign employee */}
                <select
                  value={booking.employeeId ?? ''}
                  onChange={e => {
                    if (e.target.value) assignEmployee({ bookingId: booking.id, employeeId: Number(e.target.value) });
                  }}
                  className="bg-slate-700 text-slate-300 border border-slate-600 rounded-lg px-3 py-1.5 text-xs flex-1"
                >
                  <option value="">إسناد موظف...</option>
                  {employees.filter(e => e.isActive).map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>

                {/* Change status */}
                <select
                  value={booking.status}
                  onChange={e => updateStatus({ id: booking.id, status: e.target.value })}
                  className="bg-slate-700 text-slate-300 border border-slate-600 rounded-lg px-3 py-1.5 text-xs"
                >
                  {STATUS_OPTIONS.filter(Boolean).map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>

                {/* Google Maps */}
                <button
                  onClick={() => openGoogleMaps(booking)}
                  title="فتح الموقع في خرائط قوقل"
                  className="bg-green-700/30 hover:bg-green-700/50 text-green-400 border border-green-700/30 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors"
                >
                  <Navigation size={12} /> الموقع
                </button>

                {/* Refund — only offered on completed/cancelled bookings */}
                {(booking.status === 'completed' || booking.status === 'cancelled') && (
                  <button
                    onClick={() => setRefundFor(booking)}
                    title="استرجاع مبلغ"
                    className="bg-rose-700/30 hover:bg-rose-700/50 text-rose-300 border border-rose-700/30 rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Undo2 size={12} /> استرجاع
                  </button>
                )}
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && bookings.length === 0 && (
            <EmptyState
              emoji="📅"
              title="لا توجد حجوزات بعد"
              description="شارك رابط متجرك مع عملائك لاستقبال أول حجز"
              actionLabel="عرض رابط الحجز"
              actionPath="/vendor/branding"
            />
          )}
          {filtered.length === 0 && bookings.length > 0 && (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p>لا توجد حجوزات مطابقة للبحث</p>
            </div>
          )}
        </div>
      )}

      <RefundDialog
        open={Boolean(refundFor)}
        onClose={() => setRefundFor(null)}
        bookingNumber={refundFor?.bookingNumber}
        defaultAmount={refundFor?.totalPrice ? Number(refundFor.totalPrice) : undefined}
      />
    </div>
  );
}
