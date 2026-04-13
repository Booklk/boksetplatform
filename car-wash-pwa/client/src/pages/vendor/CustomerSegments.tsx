import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Target, TrendingUp, AlertTriangle, RefreshCw, Plus, Trash2, ChevronDown, BarChart3, Crown, Medal, Award, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Crown }> = {
  platinum: { label: 'بلاتيني', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Crown },
  gold: { label: 'ذهبي', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: Medal },
  silver: { label: 'فضي', color: 'text-slate-300', bg: 'bg-slate-400/20', icon: Award },
  bronze: { label: 'برونزي', color: 'text-orange-400', bg: 'bg-orange-500/20', icon: Shield },
};

const FIELDS = [
  { value: 'totalSpend', label: 'إجمالي الإنفاق' },
  { value: 'bookingCount', label: 'عدد الحجوزات' },
  { value: 'daysSinceLastBooking', label: 'آخر حجز (أيام)' },
  { value: 'avgRating', label: 'متوسط التقييم' },
  { value: 'churnRisk', label: 'خطر المغادرة' },
  { value: 'ltvEstimate', label: 'القيمة المتوقعة' },
];

const OPERATORS = [
  { value: 'gt', label: 'أكبر من' },
  { value: 'gte', label: 'أكبر من أو يساوي' },
  { value: 'lt', label: 'أقل من' },
  { value: 'lte', label: 'أقل من أو يساوي' },
  { value: 'eq', label: 'يساوي' },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Rule {
  field: string;
  operator: string;
  value: number;
}

export default function CustomerSegments() {
  const [tab, setTab] = useState<'segments' | 'scores'>('segments');
  const [showCreate, setShowCreate] = useState(false);
  const [tierFilter, setTierFilter] = useState('');
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formLogic, setFormLogic] = useState<'and' | 'or'>('and');
  const [formRules, setFormRules] = useState<Rule[]>([{ field: 'totalSpend', operator: 'gt', value: 0 }]);
  const qc = useQueryClient();

  const { data: segments = [] } = useQuery({
    queryKey: ['segments'],
    queryFn: () => api.get('/segments').then(r => r.data),
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['scores', tierFilter],
    queryFn: () => api.get(`/segments/scores${tierFilter ? `?tier=${tierFilter}` : ''}`).then(r => r.data),
    enabled: tab === 'scores',
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api.post('/segments', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['segments'] }); setShowCreate(false); toast.success('تم إنشاء الشريحة'); resetForm(); },
    onError: () => toast.error('خطأ في إنشاء الشريحة'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/segments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['segments'] }); toast.success('تم الحذف'); },
  });

  const recalcSegments = useMutation({
    mutationFn: () => api.post('/segments/recalculate'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['segments'] }); toast.success('تم إعادة الحساب'); },
  });

  const recalcScores = useMutation({
    mutationFn: () => api.post('/segments/scores/recalculate'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['scores'] }); toast.success('تم إعادة حساب النقاط'); },
  });

  function resetForm() {
    setFormName(''); setFormColor('#3b82f6'); setFormLogic('and');
    setFormRules([{ field: 'totalSpend', operator: 'gt', value: 0 }]);
  }

  function handleCreate() {
    if (!formName.trim()) return toast.error('الاسم مطلوب');
    createMut.mutate({
      name: formName, nameAr: formName, color: formColor,
      criteria: { rules: formRules, logic: formLogic },
    });
  }

  // Stats for scores tab
  const totalCustomers = scores.length;
  const avgScore = totalCustomers > 0 ? Math.round(scores.reduce((s: number, c: any) => s + (c.score ?? 0), 0) / totalCustomers) : 0;
  const highChurn = scores.filter((c: any) => parseFloat(c.churnRisk ?? '0') > 0.7).length;
  const totalLTV = scores.reduce((s: number, c: any) => s + parseFloat(c.ltvEstimate ?? '0'), 0);

  const tierCounts = {
    platinum: scores.filter((c: any) => c.tier === 'platinum').length,
    gold: scores.filter((c: any) => c.tier === 'gold').length,
    silver: scores.filter((c: any) => c.tier === 'silver').length,
    bronze: scores.filter((c: any) => c.tier === 'bronze').length,
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-[#040812] text-white p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">ذكاء العملاء</h1>
          <p className="text-slate-400 mt-1">صنّف عملاءك واعرف قيمتهم الحقيقية</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['segments', 'scores'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}>
            {t === 'segments' ? 'شرائح العملاء' : 'تقييم العملاء'}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Segments ── */}
      {tab === 'segments' && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Plus size={18} /> إنشاء شريحة
            </button>
            <button onClick={() => recalcSegments.mutate()} disabled={recalcSegments.isPending}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <RefreshCw size={18} className={recalcSegments.isPending ? 'animate-spin' : ''} /> إعادة حساب
            </button>
          </div>

          {segments.length === 0 ? (
            <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
              <Target size={48} className="mx-auto text-slate-500 mb-4" />
              <p className="text-lg text-slate-400">ما عندك شرائح بعد</p>
              <p className="text-sm text-slate-500 mt-1">أنشئ شريحتك الأولى عشان تصنّف عملاءك</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {segments.map((seg: any, i: number) => (
                <motion.div key={seg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                      <h3 className="font-bold">{seg.nameAr || seg.name}</h3>
                    </div>
                    <button onClick={() => deleteMut.mutate(seg.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Users size={14} />
                    <span>{seg.customerCount ?? 0} عميل</span>
                  </div>
                  {seg.description && <p className="text-xs text-slate-500 mt-2">{seg.description}</p>}
                </motion.div>
              ))}
            </div>
          )}

          {/* Create Modal */}
          {showCreate && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">شريحة جديدة</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">اسم الشريحة</label>
                    <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="مثال: العملاء المميزين"
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white" />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">اللون</label>
                    <div className="flex gap-2">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => setFormColor(c)}
                          className={`w-8 h-8 rounded-full transition-transform ${formColor === c ? 'scale-125 ring-2 ring-white' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-400">الشروط:</label>
                    <select value={formLogic} onChange={e => setFormLogic(e.target.value as 'and' | 'or')}
                      className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm">
                      <option value="and">كل الشروط (AND)</option>
                      <option value="or">أي شرط (OR)</option>
                    </select>
                  </div>

                  {formRules.map((rule, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-700/30 p-3 rounded-lg">
                      <select value={rule.field} onChange={e => { const r = [...formRules]; r[idx].field = e.target.value; setFormRules(r); }}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm flex-1 min-w-[120px]">
                        {FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                      <select value={rule.operator} onChange={e => { const r = [...formRules]; r[idx].operator = e.target.value; setFormRules(r); }}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm">
                        {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <input type="number" value={rule.value} onChange={e => { const r = [...formRules]; r[idx].value = Number(e.target.value); setFormRules(r); }}
                        className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm w-24" />
                      {formRules.length > 1 && (
                        <button onClick={() => setFormRules(formRules.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                      )}
                    </div>
                  ))}

                  <button onClick={() => setFormRules([...formRules, { field: 'totalSpend', operator: 'gt', value: 0 }])}
                    className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"><Plus size={14} /> إضافة شرط</button>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={handleCreate} disabled={createMut.isPending}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors">
                    {createMut.isPending ? 'جاري الإنشاء...' : 'إنشاء'}
                  </button>
                  <button onClick={() => { setShowCreate(false); resetForm(); }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition-colors">إلغاء</button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Scores ── */}
      {tab === 'scores' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'العملاء', value: totalCustomers, icon: Users, color: 'blue' },
              { label: 'متوسط الـ Score', value: avgScore, icon: BarChart3, color: 'green' },
              { label: 'خطر مغادرة عالي', value: highChurn, icon: AlertTriangle, color: 'red' },
              { label: 'القيمة المتوقعة', value: `${(totalLTV / 1000).toFixed(1)}K`, icon: TrendingUp, color: 'purple' },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-4`}>
                <stat.icon size={20} className={`text-${stat.color}-400 mb-2`} />
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-slate-400">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Tier Distribution */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-bold mb-4">توزيع المستويات</h3>
            <div className="space-y-3">
              {Object.entries(tierCounts).map(([tier, count]) => {
                const cfg = TIER_CONFIG[tier];
                const pct = totalCustomers > 0 ? (count / totalCustomers) * 100 : 0;
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <div className={`${cfg.bg} ${cfg.color} px-2 py-1 rounded text-xs font-medium w-20 text-center`}>{cfg.label}</div>
                    <div className="flex-1 h-6 bg-slate-700/50 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        className={`h-full rounded-full ${tier === 'platinum' ? 'bg-purple-500' : tier === 'gold' ? 'bg-yellow-500' : tier === 'silver' ? 'bg-slate-400' : 'bg-orange-500'}`} />
                    </div>
                    <span className="text-sm text-slate-400 w-12 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => recalcScores.mutate()} disabled={recalcScores.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <RefreshCw size={18} className={recalcScores.isPending ? 'animate-spin' : ''} /> إعادة حساب النقاط
            </button>
            <div className="flex items-center gap-2">
              <ChevronDown size={16} className="text-slate-400" />
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm">
                <option value="">كل المستويات</option>
                <option value="platinum">بلاتيني</option>
                <option value="gold">ذهبي</option>
                <option value="silver">فضي</option>
                <option value="bronze">برونزي</option>
              </select>
            </div>
          </div>

          {/* Scores Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-right p-3">العميل</th>
                    <th className="text-right p-3">Score</th>
                    <th className="text-right p-3">المستوى</th>
                    <th className="text-right p-3">الإنفاق</th>
                    <th className="text-right p-3">الحجوزات</th>
                    <th className="text-right p-3">خطر المغادرة</th>
                    <th className="text-right p-3">القيمة المتوقعة</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((c: any, i: number) => {
                    const churn = parseFloat(c.churnRisk ?? '0');
                    const cfg = TIER_CONFIG[c.tier ?? 'bronze'];
                    return (
                      <motion.tr key={c.id ?? i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                        <td className="p-3">
                          <p className="font-medium">{c.customerName ?? c.name ?? '—'}</p>
                          <p className="text-xs text-slate-500">{c.customerPhone ?? c.phone ?? ''}</p>
                        </td>
                        <td className="p-3">
                          <span className={`font-bold text-lg ${(c.score ?? 0) >= 70 ? 'text-green-400' : (c.score ?? 0) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {c.score ?? 0}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`${cfg.bg} ${cfg.color} px-2 py-0.5 rounded text-xs font-medium`}>{cfg.label}</span>
                        </td>
                        <td className="p-3 text-slate-300">{parseFloat(c.totalSpend ?? '0').toLocaleString()} ر.س</td>
                        <td className="p-3 text-slate-300">{c.bookingCount ?? 0}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${churn > 0.7 ? 'bg-red-500' : churn > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${churn * 100}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{(churn * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-300">{parseFloat(c.ltvEstimate ?? '0').toLocaleString()} ر.س</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {scores.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
                  <p>ما فيه بيانات بعد. اضغط "إعادة حساب النقاط" عشان تبدأ</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
