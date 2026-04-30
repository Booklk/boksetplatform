import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Plus, Play, Pause, Trash2, Edit3, Clock, TrendingUp,
  Activity, ChevronDown, MessageSquare, Bell, Gift, Timer, X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

/* ─── Trigger types ─── */
const TRIGGERS: Record<string, string> = {
  booking_completed: 'عند اكتمال الحجز',
  booking_cancelled: 'عند إلغاء الحجز',
  inactive_7d: 'عميل خامل 7 أيام',
  inactive_14d: 'عميل خامل 14 يوم',
  inactive_21d: 'عميل خامل 21 يوم',
  new_customer: 'عميل جديد',
  abandoned_booking: 'حجز مهجور',
};

const TRIGGER_COLORS: Record<string, string> = {
  booking_completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  booking_cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  inactive_7d: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  inactive_14d: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  inactive_21d: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  new_customer: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  abandoned_booking: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

/* ─── Step action types ─── */
const ACTIONS: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  send_whatsapp: { label: 'إرسال واتساب', icon: MessageSquare, color: 'text-green-400' },
  send_push: { label: 'إشعار فوري', icon: Bell, color: 'text-blue-400' },
  wait: { label: 'انتظار', icon: Timer, color: 'text-amber-400' },
  add_points: { label: 'إضافة نقاط', icon: Gift, color: 'text-purple-400' },
  apply_promo: { label: 'تطبيق عرض', icon: Zap, color: 'text-pink-400' },
};

/* ─── Types ─── */
interface Step {
  action: string;
  message?: string;
  delayMinutes?: number;
}

interface Automation {
  id: string;
  name: string;
  nameAr?: string;
  trigger: string;
  isActive: boolean;
  steps: Step[];
  totalExecutions: number;
  totalConversions: number;
  createdAt: string;
}

/* ─── Blank step helper ─── */
function blankStep(): Step {
  return { action: 'send_whatsapp', message: '' };
}

/* ─── Animations ─── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function Automations() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', trigger: 'booking_completed', steps: [blankStep()] });

  /* ─── Queries ─── */
  const { data: automations = [], isLoading } = useQuery<Automation[]>({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then(r => r.data),
  });

  /* ─── Mutations ─── */
  const createMutation = useMutation({
    mutationFn: (d: typeof form) => api.post('/automations', d).then(r => r.data),
    onSuccess: () => {
      toast.success('تم إنشاء الأتمتة بنجاح ✓');
      qc.invalidateQueries({ queryKey: ['automations'] });
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ في الإنشاء'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      api.put(`/automations/${id}`, data).then(r => r.data),
    onSuccess: () => {
      toast.success('تم تحديث الأتمتة ✓');
      qc.invalidateQueries({ queryKey: ['automations'] });
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ في التحديث'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/automations/${id}`, { isActive }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automations/${id}`).then(r => r.data),
    onSuccess: () => {
      toast.success('تم حذف الأتمتة ✓');
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ في الحذف'),
  });

  /* ─── Helpers ─── */
  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm({ name: '', trigger: 'booking_completed', steps: [blankStep()] });
  }

  function openEdit(a: Automation) {
    setEditingId(a.id);
    setForm({
      name: a.nameAr || a.name,
      trigger: a.trigger,
      steps: a.steps?.length ? a.steps : [blankStep()],
    });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error('اكتب اسم الأتمتة'); return; }
    if (form.steps.length === 0) { toast.error('أضف خطوة واحدة على الأقل'); return; }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function updateStep(idx: number, patch: Partial<Step>) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function removeStep(idx: number) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  }

  function addStep() {
    setForm(f => ({ ...f, steps: [...f.steps, blankStep()] }));
  }

  /* ─── Computed stats ─── */
  const activeCount = automations.filter(a => a.isActive).length;
  const totalExec = automations.reduce((s, a) => s + (a.totalExecutions ?? 0), 0);
  const totalConv = automations.reduce((s, a) => s + (a.totalConversions ?? 0), 0);
  const conversionRate = totalExec > 0 ? ((totalConv / totalExec) * 100).toFixed(1) : '0';
  const lastExec = automations
    .filter(a => a.totalExecutions > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-surface-1 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto"
      >
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-400" />
              </div>
              الأتمتة التسويقية ⚡
            </h1>
            <p className="text-slate-400 text-sm mt-2">حملات تلقائية تشتغل لك 24/7</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setEditingId(null); setForm({ name: '', trigger: 'booking_completed', steps: [blankStep()] }); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-blue-600/25 text-sm transition-colors"
          >
            <Plus size={18} />
            إنشاء أتمتة جديدة
          </motion.button>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'أتمتات نشطة', value: activeCount, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'إجمالي التنفيذات', value: totalExec.toLocaleString('ar-SA'), icon: Play, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'معدل التحويل', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
            { label: 'آخر تنفيذ', value: lastExec ? new Date(lastExec.createdAt).toLocaleDateString('ar-SA') : '—', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          ].map(stat => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${stat.bg} border border-white/5 rounded-xl p-4`}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon size={16} className={stat.color} />
                <span className="text-slate-400 text-xs font-bold">{stat.label}</span>
              </div>
              <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* ── Workflow list ── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : automations.length === 0 ? (
          /* ── Empty state ── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
              <Zap size={36} className="text-blue-500/40" />
            </div>
            <p className="text-slate-400 text-lg font-bold mb-2">ما عندك أتمتات بعد</p>
            <p className="text-slate-500 text-sm mb-6">ابدأ أول أتمتة وخلّ المنصة تسوق لك!</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-colors"
            >
              <Plus size={16} className="inline ml-2" />
              أنشئ أول أتمتة
            </motion.button>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
            {automations.map(a => (
              <motion.div
                key={a.id}
                variants={cardVariants}
                layout
                className="bg-slate-800/50 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-white font-bold text-base truncate">{a.nameAr || a.name}</h3>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${TRIGGER_COLORS[a.trigger] ?? 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                        {TRIGGERS[a.trigger] ?? a.trigger}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${a.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-500'}`}>
                        {a.isActive ? 'مفعّلة' : 'متوقفة'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Play size={12} /> {a.totalExecutions?.toLocaleString('ar-SA') ?? 0} تنفيذ
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp size={12} /> {a.totalConversions?.toLocaleString('ar-SA') ?? 0} تحويل
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {new Date(a.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleMutation.mutate({ id: a.id, isActive: !a.isActive })}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        a.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                          : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700'
                      }`}
                      title={a.isActive ? 'إيقاف' : 'تفعيل'}
                    >
                      {a.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(a)}
                      className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex items-center justify-center transition-colors"
                      title="تعديل"
                    >
                      <Edit3 size={16} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (window.confirm('هل أنت متأكد من حذف هذه الأتمتة؟')) {
                          deleteMutation.mutate(a.id);
                        }
                      }}
                      className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* ═══════════════ Create/Edit Modal ═══════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
              className="bg-[#0c1222] border border-white/10 rounded-2xl w-full max-w-2xl my-8 shadow-2xl"
              dir="rtl"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-lg font-black text-white">
                  {editingId ? 'تعديل الأتمتة' : 'إنشاء أتمتة جديدة'}
                </h2>
                <button onClick={closeModal} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Name */}
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1.5 block">
                    اسم الأتمتة
                  </label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="مثال: ترحيب العميل الجديد"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 text-sm transition-colors"
                  />
                </div>

                {/* Trigger type */}
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2 block">
                    المشغّل (Trigger)
                  </label>
                  <div className="relative">
                    <select
                      value={form.trigger}
                      onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                      className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 text-sm cursor-pointer transition-colors"
                    >
                      {Object.entries(TRIGGERS).map(([val, label]) => (
                        <option key={val} value={val} className="bg-slate-800 text-white">{label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Steps builder */}
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-3 block">
                    الخطوات ({form.steps.length})
                  </label>
                  <div className="space-y-3">
                    {form.steps.map((step, idx) => {
                      const actionMeta = ACTIONS[step.action];
                      const ActionIcon = actionMeta?.icon ?? Zap;
                      const needsMessage = step.action === 'send_whatsapp' || step.action === 'send_push';
                      const needsDelay = step.action === 'wait';

                      return (
                        <motion.div
                          key={idx}
                          layout
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          className="bg-white/5 border border-white/10 rounded-xl p-4 relative group"
                        >
                          {/* Step number badge */}
                          <div className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                            {idx + 1}
                          </div>

                          {/* Remove step */}
                          {form.steps.length > 1 && (
                            <button
                              onClick={() => removeStep(idx)}
                              className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                              <X size={12} />
                            </button>
                          )}

                          {/* Action selector */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${actionMeta?.color ?? 'text-slate-400'}`}>
                              <ActionIcon size={16} />
                            </div>
                            <select
                              value={step.action}
                              onChange={e => {
                                const newAction = e.target.value;
                                const patch: Partial<Step> = { action: newAction };
                                if (newAction === 'wait') { patch.message = undefined; patch.delayMinutes = 60; }
                                else if (newAction === 'send_whatsapp' || newAction === 'send_push') { patch.message = ''; patch.delayMinutes = undefined; }
                                else { patch.message = undefined; patch.delayMinutes = undefined; }
                                updateStep(idx, patch);
                              }}
                              className="flex-1 appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 cursor-pointer transition-colors"
                            >
                              {Object.entries(ACTIONS).map(([val, meta]) => (
                                <option key={val} value={val} className="bg-slate-800 text-white">{meta.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Message field */}
                          {needsMessage && (
                            <textarea
                              value={step.message ?? ''}
                              onChange={e => updateStep(idx, { message: e.target.value })}
                              rows={3}
                              maxLength={500}
                              placeholder={step.action === 'send_whatsapp' ? 'نص رسالة الواتساب...' : 'نص الإشعار...'}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none transition-colors"
                            />
                          )}

                          {/* Delay field */}
                          {needsDelay && (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={1}
                                value={step.delayMinutes ?? 60}
                                onChange={e => updateStep(idx, { delayMinutes: Number(e.target.value) })}
                                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                              />
                              <span className="text-slate-400 text-sm">دقيقة</span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Connector line visual */}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={addStep}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 text-slate-400 hover:text-blue-400 text-sm font-bold transition-colors"
                  >
                    <Plus size={16} />
                    إضافة خطوة
                  </motion.button>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold transition-colors"
                >
                  إلغاء
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={isSaving || !form.name.trim()}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-600/25 transition-colors"
                >
                  <Zap size={15} />
                  {isSaving ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إنشاء الأتمتة'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
