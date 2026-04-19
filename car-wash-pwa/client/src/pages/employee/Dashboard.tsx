import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Car, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Booking } from '../../types';
import { formatDateTime, formatCurrency, STATUS_LABELS } from '../../lib/utils';
import StatusBadge from '../../components/StatusBadge';
import { haptics } from '../../lib/haptics';
import { useAuth } from '../../hooks/useAuth';

const ACTIVE_STATUSES = ['confirmed', 'on_way', 'arrived', 'in_progress'];

// ─── Live elapsed counter ────────────────────────────────────────────────────
function useElapsedSince(date: Date | null) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!date) { setElapsed('—'); return; }
    const d = date;

    function update() {
      const diffMs = Date.now() - d.getTime();
      const mins = Math.floor(diffMs / 60_000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) setElapsed(`${hrs} س ${mins % 60} د`);
      else setElapsed(`${mins} دقيقة`);
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [date]);

  return elapsed;
}

// ─── Swipeable booking card ──────────────────────────────────────────────────
function SwipeableBookingCard({
  booking,
  index,
  highlight,
  onQuickOnWay,
}: {
  booking: Booking;
  index: number;
  highlight?: boolean;
  onQuickOnWay: (id: number) => void;
}) {
  const startX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const canSwipe = booking.status === 'confirmed' || booking.status === 'pending';

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!canSwipe) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) return; // RTL: swipe right = positive dx
    setSwipeX(Math.min(dx, 80));
  }, [canSwipe]);

  const onTouchEnd = useCallback(() => {
    if (swipeX >= 60) {
      setSwiped(true);
      haptics.medium();
      onQuickOnWay(booking.id);
    }
    setSwipeX(0);
  }, [swipeX, booking.id, onQuickOnWay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="relative overflow-hidden rounded-2xl"
    >
      {/* Swipe hint background */}
      {canSwipe && (
        <div
          className="absolute inset-0 flex items-center pr-4 bg-purple-700/80 rounded-2xl"
          style={{ opacity: swipeX / 80 }}
        >
          <span className="text-white font-black text-sm">🚗 في الطريق</span>
        </div>
      )}

      <div
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.3s ease' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Link
          to={`/employee/order/${booking.id}`}
          className={`card block hover:border-brand-600/60 transition-all ${highlight ? 'border-brand-600/50 bg-brand-900/20' : ''} ${swiped ? 'opacity-60' : ''}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-slate-400">#{booking.bookingNumber}</p>
              <h3 className="font-black text-white">{booking.customerName}</h3>
              <p className="text-sm text-slate-300">{booking.serviceName} - {booking.packageName}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <div className="space-y-1 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Calendar size={12} className="text-brand-400" />
              {formatDateTime(booking.scheduledAt)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-brand-400" />
              <span className="truncate">{booking.address}</span>
            </div>
            {booking.vehiclePlate && (
              <div className="flex items-center gap-2">
                <Car size={12} className="text-brand-400" />
                {booking.vehicleType} - {booking.vehiclePlate}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-700">
            <span className="font-black gradient-text text-sm">{formatCurrency(booking.totalPrice)}</span>
            <span className="text-xs text-brand-400 font-semibold">
              {canSwipe ? 'اسحب ← للتحرك' : 'افتح التفاصيل ←'}
            </span>
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Duty toggle (isOnDuty — persisted in DB) ────────────────────────────────
function DutyToggle() {
  const { user } = useAuth();
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [pending, setPending] = useState(false);

  // Initialize from on-duty list
  useEffect(() => {
    if (!user?.id) return;
    api.get('/employees/on-duty')
      .then(r => {
        const list: any[] = r.data ?? [];
        setIsOnDuty(list.some((e: any) => e.id === user.id));
      })
      .catch(() => {/* silently ignore — user may not be vendor_admin */});
  }, [user?.id]);

  const toggleDuty = async () => {
    if (!user?.id) return;
    const next = !isOnDuty;
    setPending(true);
    try {
      await api.patch(`/employees/${user.id}/availability`, { isOnDuty: next });
      setIsOnDuty(next);
      haptics.medium();
      toast.success(next ? '✅ أنت الآن متاح للعمل' : '⏸️ تم تحديث حالتك إلى خارج الدوام');
    } catch {
      haptics.error();
      toast.error('فشل في تحديث حالة الدوام');
    } finally {
      setPending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border transition-colors duration-300 ${
        isOnDuty
          ? 'bg-green-900/30 border-green-600/40'
          : 'bg-slate-800/60 border-slate-700/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="font-black text-white text-lg leading-tight">
            {isOnDuty ? '🟢 متاح للعمل' : '⏸️ خارج الدوام'}
          </p>
          <p className={`text-sm mt-1 ${isOnDuty ? 'text-green-400' : 'text-slate-400'}`}>
            {isOnDuty
              ? 'الحجوزات ستصلك الآن'
              : 'لن تتلقى حجوزات جديدة'}
          </p>
        </div>
        <button
          onClick={toggleDuty}
          disabled={pending}
          className={`relative w-16 h-8 rounded-full transition-colors duration-300 focus:outline-none shrink-0 ${
            isOnDuty ? 'bg-green-500' : 'bg-slate-600'
          } ${pending ? 'opacity-60' : ''}`}
          aria-label="toggle duty status"
        >
          <motion.div
            animate={{ x: isOnDuty ? 32 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-6 h-6 bg-white rounded-full shadow"
          />
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-2">حالة العمل</p>
    </motion.div>
  );
}

// ─── Live Earnings Card ───────────────────────────────────────────────────────
interface LiveEarnings {
  todayBookings: number;
  todayRevenue: number;
  todayCommission: number;
  monthBookings: number;
  monthRevenue: number;
  monthCommission: number;
  monthBonus: number;
  baseSalary: number;
  totalThisMonth: number;
}

function LiveEarningsCard({ userId }: { userId: number }) {
  const { data: liveEarnings, isLoading } = useQuery<LiveEarnings>({
    queryKey: ['live-earnings', userId],
    queryFn: () => api.get(`/payroll/live-earnings/${userId}`).then(r => r.data),
    refetchInterval: 60000,
    enabled: !!userId,
  });

  const monthlyTarget = (liveEarnings?.baseSalary ?? 0) > 0
    ? liveEarnings!.baseSalary
    : 3000; // default reference target

  const progressPercent = Math.min(
    100,
    Math.round(((liveEarnings?.todayCommission ?? 0) / monthlyTarget) * 100 * 30)
  ); // ~daily share of monthly target

  if (isLoading) {
    return (
      <div className="card animate-pulse h-36" />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-900/30 to-orange-900/20 p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <TrendingUp size={16} className="text-yellow-400" />
          </div>
          <p className="font-bold text-white text-sm">كسبك اليوم</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          مباشر
        </span>
      </div>

      {/* Big number */}
      <div className="mb-2">
        <motion.span
          key={liveEarnings?.todayCommission}
          initial={{ scale: 1.1, color: '#fbbf24' }}
          animate={{ scale: 1, color: '#ffffff' }}
          transition={{ duration: 0.4 }}
          className="text-4xl font-black text-white"
        >
          {(liveEarnings?.todayCommission ?? 0).toFixed(0)}
        </motion.span>
        <span className="text-lg text-yellow-300 mr-1">ر.س</span>
      </div>

      {/* Today sub-stats */}
      <p className="text-xs text-slate-400 mb-3">
        {liveEarnings?.todayBookings ?? 0} غسلة
        {' | '}
        {(liveEarnings?.todayRevenue ?? 0).toFixed(0)} ر.س إيراد
      </p>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>اليوم</span>
          <span>الهدف اليومي</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-400 rounded-full"
          />
        </div>
      </div>

      {/* Monthly total */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <p className="text-xs text-slate-400">إجمالي هذا الشهر</p>
        <p className="text-sm font-bold text-yellow-300">
          {(liveEarnings?.totalThisMonth ?? 0).toFixed(0)} ر.س
        </p>
      </div>
    </motion.div>
  );
}

// ─── Ready toggle ─────────────────────────────────────────────────────────────
function ReadyToggle() {
  const [isReady, setIsReady] = useState(() => {
    return localStorage.getItem('emp-ready') === 'true';
  });
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const next = !isReady;
    try {
      await api.post('/employees/ready-status', { isReady: next });
      setIsReady(next);
      localStorage.setItem('emp-ready', String(next));
      haptics.medium();
      toast.success(next ? 'أنت الآن جاهز للعمل ✅' : 'تم إيقاف الجاهزية');
    } catch {
      haptics.error();
      toast.error('فشل في تحديث الحالة');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card flex items-center justify-between">
      <div>
        <p className="font-black text-white">جاهز للعمل</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {isReady ? 'أنت مرئي للطلبات الجديدة' : 'أنت غير متاح حالياً'}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={pending}
        className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${
          isReady ? 'bg-green-500' : 'bg-slate-600'
        } ${pending ? 'opacity-60' : ''}`}
        aria-label="toggle ready status"
      >
        <motion.div
          animate={{ x: isReady ? 28 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
        />
      </button>
    </div>
  );
}

// ─── My Vehicle Card ─────────────────────────────────────────────────────────
function MyVehicleCard({ userId }: { userId: number }) {
  const { data: myVehicle, isLoading } = useQuery({
    queryKey: ['my-vehicle', userId],
    queryFn: () =>
      api.get('/fleet/with-crew').then((r) => {
        const found = (r.data?.vehicles ?? []).find((v: any) =>
          v.crew?.some((c: any) => c.id === userId),
        );
        return found ?? null;
      }),
    enabled: !!userId,
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="card animate-pulse h-20" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${
        myVehicle
          ? 'bg-blue-900/20 border-blue-600/30'
          : 'bg-slate-800/40 border-slate-700/40'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-lg shrink-0">
          {myVehicle?.type === 'motorcycle' ? '🏍️' : '🚗'}
        </div>
        <p className="font-bold text-white text-sm">سيارتك اليوم</p>
      </div>

      {myVehicle ? (
        <div>
          <p className="text-base font-black text-white mb-1">
            {myVehicle.nameAr}
            {myVehicle.plateNumber && (
              <span className="text-slate-400 text-sm font-normal mr-2">{myVehicle.plateNumber}</span>
            )}
          </p>
          {myVehicle.crew?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {myVehicle.crew.map((c: any) => (
                <span key={c.id} className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                  {c.role === 'driver' ? '🚗' : '🔧'} {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">
          لم يتم تعيينك لسيارة بعد — تواصل مع المشرف
        </p>
      )}
    </motion.div>
  );
}

// ─── Quick stats row ──────────────────────────────────────────────────────────
function QuickStats({ bookings }: { bookings: Booking[] }) {
  const now = new Date();

  const todayCount = bookings.filter(b => {
    const d = new Date(b.scheduledAt);
    return d.toDateString() === now.toDateString() && b.status === 'completed';
  }).length;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekCount = bookings.filter(b => {
    return new Date(b.scheduledAt) >= weekStart && b.status === 'completed';
  }).length;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthCount = bookings.filter(b => {
    return new Date(b.scheduledAt) >= monthStart && b.status === 'completed';
  }).length;

  return (
    <div>
      <h2 className="text-sm font-bold text-slate-400 mb-2 flex items-center gap-1">
        <CheckCircle2 size={14} className="text-green-400" /> الإنجازات المكتملة
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'اليوم',        value: todayCount, color: 'text-green-400' },
          { label: 'هذا الأسبوع', value: weekCount,  color: 'text-blue-400'  },
          { label: 'هذا الشهر',   value: monthCount, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live counter ─────────────────────────────────────────────────────────────
function LiveCounter({ bookings }: { bookings: Booking[] }) {
  const lastCompleted = bookings
    .filter(b => b.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt ?? b.scheduledAt).getTime() - new Date(a.updatedAt ?? a.scheduledAt).getTime())[0];

  const sinceDate = lastCompleted
    ? new Date(lastCompleted.updatedAt ?? lastCompleted.scheduledAt)
    : null;

  const elapsed = useElapsedSince(sinceDate);

  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
        <Clock size={20} className="text-orange-400" />
      </div>
      <div>
        <p className="text-xs text-slate-400">الوقت منذ آخر إنجاز</p>
        <p className="font-black text-white text-lg leading-tight">{elapsed}</p>
        {lastCompleted && (
          <p className="text-xs text-slate-500 truncate max-w-[200px]">
            {lastCompleted.customerName}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['employee-bookings'],
    queryFn: () => api.get('/bookings/employee/assigned').then(r => r.data),
    refetchInterval: 20000,
  });

  const { mutate: quickOnWay } = useMutation({
    mutationFn: (id: number) => api.post(`/bookings/${id}/status`, { status: 'on_way' }).then(r => r.data),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['employee-bookings'] });
      toast.success('تم تحديث الحالة: في الطريق 🚗');
    },
    onError: () => {
      haptics.error();
      toast.error('فشل في تحديث الحالة');
    },
  });

  const active = bookings.filter(b => ACTIVE_STATUSES.includes(b.status));
  const upcoming = bookings.filter(b => b.status === 'pending' || b.status === 'confirmed');
  const today = bookings.filter(b => {
    const d = new Date(b.scheduledAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  if (isLoading) return (
    <div className="p-4 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card animate-pulse h-32" />
      ))}
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5" dir="rtl">

      {/* Live earnings */}
      {user?.id && <LiveEarningsCard userId={user.id} />}

      {/* Duty status toggle (isOnDuty — DB-persisted) */}
      <DutyToggle />

      {/* Ready toggle */}
      <ReadyToggle />

      {/* My vehicle today */}
      {user?.id && <MyVehicleCard userId={user.id} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'اليوم', value: today.length, icon: '📅' },
          { label: 'نشط', value: active.length, icon: '🔴' },
          { label: 'قادم', value: upcoming.length, icon: '⏳' },
        ].map(stat => (
          <div key={stat.label} className="card text-center py-4">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-2xl font-black text-white">{stat.value}</div>
            <div className="text-xs text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Live counter */}
      <LiveCounter bookings={bookings} />

      {/* Quick stats */}
      <QuickStats bookings={bookings} />

      {/* Quick action */}
      <Link to="/employee/new-booking" className="card-hover flex items-center justify-between p-4 border-dashed border-brand-600/40">
        <div>
          <p className="font-black text-white">حجز جديد</p>
          <p className="text-sm text-slate-400">أنشئ حجزاً لعميل موجود أو جديد</p>
        </div>
        <div className="w-10 h-10 bg-brand-700/50 rounded-xl flex items-center justify-center text-xl">+</div>
      </Link>

      {/* Active orders */}
      {active.length > 0 && (
        <div>
          <h2 className="text-lg font-black text-white mb-3">🔴 الطلبات النشطة</h2>
          <div className="space-y-3">
            {active.map((b, i) => (
              <SwipeableBookingCard
                key={b.id}
                booking={b}
                index={i}
                highlight
                onQuickOnWay={quickOnWay}
              />
            ))}
          </div>
        </div>
      )}

      {/* All bookings */}
      <div>
        <h2 className="text-lg font-black text-white mb-3">جميع الطلبات</h2>
        {bookings.length === 0 ? (
          <div className="card text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">📋</div>
            <p>لا توجد طلبات مسندة إليك</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <SwipeableBookingCard
                key={b.id}
                booking={b}
                index={i}
                onQuickOnWay={quickOnWay}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
