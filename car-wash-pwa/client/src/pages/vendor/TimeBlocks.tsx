import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ban, Plus, Trash2, Clock, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const REASONS = [
  { value: 'maintenance', label: 'صيانة', icon: '🔧', color: 'text-orange-400 bg-orange-500/20 border-orange-500/30' },
  { value: 'break', label: 'استراحة', icon: '☕', color: 'text-blue-400 bg-blue-500/20 border-blue-500/30' },
  { value: 'holiday', label: 'إجازة', icon: '🏖️', color: 'text-purple-400 bg-purple-500/20 border-purple-500/30' },
  { value: 'full', label: 'مكتمل', icon: '⛔', color: 'text-red-400 bg-red-500/20 border-red-500/30' },
  { value: 'other', label: 'أخرى', icon: '📌', color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' },
];

const now = new Date();
const toLocalDT = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function TimeBlocks() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    reason: 'maintenance',
    startsAt: toLocalDT(new Date()),
    endsAt: toLocalDT(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
  });

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['time-blocks'],
    queryFn: () => api.get('/time-blocks').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post('/time-blocks', d).then(r => r.data),
    onSuccess: () => { toast.success('تم حجب الوقت ✓'); qc.invalidateQueries({ queryKey: ['time-blocks'] }); setShowForm(false); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/time-blocks/${id}`).then(r => r.data),
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['time-blocks'] }); },
  });

  const isNow = (b: any) => new Date(b.startsAt) <= new Date() && new Date(b.endsAt) >= new Date();

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
              <Ban className="w-7 h-7 text-red-400" />
              حجب أوقات الحجز
            </h1>
            <p className="text-slate-400 text-sm mt-1">أوقف الحجوزات لفترة محددة بسبب صيانة أو إجازة</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-red-500/20"
          >
            <Plus size={16} /> حجب وقت
          </motion.button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-5"
            >
              <h2 className="text-lg font-bold">حجب وقت جديد</h2>

              <div>
                <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">سبب الحجب</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {REASONS.map(r => (
                    <button key={r.value} onClick={() => setForm(f => ({ ...f, reason: r.value }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${form.reason === r.value ? r.color : 'bg-white/5 border-white/10 text-slate-400'}`}>
                      <span className="text-xl block mb-1">{r.icon}</span>
                      <span className="text-xs font-bold">{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">ملاحظة (تظهر للموظفين)</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="مثال: صيانة دورية للمعدات"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">
                    <Clock size={12} className="inline ml-1" />من
                  </label>
                  <input type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">
                    <Clock size={12} className="inline ml-1" />إلى
                  </label>
                  <input type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500/50 text-sm" />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 text-sm font-bold">إلغاء</button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => create.mutate(form)} disabled={create.isPending || !form.title}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  <Ban size={15} />
                  {create.isPending ? 'جاري الحفظ...' : 'حجب الوقت'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blocks list */}
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : blocks.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد أوقات محجوبة حالياً</p>
            <p className="text-xs mt-1 text-slate-600">الحجوزات متاحة على مدار الساعة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((b: any) => {
              const reason = REASONS.find(r => r.value === b.reason) ?? REASONS[4];
              const active = isNow(b);
              return (
                <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`border rounded-xl p-4 flex items-center gap-4 ${active ? 'bg-red-500/10 border-red-500/30' : 'bg-white/5 border-white/10'}`}
                >
                  <span className="text-2xl flex-shrink-0">{reason.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold text-sm">{b.title}</p>
                      {active && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">نشط الآن</span>}
                    </div>
                    <p className="text-slate-400 text-xs">
                      {new Date(b.startsAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' ← '}
                      {new Date(b.endsAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button onClick={() => { if (confirm('حذف هذا الحجب؟')) remove.mutate(b.id); }}
                    className="flex-shrink-0 p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
