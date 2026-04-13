import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Calendar, Star, Package, AlertTriangle, DollarSign } from 'lucide-react';
import api from '../../lib/api';
import { DashboardStats, InventoryItem } from '../../types';
import { formatCurrency } from '../../lib/utils';

export default function AdminDashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: lowStock = [] } = useQuery<InventoryItem[]>({
    queryKey: ['low-stock'],
    queryFn: () => api.get('/inventory/low-stock').then(r => r.data),
  });

  const { data: summary } = useQuery<any>({
    queryKey: ['financial-summary'],
    queryFn: () => api.get('/financials/summary').then(r => r.data),
  });

  const statCards = [
    { label: 'حجوزات اليوم', value: stats?.todayBookings ?? '-', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10', to: '/admin/bookings' },
    { label: 'مكتملة اليوم', value: stats?.completedToday ?? '-', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10', to: '/admin/bookings' },
    { label: 'في الانتظار', value: stats?.pendingCount ?? '-', icon: Package, color: 'text-yellow-400', bg: 'bg-yellow-500/10', to: '/admin/bookings' },
    { label: 'إجمالي العملاء', value: stats?.totalCustomers ?? '-', icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10', to: '/admin/customers' },
    { label: 'إيرادات هذا الشهر', value: stats ? formatCurrency(stats.monthIncome) : '-', icon: DollarSign, color: 'text-brand-400', bg: 'bg-brand-500/10', to: '/admin/financials' },
    { label: 'متوسط التقييم', value: stats?.avgRating ? `${stats.avgRating} ⭐` : '-', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10', to: '/admin/bookings' },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">لوحة التحكم</h1>
          <p className="text-slate-400 text-sm">مغسلة Bokset</p>
        </div>
        <div className="text-2xl animate-float">💧</div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Link to={stat.to} className={`card-hover block p-5 ${stat.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <stat.icon size={20} className={stat.color} />
              </div>
              <div className="text-2xl font-black text-white mb-1">{stat.value}</div>
              <div className="text-xs text-slate-400">{stat.label}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Financial Summary */}
      {summary && (
        <div className="card">
          <h2 className="font-black text-white mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-brand-400" />
            ملخص مالي
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'الإيرادات', value: summary.income, color: 'text-green-400' },
              { label: 'المصروفات', value: summary.expense, color: 'text-red-400' },
              { label: 'الرواتب', value: summary.salary, color: 'text-blue-400' },
              { label: 'الصيانة', value: summary.maintenance, color: 'text-orange-400' },
            ].map(item => (
              <div key={item.label} className="bg-slate-700/40 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className={`font-black text-lg ${item.color}`}>{formatCurrency(item.value)}</p>
              </div>
            ))}
            <div className="col-span-2 lg:col-span-4 bg-gradient-to-l from-brand-900/40 to-slate-700/40 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">صافي الربح</p>
              <p className={`font-black text-2xl ${summary.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(summary.net)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="card border-yellow-600/30 bg-yellow-900/10">
          <h2 className="font-black text-yellow-400 mb-3 flex items-center gap-2">
            <AlertTriangle size={18} />
            تنبيه: مخزون منخفض ({lowStock.length} منتج)
          </h2>
          <div className="space-y-2">
            {lowStock.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 font-bold">{item.quantity} {item.unit}</span>
                  <span className="text-slate-500">/ الحد الأدنى: {item.minQuantity}</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/admin/inventory" className="btn-outline text-sm py-2 mt-4 block text-center">
            إدارة المخزون
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { to: '/admin/bookings', label: 'الحجوزات', icon: '📋', desc: 'إدارة جميع الحجوزات' },
          { to: '/admin/services', label: 'الخدمات', icon: '🧹', desc: 'إضافة وتعديل الخدمات' },
          { to: '/admin/inventory', label: 'المخزون', icon: '📦', desc: 'إدارة المواد والمستلزمات' },
          { to: '/admin/financials', label: 'المالية', icon: '💰', desc: 'الدخل والمصروفات والرواتب' },
        ].map(link => (
          <Link key={link.to} to={link.to} className="card-hover text-center py-6">
            <div className="text-3xl mb-2">{link.icon}</div>
            <p className="font-black text-white text-sm">{link.label}</p>
            <p className="text-xs text-slate-400 mt-1">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
