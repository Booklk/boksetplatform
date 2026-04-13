import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  Bell, Calendar, DollarSign, Gift, Settings, CheckCheck,
  BellOff, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

/* ── Types ────────────────────────────────────────────── */
type NotifType = 'booking' | 'payment' | 'promo' | 'system';

interface Notification {
  id: number;
  type: NotifType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotifPage {
  data: Notification[];
  total: number;
  page: number;
  hasMore: boolean;
}

/* ── Constants ────────────────────────────────────────── */
const TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'booking', label: 'حجوزات' },
  { key: 'payment', label: 'مدفوعات' },
  { key: 'promo', label: 'عروض' },
  { key: 'system', label: 'نظام' },
];

const TYPE_ICON: Record<string, typeof Bell> = {
  booking: Calendar,
  payment: DollarSign,
  promo: Gift,
  system: Settings,
};

const TYPE_COLOR: Record<string, { text: string; bg: string }> = {
  booking: { text: 'text-blue-400', bg: 'bg-blue-500/20' },
  payment: { text: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  promo: { text: 'text-amber-400', bg: 'bg-amber-500/20' },
  system: { text: 'text-slate-400', bg: 'bg-slate-500/20' },
};

/* ── Helpers ──────────────────────────────────────────── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الحين';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `قبل ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `قبل ${days} يوم`;
  if (days < 30) return `قبل ${Math.floor(days / 7)} أسبوع`;
  return `قبل ${Math.floor(days / 30)} شهر`;
}

/* ── Main Component ───────────────────────────────────── */
export default function NotificationCenter() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');

  /* ── Infinite query for notifications ── */
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery<NotifPage>({
    queryKey: ['notifications', activeTab],
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), limit: '20' });
      if (activeTab !== 'all') params.set('type', activeTab);
      return api.get(`/notification-center?${params}`).then(r => r.data);
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
  });

  const notifications = data?.pages.flatMap(p => p.data ?? p) ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;

  /* ── Mark single as read ── */
  const markRead = useMutation({
    mutationFn: (id: number) => api.put(`/notification-center/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  /* ── Mark all as read ── */
  const markAllRead = useMutation({
    mutationFn: () => api.put('/notification-center/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('تم قراءة جميع الإشعارات');
    },
    onError: () => toast.error('خطأ في تحديث الإشعارات'),
  });

  /* ── Handle notification click ── */
  function handleClick(notif: Notification) {
    if (!notif.read) {
      markRead.mutate(notif.id);
    }
    if (notif.link) {
      window.location.href = notif.link;
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#040812] text-white p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell size={28} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">مركز الإشعارات</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              {unreadCount > 0 ? `عندك ${unreadCount} إشعار جديد` : 'كل الإشعارات مقروءة'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}
            className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
            <CheckCheck size={16} />
            قراءة الكل
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        /* Empty State */
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
            <BellOff size={36} className="text-slate-500" />
          </div>
          <p className="text-lg text-slate-400 font-medium">ما فيه إشعارات جديدة</p>
          <p className="text-sm text-slate-500 mt-1">راح نرسلك إشعار أول ما يصير شي جديد</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((notif, i) => {
              const Icon = TYPE_ICON[notif.type] ?? Bell;
              const colors = TYPE_COLOR[notif.type] ?? TYPE_COLOR.system;

              return (
                <motion.div key={notif.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }} transition={{ delay: i * 0.02 }}
                  onClick={() => handleClick(notif)}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-slate-800/30 border-slate-700/30 hover:bg-slate-800/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-700/50'
                  }`}>
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={18} className={colors.text} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {!notif.read && (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{notif.body}</p>
                    <p className="text-[11px] text-slate-500 mt-1.5">{timeAgo(notif.createdAt)}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Load More */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-300 px-5 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50">
                {isFetchingNextPage ? (
                  <span className="animate-spin"><ChevronDown size={16} /></span>
                ) : (
                  <ChevronDown size={16} />
                )}
                تحميل المزيد
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
