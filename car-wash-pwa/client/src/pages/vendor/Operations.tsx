import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Phone, RefreshCw,
  Car, Users, Wrench, TrendingUp, ChevronRight, ArrowLeft,
  Navigation2, Zap, User, BarChart3,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperationsAlert {
  type: 'unassigned_booking' | 'employee_not_ready' | 'maintenance_due';
  severity: 'high' | 'medium' | 'low';
  message: string;
  actionUrl: string;
  actionLabel: string;
  data: Record<string, unknown>;
}

interface TodaySummary {
  todayBookings: number;
  completedToday: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  avgBookingValue: number;
  activeVehicles: number;
}

interface TodayBooking {
  id: number;
  bookingNumber: string;
  status: string;
  scheduledAt: string;
  address: string;
  totalPrice: string | null;
  vehiclePlate: string | null;
  fleetVehicleId: number | null;
  employeeId: number | null;
  packageName: string | null;
  serviceName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  assignedVehicleName: string | null;
  assignedVehiclePlate: string | null;
}

interface CrewMember {
  id: number;
  name: string;
  phone: string;
  role: string;
  isOnDuty: boolean | null;
}

interface FleetVehicle {
  id: number;
  nameAr: string;
  plateNumber: string | null;
  type: string;
  status: string | null;
  crew: CrewMember[];
  currentBooking: { id: number; bookingNumber: string; scheduledAt: string } | null;
  isAvailable: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; badgeCls: string }> = {
  pending:     { label: 'في الانتظار', dotColor: 'bg-slate-400', badgeCls: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  confirmed:   { label: 'مؤكد',        dotColor: 'bg-blue-400',  badgeCls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  on_way:      { label: 'في الطريق',   dotColor: 'bg-amber-400', badgeCls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  arrived:     { label: 'وصل',         dotColor: 'bg-cyan-400',  badgeCls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  in_progress: { label: 'جاري',        dotColor: 'bg-green-400', badgeCls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  completed:   { label: 'مكتمل',       dotColor: 'bg-emerald-600', badgeCls: 'bg-emerald-900/40 text-emerald-400 border-emerald-700/50' },
  cancelled:   { label: 'ملغي',        dotColor: 'bg-red-400',   badgeCls: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const ALERT_ICON: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  unassigned_booking: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
  employee_not_ready: { icon: User,          color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  maintenance_due:    { icon: Wrench,        color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/30' },
};

const VEHICLE_EMOJI: Record<string, string> = {
  car: '🚗', pickup: '🛻', water_tank: '🚚', van: '🚐', motorcycle: '🏍️', equipment: '🔧',
};

const BOOKING_GROUPS = [
  { key: 'active',    label: 'قيد التنفيذ',  statuses: ['in_progress', 'on_way', 'arrived'] },
  { key: 'confirmed', label: 'مؤكدة',        statuses: ['confirmed'] },
  { key: 'pending',   label: 'في الانتظار',  statuses: ['pending'] },
  { key: 'completed', label: 'مكتملة',       statuses: ['completed', 'cancelled'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function arabicDate() {
  return new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Count-up animation hook ──────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startRef.current = null;
    let raf: number;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.badgeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

function AlertCard({ alert, onDismiss }: { alert: OperationsAlert; onDismiss?: () => void }) {
  const cfg = ALERT_ICON[alert.type];
  const Icon = cfg.icon;
  const isTel = alert.actionUrl.startsWith('tel:');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg}`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 leading-snug">{alert.message}</p>
      </div>
      {isTel ? (
        <a
          href={alert.actionUrl}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
        >
          <Phone size={12} />
          {alert.actionLabel}
        </a>
      ) : (
        <Link
          to={alert.actionUrl}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
        >
          {alert.actionLabel}
          <ChevronRight size={12} />
        </Link>
      )}
    </motion.div>
  );
}

// Vehicle picker inline
function VehiclePickerInline({
  bookingId,
  currentVehicleId,
  onClose,
}: {
  bookingId: number;
  currentVehicleId: number | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const { data: fleetData } = useQuery<{ vehicles: FleetVehicle[] }>({
    queryKey: ['fleet-with-crew'],
    queryFn: async () => {
      const { data } = await api.get('/fleet/with-crew');
      return data;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (vehicleId: number) => {
      await api.post(`/dispatch/assign`, { bookingId, vehicleId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations-bookings-today'] });
      onClose();
    },
  });

  const vehicles = fleetData?.vehicles ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 p-2 rounded-xl bg-slate-800 border border-slate-700">
        <p className="text-xs text-slate-400 mb-2 font-semibold">اختر مركبة:</p>
        <div className="flex flex-wrap gap-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => assignMutation.mutate(v.id)}
              disabled={assignMutation.isPending}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                v.id === currentVehicleId
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : v.isAvailable
                  ? 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'
                  : 'bg-slate-900/50 border-slate-700/50 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>{VEHICLE_EMOJI[v.type] ?? '🚗'}</span>
              <span>{v.nameAr}</span>
              {v.plateNumber && (
                <span className="text-[10px] opacity-70">{v.plateNumber}</span>
              )}
              {!v.isAvailable && v.id !== currentVehicleId && (
                <span className="text-[10px] text-red-400">مشغول</span>
              )}
            </button>
          ))}
          {vehicles.length === 0 && (
            <p className="text-xs text-slate-500">لا توجد مركبات</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </motion.div>
  );
}

function BookingRow({ booking }: { booking: TodayBooking }) {
  const [showActions, setShowActions] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const qc = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/bookings/${booking.id}/status`, { status: 'completed' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations-bookings-today'] });
      qc.invalidateQueries({ queryKey: ['operations-summary'] });
    },
  });

  const timeStr = formatTime(booking.scheduledAt);
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative"
    >
      {/* Timeline dot */}
      <div className={`absolute right-0 top-4 w-2.5 h-2.5 rounded-full ${cfg.dotColor} -translate-x-[1px] z-10`} />

      <div
        className="mr-5 mb-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer active:scale-[0.99] transition-transform"
        onClick={() => setShowActions((s) => !s)}
      >
        <div className="flex items-start gap-3">
          {/* Time block */}
          <div className="flex-shrink-0 text-center w-12">
            <div className="text-lg font-black text-white tabular-nums leading-none">{timeStr}</div>
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm truncate">{booking.customerName ?? '—'}</span>
              <StatusBadge status={booking.status} />
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">
              {booking.serviceName ?? ''} {booking.packageName ? `- ${booking.packageName}` : ''}
            </div>
            {(booking.assignedVehicleName || booking.assignedVehiclePlate) && (
              <div className="flex items-center gap-1 mt-1">
                <Car size={11} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs text-blue-300 font-semibold truncate">
                  {booking.assignedVehicleName}
                  {booking.assignedVehiclePlate && ` · ${booking.assignedVehiclePlate}`}
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          {booking.totalPrice && (
            <div className="flex-shrink-0 text-right">
              <span className="text-sm font-black text-emerald-400">
                {parseFloat(booking.totalPrice).toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-500 mr-0.5">ر.س</span>
            </div>
          )}
        </div>

        {/* Action buttons (shown when row is tapped) */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50 flex-wrap">
                {/* Call customer */}
                {booking.customerPhone && (
                  <a
                    href={`tel:${booking.customerPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white transition-colors"
                  >
                    <Phone size={12} />
                    اتصال
                  </a>
                )}

                {/* Change vehicle */}
                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPicker((s) => !s);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-xs font-bold text-blue-300 transition-colors border border-blue-500/30"
                  >
                    <RefreshCw size={12} />
                    تغيير سيارة
                  </button>
                )}

                {/* Complete */}
                {booking.status === 'in_progress' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      completeMutation.mutate();
                    }}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600/30 hover:bg-green-600/50 text-xs font-bold text-green-300 transition-colors border border-green-500/30 disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} />
                    {completeMutation.isPending ? 'جارٍ...' : 'إتمام'}
                  </button>
                )}
              </div>

              {/* Vehicle picker */}
              <AnimatePresence>
                {showPicker && (
                  <VehiclePickerInline
                    bookingId={booking.id}
                    currentVehicleId={booking.fleetVehicleId}
                    onClose={() => setShowPicker(false)}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorOperations() {
  const { user } = useAuth();
  const vendorId = user?.vendorId;
  const vendorName = user?.vendor?.nameAr ?? user?.name ?? 'المغسلة';
  const qc = useQueryClient();

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<{ alerts: OperationsAlert[] }>({
    queryKey: ['operations-alerts', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/operations/alerts');
      return data;
    },
    enabled: !!vendorId,
    refetchInterval: 60_000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<TodaySummary>({
    queryKey: ['operations-summary', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/operations/today-summary');
      return data;
    },
    enabled: !!vendorId,
    refetchInterval: 30_000,
  });

  const { data: todayBookings = [], isLoading: bookingsLoading } = useQuery<TodayBooking[]>({
    queryKey: ['operations-bookings-today', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/operations/bookings/today');
      return data;
    },
    enabled: !!vendorId,
    refetchInterval: 30_000,
  });

  const { data: fleetData, isLoading: fleetLoading } = useQuery<{ vehicles: FleetVehicle[] }>({
    queryKey: ['fleet-with-crew', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/fleet/with-crew');
      return data;
    },
    enabled: !!vendorId,
    refetchInterval: 60_000,
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const alerts = alertsData?.alerts ?? [];
  const vehicles = fleetData?.vehicles ?? [];

  const groupedBookings = BOOKING_GROUPS.map((group) => ({
    ...group,
    bookings: todayBookings.filter((b) => group.statuses.includes(b.status)),
  })).filter((g) => g.bookings.length > 0);

  // Count-up for revenue
  const revenueAnimated = useCountUp(Math.round(summary?.todayRevenue ?? 0));

  // Yesterday progress
  const yesterdayRev = summary?.yesterdayRevenue ?? 0;
  const todayRev = summary?.todayRevenue ?? 0;
  const progressPct = yesterdayRev > 0 ? Math.min(100, Math.round((todayRev / yesterdayRev) * 100)) : 0;

  const handleRefreshAll = () => {
    qc.invalidateQueries({ queryKey: ['operations-alerts'] });
    qc.invalidateQueries({ queryKey: ['operations-summary'] });
    qc.invalidateQueries({ queryKey: ['operations-bookings-today'] });
    qc.invalidateQueries({ queryKey: ['fleet-with-crew'] });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = alertsLoading || summaryLoading || bookingsLoading;

  return (
    <div className="min-h-screen bg-surface-1 text-white" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">

        {/* ── TOP: Day Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          {/* Back + refresh */}
          <div className="flex items-center justify-between mb-3">
            <Link to="/vendor" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
              <ArrowLeft size={16} />
              <span>لوحة التحكم</span>
            </Link>
            <button
              onClick={handleRefreshAll}
              className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 transition-colors text-slate-400 hover:text-white"
              title="تحديث"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Date + greeting */}
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-slate-400 text-xs font-semibold mb-1">{arabicDate()}</p>
                <h1 className="text-xl font-black text-white">صباح الخير، {vendorName}!</h1>
                <div className="flex items-center gap-1 mt-0.5">
                  <Activity size={14} className="text-blue-400" />
                  <span className="text-blue-400 text-xs font-bold">مركز العمليات اليومية</span>
                </div>
              </div>
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Activity size={28} className="text-white" />
              </div>
            </div>

            {/* Quick stats bar */}
            {isLoading ? (
              <div className="mt-4 flex gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-1 h-12 rounded-xl bg-slate-700/50 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-700/40 p-2.5 text-center">
                  <div className="text-xl font-black text-white">{summary?.todayBookings ?? 0}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">حجز اليوم</div>
                </div>
                <div className="rounded-xl bg-emerald-900/30 p-2.5 text-center border border-emerald-700/30">
                  <div className="text-xl font-black text-emerald-400">
                    {revenueAnimated.toLocaleString('ar-SA')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ر.س حتى الآن</div>
                </div>
                <div className="rounded-xl bg-blue-900/30 p-2.5 text-center border border-blue-700/30">
                  <div className="text-xl font-black text-blue-400">{summary?.activeVehicles ?? 0}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">سيارة نشطة</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── SECTION 1: Smart Alerts ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400" />
              تنبيهات تحتاج تدخلك
            </h2>
            {alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>

          <AnimatePresence mode="popLayout">
            {alertsLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-16 rounded-xl bg-slate-800/60 border border-slate-700/50 animate-pulse"
              />
            ) : alerts.length === 0 ? (
              <motion.div
                key="all-good"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-emerald-900/30 border border-emerald-700/40"
              >
                <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-emerald-300 font-bold text-sm">كل شيء على ما يرام</p>
                  <p className="text-emerald-600 text-xs">استمتع بيومك!</p>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <AlertCard key={`${alert.type}-${i}`} alert={alert} />
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* ── SECTION 2: Today's Bookings Timeline ─────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Clock size={15} className="text-blue-400" />
              جدول اليوم
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              {todayBookings.length} حجز
            </span>
          </div>

          {bookingsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-800/60 border border-slate-700/50 animate-pulse" />
              ))}
            </div>
          ) : todayBookings.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/40 text-center">
              <Clock size={24} className="text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">لا توجد حجوزات لهذا اليوم</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline vertical line */}
              <div className="absolute right-1.5 top-0 bottom-0 w-px bg-slate-700/60" />

              {groupedBookings.map((group) => (
                <div key={group.key} className="mb-4">
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-2 mr-5">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wide">
                      {group.label}
                    </span>
                    <span className="text-xs text-slate-600 font-semibold">({group.bookings.length})</span>
                  </div>

                  <AnimatePresence>
                    {group.bookings.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} />
                    ))}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── SECTION 3: Fleet Status ──────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mb-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Car size={15} className="text-cyan-400" />
              حالة الأسطول
            </h2>
            <Link to="/vendor/fleet" className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              إدارة الأسطول
            </Link>
          </div>

          {fleetLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-800/60 border border-slate-700/50 animate-pulse" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 text-center">
              <Car size={20} className="text-slate-600 mx-auto mb-1.5" />
              <p className="text-slate-500 text-sm">لا توجد مركبات مسجلة</p>
              <Link to="/vendor/fleet" className="text-xs text-blue-400 mt-1 block">إضافة مركبة</Link>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {vehicles.map((vehicle) => {
                  const isActive = !vehicle.isAvailable;
                  const hasActiveBooking = !!vehicle.currentBooking;

                  return (
                    <motion.div
                      key={vehicle.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl flex-shrink-0 mt-0.5">{VEHICLE_EMOJI[vehicle.type] ?? '🚗'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-sm">{vehicle.nameAr}</span>
                            {vehicle.plateNumber && (
                              <span className="text-xs text-slate-400 font-mono">{vehicle.plateNumber}</span>
                            )}
                            {/* Status pill */}
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                مشغول
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                متاح
                              </span>
                            )}
                          </div>

                          {/* Crew pills */}
                          {vehicle.crew.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {vehicle.crew.map((c) => (
                                <span
                                  key={c.id}
                                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                    c.isOnDuty
                                      ? 'bg-blue-900/40 text-blue-300 border-blue-700/50'
                                      : 'bg-slate-700/60 text-slate-400 border-slate-600/50'
                                  }`}
                                >
                                  <Users size={9} />
                                  {c.name}
                                  {c.role === 'driver' && (
                                    <span className="opacity-60 text-[9px]">سائق</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Current booking info */}
                          {hasActiveBooking && vehicle.currentBooking && (
                            <div className="flex items-center gap-1 mt-1.5">
                              <Navigation2 size={10} className="text-amber-400 flex-shrink-0" />
                              <span className="text-xs text-amber-300 font-semibold">
                                حجز #{vehicle.currentBooking.bookingNumber}
                              </span>
                              <span className="text-xs text-slate-500">
                                · {formatTime(vehicle.currentBooking.scheduledAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        {/* ── SECTION 4: Revenue Today ─────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mb-5"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" />
              دخلك اليوم
            </h2>
            <Link to="/vendor/analytics" className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
              التقارير الكاملة
            </Link>
          </div>

          {summaryLoading ? (
            <div className="h-32 rounded-2xl bg-slate-800/60 border border-slate-700/50 animate-pulse" />
          ) : (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/40 to-slate-900/60 border border-emerald-700/30">
              {/* Big revenue number */}
              <div className="text-center mb-4">
                <div className="text-5xl font-black text-emerald-400 tabular-nums leading-none">
                  {revenueAnimated.toLocaleString('ar-SA')}
                </div>
                <div className="text-slate-400 text-sm mt-1">ريال سعودي</div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-xl font-black text-white">{summary?.completedToday ?? 0}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">حجز مكتمل</div>
                </div>
                <div className="text-center border-x border-slate-700/50">
                  <div className="text-xl font-black text-white">
                    {summary?.avgBookingValue ? summary.avgBookingValue.toFixed(0) : 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">متوسط الحجز</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-white">
                    {summary?.todayBookings ?? 0}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">إجمالي الحجوزات</div>
                </div>
              </div>

              {/* Progress vs yesterday */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400 font-semibold">مقارنة بالأمس</span>
                  <span className={`font-bold ${progressPct >= 100 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {progressPct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                    className={`h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                  />
                </div>
                {yesterdayRev > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1 text-center">
                    دخل الأمس: {yesterdayRev.toFixed(0)} ر.س
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.section>

        {/* ── Bottom quick nav ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="grid grid-cols-2 gap-3"
        >
          <Link
            to="/vendor/dispatch"
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">التوزيع الذكي</div>
              <div className="text-[11px] text-slate-500">تعيين المركبات</div>
            </div>
          </Link>

          <Link
            to="/vendor/fleet"
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-cyan-600/30 flex items-center justify-center flex-shrink-0">
              <Car size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">الأسطول</div>
              <div className="text-[11px] text-slate-500">إدارة المركبات</div>
            </div>
          </Link>
        </motion.div>

      </div>
    </div>
  );
}
