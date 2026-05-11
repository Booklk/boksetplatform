import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MoreVertical, CheckCircle, PauseCircle, CalendarPlus,
  Building2, Phone, User, AlertTriangle,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface Vendor {
  id: string;
  nameAr: string;
  logoUrl?: string;
  ownerName: string;
  ownerPhone: string;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'trial' | 'expired' | 'suspended';
  daysRemaining: number;
  subscriptionEndsAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  basic: 'أساسي',
  pro: 'احترافي',
  enterprise: 'مؤسسي',
};

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-slate-700/60 text-slate-300 border-slate-600/50',
  pro: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  enterprise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  trial: 'تجربة',
  expired: 'منتهي',
  suspended: 'موقوف',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  trial: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  expired: 'bg-red-500/20 text-red-300 border-red-500/30',
  suspended: 'bg-slate-600/50 text-slate-400 border-slate-500/30',
};

const FILTER_TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'trial', label: 'تجربة' },
  { key: 'expired', label: 'منتهي' },
  { key: 'suspended', label: 'موقوف' },
];

function VendorActionsMenu({
  vendor,
  onClose,
}: {
  vendor: Vendor;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/vendors/${vendor.id}/activate`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success('تم تفعيل المغسلة');
      queryClient.invalidateQueries({ queryKey: ['super-admin-vendors'] });
      onClose();
    },
    onError: () => toast.error('فشل التفعيل'),
  });

  const suspendMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/vendors/${vendor.id}/suspend`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success('تم تعليق المغسلة');
      queryClient.invalidateQueries({ queryKey: ['super-admin-vendors'] });
      onClose();
    },
    onError: () => toast.error('فشل التعليق'),
  });

  const extendMutation = useMutation({
    mutationFn: () =>
      axios.post(`/api/vendors/${vendor.id}/extend`, { days: 30 }, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success('تم تمديد الاشتراك 30 يوم');
      queryClient.invalidateQueries({ queryKey: ['super-admin-vendors'] });
      onClose();
    },
    onError: () => toast.error('فشل التمديد'),
  });

  const isLoading =
    activateMutation.isPending ||
    suspendMutation.isPending ||
    extendMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      className="absolute left-0 top-8 z-50 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
    >
      <button
        onClick={() => activateMutation.mutate()}
        disabled={isLoading || vendor.status === 'active'}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-green-300 hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <CheckCircle size={14} />
        تفعيل
      </button>
      <button
        onClick={() => suspendMutation.mutate()}
        disabled={isLoading || vendor.status === 'suspended'}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-yellow-300 hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <PauseCircle size={14} />
        تعليق
      </button>
      <button
        onClick={() => extendMutation.mutate()}
        disabled={isLoading}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-blue-300 hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <CalendarPlus size={14} />
        تمديد 30 يوم
      </button>
    </motion.div>
  );
}

export default function SuperAdminVendors() {
  const { token } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { data: vendors = [], isLoading } = useQuery<Vendor[]>({
    queryKey: ['super-admin-vendors'],
    queryFn: () =>
      axios
        .get('/api/super-admin/vendors', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
  });

  const filtered = vendors.filter((v) => {
    const matchesFilter = activeFilter === 'all' || v.status === activeFilter;
    const matchesSearch =
      !search ||
      v.nameAr.includes(search) ||
      v.ownerName.includes(search) ||
      v.ownerPhone.includes(search);
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: vendors.length,
    active: vendors.filter((v) => v.status === 'active').length,
    trial: vendors.filter((v) => v.status === 'trial').length,
    expired: vendors.filter((v) => v.status === 'expired').length,
    suspended: vendors.filter((v) => v.status === 'suspended').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">إدارة المغاسل</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {vendors.length} مغسلة مسجلة
          </p>
        </div>
        <Building2 size={28} className="text-blue-400" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'الإجمالي', value: stats.total, color: 'text-white' },
          { label: 'نشط', value: stats.active, color: 'text-green-400' },
          { label: 'تجربة', value: stats.trial, color: 'text-yellow-400' },
          { label: 'منتهي / موقوف', value: stats.expired + stats.suspended, color: 'text-red-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-4 text-center"
          >
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-slate-400 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم المغسلة أو المالك أو الهاتف..."
          className="w-full bg-slate-800 border border-slate-600 rounded-xl pr-9 pl-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className="mr-1.5 text-xs opacity-70">
                ({stats[tab.key as keyof typeof stats] ?? 0})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table / cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-slate-700 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700 rounded w-1/3" />
                  <div className="h-3 bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-12 text-center text-slate-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد نتائج</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((vendor, i) => (
              <motion.div
                key={vendor.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04 }}
                className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl p-4 md:p-5"
              >
                <div className="flex items-start gap-4">
                  {/* Logo */}
                  <div className="shrink-0">
                    {vendor.logoUrl ? (
                      <img
                        src={vendor.logoUrl}
                        alt={vendor.nameAr}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700/50"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center">
                        <Building2 size={22} className="text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-black text-white text-base leading-tight">
                          {vendor.nameAr}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {vendor.ownerName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone size={12} />
                            {vendor.ownerPhone}
                          </span>
                        </div>
                      </div>

                      {/* Actions menu */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === vendor.id ? null : vendor.id
                            )
                          }
                          className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        <AnimatePresence>
                          {openMenuId === vendor.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <VendorActionsMenu
                                vendor={vendor}
                                onClose={() => setOpenMenuId(null)}
                              />
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${PLAN_COLORS[vendor.plan]}`}
                      >
                        {PLAN_LABELS[vendor.plan]}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_COLORS[vendor.status]}`}
                      >
                        {STATUS_LABELS[vendor.status]}
                      </span>
                      {vendor.daysRemaining <= 7 && vendor.status !== 'suspended' && (
                        <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border bg-red-500/20 text-red-300 border-red-500/30">
                          <AlertTriangle size={11} />
                          {vendor.daysRemaining} يوم متبقي
                        </span>
                      )}
                      {vendor.daysRemaining > 7 && vendor.status === 'active' && (
                        <span className="text-xs text-slate-400">
                          {vendor.daysRemaining} يوم متبقي
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
