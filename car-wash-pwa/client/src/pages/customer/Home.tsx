import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, CreditCard, Crown, Star, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { Service, Booking } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import PushPrompt from '../../components/PushPrompt';
import { useVendorTheme } from '../../store/vendorTheme';

// ─── Active Booking Banner ────────────────────────────────────────────────────
const ACTIVE_BOOKING_STATUSES = ['on_way', 'arrived', 'in_progress'];

const STATUS_LABEL_MAP: Record<string, string> = {
  on_way:      'في الطريق إليك',
  arrived:     'وصل مقدم الخدمة 📍',
  in_progress: 'جارٍ تنفيذ الخدمة',
};

const STATUS_COLOR: Record<string, string> = {
  on_way:      'from-purple-900/80 to-purple-800/60 border-purple-500/40',
  arrived:     'from-cyan-900/80 to-cyan-800/60 border-cyan-500/40',
  in_progress: 'from-orange-900/80 to-orange-800/60 border-orange-500/40',
};

const DOT_COLOR: Record<string, string> = {
  on_way:      'bg-purple-400',
  arrived:     'bg-cyan-400',
  in_progress: 'bg-orange-400',
};

function ActiveBookingBanner() {
  const navigate = useNavigate();

  const { data: activeBookings = [] } = useQuery<Booking[]>({
    queryKey: ['active-booking-banner'],
    queryFn: () =>
      api.get('/bookings/my?limit=5').then(r => {
        const all: Booking[] = r.data;
        return all.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status));
      }),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const active = activeBookings[0];

  return (
    <AnimatePresence>
      {active && (
        <motion.button
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          onClick={() => navigate(`/app/tracking/${active.id}`)}
          className={`w-full card bg-gradient-to-l ${STATUS_COLOR[active.status] ?? 'from-brand-900/80 to-slate-800/60 border-brand-600/40'} flex items-center gap-3 text-right`}
        >
          {/* Pulsing dot */}
          <span className="relative flex shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${DOT_COLOR[active.status] ?? 'bg-brand-400'}`} />
            <span className={`relative inline-flex rounded-full h-3 w-3 ${DOT_COLOR[active.status] ?? 'bg-brand-400'}`} />
          </span>

          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-sm">لديك حجز نشط الآن</p>
            <p className="text-xs text-slate-300 truncate mt-0.5">
              {STATUS_LABEL_MAP[active.status] ?? active.status}
              {(active as any).employeeName ? ` — ${(active as any).employeeName}` : ''}
            </p>
          </div>

          <span className="text-xs text-brand-300 font-bold shrink-0">تتبع ←</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ─── Weather Widget ───────────────────────────────────────────────────────────
interface WeatherData {
  weather: { main: string; description: string }[];
  main: { temp: number };
  name?: string;
}

function weatherMessage(data: WeatherData): { text: string; color: string; emoji: string } {
  const main = data.weather[0]?.main?.toLowerCase() ?? '';
  const desc = data.weather[0]?.description?.toLowerCase() ?? '';

  if (main.includes('dust') || desc.includes('dust') || desc.includes('sand') || main.includes('sand')) {
    return { text: 'توقع غبار اليوم — فرصة مثالية للغسيل!', color: 'from-orange-900/60 to-amber-900/60 border-orange-500/30', emoji: '🌪️' };
  }
  if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm')) {
    return { text: 'ممطر اليوم — سيارتك تحتاج غسلة', color: 'from-blue-900/60 to-sky-900/60 border-blue-500/30', emoji: '🚿' };
  }
  return { text: 'طقس رائع للغسيل', color: 'from-green-900/60 to-emerald-900/60 border-green-500/30', emoji: '☀️' };
}

function WeatherWidget() {
  const { data, isLoading } = useQuery<WeatherData>({
    queryKey: ['weather-home'],
    queryFn: () => api.get('/weather?lat=24.7&lng=46.7').then(r => r.data),
    staleTime: 30 * 60_000, // 30 min
    retry: false,
  });

  if (isLoading) return (
    <div className="card flex items-center gap-3 animate-pulse">
      <div className="w-8 h-8 bg-slate-700 rounded-xl" />
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-slate-700 rounded w-32" />
        <div className="h-3 bg-slate-700 rounded w-20" />
      </div>
    </div>
  );

  if (!data) return null;

  const { text, color, emoji } = weatherMessage(data);
  const temp = Math.round(data.main?.temp ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`card bg-gradient-to-l ${color} flex items-center gap-3`}
    >
      <span className="text-2xl shrink-0">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm">{text}</p>
        <p className="text-xs text-slate-400 mt-0.5">{temp}° — {data.weather[0]?.description}</p>
      </div>
    </motion.div>
  );
}

// ─── Loyalty Mini Widget ──────────────────────────────────────────────────────
const LOYALTY_REWARD_THRESHOLD = 500; // points needed for next reward

function LoyaltyMiniWidget() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<{ balance: number }>({
    queryKey: ['loyalty-balance-home'],
    queryFn: () => api.get('/loyalty/balance').then(r => r.data),
    staleTime: 60_000,
  });

  if (isLoading || !data) return null;

  const progressPercent = Math.min((data.balance % LOYALTY_REWARD_THRESHOLD) / LOYALTY_REWARD_THRESHOLD * 100, 100);
  const pointsToNext = LOYALTY_REWARD_THRESHOLD - (data.balance % LOYALTY_REWARD_THRESHOLD);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/app/loyalty')}
      className="w-full card bg-gradient-to-l from-yellow-900/30 to-amber-900/20 border-yellow-500/20 text-right"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
          <Star size={18} className="text-yellow-400 fill-yellow-400" />
        </div>
        <div className="flex-1">
          <p className="font-black text-white">نقاط الولاء</p>
          <p className="text-sm text-slate-400">
            رصيدك الحالي:{' '}
            <span className="text-yellow-400 font-black">{data.balance.toLocaleString('ar-SA')}</span>
            {' '}نقطة
          </p>
        </div>
        <span className="text-xs text-brand-400 font-bold shrink-0">استبدل ←</span>
      </div>

      {/* Progress bar toward next reward */}
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-slate-500">{pointsToNext} نقطة للمكافأة القادمة</span>
          <span className="text-yellow-400 font-bold">{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-amber-500"
          />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeService, setActiveService] = useState(0);
  const { nameAr: vendorNameAr } = useVendorTheme();

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء النور';
  }, []);

  useEffect(() => {
    if (vendorNameAr) {
      document.title = vendorNameAr;
    }
  }, [vendorNameAr]);

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  if (isLoading) return (
    <div className="p-4 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-6 bg-slate-700 rounded mb-3 w-2/3" />
          <div className="h-32 bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6" dir="rtl">

      {/* Active Booking Banner — top of page */}
      <ActiveBookingBanner />

      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-gradient-to-l from-brand-900/50 to-slate-800/60 border-brand-700/30"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl animate-float">💧</div>
          <div>
            <p className="font-black text-white text-lg">أهلاً {user?.name} 👋</p>
            <p className="text-sm text-slate-400">{timeGreeting} — اختر خدمة واحجز موعدك الآن</p>
          </div>
        </div>
      </motion.div>

      {/* Weather Widget */}
      <WeatherWidget />

      {/* Loyalty Mini Widget */}
      <LoyaltyMiniWidget />

      {/* Service tabs */}
      <div>
        <h2 className="text-xl font-black text-white mb-4">خدماتنا</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {services.map((svc, i) => (
            <button
              key={svc.id}
              onClick={() => setActiveService(i)}
              className={`shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeService === i
                  ? 'bg-brand-700 text-white shadow-brand'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {svc.name}
            </button>
          ))}
        </div>
      </div>

      {/* Packages */}
      {services[activeService] && (() => {
        const pkgs = services[activeService].packages;
        const maxPrice = Math.max(...pkgs.map(p => parseFloat(p.price) || 0));

        return (
          <motion.div
            key={activeService}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {services[activeService].imageUrl && (
              <div className="rounded-2xl overflow-hidden h-40">
                <img src={services[activeService].imageUrl!} alt={services[activeService].name} className="w-full h-full object-cover" />
              </div>
            )}

            {pkgs.map((pkg, i) => {
              const isPremium = /VIP|شامل/i.test(pkg.name);
              const isMostExpensive = parseFloat(pkg.price) === maxPrice && pkgs.length > 1;

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`card-hover relative overflow-hidden ${
                    isMostExpensive
                      ? 'ring-1 ring-brand-500/40 bg-gradient-to-br from-brand-900/20 to-slate-900'
                      : ''
                  }`}
                  onClick={() => navigate(`/app/book/${pkg.id}`)}
                >
                  {/* Premium ribbon */}
                  {isPremium && (
                    <div className="absolute top-0 left-0 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] font-black px-3 py-0.5 rounded-br-lg flex items-center gap-1 z-10">
                      <Crown size={10} />
                      Premium
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {i === 1 && <div className="badge bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mb-2">⭐ الأكثر طلباً</div>}
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        {pkg.name}
                        {isPremium && <Crown size={14} className="text-yellow-400" />}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                        <Clock size={13} />
                        {pkg.duration} دقيقة
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <div className="text-2xl font-black gradient-text">{formatCurrency(pkg.price)}</div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        {pkg.duration} د
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 mb-4">
                    {pkg.features.map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-sm text-slate-300">
                        <CheckCircle size={13} className="text-green-400 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  <button className={`btn-primary w-full text-sm py-2.5 ${
                    isPremium ? 'bg-gradient-to-l from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500' : ''
                  }`}>
                    احجز الآن →
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        );
      })()}

      {services.length === 0 && !isLoading && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">💧</div>
          <p className="text-white font-bold text-lg mb-2">لا توجد خدمات متاحة حالياً</p>
          <p className="text-slate-400 text-sm mb-5 max-w-xs mx-auto">
            نعمل على تجهيز خدمات جديدة لك. يمكنك المحاولة لاحقاً أو التواصل مع فريق الدعم لمساعدتك.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-colors"
            >
              <RefreshCw size={14} />
              تحديث الصفحة
            </button>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-800/40 hover:bg-green-700/40 text-green-300 text-sm font-bold border border-green-600/30 transition-colors"
            >
              تواصل مع الدعم
            </a>
          </div>
        </div>
      )}

      {/* Achievements quick link */}
      <AchievementsQuickLink />

      {/* Subscriptions quick link — shown when customer has active subscriptions */}
      <SubscriptionsQuickLink />

      <PushPrompt />
    </div>
  );
}

function AchievementsQuickLink() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const { data: statuses = [] } = useQuery<{ unlocked: boolean }[]>({
    queryKey: ['achievements-preview'],
    queryFn: () =>
      import('axios').then(({ default: axios }) =>
        axios
          .get('/api/achievements/my', {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((r) => r.data)
          .catch(() => [])
      ),
    staleTime: 120_000,
  });

  const unlockedCount = statuses.filter((s) => s.unlocked).length;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/app/achievements')}
      className="w-full card-hover flex items-center gap-3 text-right"
    >
      <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
        <span className="text-xl">🏆</span>
      </div>
      <div className="flex-1">
        <p className="font-black text-white">إنجازاتي</p>
        <p className="text-sm text-slate-400">
          {unlockedCount > 0 ? `${unlockedCount} إنجاز مكتمل` : 'اكتشف إنجازاتك'}
        </p>
      </div>
      <div className="text-slate-500 text-sm font-bold">
        {unlockedCount}/12
      </div>
    </motion.button>
  );
}

function SubscriptionsQuickLink() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery<unknown[]>({
    queryKey: ['my-subscriptions-preview'],
    queryFn: () =>
      api
        .get('/api/subscriptions/my?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/app/subscriptions')}
      className="w-full card-hover flex items-center gap-3 text-right"
    >
      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
        <CreditCard size={18} className="text-blue-400" />
      </div>
      <div className="flex-1">
        <p className="font-black text-white">اشتراكاتي</p>
        <p className="text-sm text-slate-400">عرض اشتراكاتك النشطة وغسلاتك المتبقية</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
    </motion.button>
  );
}
