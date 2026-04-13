import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

type Tab = 'plans' | 'subscribers';

const BILLING_CYCLE_LABEL: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربع سنوي',
  yearly: 'سنوي',
};

interface PlanForm {
  nameAr: string;
  billingCycle: string;
  washesIncluded: string;
  price: string;
}

const emptyPlanForm: PlanForm = { nameAr: '', billingCycle: 'monthly', washesIncluded: '', price: '' };

export default function VendorSubscriptions() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('plans');
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<any>(null);
  const [form, setForm] = useState<PlanForm>(emptyPlanForm);

  // Fetch plans
  const { data: plansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data } = await axios.get('/api/subscriptions/plans', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token && tab === 'plans',
  });

  // Fetch active subscriptions
  const { data: subsData, isLoading: loadingSubs } = useQuery({
    queryKey: ['subscriptions-active'],
    queryFn: async () => {
      const { data } = await axios.get('/api/subscriptions/active', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token && tab === 'subscribers',
  });

  const plans: any[] = Array.isArray(plansData) ? plansData : [];
  const subscribers: any[] = Array.isArray(subsData) ? subsData : [];

  // Create plan
  const createPlan = useMutation({
    mutationFn: (payload: any) =>
      axios.post('/api/subscriptions/plans', payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success('تم إنشاء الخطة');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowForm(false);
      setForm(emptyPlanForm);
    },
    onError: () => toast.error('فشل إنشاء الخطة'),
  });

  // Update plan
  const updatePlan = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      axios.put(`/api/subscriptions/plans/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      toast.success('تم تحديث الخطة');
      qc.invalidateQueries({ queryKey: ['subscription-plans'] });
      setShowForm(false);
      setEditPlan(null);
      setForm(emptyPlanForm);
    },
    onError: () => toast.error('فشل تحديث الخطة'),
  });

  const handleToggleActive = (plan: any) => {
    updatePlan.mutate({ id: plan.id, payload: { isActive: !plan.isActive } });
  };

  const handleSubmit = () => {
    const payload = {
      nameAr: form.nameAr,
      billingCycle: form.billingCycle,
      washesIncluded: Number(form.washesIncluded),
      price: Number(form.price),
    };
    if (editPlan) {
      updatePlan.mutate({ id: editPlan.id, payload });
    } else {
      createPlan.mutate(payload);
    }
  };

  const openCreate = () => {
    setEditPlan(null);
    setForm(emptyPlanForm);
    setShowForm(true);
  };

  const openEdit = (plan: any) => {
    setEditPlan(plan);
    setForm({
      nameAr: plan.nameAr ?? '',
      billingCycle: plan.billingCycle ?? 'monthly',
      washesIncluded: String(plan.washesIncluded ?? ''),
      price: String(plan.price ?? ''),
    });
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <RefreshCw className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">الاشتراكات</h1>
          </div>
          {tab === 'plans' && (
            <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors text-sm">
              <Plus className="w-4 h-4" />
              خطة جديدة
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['plans', 'subscribers'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              {t === 'plans' ? 'الخطط' : 'المشتركون'}
            </button>
          ))}
        </div>

        {/* Plans Tab */}
        {tab === 'plans' && (
          <>
            {loadingPlans ? (
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الاسم</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">دورة الفوترة</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الغسلات</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">السعر</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الحالة</th>
                      <th className="px-5 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan) => (
                      <tr key={plan.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 text-white font-medium">{plan.nameAr}</td>
                        <td className="px-5 py-4 text-slate-300 text-sm">{BILLING_CYCLE_LABEL[plan.billingCycle] ?? plan.billingCycle}</td>
                        <td className="px-5 py-4 text-slate-300 text-sm">{plan.washesIncluded}</td>
                        <td className="px-5 py-4 text-green-400 font-semibold">{plan.price} ريال</td>
                        <td className="px-5 py-4">
                          <button onClick={() => handleToggleActive(plan)} className="transition-colors">
                            {plan.isActive ? (
                              <ToggleRight className="w-6 h-6 text-green-400" />
                            ) : (
                              <ToggleLeft className="w-6 h-6 text-slate-500" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <button onClick={() => openEdit(plan)} className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                            تعديل
                          </button>
                        </td>
                      </tr>
                    ))}
                    {plans.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                          لا توجد خطط بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Subscribers Tab */}
        {tab === 'subscribers' && (
          <>
            {loadingSubs ? (
              <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-8 text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">العميل</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الخطة</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الغسلات المتبقية</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">تاريخ الانتهاء</th>
                      <th className="text-right px-5 py-4 text-slate-400 text-sm font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((sub) => (
                      <tr key={sub.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 text-white font-medium">{sub.customer?.nameAr ?? sub.customerName ?? '—'}</td>
                        <td className="px-5 py-4 text-slate-300 text-sm">{sub.plan?.nameAr ?? sub.planName ?? '—'}</td>
                        <td className="px-5 py-4 text-slate-300 text-sm">{sub.washesRemaining ?? '—'}</td>
                        <td className="px-5 py-4 text-slate-400 text-sm">
                          {sub.endDate ? new Date(sub.endDate).toLocaleDateString('ar-SA') : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-xs px-2 py-1 rounded-lg border ${
                            sub.status === 'active'
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-slate-700/40 text-slate-400 border-slate-600/30'
                          }`}>
                            {sub.status === 'active' ? 'نشط' : sub.status ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {subscribers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                          لا يوجد مشتركون بعد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slide-in Form */}
      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            />
            <motion.div
              className="fixed top-0 left-0 h-full w-80 bg-slate-900 border-r border-slate-700/50 z-50 p-6 overflow-y-auto"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">{editPlan ? 'تعديل الخطة' : 'خطة جديدة'}</h2>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-slate-400 text-sm block mb-1">اسم الخطة</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="مثال: الخطة الذهبية"
                    value={form.nameAr}
                    onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-1">دورة الفوترة</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-sm"
                    value={form.billingCycle}
                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-1">عدد الغسلات</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="مثال: 8"
                    value={form.washesIncluded}
                    onChange={(e) => setForm((f) => ({ ...f, washesIncluded: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-1">السعر (ريال)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="مثال: 199"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={createPlan.isPending || updatePlan.isPending || !form.nameAr || !form.price}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors"
                >
                  {createPlan.isPending || updatePlan.isPending ? 'جارٍ الحفظ...' : editPlan ? 'حفظ التعديلات' : 'إنشاء الخطة'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
