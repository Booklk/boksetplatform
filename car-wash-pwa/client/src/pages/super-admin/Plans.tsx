import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Plus, Pencil, Trash2, X, Save, CheckCircle, Star } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Plan {
  id: number;
  slug: string;
  nameAr: string;
  nameEn?: string;
  description?: string;
  price: string;
  maxEmployees: number;
  maxBranches: number;
  features: string[];
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
  trialDays: number;
}

const EMPTY_PLAN: Omit<Plan, 'id'> = {
  slug: '', nameAr: '', nameEn: '', description: '', price: '0',
  maxEmployees: 1, maxBranches: 1, features: [], isPopular: false,
  isActive: true, sortOrder: 0, trialDays: 14,
};

export default function AdminPlans() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | (Omit<Plan, 'id'> & { id?: undefined }) | null>(null);
  const [newFeature, setNewFeature] = useState('');

  const { data: plans = [], isLoading } = useQuery<Plan[]>({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/super-admin/plans').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (plan: any) => {
      if (plan.id) return api.put(`/super-admin/plans/${plan.id}`, plan).then(r => r.data);
      return api.post('/super-admin/plans', plan).then(r => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      setEditing(null);
      toast.success('تم الحفظ');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/super-admin/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('تم الحذف');
    },
  });

  function addFeature() {
    if (!newFeature.trim() || !editing) return;
    setEditing({ ...editing, features: [...editing.features, newFeature.trim()] });
    setNewFeature('');
  }

  function removeFeature(idx: number) {
    if (!editing) return;
    setEditing({ ...editing, features: editing.features.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-indigo-400" /> إدارة الباقات
        </h2>
        <button onClick={() => setEditing({ ...EMPTY_PLAN })}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> باقة جديدة
        </button>
      </div>

      {/* Plans list */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <p className="mb-3">لا توجد باقات بعد</p>
          <button onClick={() => setEditing({ ...EMPTY_PLAN })} className="text-indigo-400 text-sm font-bold">أنشئ أول باقة</button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <motion.div key={plan.id} layout className={`bg-white/[0.03] border rounded-xl p-5 flex items-start gap-4 ${plan.isActive ? 'border-white/[0.06]' : 'border-red-500/20 opacity-60'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-white">{plan.nameAr}</h3>
                  {plan.isPopular && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">الأكثر طلباً</span>}
                  {!plan.isActive && <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">معطّلة</span>}
                </div>
                <p className="text-2xl font-black text-white">{parseFloat(plan.price).toFixed(0)} <span className="text-sm text-slate-500">ر.س/شهر</span></p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {plan.features.slice(0, 4).map((f, i) => (
                    <span key={i} className="text-[10px] text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{f}</span>
                  ))}
                  {plan.features.length > 4 && <span className="text-[10px] text-slate-600">+{plan.features.length - 4}</span>}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setEditing(plan)} className="btn-icon w-8 h-8"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { if (confirm('حذف هذه الباقة؟')) deleteMutation.mutate(plan.id); }} className="btn-icon w-8 h-8 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-surface-2 border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white">{editing.id ? 'تعديل الباقة' : 'باقة جديدة'}</h3>
                <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الاسم بالعربي *</label>
                  <input value={editing.nameAr} onChange={e => setEditing({ ...editing, nameAr: e.target.value })} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label">Slug *</label>
                  <input value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} className="input-field text-sm font-mono" dir="ltr" placeholder="starter" disabled={!!editing.id} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">السعر (ر.س) *</label>
                  <input type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} className="input-field text-sm" dir="ltr" />
                </div>
                <div>
                  <label className="label">أقصى موظفين</label>
                  <input type="number" value={editing.maxEmployees} onChange={e => setEditing({ ...editing, maxEmployees: Number(e.target.value) })} className="input-field text-sm" dir="ltr" />
                  <p className="text-[10px] text-slate-600 mt-0.5">-1 = غير محدود</p>
                </div>
                <div>
                  <label className="label">أيام التجربة</label>
                  <input type="number" value={editing.trialDays} onChange={e => setEditing({ ...editing, trialDays: Number(e.target.value) })} className="input-field text-sm" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="label">الوصف</label>
                <input value={editing.description ?? ''} onChange={e => setEditing({ ...editing, description: e.target.value })} className="input-field text-sm" placeholder="وصف مختصر للباقة" />
              </div>

              {/* Features */}
              <div>
                <label className="label">المميزات</label>
                <div className="space-y-1.5 mb-2">
                  {editing.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/[0.03] rounded-lg px-3 py-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-sm text-slate-300 flex-1">{f}</span>
                      <button onClick={() => removeFeature(i)} className="text-slate-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newFeature} onChange={e => setNewFeature(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                    placeholder="أضف ميزة..." className="input-field text-sm flex-1" />
                  <button onClick={addFeature} className="btn-icon w-10 h-10"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={editing.isPopular} onChange={e => setEditing({ ...editing, isPopular: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5" />
                  <Star className="w-3.5 h-3.5" /> الأكثر طلباً
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={editing.isActive} onChange={e => setEditing({ ...editing, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5" />
                  مفعّلة
                </label>
              </div>

              <button onClick={() => saveMutation.mutate(editing)} disabled={!editing.nameAr || !editing.slug || !editing.price || saveMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
