import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, UserPlus, AlertTriangle, DollarSign, Search, X, Plus,
  Trash2, Tag, Clock, Star, ChevronLeft, Send, CalendarDays,
  FileText, Activity, Crown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

/* ── Types ────────────────────────────────────────────── */
interface CrmTag {
  id: number;
  name: string;
  color: string;
}

interface LifecycleEvent {
  type: string;
  customerName: string;
  date: string;
  detail?: string;
}

interface DashboardData {
  totalCustomers: number;
  newThisMonth: number;
  atRisk: number;
  avgLTV: number;
  recentEvents: LifecycleEvent[];
}

interface TimelineEntry {
  id: number;
  type: 'booking' | 'note' | 'lifecycle' | 'payment';
  title: string;
  detail?: string;
  date: string;
}

interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  totalSpend?: number;
  bookingCount?: number;
  tier?: string;
  tags?: string[];
  lastVisit?: string;
}

/* ── Helpers ──────────────────────────────────────────── */
const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const SAR = (v: number) => new Intl.NumberFormat('ar-SA').format(Math.round(v)) + ' ر.س';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الحين';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `قبل ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `قبل ${days} يوم`;
  return `قبل ${Math.floor(days / 30)} شهر`;
}

const EVENT_ICON: Record<string, typeof Star> = {
  new_customer: UserPlus,
  vip: Crown,
  churn_risk: AlertTriangle,
  booking: CalendarDays,
  note: FileText,
  payment: DollarSign,
  lifecycle: Activity,
};

const EVENT_COLOR: Record<string, string> = {
  new_customer: 'text-emerald-400',
  vip: 'text-yellow-400',
  churn_risk: 'text-red-400',
  booking: 'text-blue-400',
  note: 'text-slate-300',
  payment: 'text-green-400',
  lifecycle: 'text-purple-400',
};

const EVENT_LABEL: Record<string, string> = {
  new_customer: 'عميل جديد',
  vip: 'أصبح عميل VIP',
  churn_risk: 'خطر مغادرة',
};

/* ── Main Component ───────────────────────────────────── */
export default function CRM() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showTagForm, setShowTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  /* ── Queries ── */
  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get('/crm/dashboard').then(r => r.data),
  });

  const { data: tags = [] } = useQuery<CrmTag[]>({
    queryKey: ['crm-tags'],
    queryFn: () => api.get('/crm/tags').then(r => r.data),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['crm-customers', search],
    queryFn: () => api.get(`/crm/dashboard`).then(r => r.data.customers ?? []),
  });

  const { data: timeline = [], isLoading: timelineLoading } = useQuery<TimelineEntry[]>({
    queryKey: ['crm-timeline', selectedCustomer?.id],
    queryFn: () => api.get(`/crm/customers/${selectedCustomer!.id}/timeline`).then(r => r.data),
    enabled: !!selectedCustomer,
  });

  /* ── Mutations ── */
  const createTag = useMutation({
    mutationFn: (data: { name: string; color: string }) => api.post('/crm/tags', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-tags'] });
      toast.success('تم إنشاء الوسم');
      setNewTagName('');
      setShowTagForm(false);
    },
    onError: () => toast.error('خطأ في إنشاء الوسم'),
  });

  const deleteTag = useMutation({
    mutationFn: (id: number) => api.delete(`/crm/tags/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-tags'] });
      toast.success('تم حذف الوسم');
    },
  });

  const addNote = useMutation({
    mutationFn: (data: { customerId: number; text: string }) =>
      api.post(`/crm/customers/${data.customerId}/notes`, { text: data.text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-timeline', selectedCustomer?.id] });
      toast.success('تمت إضافة الملاحظة');
      setNoteText('');
    },
    onError: () => toast.error('خطأ في إضافة الملاحظة'),
  });

  /* ── Filtered customer list ── */
  const filtered = search.trim()
    ? customers.filter((c: Customer) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
    : customers;

  const stats = [
    { label: 'إجمالي العملاء', value: dashboard?.totalCustomers ?? 0, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { label: 'عملاء جدد (هالشهر)', value: dashboard?.newThisMonth ?? 0, icon: UserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { label: 'عملاء بخطر مغادرة', value: dashboard?.atRisk ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/20' },
    { label: 'متوسط القيمة الدائمة', value: SAR(dashboard?.avgLTV ?? 0), icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#040812] text-white p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">إدارة علاقات العملاء</h1>
        <p className="text-slate-400 mt-1">نظرة شاملة على عملاءك وتفاعلاتهم</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={20} className={s.color} />
            </div>
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="text-xl font-bold mt-1">{typeof s.value === 'number' ? s.value.toLocaleString('ar-SA') : s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Tags Management */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2"><Tag size={18} className="text-purple-400" /> الوسوم</h2>
            <button onClick={() => setShowTagForm(!showTagForm)} className="text-blue-400 hover:text-blue-300 transition-colors">
              <Plus size={18} />
            </button>
          </div>

          {showTagForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-4 space-y-3">
              <input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="اسم الوسم..."
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <div className="flex gap-2 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button key={c} onClick={() => setNewTagColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newTagColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button onClick={() => { if (newTagName.trim()) createTag.mutate({ name: newTagName, color: newTagColor }); }}
                disabled={createTag.isPending || !newTagName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg w-full transition-colors disabled:opacity-50">
                إنشاء الوسم
              </button>
            </motion.div>
          )}

          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && <p className="text-sm text-slate-500">ما فيه وسوم بعد</p>}
            {tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={{ backgroundColor: tag.color + '25', color: tag.color }}>
                {tag.name}
                <button onClick={() => deleteTag.mutate(tag.id)} className="hover:opacity-70 transition-opacity"><X size={14} /></button>
              </span>
            ))}
          </div>
        </div>

        {/* Recent Lifecycle Events */}
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="font-bold flex items-center gap-2 mb-4"><Activity size={18} className="text-blue-400" /> آخر الأحداث</h2>
          <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
            {(!dashboard?.recentEvents || dashboard.recentEvents.length === 0) && (
              <p className="text-sm text-slate-500 text-center py-8">ما فيه أحداث حالياً</p>
            )}
            {dashboard?.recentEvents?.map((ev, i) => {
              const Icon = EVENT_ICON[ev.type] ?? Activity;
              const color = EVENT_COLOR[ev.type] ?? 'text-slate-400';
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg">
                  <div className={`mt-0.5 ${color}`}><Icon size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ev.customerName}</p>
                    <p className="text-xs text-slate-400">{EVENT_LABEL[ev.type] ?? ev.type}{ev.detail ? ` — ${ev.detail}` : ''}</p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(ev.date)}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Customer List */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <h2 className="font-bold flex items-center gap-2"><Users size={18} className="text-emerald-400" /> قائمة العملاء</h2>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الجوال..."
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pr-9 pl-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700/50">
                <th className="text-right pb-3 font-medium">العميل</th>
                <th className="text-right pb-3 font-medium hidden md:table-cell">الجوال</th>
                <th className="text-right pb-3 font-medium hidden lg:table-cell">إجمالي الإنفاق</th>
                <th className="text-right pb-3 font-medium hidden lg:table-cell">الحجوزات</th>
                <th className="text-right pb-3 font-medium hidden md:table-cell">آخر زيارة</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">ما لقينا نتائج</td></tr>
              )}
              {filtered.slice(0, 50).map((c: Customer) => (
                <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedCustomer(c)}>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-400 hidden md:table-cell">{c.phone ?? '—'}</td>
                  <td className="py-3 hidden lg:table-cell">{SAR(c.totalSpend ?? 0)}</td>
                  <td className="py-3 hidden lg:table-cell">{c.bookingCount ?? 0}</td>
                  <td className="py-3 text-slate-400 text-xs hidden md:table-cell">{c.lastVisit ? timeAgo(c.lastVisit) : '—'}</td>
                  <td className="py-3"><ChevronLeft size={16} className="text-slate-500" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Timeline Sheet */}
      <AnimatePresence>
        {selectedCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex justify-start" onClick={() => setSelectedCustomer(null)}>
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ type: 'spring', damping: 25 }}
              className="mr-auto w-full max-w-md bg-slate-900 border-r border-slate-700 h-full overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              {/* Sheet header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 p-4 flex items-center gap-3">
                <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold">
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold">{selectedCustomer.name}</h3>
                      <p className="text-xs text-slate-400">{selectedCustomer.phone ?? ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer quick stats */}
              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">الإنفاق</p>
                  <p className="font-bold text-sm mt-1">{SAR(selectedCustomer.totalSpend ?? 0)}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-400">الحجوزات</p>
                  <p className="font-bold text-sm mt-1">{selectedCustomer.bookingCount ?? 0}</p>
                </div>
              </div>

              {/* Add note */}
              <div className="px-4 mb-4">
                <div className="flex gap-2">
                  <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="أضف ملاحظة..."
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                    onKeyDown={e => { if (e.key === 'Enter' && noteText.trim()) addNote.mutate({ customerId: selectedCustomer.id, text: noteText }); }} />
                  <button onClick={() => { if (noteText.trim()) addNote.mutate({ customerId: selectedCustomer.id, text: noteText }); }}
                    disabled={addNote.isPending || !noteText.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {/* Timeline */}
              <div className="px-4 pb-8">
                <h4 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2"><Clock size={14} /> السجل الزمني</h4>
                {timelineLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-slate-800/50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">ما فيه أحداث لهالعميل</p>
                ) : (
                  <div className="relative border-r-2 border-slate-700/50 pr-4 space-y-4">
                    {timeline.map((entry, i) => {
                      const Icon = EVENT_ICON[entry.type] ?? Activity;
                      const color = EVENT_COLOR[entry.type] ?? 'text-slate-400';
                      return (
                        <motion.div key={entry.id ?? i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }} className="relative">
                          <div className={`absolute -right-[1.35rem] top-1 w-3 h-3 rounded-full border-2 border-slate-900`}
                            style={{ backgroundColor: color.includes('blue') ? '#3b82f6' : color.includes('emerald') ? '#10b981' : color.includes('red') ? '#ef4444' : color.includes('yellow') ? '#eab308' : color.includes('green') ? '#22c55e' : color.includes('purple') ? '#a855f7' : '#94a3b8' }} />
                          <div className="bg-slate-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon size={14} className={color} />
                              <span className="text-sm font-medium">{entry.title}</span>
                            </div>
                            {entry.detail && <p className="text-xs text-slate-400 mr-6">{entry.detail}</p>}
                            <p className="text-xs text-slate-500 mt-1 mr-6">{timeAgo(entry.date)}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
