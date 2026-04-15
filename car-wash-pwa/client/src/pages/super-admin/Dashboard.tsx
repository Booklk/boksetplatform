import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle,
  Users,
  Calendar,
  TrendingUp,
  Wallet,
  Shield,
  MoreVertical,
  AlertCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

interface Stats {
  totalVendors: number;
  activeVendors: number;
  totalUsers: number;
  totalBookings: number;
  completedBookings: number;
  platformRevenue: number;
}

interface Vendor {
  id: number;
  nameAr: string;
  slug: string;
  logoUrl?: string;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended';
  subscriptionPlan: 'basic' | 'pro' | 'enterprise';
  subscriptionEndDate: string;
  isActive: boolean;
  createdAt: string;
}

const planLabels: Record<string, string> = {
  basic: 'أساسي',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  trial: {
    label: 'تجريبي',
    bg: 'bg-blue-500/20',
    text: 'text-blue-300',
    icon: <Clock className="w-3 h-3" />,
  },
  active: {
    label: 'نشط',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  expired: {
    label: 'منتهي',
    bg: 'bg-red-500/20',
    text: 'text-red-300',
    icon: <XCircle className="w-3 h-3" />,
  },
  suspended: {
    label: 'معلق',
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

const statCards = [
  {
    key: 'totalVendors' as keyof Stats,
    label: 'إجمالي التجار',
    icon: Building2,
    gradient: 'from-purple-500 to-indigo-600',
    glow: 'shadow-purple-500/30',
    border: 'border-purple-500/30',
  },
  {
    key: 'activeVendors' as keyof Stats,
    label: 'التجار النشطين',
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/30',
    border: 'border-emerald-500/30',
  },
  {
    key: 'totalUsers' as keyof Stats,
    label: 'إجمالي المستخدمين',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-600',
    glow: 'shadow-blue-500/30',
    border: 'border-blue-500/30',
  },
  {
    key: 'totalBookings' as keyof Stats,
    label: 'إجمالي الحجوزات',
    icon: Calendar,
    gradient: 'from-pink-500 to-rose-600',
    glow: 'shadow-pink-500/30',
    border: 'border-pink-500/30',
  },
  {
    key: 'completedBookings' as keyof Stats,
    label: 'الحجوزات المكتملة',
    icon: TrendingUp,
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/30',
    border: 'border-amber-500/30',
  },
  {
    key: 'platformRevenue' as keyof Stats,
    label: 'إيرادات المنصة (ر.س)',
    icon: Wallet,
    gradient: 'from-violet-500 to-purple-600',
    glow: 'shadow-violet-500/30',
    border: 'border-violet-500/30',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.06, type: 'spring', stiffness: 200, damping: 22 },
  }),
};

export default function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const { data } = await api.get('/super-admin/stats');
      return data;
    },
  });

  const { data: vendors, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['super-admin-vendors'],
    queryFn: async () => {
      const { data } = await api.get('/super-admin/vendors');
      return data;
    },
  });

  const activateMutation = useMutation({
    mutationFn: (id: number) => api.post(`/vendors/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-stats'] });
      showToast('تم تفعيل المغسلة بنجاح');
      setOpenMenu(null);
    },
    onError: () => showToast('حدث خطأ أثناء التفعيل', 'error'),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: number) => api.post(`/vendors/${id}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-stats'] });
      showToast('تم تعليق المغسلة');
      setOpenMenu(null);
    },
    onError: () => showToast('حدث خطأ أثناء التعليق', 'error'),
  });

  const formatNumber = (n?: number) => {
    if (n === undefined || n === null) return '—';
    return n.toLocaleString('ar-SA');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white font-sans"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-indigo-600/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-l from-purple-300 to-indigo-300 bg-clip-text text-transparent">
              لوحة تحكم السوبر أدمن
            </h1>
            <p className="text-white/50 text-sm mt-0.5">إدارة المنصة والمغاسل</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10"
        >
          {statCards.map(({ key, label, icon: Icon, gradient, glow, border }) => (
            <motion.div
              key={key}
              variants={cardVariants}
              whileHover={{ scale: 1.02, y: -2 }}
              className={`relative overflow-hidden rounded-2xl border ${border} bg-white/5 backdrop-blur-xl shadow-xl ${glow} p-5`}
            >
              {/* Glow orb */}
              <div
                className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl`}
              />
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  {statsLoading ? (
                    <div className="h-9 w-20 bg-white/10 rounded-lg animate-pulse mb-2" />
                  ) : (
                    <p className="text-3xl font-black text-white leading-none mb-1">
                      {formatNumber(stats?.[key])}
                    </p>
                  )}
                  <p className="text-white/60 text-sm font-medium">{label}</p>
                </div>
                <div
                  className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Vendors Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Building2 className="w-5 h-5 text-purple-300" />
              </div>
              <h2 className="text-xl font-bold text-white">المغاسل المسجلة</h2>
            </div>
            {vendors && (
              <span className="text-white/40 text-sm">
                {vendors.length} مغسلة
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['المغسلة', 'الخطة', 'حالة الاشتراك', 'تاريخ الانتهاء', 'إجراءات'].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-4 text-right text-xs font-semibold text-white/40 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {vendorsLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 5 }).map((__, j) => (
                          <td key={j} className="px-6 py-4">
                            <div className="h-5 bg-white/10 rounded-lg animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : vendors?.map((vendor, i) => {
                      const status = statusConfig[vendor.subscriptionStatus] ?? statusConfig.trial;
                      return (
                        <motion.tr
                          key={vendor.id}
                          custom={i}
                          variants={rowVariants}
                          initial="hidden"
                          animate="visible"
                          className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        >
                          {/* Name + logo */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
                                {vendor.logoUrl ? (
                                  <img
                                    src={vendor.logoUrl}
                                    alt={vendor.nameAr}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Building2 className="w-5 h-5 text-white/30" />
                                )}
                              </div>
                              <div>
                                <p className="text-white font-semibold text-sm">{vendor.nameAr}</p>
                                <p className="text-white/40 text-xs">{vendor.slug}</p>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-6 py-4">
                            <span className="text-white/70 text-sm font-medium">
                              {planLabels[vendor.subscriptionPlan] ?? vendor.subscriptionPlan}
                            </span>
                          </td>

                          {/* Status badge */}
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}
                            >
                              {status.icon}
                              {status.label}
                            </span>
                          </td>

                          {/* End date */}
                          <td className="px-6 py-4">
                            <span className="text-white/60 text-sm">
                              {formatDate(vendor.subscriptionEndDate)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4">
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenMenu(openMenu === vendor.id ? null : vendor.id)
                                }
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <AnimatePresence>
                                {openMenu === vendor.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute left-0 top-10 z-50 min-w-[140px] rounded-xl border border-white/10 bg-[#1a1a2e] backdrop-blur-xl shadow-2xl overflow-hidden"
                                  >
                                    <button
                                      onClick={() => activateMutation.mutate(vendor.id)}
                                      disabled={activateMutation.isPending}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      تفعيل
                                    </button>
                                    <button
                                      onClick={() => suspendMutation.mutate(vendor.id)}
                                      disabled={suspendMutation.isPending}
                                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-orange-300 hover:bg-orange-500/10 transition-colors disabled:opacity-50"
                                    >
                                      <AlertCircle className="w-4 h-4" />
                                      تعليق
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
              </tbody>
            </table>
            {!vendorsLoading && (!vendors || vendors.length === 0) && (
              <div className="py-16 text-center text-white/30">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد مغاسل مسجلة بعد</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-semibold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-red-600 to-rose-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for closing menu */}
      {openMenu !== null && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenMenu(null)} />
      )}
    </div>
  );
}
