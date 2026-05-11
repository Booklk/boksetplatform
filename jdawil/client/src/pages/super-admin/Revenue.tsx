import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Store, RefreshCw, CreditCard } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

interface PlatformStats {
  revenueThisMonth: number;
  activeVendors: number;
  renewalsThisMonth: number;
  avgSubscriptionValue: number;
}

interface MonthlyRevenue {
  month: string; // e.g. "2025-01"
  revenue: number;
  renewals: number;
}

interface RecentPayment {
  id: string;
  vendorName: string;
  plan: string;
  amount: number;
  paidAt: string;
}

const ARABIC_MONTHS: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

const PLAN_LABELS: Record<string, string> = {
  basic: 'أساسي',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

function formatSAR(value: number) {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={20} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-slate-400 text-sm mt-1">{label}</p>
    </motion.div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-slate-300 text-sm mb-1">{label}</p>
      <p className="text-blue-300 font-black">{formatSAR(payload[0].value)}</p>
    </div>
  );
}

export default function SuperAdminRevenue() {
  const { token } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ['super-admin-stats'],
    queryFn: () =>
      axios
        .get('/api/super-admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
  });

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery<MonthlyRevenue[]>({
    queryKey: ['super-admin-revenue'],
    queryFn: () =>
      axios
        .get('/api/super-admin/revenue', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
  });

  const chartData = revenueData.map((d) => ({
    ...d,
    label: ARABIC_MONTHS[d.month.split('-')[1]] ?? d.month,
  }));

  const statCards = [
    {
      icon: TrendingUp,
      label: 'إجمالي الإيرادات هذا الشهر',
      value: stats ? formatSAR(stats.revenueThisMonth) : '—',
      color: 'bg-blue-500/20 text-blue-300',
    },
    {
      icon: Store,
      label: 'المغاسل النشطة',
      value: stats ? String(stats.activeVendors) : '—',
      color: 'bg-green-500/20 text-green-300',
    },
    {
      icon: RefreshCw,
      label: 'تجديدات هذا الشهر',
      value: stats ? String(stats.renewalsThisMonth) : '—',
      color: 'bg-purple-500/20 text-purple-300',
    },
    {
      icon: CreditCard,
      label: 'متوسط قيمة الاشتراك',
      value: stats ? formatSAR(stats.avgSubscriptionValue) : '—',
      color: 'bg-yellow-500/20 text-yellow-300',
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-white">إيرادات المنصة</h1>
        <p className="text-slate-400 text-sm mt-0.5">تحليلات الاشتراكات والإيرادات</p>
      </div>

      {/* Stat cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-6 animate-pulse"
            >
              <div className="w-10 h-10 bg-slate-700 rounded-xl mb-3" />
              <div className="h-6 bg-slate-700 rounded w-2/3 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((s, i) => (
            <StatCard key={s.label} {...s} delay={i * 0.07} />
          ))}
        </div>
      )}

      {/* Bar chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6"
      >
        <h2 className="font-black text-white mb-6">الإيرادات الشهرية (آخر 12 شهر)</h2>
        {revenueLoading ? (
          <div className="h-60 flex items-center justify-center text-slate-500 animate-pulse">
            جاري التحميل...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-slate-500">
            لا توجد بيانات
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}ك`}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
              <Bar
                dataKey="revenue"
                fill="#3b82f6"
                radius={[6, 6, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Recent payments table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-6"
      >
        <h2 className="font-black text-white mb-5">آخر مدفوعات الاشتراكات</h2>
        <RecentPaymentsTable token={token!} />
      </motion.div>
    </div>
  );
}

function RecentPaymentsTable({ token }: { token: string }) {
  const { data: payments = [], isLoading } = useQuery<RecentPayment[]>({
    queryKey: ['super-admin-recent-payments'],
    queryFn: () =>
      axios
        .get('/api/super-admin/payments/recent', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <p className="text-slate-500 text-center py-8">لا توجد مدفوعات حديثة</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700/60">
            <th className="text-right pb-3 font-semibold">المغسلة</th>
            <th className="text-right pb-3 font-semibold">الخطة</th>
            <th className="text-right pb-3 font-semibold">المبلغ</th>
            <th className="text-right pb-3 font-semibold">التاريخ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/40">
          {payments.map((p) => (
            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
              <td className="py-3 text-white font-medium">{p.vendorName}</td>
              <td className="py-3 text-slate-300">
                {PLAN_LABELS[p.plan] ?? p.plan}
              </td>
              <td className="py-3 text-green-300 font-bold">{formatSAR(p.amount)}</td>
              <td className="py-3 text-slate-400">
                {new Date(p.paidAt).toLocaleDateString('ar-SA')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
