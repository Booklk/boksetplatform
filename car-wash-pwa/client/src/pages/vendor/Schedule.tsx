/**
 * VendorSchedule — Day/Week appointment calendar for vendor admins
 * Route: /vendor/schedule
 *
 * Features:
 * - Day view: vertical timeline of booked slots
 * - Week view: heatmap of daily booking counts
 * - Config drawer: working hours, slot duration, capacity, etc.
 */

import { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ChevronLeft, ChevronRight, Settings, Plus, CalendarDays, Clock,
  Car, User, Phone, CheckCircle, AlertCircle, Loader2, X,
  Calendar, ToggleLeft, ToggleRight,
  Lightbulb, TrendingUp, Sunrise, ArrowLeft, Search, UserPlus,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingConfig {
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDurationMin: number;
  carsPerSlot: number;
  advanceBookingDays: number;
  isAppointmentMode: boolean;
}

interface ScheduleBooking {
  id: number;
  bookingNumber: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  totalPrice: string | null;
  vehicleType: string | null;
  vehiclePlate: string | null;
  customerName: string | null;
  customerPhone: string | null;
  packageName: string | null;
  serviceName: string | null;
  employeeId: number | null;
}

interface DayData {
  date: string;
  bookings: ScheduleBooking[];
  config: BookingConfig;
}

interface WeekDay {
  date: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AR_DAYS_FULL = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function toAr(n: string | number) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDateAr(dateStr: string) {
  const d = new Date(dateStr);
  return `${AR_DAYS_FULL[d.getDay()]}، ${toAr(d.getDate())} ${AR_MONTHS[d.getMonth()]}`;
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:     { label: 'معلق',       bg: 'bg-amber-500/20',   text: 'text-amber-300',   dot: '#f59e0b' },
  confirmed:   { label: 'مؤكد',       bg: 'bg-blue-500/20',    text: 'text-blue-300',    dot: '#3b82f6' },
  in_progress: { label: 'قيد التنفيذ', bg: 'bg-violet-500/20', text: 'text-violet-300',  dot: '#8b5cf6' },
  completed:   { label: 'مكتمل',      bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: '#10b981' },
  cancelled:   { label: 'ملغي',       bg: 'bg-red-500/20',     text: 'text-red-300',     dot: '#ef4444' },
};

function generateTimelineHours(startTime: string, endTime: string): string[] {
  const [sh] = startTime.split(':').map(Number);
  const [eh] = endTime.split(':').map(Number);
  const hours: string[] = [];
  for (let h = sh; h <= eh; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`);
  }
  return hours;
}

// ─── Config Drawer ────────────────────────────────────────────────────────────

function ConfigDrawer({
  open,
  onClose,
  initial,
  vendorId,
}: {
  open: boolean;
  onClose: () => void;
  initial: BookingConfig | null;
  vendorId: number;
}) {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<BookingConfig>(
    initial ?? {
      workingDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '08:00',
      endTime: '20:00',
      slotDurationMin: 30,
      carsPerSlot: 2,
      advanceBookingDays: 7,
      isAppointmentMode: true,
    },
  );

  const saveMutation = useMutation({
    mutationFn: () => api.put('/appointments/config', cfg),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-booking-config'] });
      qc.invalidateQueries({ queryKey: ['vendor-schedule'] });
      onClose();
    },
  });

  const toggleDay = (d: number) => {
    setCfg((c) => ({
      ...c,
      workingDays: c.workingDays.includes(d)
        ? c.workingDays.filter((x) => x !== d)
        : [...c.workingDays, d].sort(),
    }));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-slate-900 border-l border-white/10 overflow-y-auto"
            dir="rtl"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-white">إعدادات المواعيد</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Appointment mode toggle */}
              <div className="flex items-center justify-between mb-6 bg-slate-800/60 rounded-xl px-4 py-3">
                <div>
                  <p className="font-bold text-white text-sm">وضع المواعيد</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cfg.isAppointmentMode ? 'مفعّل — العملاء يحجزون مواعيد محددة' : 'موقوف — طابور انتظار فقط'}
                  </p>
                </div>
                <button onClick={() => setCfg((c) => ({ ...c, isAppointmentMode: !c.isAppointmentMode }))}>
                  {cfg.isAppointmentMode ? (
                    <ToggleRight size={32} className="text-brand-400" />
                  ) : (
                    <ToggleLeft size={32} className="text-slate-600" />
                  )}
                </button>
              </div>

              {/* Working days */}
              <div className="mb-5">
                <p className="text-sm font-bold text-slate-300 mb-3">أيام العمل</p>
                <div className="grid grid-cols-4 gap-2">
                  {AR_DAYS_SHORT.map((day, i) => {
                    const active = cfg.workingDays.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleDay(i)}
                        className="py-2 rounded-xl text-xs font-bold border transition-all"
                        style={
                          active
                            ? { borderColor: '#3b82f6', background: '#3b82f620', color: '#93c5fd' }
                            : { borderColor: '#1e293b', background: 'transparent', color: '#475569' }
                        }
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start / End time */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1.5 block">وقت البداية</label>
                  <input
                    type="time"
                    value={cfg.startTime}
                    onChange={(e) => setCfg((c) => ({ ...c, startTime: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1.5 block">وقت الإغلاق</label>
                  <input
                    type="time"
                    value={cfg.endTime}
                    onChange={(e) => setCfg((c) => ({ ...c, endTime: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  />
                </div>
              </div>

              {/* Slot duration */}
              <div className="mb-5">
                <p className="text-sm font-bold text-slate-300 mb-3">مدة الموعد</p>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCfg((c) => ({ ...c, slotDurationMin: d }))}
                      className="py-2 rounded-xl text-xs font-bold border transition-all"
                      style={
                        cfg.slotDurationMin === d
                          ? { borderColor: '#8b5cf6', background: '#8b5cf620', color: '#c4b5fd' }
                          : { borderColor: '#1e293b', background: 'transparent', color: '#475569' }
                      }
                    >
                      {toAr(d)} د
                    </button>
                  ))}
                </div>
              </div>

              {/* Cars per slot */}
              <div className="mb-5">
                <p className="text-sm font-bold text-slate-300 mb-2">
                  سيارات في الموعد الواحد: <span className="text-white">{toAr(cfg.carsPerSlot)}</span>
                </p>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={cfg.carsPerSlot}
                  onChange={(e) => setCfg((c) => ({ ...c, carsPerSlot: Number(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>{toAr(1)}</span>
                  <span>{toAr(10)}</span>
                </div>
              </div>

              {/* Advance booking days */}
              <div className="mb-8">
                <p className="text-sm font-bold text-slate-300 mb-3">الحجز المسبق</p>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCfg((c) => ({ ...c, advanceBookingDays: d }))}
                      className="py-2 rounded-xl text-xs font-bold border transition-all"
                      style={
                        cfg.advanceBookingDays === d
                          ? { borderColor: '#10b981', background: '#10b98120', color: '#6ee7b7' }
                          : { borderColor: '#1e293b', background: 'transparent', color: '#475569' }
                      }
                    >
                      {d === 7 ? 'أسبوع' : d === 14 ? 'أسبوعان' : 'شهر'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full py-3.5 rounded-xl font-black text-white flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 transition-colors"
              >
                {saveMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                حفظ الإعدادات
              </button>
              {saveMutation.isError && (
                <p className="text-red-400 text-xs text-center mt-2">حدث خطأ أثناء الحفظ</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Booking Detail Drawer ────────────────────────────────────────────────────

function BookingDetailDrawer({
  booking,
  onClose,
  color,
}: {
  booking: ScheduleBooking | null;
  onClose: () => void;
  color: string;
}) {
  if (!booking) return null;
  const s = STATUS_MAP[booking.status] ?? STATUS_MAP.pending;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-white/10 rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>

        <h3 className="text-lg font-black text-white mb-4">
          {booking.serviceName} — {booking.packageName}
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Clock size={16} style={{ color }} />
            <span className="text-slate-300">{formatTime(booking.scheduledAt)}</span>
          </div>
          {booking.customerName && (
            <div className="flex items-center gap-3">
              <User size={16} style={{ color }} />
              <span className="text-slate-300">{booking.customerName}</span>
            </div>
          )}
          {booking.customerPhone && (
            <div className="flex items-center gap-3">
              <Phone size={16} style={{ color }} />
              <a href={`tel:${booking.customerPhone}`} className="text-brand-400">
                {booking.customerPhone}
              </a>
            </div>
          )}
          {booking.vehicleType && (
            <div className="flex items-center gap-3">
              <Car size={16} style={{ color }} />
              <span className="text-slate-300">
                {booking.vehicleType}
                {booking.vehiclePlate ? ` — ${booking.vehiclePlate}` : ''}
              </span>
            </div>
          )}
          {booking.notes && (
            <div className="bg-slate-800/60 rounded-xl p-3 text-slate-400 text-xs">
              {booking.notes}
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-white/8 flex justify-between items-center">
          <span className="text-slate-400 text-xs">رقم الحجز</span>
          <span className="font-mono text-slate-300 text-sm">{booking.bookingNumber}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Manual Booking Drawer ───────────────────────────────────────────────────

interface CustomerSearchResult {
  id: number;
  name: string | null;
  phone: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  defaultAddress: string | null;
}

interface ServiceListItem {
  id: number;
  name: string;
  packages: {
    id: number;
    name: string;
    price: string;
    duration: number;
  }[];
}

interface SlotListItem {
  time: string;
  available: boolean;
  bookedCount: number;
  capacity: number;
  isBlocked: boolean;
  isPast: boolean;
}

interface AvailableSlotsResponse {
  appointmentMode: boolean;
  slots: SlotListItem[];
  closedDay?: boolean;
  tooFarAhead?: boolean;
}

function ManualBookingDrawer({
  open,
  onClose,
  vendorId,
  defaultDate,
  color,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: number | undefined;
  defaultDate: string;
  color: string;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'search' | 'new'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '', phone: '', vehicleType: '', vehiclePlate: '',
  });
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      // Reset form each time drawer opens
      setMode('search');
      setSearchQuery('');
      setSearchResults([]);
      setSelectedCustomer(null);
      setNewCustomer({ name: '', phone: '', vehicleType: '', vehiclePlate: '' });
      setSelectedPackageId(null);
      setDate(defaultDate);
      setTime('');
      setVehicleType('');
      setVehiclePlate('');
      setNotes('');
    }
  }, [open, defaultDate]);

  const { data: services = [] } = useQuery<ServiceListItem[]>({
    queryKey: ['services-for-manual-booking', vendorId],
    queryFn: () => api.get('/services').then((r) => r.data),
    enabled: open && !!vendorId,
  });

  const { data: slotData } = useQuery<AvailableSlotsResponse>({
    queryKey: ['manual-booking-slots', vendorId, date],
    queryFn: () =>
      api
        .get(`/appointments/available?vendorId=${vendorId}&date=${date}`)
        .then((r) => r.data),
    enabled: open && !!vendorId && !!date,
  });

  async function runSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(`/customers/search/phone?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  const createCustomer = useMutation({
    mutationFn: () => api.post('/customers', newCustomer).then((r) => r.data),
    onSuccess: (customer: { id: number; name: string; phone: string }) => {
      toast.success('تم إنشاء العميل');
      setSelectedCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        vehiclePlate: newCustomer.vehiclePlate || null,
        vehicleType: newCustomer.vehicleType || null,
        defaultAddress: null,
      });
      setVehicleType(newCustomer.vehicleType);
      setVehiclePlate(newCustomer.vehiclePlate);
      setMode('search');
    },
    onError: (err: { response?: { status?: number; data?: { existingCustomer?: CustomerSearchResult; error?: string } } }) => {
      if (err?.response?.status === 409 && err.response.data?.existingCustomer) {
        toast.success('العميل موجود مسبقاً — تم اختياره');
        setSelectedCustomer({
          ...err.response.data.existingCustomer,
          vehiclePlate: err.response.data.existingCustomer.vehiclePlate ?? null,
          vehicleType: err.response.data.existingCustomer.vehicleType ?? null,
          defaultAddress: err.response.data.existingCustomer.defaultAddress ?? null,
        });
        setMode('search');
      } else {
        toast.error(err?.response?.data?.error ?? 'فشل إنشاء العميل');
      }
    },
  });

  const createBooking = useMutation({
    mutationFn: () => {
      if (!selectedPackageId || !selectedCustomer || !date || !time) {
        throw new Error('بيانات ناقصة');
      }
      const scheduledAt = new Date(`${date}T${time}:00.000Z`).toISOString();
      return api
        .post('/bookings', {
          packageId: selectedPackageId,
          customerId: selectedCustomer.id,
          scheduledAt,
          address: 'حجز يدوي — داخل المحل',
          vehicleType: vehicleType || selectedCustomer.vehicleType || undefined,
          vehiclePlate: vehiclePlate || selectedCustomer.vehiclePlate || undefined,
          notes: notes || undefined,
        })
        .then((r) => r.data);
    },
    onSuccess: (booking: { bookingNumber: string }) => {
      toast.success(`تم إنشاء الحجز #${booking.bookingNumber}`);
      qc.invalidateQueries({ queryKey: ['vendor-schedule'] });
      qc.invalidateQueries({ queryKey: ['vendor-schedule-week'] });
      qc.invalidateQueries({ queryKey: ['manual-booking-slots'] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      toast.error(err?.response?.data?.error ?? err?.message ?? 'فشل إنشاء الحجز');
    },
  });

  const allPackages = services.flatMap((s) =>
    s.packages.map((p) => ({ ...p, serviceName: s.name })),
  );
  const selectedPkg = allPackages.find((p) => p.id === selectedPackageId);

  const canSubmit =
    !!selectedCustomer &&
    !!selectedPackageId &&
    !!date &&
    !!time &&
    !createBooking.isPending;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-slate-900 border-l border-white/10 overflow-y-auto"
            dir="rtl"
          >
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-black text-white">حجز يدوي</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {/* ── Step 1: Customer ─────────────────────────────── */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-black text-white">① العميل</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('search')}
                      className="text-xs px-3 py-1 rounded-lg font-bold transition-colors"
                      style={
                        mode === 'search'
                          ? { background: color, color: '#fff' }
                          : { background: '#1e293b', color: '#64748b' }
                      }
                    >
                      <Search size={11} className="inline ml-1" />
                      بحث
                    </button>
                    <button
                      onClick={() => setMode('new')}
                      className="text-xs px-3 py-1 rounded-lg font-bold transition-colors"
                      style={
                        mode === 'new'
                          ? { background: color, color: '#fff' }
                          : { background: '#1e293b', color: '#64748b' }
                      }
                    >
                      <UserPlus size={11} className="inline ml-1" />
                      جديد
                    </button>
                  </div>
                </div>

                {mode === 'search' ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => runSearch(e.target.value)}
                      placeholder="اسم أو رقم جوال..."
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      dir="rtl"
                    />
                    {searching && (
                      <p className="text-xs text-slate-400">جاري البحث...</p>
                    )}
                    {searchResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setSearchResults([]);
                          setSearchQuery(c.name ?? c.phone);
                          setVehicleType(c.vehicleType ?? '');
                          setVehiclePlate(c.vehiclePlate ?? '');
                        }}
                        className="w-full text-right p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/8 transition-colors"
                      >
                        <p className="text-sm font-bold text-white">{c.name ?? '—'}</p>
                        <p className="text-xs text-slate-400 font-mono" dir="ltr">
                          {c.phone}
                          {c.vehiclePlate ? ` · ${c.vehiclePlate}` : ''}
                        </p>
                      </button>
                    ))}
                    {selectedCustomer && (
                      <div className="mt-2 rounded-xl p-3 border" style={{ background: `${color}15`, borderColor: `${color}40` }}>
                        <p className="text-xs font-bold" style={{ color }}>العميل المختار</p>
                        <p className="text-sm font-black text-white mt-1">{selectedCustomer.name ?? '—'}</p>
                        <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">{selectedCustomer.phone}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer((f) => ({ ...f, name: e.target.value }))}
                      placeholder="الاسم الكامل"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                    />
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="05XXXXXXXX"
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      dir="ltr"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newCustomer.vehicleType}
                        onChange={(e) => setNewCustomer((f) => ({ ...f, vehicleType: e.target.value }))}
                        placeholder="نوع السيارة"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      />
                      <input
                        type="text"
                        value={newCustomer.vehiclePlate}
                        onChange={(e) => setNewCustomer((f) => ({ ...f, vehiclePlate: e.target.value }))}
                        placeholder="رقم اللوحة"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      />
                    </div>
                    <button
                      onClick={() => createCustomer.mutate()}
                      disabled={
                        createCustomer.isPending ||
                        newCustomer.name.trim().length < 2 ||
                        newCustomer.phone.trim().length < 10
                      }
                      className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-colors disabled:opacity-40"
                      style={{ background: color }}
                    >
                      {createCustomer.isPending ? 'جاري الإنشاء...' : 'إنشاء العميل'}
                    </button>
                  </div>
                )}
              </div>

              {/* ── Step 2: Package ─────────────────────────────── */}
              <div className="mb-5">
                <p className="text-sm font-black text-white mb-3">② الخدمة</p>
                {allPackages.length === 0 ? (
                  <p className="text-xs text-slate-500">لا توجد باقات متاحة</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {allPackages.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl border transition-colors"
                        style={
                          selectedPackageId === pkg.id
                            ? { borderColor: color, background: `${color}15` }
                            : { borderColor: '#1e293b', background: '#0f172a' }
                        }
                      >
                        <div className="text-right">
                          <p className="text-xs text-slate-500">{pkg.serviceName}</p>
                          <p className="text-sm font-bold text-white">{pkg.name}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-white">{pkg.price} ر.س</p>
                          <p className="text-[10px] text-slate-500">{toAr(pkg.duration)} د</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Step 3: Date + Slot ─────────────────────────── */}
              <div className="mb-5">
                <p className="text-sm font-black text-white mb-3">③ الموعد</p>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setTime(''); }}
                  className="w-full mb-2 bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                />
                {slotData?.closedDay && (
                  <p className="text-xs text-amber-400 mb-2">هذا اليوم خارج أيام العمل</p>
                )}
                {slotData?.tooFarAhead && (
                  <p className="text-xs text-amber-400 mb-2">التاريخ أبعد من نافذة الحجز المسبق</p>
                )}
                {slotData?.slots && slotData.slots.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {slotData.slots.map((s) => {
                      const disabled = s.isPast || s.isBlocked;
                      const full = s.bookedCount >= s.capacity;
                      const selected = time === s.time;
                      return (
                        <button
                          key={s.time}
                          disabled={disabled}
                          onClick={() => setTime(s.time)}
                          className="py-2 rounded-xl text-xs font-bold transition-colors font-mono"
                          style={
                            selected
                              ? { background: color, color: '#fff' }
                              : disabled
                              ? { background: '#0f172a', color: '#334155' }
                              : full
                              ? { background: '#1e293b', color: '#f59e0b', border: '1px dashed #f59e0b55' }
                              : { background: '#1e293b', color: '#cbd5e1' }
                          }
                          title={full ? 'ممتلئ — قد يتجاوز السعة' : undefined}
                        >
                          {s.time}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">لا توجد خانات متاحة</p>
                )}
              </div>

              {/* ── Step 4: Vehicle + Notes ─────────────────────── */}
              <div className="mb-5 space-y-2">
                <p className="text-sm font-black text-white mb-2">④ السيارة وملاحظات</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    placeholder="نوع السيارة"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  />
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="اللوحة"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                  />
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات (اختياري)"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none h-16"
                />
              </div>

              {/* ── Summary ─────────────────────────────────────── */}
              {selectedPkg && selectedCustomer && time && (
                <div className="rounded-xl p-3 mb-4 border" style={{ background: `${color}10`, borderColor: `${color}30` }}>
                  <p className="text-xs text-slate-400">ملخص</p>
                  <p className="text-sm font-black text-white mt-1">
                    {selectedCustomer.name ?? selectedCustomer.phone} — {selectedPkg.name}
                  </p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {formatDateAr(date)} · {time}
                  </p>
                  <p className="text-sm font-black mt-1" style={{ color }}>
                    {selectedPkg.price} ر.س
                  </p>
                </div>
              )}

              {/* ── Submit ──────────────────────────────────────── */}
              <button
                onClick={() => createBooking.mutate()}
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl font-black text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
                style={{ background: color }}
              >
                {createBooking.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle size={18} />
                )}
                تأكيد الحجز
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Smart Recommendations Panel ─────────────────────────────────────────────

interface Insight {
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
  color: string;
}

interface InsightsResponse {
  insights: Insight[];
  meta: {
    monthBookings: number;
    timeSavedHours: number;
    inactiveCustomers: number;
    hasLoyalty: boolean;
    growth: number | null;
  };
}

const TIP_COLORS: Record<string, { card: string; badge: string; icon: string; btn: string }> = {
  amber:   { card: 'bg-amber-500/10 border-amber-500/30',   badge: 'text-amber-300',   icon: 'text-amber-400',  btn: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30' },
  blue:    { card: 'bg-blue-500/10 border-blue-500/30',     badge: 'text-blue-300',    icon: 'text-blue-400',   btn: 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/30' },
  emerald: { card: 'bg-emerald-500/10 border-emerald-500/30', badge: 'text-emerald-300', icon: 'text-emerald-400', btn: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30' },
};

function SmartRecommendations() {
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery<InsightsResponse>({
    queryKey: ['schedule-insights'],
    queryFn: () => api.get('/reports/insights').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (dismissed || isLoading || !data) return null;

  // Extract slowest day from API data (from slow_day insight if present, or meta)
  const slowDayInsight = data.insights.find((i) => i.id === 'slow_day');
  const slowestDayLabel = slowDayInsight
    ? slowDayInsight.title.split(' ')[0]  // first word is the day name
    : 'يوم في الأسبوع';

  // Build the 3 schedule-specific tips
  const tips = [
    {
      id: 'best_promo_time',
      Icon: TrendingUp,
      color: 'amber',
      title: `أفضل وقت للعروض: ${slowestDayLabel}`,
      body: 'معدل الحجوزات أقل بـ 40% — عرض سريع يُضاعف الحجوزات',
      actionLabel: 'أنشئ عرضاً',
      actionUrl: '/vendor/promos',
    },
    {
      id: 'peak_capacity',
      Icon: Lightbulb,
      color: 'blue',
      title: 'اكتمال الطاقة الإنتاجية',
      body: 'أضف موظفاً في وقت الذروة لزيادة الإيرادات 25% دون فقدان أي حجز',
      actionLabel: 'إدارة الموظفين',
      actionUrl: '/vendor/employees',
    },
    {
      id: 'early_slots',
      Icon: Sunrise,
      color: 'emerald',
      title: 'جدول خانات الصباح الباكر',
      body: 'الخانات 7–9 صباحاً الأقل استخداماً — ابدأ بها ليومٍ منتج ومرتب',
      actionLabel: 'ضبط الجدول',
      actionUrl: '/vendor/schedule',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="max-w-3xl mx-auto px-4 pt-4 pb-1"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={15} className="text-amber-400" />
          <span className="text-sm font-black text-white">توصيات ذكية</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg bg-slate-800/60 text-slate-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {tips.map((tip) => {
          const c = TIP_COLORS[tip.color] ?? TIP_COLORS.amber;
          return (
            <div
              key={tip.id}
              className={`border rounded-2xl p-3.5 ${c.card}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <tip.Icon size={14} className={c.icon} />
                <p className={`text-xs font-black ${c.badge}`}>{tip.title}</p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed mb-3">{tip.body}</p>
              <a
                href={tip.actionUrl}
                className={`inline-flex items-center gap-1 border text-xs font-bold px-3 py-1.5 rounded-xl transition-colors ${c.btn}`}
              >
                {tip.actionLabel}
                <ArrowLeft size={11} />
              </a>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorSchedule() {
  const { user } = useAuth();
  const vendorId = user?.vendorId;
  const color = '#3b82f6'; // fallback; could come from vendor settings

  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [configOpen, setConfigOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ScheduleBooking | null>(null);

  const dateStr = isoDate(currentDate);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: dayData, isLoading: dayLoading } = useQuery<DayData>({
    queryKey: ['vendor-schedule', vendorId, dateStr],
    queryFn: () => api.get(`/appointments/schedule?date=${dateStr}`).then((r) => r.data),
    enabled: !!vendorId && viewMode === 'day',
  });

  const weekStart = isoDate(
    (() => {
      const d = new Date(currentDate);
      const dow = d.getDay();
      d.setDate(d.getDate() - dow); // start of week (Sunday)
      return d;
    })(),
  );
  const weekEnd = isoDate(addDays(new Date(weekStart), 6));

  const { data: weekData, isLoading: weekLoading } = useQuery<{ from: string; to: string; days: WeekDay[] }>({
    queryKey: ['vendor-schedule-week', vendorId, weekStart],
    queryFn: () => api.get(`/appointments/schedule/week?from=${weekStart}&to=${weekEnd}`).then((r) => r.data),
    enabled: !!vendorId && viewMode === 'week',
  });

  const { data: configData } = useQuery<BookingConfig>({
    queryKey: ['vendor-booking-config', vendorId],
    queryFn: () => api.get(`/appointments/config?vendorId=${vendorId}`).then((r) => r.data),
    enabled: !!vendorId,
  });

  // ─── Timeline rendering ──────────────────────────────────────────────────────

  function renderDayView() {
    if (dayLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-brand-400" />
        </div>
      );
    }

    const cfg = dayData?.config ?? configData;
    const dayBookings = dayData?.bookings ?? [];

    if (!cfg) return null;

    const timelineHours = generateTimelineHours(cfg.startTime, cfg.endTime);

    // Group bookings by slot time (HH:00 or HH:30 etc.)
    const byHour: Record<string, ScheduleBooking[]> = {};
    for (const b of dayBookings) {
      const d = new Date(b.scheduledAt);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = d.getUTCMinutes() < 30 ? '00' : '30';
      const key = `${hh}:${mm}`;
      if (!byHour[key]) byHour[key] = [];
      byHour[key].push(b);
    }

    // Slots for capacity indicator
    const slotTimes: string[] = [];
    const [sh, sm] = cfg.startTime.split(':').map(Number);
    const [eh, em] = cfg.endTime.split(':').map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur < end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      slotTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      cur += cfg.slotDurationMin;
    }

    return (
      <div className="relative">
        {slotTimes.map((slotTime) => {
          const slotBookings = byHour[slotTime] ?? [];
          const isEmpty = slotBookings.length === 0;
          return (
            <div key={slotTime} className="flex gap-3 mb-1">
              {/* Time label */}
              <div className="w-14 shrink-0 text-right">
                <span className="text-xs text-slate-500 font-mono">{slotTime}</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-h-[52px] relative border-r border-slate-800/60 pr-3">
                {isEmpty ? (
                  <div className="h-12 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/20" />
                ) : (
                  <div className="space-y-1.5">
                    {slotBookings.map((b) => {
                      const s = STATUS_MAP[b.status] ?? STATUS_MAP.pending;
                      return (
                        <motion.button
                          key={b.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedBooking(b)}
                          className="w-full text-right rounded-xl px-3 py-2 border border-white/8 flex items-center gap-3 transition-all hover:border-white/20"
                          style={{ background: `${s.dot}15`, borderColor: `${s.dot}40` }}
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: s.dot }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {b.customerName ?? 'عميل'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {b.serviceName} — {b.vehicleType ?? b.vehiclePlate ?? ''}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Capacity indicator */}
                {cfg.carsPerSlot > 1 && (
                  <div className="absolute top-1 left-0 text-[9px] text-slate-600 font-mono">
                    {toAr(slotBookings.length)}/{toAr(cfg.carsPerSlot)}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {dayBookings.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm">لا توجد حجوزات لهذا اليوم</p>
          </div>
        )}
      </div>
    );
  }

  function renderWeekView() {
    if (weekLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-brand-400" />
        </div>
      );
    }

    const byDate: Record<string, number> = {};
    for (const d of weekData?.days ?? []) byDate[d.date] = d.count;

    const maxCount = Math.max(...Object.values(byDate), 1);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(weekStart), i));

    return (
      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d) => {
          const iso = isoDate(d);
          const count = byDate[iso] ?? 0;
          const intensity = count / maxCount;
          const isToday = iso === isoDate(new Date());
          return (
            <motion.button
              key={iso}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setCurrentDate(d);
                setViewMode('day');
              }}
              className="rounded-2xl p-2 flex flex-col items-center gap-1.5 border transition-all"
              style={{
                borderColor: isToday ? color : '#1e293b',
                background: count > 0
                  ? `rgba(59,130,246,${0.08 + intensity * 0.35})`
                  : '#0f172a',
              }}
            >
              <span className="text-[10px] text-slate-500">{AR_DAYS_SHORT[d.getDay()]}</span>
              <span className={`text-lg font-black ${isToday ? 'text-brand-400' : 'text-white'}`}>
                {toAr(d.getDate())}
              </span>
              {count > 0 ? (
                <div
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `rgba(59,130,246,${0.2 + intensity * 0.5})`, color: '#93c5fd' }}
                >
                  {toAr(count)}
                </div>
              ) : (
                <div className="text-[10px] text-slate-700">—</div>
              )}
            </motion.button>
          );
        })}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      <ConfigDrawer
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        initial={configData ?? null}
        vendorId={vendorId!}
      />
      <BookingDetailDrawer
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        color={color}
      />
      <ManualBookingDrawer
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        vendorId={vendorId}
        defaultDate={dateStr}
        color={color}
      />

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-surface-1/95 border-b border-white/8 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-black text-white">الجدول الزمني</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setConfigOpen(true)}
                className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
              >
                <Settings size={18} />
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: color }}
                onClick={() => setManualOpen(true)}
              >
                <Plus size={14} />
                حجز يدوي
              </button>
            </div>
          </div>

          {/* Date navigation */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentDate((d) => addDays(d, viewMode === 'day' ? -1 : -7))}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 text-slate-300 hover:text-white"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="flex-1 text-center text-sm font-bold text-white py-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
            >
              {viewMode === 'day'
                ? formatDateAr(dateStr)
                : `${formatDateAr(weekStart)} — ${formatDateAr(weekEnd)}`}
            </button>
            <button
              onClick={() => setCurrentDate((d) => addDays(d, viewMode === 'day' ? 1 : 7))}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 text-slate-300 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex gap-1.5 mt-3">
            {(['day', 'week'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={
                  viewMode === v
                    ? { background: color, color: '#fff' }
                    : { background: '#1e293b', color: '#64748b' }
                }
              >
                {v === 'day' ? 'يوم' : 'أسبوع'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Smart Recommendations ──────────────────────────────────── */}
      <SmartRecommendations />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {viewMode === 'day' ? (
            <motion.div
              key="day"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {renderDayView()}
            </motion.div>
          ) : (
            <motion.div
              key="week"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {renderWeekView()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
