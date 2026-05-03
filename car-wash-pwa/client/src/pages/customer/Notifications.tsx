import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, BellOff, Trash2, CheckCheck, Calendar, Gift, Tag, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Notif {
  id: number;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
  vendorId: number | null;
}

interface ListResponse {
  notifications: Notif[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروء' },
  { key: 'booking', label: 'حجوزات' },
  { key: 'loyalty', label: 'ولاء وعروض' },
] as const;
type FilterKey = (typeof FILTERS)[number]['key'];

function iconFor(n: Notif) {
  const t = (n.title + ' ' + (n.body ?? '')).toLowerCase();
  if (t.includes('حجز') || t.includes('موعد')) return Calendar;
  if (t.includes('ولاء') || t.includes('نقاط') || t.includes('هدية')) return Gift;
  if (t.includes('عرض') || t.includes('خصم')) return Tag;
  if (n.type === 'warning' || n.type === 'error') return AlertCircle;
  return Bell;
}

function colorFor(type: string) {
  if (type === 'success') return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300';
  if (type === 'warning') return 'border-amber-500/30 bg-amber-500/5 text-amber-300';
  if (type === 'error')   return 'border-rose-500/30 bg-rose-500/5 text-rose-300';
  return 'border-blue-500/30 bg-blue-500/5 text-blue-300';
}

export default function CustomerNotifications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>('all');

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ['customer-notifications'],
    queryFn: async () => (await api.get('/notification-center?limit=80')).data,
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => api.put(`/notification-center/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.put('/notification-center/read-all'),
    onSuccess: () => {
      toast.success('تم تعليم الكل كمقروء');
      qc.invalidateQueries({ queryKey: ['customer-notifications'] });
    },
  });

  const removeOne = useMutation({
    mutationFn: async (id: number) => api.delete(`/notification-center/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-notifications'] }),
  });

  const list = data?.notifications ?? [];
  const filtered = list.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    const t = (n.title + ' ' + (n.body ?? '')).toLowerCase();
    if (filter === 'booking') return t.includes('حجز') || t.includes('موعد');
    if (filter === 'loyalty') return t.includes('ولاء') || t.includes('نقاط') || t.includes('عرض') || t.includes('خصم') || t.includes('هدية');
    return true;
  });

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-400" />
            الإشعارات
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {data?.unreadCount
              ? <>عندك <span className="text-blue-300 font-bold">{data.unreadCount}</span> إشعار جديد</>
              : 'كل شي محدّث'}
          </p>
        </div>
        {(data?.unreadCount ?? 0) > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            علّم الكل كمقروء
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === f.key
                ? 'bg-blue-500 text-white'
                : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-center py-12 text-slate-500 text-sm">جاري التحميل…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BellOff className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-300 font-bold">لا توجد إشعارات بهذا الفلتر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const Icon = iconFor(n);
            const colorClass = colorFor(n.type);
            const Wrapper: any = n.link ? Link : 'div';
            const wrapperProps = n.link ? { to: n.link } : {};
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Wrapper
                  {...wrapperProps}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                  className={`block rounded-2xl border p-4 transition-colors ${
                    n.isRead
                      ? 'border-white/5 bg-white/[0.02]'
                      : 'border-white/10 bg-white/[0.04]'
                  } hover:border-white/15`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-bold leading-tight ${n.isRead ? 'text-slate-300' : 'text-white'}`}>
                          {n.title}
                          {!n.isRead && <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-2" />}
                        </p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeOne.mutate(n.id);
                          }}
                          className="text-slate-500 hover:text-rose-300 shrink-0"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {n.body && (
                        <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {new Date(n.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                </Wrapper>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
