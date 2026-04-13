import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import AnalyticsChart from '../../components/AnalyticsChart';

type Period = 'week' | 'month' | 'year';

/* ── Prediction types ─────────────────────────────────── */
interface PredictionMonth {
  month: string;        // e.g. "يناير 2025"
  revenue?: number;     // actual (present for past months)
  projected?: number;   // forecast (present for future months)
  isFuture?: boolean;
}

interface PredictionData {
  months: PredictionMonth[];
  avgGrowth: number;        // e.g. 8.5
  nextMonthForecast: number; // e.g. 11200
  trend: 'up' | 'down' | 'stable';
  currentMonthLabel: string; // label of the boundary month
}

/* ── Custom tooltip for the ComposedChart ─────────────── */
const PredictionTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) => new Intl.NumberFormat('ar-SA').format(v) + ' ر.س';
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-right" dir="rtl">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {entry.name === 'projected' ? 'متوقع: ' : 'فعلي: '}
          {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
};

/* ── Arabic month label helper ─────────────────────────── */
function toArabicMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
}

/* ── Revenue Predictions section ──────────────────────── */
function RevenuePredictions({ token }: { token: string | null }) {
  const { data, isLoading, isError } = useQuery<PredictionData>({
    queryKey: ['reports-predictions'],
    queryFn: async () => {
      const { data: raw } = await axios.get('/api/reports/predictions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const months: PredictionMonth[] = [
        ...(raw.history ?? []).map((h: any) => ({
          month: toArabicMonth(h.month),
          revenue: h.income,
        })),
        ...(raw.predictions ?? []).map((p: any) => ({
          month: toArabicMonth(p.month),
          projected: p.income,
          isFuture: true,
        })),
      ];
      const lastHistoryMonth = (raw.history ?? []).at(-1)?.month;
      return {
        months,
        avgGrowth: raw.avgGrowthRate ?? 0,
        nextMonthForecast: raw.nextMonthProjection ?? 0,
        trend: raw.trend ?? 'stable',
        currentMonthLabel: lastHistoryMonth ? toArabicMonth(lastHistoryMonth) : null,
      } as PredictionData;
    },
    enabled: !!token,
    retry: 1,
  });

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-600/20 rounded-xl animate-pulse w-10 h-10" />
          <div className="h-6 w-48 bg-slate-800 rounded-lg animate-pulse" />
        </div>
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 h-80 animate-pulse" />
      </div>
    );
  }

  /* ── Insufficient data ── */
  if (isError || !data) {
    return (
      <div className="mt-10">
        <SectionHeader />
        <div className="bg-slate-900/80 border border-amber-700/30 rounded-2xl p-8 text-center">
          <Sparkles className="w-10 h-10 text-amber-500/60 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            تحتاج بيانات 3 أشهر على الأقل لتفعيل التنبؤات
          </p>
        </div>
      </div>
    );
  }

  /* ── If API returned but insufficient data ── */
  if (!data.months || data.months.length < 3) {
    return (
      <div className="mt-10">
        <SectionHeader />
        <div className="bg-slate-900/80 border border-amber-700/30 rounded-2xl p-8 text-center">
          <Sparkles className="w-10 h-10 text-amber-500/60 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            تحتاج بيانات 3 أشهر على الأقل لتفعيل التنبؤات
          </p>
        </div>
      </div>
    );
  }

  const TrendIcon =
    data.trend === 'up' ? TrendingUp :
    data.trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    data.trend === 'up' ? 'text-emerald-400' :
    data.trend === 'down' ? 'text-red-400' : 'text-slate-400';

  const trendLabel =
    data.trend === 'up' ? '↑ نمو' :
    data.trend === 'down' ? '↓ تراجع' : '→ مستقر';

  const fmt = (v: number) => new Intl.NumberFormat('ar-SA').format(v);

  return (
    <div className="mt-10">
      <SectionHeader />

      {/* Key metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* Average growth */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-slate-400">متوسط النمو الشهري</span>
          <span className="text-2xl font-bold text-blue-400">
            +{data.avgGrowth.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-500">آخر 6 أشهر</span>
        </div>

        {/* Next month forecast */}
        <div className="bg-slate-900/80 border border-amber-700/30 rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-slate-400">توقع الشهر القادم</span>
          <span className="text-2xl font-bold text-amber-400">
            {fmt(data.nextMonthForecast)} ر.س
          </span>
          <span className="text-xs text-amber-600/70">قيمة متوقعة</span>
        </div>

        {/* Trend indicator */}
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-slate-400">الاتجاه العام</span>
          <div className="flex items-center gap-2">
            <TrendIcon className={`w-6 h-6 ${trendColor}`} />
            <span className={`text-xl font-bold ${trendColor}`}>{trendLabel}</span>
          </div>
          <span className="text-xs text-slate-500">بناءً على بيانات المغسلة</span>
        </div>
      </div>

      {/* ComposedChart */}
      <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4" dir="rtl">
          <h3 className="text-white font-semibold text-right">
            الإيرادات الفعلية والمتوقعة
          </h3>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
              فعلي
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 border-t-2 border-dashed border-amber-400 mt-0.5" />
              متوقع
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data.months} margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => new Intl.NumberFormat('ar-SA', { notation: 'compact' }).format(v)}
            />
            <Tooltip content={<PredictionTooltip />} />

            {/* Reference line at the boundary between actual and projected */}
            {data.currentMonthLabel && (
              <ReferenceLine
                x={data.currentMonthLabel}
                stroke="#64748b"
                strokeDasharray="4 4"
                label={{ value: 'الآن', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }}
              />
            )}

            {/* Actual revenue – solid blue bars */}
            <Bar
              dataKey="revenue"
              name="revenue"
              fill="#3b82f6"
              radius={[6, 6, 0, 0]}
              maxBarSize={48}
            />

            {/* Projected revenue – dashed amber line */}
            <Line
              type="monotone"
              dataKey="projected"
              name="projected"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#fbbf24' }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-slate-500 text-center" dir="rtl">
        * التنبؤات مبنية على بيانات مغسلتك الفعلية وقد تختلف عن النتائج الحقيقية
      </p>
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="p-2 bg-amber-600/20 rounded-xl">
        <Sparkles className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-xl font-bold text-white">التنبؤ بالإيرادات</h2>
    </div>
  );
}

const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: 'week', label: 'هذا الأسبوع' },
  { value: 'month', label: 'هذا الشهر' },
  { value: 'year', label: 'هذه السنة' },
];

export default function VendorAnalytics() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<Period>('month');

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['reports-revenue', period],
    queryFn: async () => {
      const { data } = await axios.get(`/api/reports/revenue?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token,
  });

  const { data: servicesData, isLoading: loadingServices } = useQuery({
    queryKey: ['reports-top-services'],
    queryFn: async () => {
      const { data } = await axios.get('/api/reports/top-services', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token,
  });

  const dailyRevenue: any[] = revenueData?.daily ?? [];
  const bookingsTrend: any[] = revenueData?.bookingsTrend ?? [];
  const monthlyComparison: any[] = revenueData?.monthlyComparison ?? [];
  const topServices: any[] = servicesData?.services ?? [];

  const isLoading = loadingRevenue || loadingServices;

  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600/20 rounded-xl">
            <TrendingUp className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">التقارير والإحصائيات</h1>
        </div>

        {/* Period Filter */}
        <div className="flex gap-2 mb-8">
          {PERIOD_LABELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Charts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 h-72 animate-pulse" />
            ))}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ staggerChildren: 0.1 }}
          >
            <AnalyticsChart
              type="bar"
              data={dailyRevenue}
              xKey="day"
              yKey="revenue"
              color="#3b82f6"
              title="الإيرادات اليومية (ريال)"
              height={220}
            />

            <AnalyticsChart
              type="pie"
              data={topServices}
              xKey="nameAr"
              yKey="count"
              title="توزيع الخدمات الأكثر طلباً"
              height={220}
            />

            <AnalyticsChart
              type="line"
              data={bookingsTrend}
              xKey="day"
              yKey="bookings"
              color="#8b5cf6"
              title="اتجاه الحجوزات"
              height={220}
            />

            <AnalyticsChart
              type="bar"
              data={monthlyComparison}
              xKey="month"
              yKey="revenue"
              color="#10b981"
              title="مقارنة الأشهر الستة الأخيرة"
              height={220}
            />
          </motion.div>
        )}

        {/* Revenue Predictions */}
        <RevenuePredictions token={token} />
      </div>
    </div>
  );
}
