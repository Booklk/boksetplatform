import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation2, Clock, User, MapPin, Zap, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, Car, ArrowLeftRight,
} from 'lucide-react';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingBooking {
  id: number;
  bookingNumber: string;
  status: string;
  scheduledAt: string;
  address: string;
  customerName?: string;
  serviceName?: string;
  packageName?: string;
  fleetVehicleId?: number | null;
  assignedVehicleName?: string | null;
  assignedVehiclePlate?: string | null;
}

interface CrewMember {
  id: number;
  name: string;
  phone: string;
  role: string;
  isOnDuty: boolean | null;
}

interface VehicleWithCrew {
  id: number;
  nameAr: string;
  plateNumber: string | null;
  type: string;
  isActive: boolean;
  crew: CrewMember[];
  currentBooking: { id: number; bookingNumber: string; scheduledAt: string } | null;
  isAvailable: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending:     { label: 'قيد الانتظار', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  confirmed:   { label: 'مؤكد',         cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  on_way:      { label: 'في الطريق',    cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  arrived:     { label: 'وصل',          cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  in_progress: { label: 'جارٍ التنفيذ',cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  completed:   { label: 'مكتمل',        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  cancelled:   { label: 'ملغي',         cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function formatScheduledAt(iso: string) {
  return new Intl.DateTimeFormat('ar-SA', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onAnimationComplete={() => setTimeout(onDone, 2500)}
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl border text-sm font-bold ${
        type === 'success'
          ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-300'
          : 'bg-red-900/90 border-red-500/40 text-red-300'
      }`}
    >
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {message}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorDispatch() {
  const queryClient = useQueryClient();
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  // bookingId whose vehicle is being reassigned → shows inline vehicle picker
  const [reassignBookingId, setReassignBookingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // All recent active bookings (pending + confirmed)
  const {
    data: allBookingsData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useQuery<PendingBooking[]>({
    queryKey: ['dispatch-bookings'],
    queryFn: () =>
      api.get('/bookings?limit=100').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const pendingBookings = (allBookingsData ?? []).filter((b) => b.status === 'pending');
  const confirmedBookings = (allBookingsData ?? []).filter((b) => b.status === 'confirmed');

  // Vehicles with crew
  const {
    data: vehiclesData,
    isLoading: vehiclesLoading,
    refetch: refetchVehicles,
  } = useQuery<{ vehicles: VehicleWithCrew[] }>({
    queryKey: ['fleet-with-crew'],
    queryFn: () => api.get('/fleet/with-crew').then((r) => r.data),
    refetchInterval: 15_000,
  });

  const vehicles = vehiclesData?.vehicles ?? [];
  const selectedBooking = pendingBookings.find((b) => b.id === selectedBookingId);

  // Assign mutation (pending → confirmed)
  const assignMutation = useMutation({
    mutationFn: ({ bookingId, vehicleId, employeeId }: { bookingId: number; vehicleId: number; employeeId: number }) =>
      api.post('/dispatch/assign', { bookingId, vehicleId, employeeId }),
    onSuccess: () => {
      setToast({ message: 'تم تعيين السيارة بنجاح', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['dispatch-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-with-crew'] });
      setSelectedBookingId(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'حدث خطأ';
      setToast({ message: msg, type: 'error' });
    },
  });

  // Reassign mutation (confirmed → new vehicle)
  const reassignMutation = useMutation({
    mutationFn: ({ bookingId, newVehicleId }: { bookingId: number; newVehicleId: number }) =>
      api.patch('/dispatch/reassign', { bookingId, newVehicleId }),
    onSuccess: () => {
      setToast({ message: '✅ تم تغيير السيارة بنجاح', type: 'success' });
      queryClient.invalidateQueries({ queryKey: ['dispatch-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-with-crew'] });
      setReassignBookingId(null);
    },
    onError: (err: any) => {
      const isConflict = err?.response?.status === 409;
      const msg = isConflict
        ? '⚠️ السيارة لديها حجز في نفس الوقت'
        : (err?.response?.data?.message ?? err?.response?.data?.error ?? 'حدث خطأ');
      setToast({ message: msg, type: 'error' });
    },
  });

  return (
    <div dir="rtl" className="min-h-screen bg-surface-1 text-white">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/6 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600/6 blur-[120px] rounded-full" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            type={toast.type}
            onDone={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="relative z-10 border-b border-white/5 bg-surface-1/80 backdrop-blur-xl px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white">مركز التوزيع الذكي</h1>
              <p className="text-xs text-slate-500">توزيع السيارات والطواقم على الحجوزات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingBookings.length > 0 && (
              <span className="bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-black px-3 py-1 rounded-full">
                {pendingBookings.length} حجز ينتظر التعيين
              </span>
            )}
            {confirmedBookings.length > 0 && (
              <span className="bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-black px-3 py-1 rounded-full">
                {confirmedBookings.length} مؤكد
              </span>
            )}
            <button
              onClick={() => { refetchPending(); refetchVehicles(); }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              title="تحديث"
            >
              <RefreshCw size={15} className="text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="relative z-10 flex h-[calc(100vh-85px)]">

        {/* ── Left panel: Pending + Confirmed bookings list ── */}
        <div className="w-1/3 border-l border-white/5 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h2 className="text-sm font-bold text-slate-300">الحجوزات</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {pendingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-slate-500" />
              </div>
            ) : (
              <>
                {/* Pending section */}
                {pendingBookings.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider px-1 pt-1">
                      ينتظر التعيين
                    </p>
                    {pendingBookings.map((booking) => (
                      <motion.button
                        key={booking.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => {
                          setSelectedBookingId(booking.id === selectedBookingId ? null : booking.id);
                          setReassignBookingId(null);
                        }}
                        className={`w-full text-right p-3 rounded-xl border transition-all ${
                          selectedBookingId === booking.id
                            ? 'bg-blue-600/20 border-blue-500/40'
                            : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-white">#{booking.bookingNumber}</span>
                          <StatusBadge status={booking.status} />
                        </div>

                        {booking.customerName && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <User size={11} className="text-slate-500 flex-shrink-0" />
                            <span className="text-xs text-slate-300 font-medium truncate">{booking.customerName}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin size={11} className="text-blue-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-400 truncate">{booking.address}</span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-2">
                          <Clock size={11} className="text-purple-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-400">{formatScheduledAt(booking.scheduledAt)}</span>
                        </div>

                        {(booking.serviceName || booking.packageName) && (
                          <div className="text-[10px] text-slate-500 truncate">
                            {[booking.serviceName, booking.packageName].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </motion.button>
                    ))}
                  </>
                )}

                {pendingBookings.length === 0 && confirmedBookings.length === 0 && (
                  <div className="text-center py-12 space-y-2">
                    <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                    <p className="text-slate-400 text-sm font-medium">لا توجد حجوزات نشطة</p>
                  </div>
                )}

                {/* Confirmed section — with reassign button */}
                {confirmedBookings.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider px-1 pt-2">
                      مؤكدة — قابلة لتغيير السيارة
                    </p>
                    {confirmedBookings.map((booking) => (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full text-right p-3 rounded-xl border bg-blue-500/[0.04] border-blue-500/15"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-xs font-black text-white">#{booking.bookingNumber}</span>
                          <StatusBadge status={booking.status} />
                        </div>

                        {booking.customerName && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <User size={11} className="text-slate-500 flex-shrink-0" />
                            <span className="text-xs text-slate-300 font-medium truncate">{booking.customerName}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin size={11} className="text-blue-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-400 truncate">{booking.address}</span>
                        </div>

                        <div className="flex items-center gap-1.5 mb-2">
                          <Clock size={11} className="text-purple-400 flex-shrink-0" />
                          <span className="text-[11px] text-slate-400">{formatScheduledAt(booking.scheduledAt)}</span>
                        </div>

                        {/* Current vehicle + reassign trigger */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          {booking.assignedVehicleName ? (
                            <div className="flex items-center gap-1.5">
                              <Car size={11} className="text-cyan-400 flex-shrink-0" />
                              <span className="text-[11px] text-cyan-300 font-medium truncate">
                                {booking.assignedVehicleName}
                                {booking.assignedVehiclePlate ? ` · ${booking.assignedVehiclePlate}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">لا توجد سيارة مُعيَّنة</span>
                          )}
                          <button
                            onClick={() => setReassignBookingId(
                              reassignBookingId === booking.id ? null : booking.id
                            )}
                            className="flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/25 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
                          >
                            <ArrowLeftRight size={10} />
                            تغيير السيارة 🔄
                          </button>
                        </div>

                        {/* Inline vehicle picker for reassignment */}
                        <AnimatePresence>
                          {reassignBookingId === booking.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5">
                                <p className="text-[10px] text-slate-500 font-medium mb-2">اختر سيارة جديدة:</p>
                                {vehiclesLoading ? (
                                  <div className="flex items-center justify-center py-3">
                                    <Loader2 size={16} className="animate-spin text-slate-500" />
                                  </div>
                                ) : vehicles.length === 0 ? (
                                  <p className="text-[11px] text-slate-600 text-center py-2">لا توجد سيارات متاحة</p>
                                ) : (
                                  vehicles.map((v) => (
                                    <button
                                      key={v.id}
                                      disabled={reassignMutation.isPending || v.id === booking.fleetVehicleId}
                                      onClick={() => reassignMutation.mutate({
                                        bookingId: booking.id,
                                        newVehicleId: v.id,
                                      })}
                                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-right transition-all ${
                                        v.id === booking.fleetVehicleId
                                          ? 'bg-blue-600/15 border-blue-500/30 opacity-60 cursor-not-allowed'
                                          : v.isAvailable
                                            ? 'bg-white/[0.03] border-white/8 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                                            : 'bg-yellow-500/5 border-yellow-500/10 opacity-60 cursor-not-allowed'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-base flex-shrink-0">{v.type === 'motorcycle' ? '🏍️' : '🚗'}</span>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-white truncate">{v.nameAr}</p>
                                          {v.plateNumber && (
                                            <p className="text-[10px] text-slate-500">{v.plateNumber}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {v.id === booking.fleetVehicleId ? (
                                          <span className="text-[9px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">الحالية</span>
                                        ) : v.isAvailable ? (
                                          <>
                                            {reassignMutation.isPending ? (
                                              <Loader2 size={12} className="animate-spin text-slate-400" />
                                            ) : (
                                              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">تعيين</span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-[9px] font-bold text-yellow-400 bg-yellow-500/15 px-1.5 py-0.5 rounded-full">مشغول</span>
                                        )}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Right panel: Vehicle assignment (pending bookings) ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedBookingId ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Navigation2 size={28} className="text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-bold text-base">اختر حجزاً معلقاً لتعيين سيارة</p>
                <p className="text-slate-600 text-sm mt-1">انقر على حجز من قائمة "ينتظر التعيين" لعرض السيارات المتاحة</p>
                <p className="text-slate-600 text-xs mt-2 opacity-70">لتغيير سيارة حجز مؤكد، استخدم زر "تغيير السيارة 🔄"</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Booking detail header */}
              {selectedBooking && (
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white">#{selectedBooking.bookingNumber}</span>
                        <StatusBadge status={selectedBooking.status} />
                      </div>
                      {selectedBooking.customerName && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <User size={12} className="text-slate-500" />
                          <span className="text-sm text-slate-300">{selectedBooking.customerName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        <MapPin size={12} className="text-blue-400" />
                        <span className="text-sm text-slate-400">{selectedBooking.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-purple-400" />
                        <span className="text-sm text-slate-400">{formatScheduledAt(selectedBooking.scheduledAt)}</span>
                      </div>
                    </div>
                    {(selectedBooking.serviceName || selectedBooking.packageName) && (
                      <span className="text-xs text-slate-500 bg-white/5 rounded-lg px-2 py-1">
                        {[selectedBooking.serviceName, selectedBooking.packageName].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicles list */}
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-300">السيارات المتاحة</h3>
                  {!vehiclesLoading && (
                    <span className="text-xs text-slate-600">{vehicles.length} سيارة</span>
                  )}
                </div>

                {vehiclesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={22} className="animate-spin text-slate-500" />
                  </div>
                ) : vehicles.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <Car size={32} className="text-slate-600 mx-auto" />
                    <p className="text-slate-400 text-sm">لا توجد سيارات في الأسطول</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {vehicles.map((v, idx) => (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className={`rounded-2xl border p-4 ${
                            v.isAvailable
                              ? 'bg-white/[0.04] border-white/8 hover:bg-white/[0.07]'
                              : 'bg-yellow-500/5 border-yellow-500/15 opacity-80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Vehicle icon */}
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${
                              v.isAvailable
                                ? 'bg-gradient-to-br from-blue-600 to-cyan-500'
                                : 'bg-slate-700'
                            }`}>
                              {v.type === 'motorcycle' ? '🏍️' : '🚗'}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-white truncate">{v.nameAr}</span>
                                {v.isAvailable ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 size={9} /> متاح الآن
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-400 bg-yellow-500/15 border border-yellow-500/25 px-1.5 py-0.5 rounded-full">
                                    <AlertCircle size={9} /> مشغول بحجز {v.currentBooking?.bookingNumber}
                                  </span>
                                )}
                              </div>

                              {v.plateNumber && (
                                <p className="text-[11px] text-slate-500 mb-1">{v.plateNumber}</p>
                              )}

                              {/* Crew pills */}
                              {v.crew.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {v.crew.map((c) => (
                                    <span key={c.id} className="inline-flex items-center gap-1 text-[10px] bg-white/8 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                                      {c.role === 'driver' ? '🚗' : '🔧'} {c.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-600 mt-1">لا يوجد طاقم مُعيَّن</p>
                              )}
                            </div>

                            {/* Assign button */}
                            {v.isAvailable && v.crew.length > 0 && selectedBookingId && (
                              <button
                                onClick={() => {
                                  const driver = v.crew.find(c => c.role === 'driver') ?? v.crew[0];
                                  assignMutation.mutate({
                                    bookingId: selectedBookingId,
                                    vehicleId: v.id,
                                    employeeId: driver.id,
                                  });
                                }}
                                disabled={assignMutation.isPending}
                                className="flex-shrink-0 flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-black px-3 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/25"
                              >
                                {assignMutation.isPending ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Zap size={13} />
                                )}
                                تعيين هذه السيارة
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
