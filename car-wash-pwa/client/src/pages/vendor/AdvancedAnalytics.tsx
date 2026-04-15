import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, PieChart as PieIcon, Clock, Users, AlertTriangle,
  BarChart3, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../../lib/api';

/* ── Types ────────────────────────────────────────────── */
interface RevenuePoint {
  month: string;
  revenue: number;
}

interface ServiceBreakdown {
  name: string;
  revenue: number;
}

interface SummaryData {
  newCustomers: number;
  returningCustomers: number;
  totalCustomers: number;
}

interface ChurnCustomer {
  id: number;
  name: string;
  phone?: string;
  score: number;
  churnRisk: number;
  lastBooking?: string;
  totalSpend?: number;
}

/* ── Constants ────────────────────────────────────────── */
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const SAR = (v: number) => new Intl.NumberFormat('ar-SA').format(Math.round(v)) + ' ر.س';

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const HOURS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 8; // 8 AM to 7 PM
  return h <= 12 ? `${h} ص` : `${h - 12} م`;
});

/* ── Mock heatmap data (will be replaced by API later) ── */
function generateHeatmap(): number[][] {
  return DAYS_AR.map(() => HOURS.map(() => Math.floor(Math.random() * 20)));
}

/* ── Arabic month helper ──────────────────────────────── */
function toArabicMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' });
}

/* ── Custom Recharts Tooltip ──────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-right" dir="rtl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="font-semibold">
          {SAR(entry.value)}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-sm text-right" dir="rtl">
      <p className="text-white font-medium">{payload[0].name}</p>
      <p className="text-slate-300">{SAR(payload[0].value)}</p>
    </div>
  );
};

/* ── Card Wrapper ─────────────────────────────────────── */
function Card({ title, icon: Icon, iconColor, children, className = '' }: {
  title: string;
  icon: typeof TrendingUp;
  iconColor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 ${className}`}>
      <h2 className="font-bold flex items-center gap-2 mb-4">
        <Icon size={18} className={iconColor} />
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ── Main Component ───────────────────────────────────── */
export default function AdvancedAnalytics() {
  const [heatmapData] = useState(() => generateHeatmap());

  /* ── Queries ── */
  const { data: revenueData = [], isLoading: revLoading } = useQuery<RevenuePoint[]>({
    queryKey: ['analytics-revenue'],
    queryFn: () =>
      api.get('/reports/revenue?months=6').then(r =>
        (r.data.months ?? r.data ?? []).map((m: any) => ({
          month: toArabicMonth(m.month),
          revenue: m.revenue ?? m.income ?? 0,
        }))
      ),
  });

  const { data: servicesData = [], isLoading: svcLoading } = useQuery<ServiceBreakdown[]>({
    queryKey: ['analytics-services'],
    queryFn: () =>
      api.get('/reports/top-services').then(r =>
        (r.data ?? []).map((s: any) => ({
          name: s.nameAr ?? s.name ?? s.service,
          revenue: s.revenue ?? s.total ?? 0,
        }))
      ),
  });

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ['analytics-summary'],
    queryFn: () => api.get('/reports/summary').then(r => r.data),
  });

  const { data: churnList = [], isLoading: churnLoading } = useQuery<ChurnCustomer[]>({
    queryKey: ['analytics-churn'],
    queryFn: () => api.get('/segments/scores?maxScore=40').then(r => (r.data ?? []).slice(0, 10)),
  });

  /* ── Retention calc ── */
  const totalCust = (summary?.totalCustomers ?? 1) || 1;
  const newPct = Math.round(((summary?.newCustomers ?? 0) / totalCust) * 100);
  const retPct = Math.round(((summary?.returningCustomers ?? 0) / totalCust) * 100);

  /* ── Heatmap max for scaling ── */
  const heatmapMax = Math.max(1, ...heatmapData.flat());

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-surface-1 text-white p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">التحليلات المتقدمة</h1>
        <p className="text-slate-400 mt-1">رؤية عميقة عن أداء مشروعك</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Revenue Trend */}
        <Card title="اتجاه الإيرادات" icon={TrendingUp} iconColor="text-emerald-400" className="lg:col-span-2">
          {revLoading ? (
            <div className="h-64 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-500" size={24} /></div>
          ) : revenueData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-16">ما فيه بيانات حالياً</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* 2. Peak Hours Heatmap */}
        <Card title="ساعات الذروة" icon={Clock} iconColor="text-amber-400" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="pb-2 text-slate-500 font-medium text-right pr-2 w-20"></th>
                  {HOURS.map(h => (
                    <th key={h} className="pb-2 text-slate-500 font-medium text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS_AR.map((day, di) => (
                  <tr key={day}>
                    <td className="py-1 pr-2 text-slate-400 font-medium">{day}</td>
                    {HOURS.map((_, hi) => {
                      const count = heatmapData[di][hi];
                      const intensity = count / heatmapMax;
                      return (
                        <td key={hi} className="p-0.5">
                          <div className="w-full aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium transition-colors"
                            style={{ backgroundColor: `rgba(59, 130, 246, ${intensity * 0.8 + 0.05})`, color: intensity > 0.5 ? '#fff' : '#94a3b8' }}
                            title={`${day} ${HOURS[hi]}: ${count} حجز`}>
                            {count > 0 ? count : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 3. Service Breakdown */}
        <Card title="توزيع الخدمات" icon={PieIcon} iconColor="text-purple-400">
          {svcLoading ? (
            <div className="h-64 flex items-center justify-center"><RefreshCw className="animate-spin text-slate-500" size={24} /></div>
          ) : servicesData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-16">ما فيه بيانات حالياً</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={servicesData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                  dataKey="revenue" nameKey="name" paddingAngle={3}>
                  {servicesData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* 4. Customer Retention */}
        <Card title="استبقاء العملاء" icon={Users} iconColor="text-blue-400">
          <div className="flex flex-col items-center justify-center h-[260px] gap-6">
            {/* Donut-like display */}
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="12" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="#3b82f6" strokeWidth="12"
                  strokeDasharray={`${retPct * 3.14} ${314 - retPct * 3.14}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{retPct}%</span>
                <span className="text-xs text-slate-400">عائدين</span>
              </div>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-slate-300">عائدين: {summary?.returningCustomers ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-600" />
                <span className="text-slate-300">جدد: {summary?.newCustomers ?? 0}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 5. Churn Risk List */}
        <Card title="عملاء بخطر مغادرة" icon={AlertTriangle} iconColor="text-red-400" className="lg:col-span-2">
          {churnLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-700/30 rounded-lg animate-pulse" />)}
            </div>
          ) : churnList.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">ما فيه عملاء بخطر مغادرة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700/50">
                    <th className="text-right pb-3 font-medium">#</th>
                    <th className="text-right pb-3 font-medium">العميل</th>
                    <th className="text-right pb-3 font-medium hidden md:table-cell">الجوال</th>
                    <th className="text-right pb-3 font-medium">النقاط</th>
                    <th className="text-right pb-3 font-medium">خطر المغادرة</th>
                    <th className="text-right pb-3 font-medium hidden md:table-cell">إجمالي الإنفاق</th>
                  </tr>
                </thead>
                <tbody>
                  {churnList.map((c, i) => {
                    const risk = typeof c.churnRisk === 'number' ? c.churnRisk : parseFloat(String(c.churnRisk ?? '0'));
                    const riskPct = Math.round(risk * 100);
                    const riskColor = riskPct >= 80 ? 'text-red-400' : riskPct >= 50 ? 'text-amber-400' : 'text-yellow-400';
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="py-3 text-slate-500">{i + 1}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-xs font-bold">
                              {c.name.charAt(0)}
                            </div>
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 hidden md:table-cell">{c.phone ?? '—'}</td>
                        <td className="py-3">
                          <span className="bg-slate-700/50 px-2 py-0.5 rounded text-xs font-mono">{c.score}</span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${riskPct}%`, backgroundColor: riskPct >= 80 ? '#ef4444' : riskPct >= 50 ? '#f59e0b' : '#eab308' }} />
                            </div>
                            <span className={`text-xs font-bold ${riskColor}`}>{riskPct}%</span>
                          </div>
                        </td>
                        <td className="py-3 hidden md:table-cell">{SAR(c.totalSpend ?? 0)}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
