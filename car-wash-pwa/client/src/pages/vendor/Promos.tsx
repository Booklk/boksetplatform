import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Plus,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Pencil,
  Percent,
  BadgeDollarSign,
  Calendar,
  Infinity as InfinityIcon,
  X,
  Hash,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

interface Promo {
  id: number;
  code: string;
  descriptionAr?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
}

type PromoForm = Omit<Promo, 'id' | 'usedCount'> & { id?: number };

const emptyForm: PromoForm = {
  code: '',
  descriptionAr: '',
  discountType: 'percentage',
  discountValue: 0,
  minOrderAmount: undefined,
  maxUses: undefined,
  validFrom: '',
  validUntil: '',
  isActive: true,
};

interface Toast {
  msg: string;
  type: 'success' | 'error';
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-emerald-500' : 'bg-white/15'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? '-translate-x-5' : '-translate-x-1'
        }`}
      />
    </button>
  );
}

export default function VendorPromos() {
  const queryClient = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [toast, setToast] = useState<Toast | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PromoForm, string>>>({});

  const showToast = (msg: string, type: Toast['type'] = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const setField = <K extends keyof PromoForm>(key: K, value: PromoForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const { data: promos, isLoading } = useQuery<Promo[]>({
    queryKey: ['promos'],
    queryFn: async () => {
      const { data } = await api.get('/promos');
      return Array.isArray(data) ? data : data.promos ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: Omit<PromoForm, 'id'>) => api.post('/promos', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      showToast('تم إنشاء الكود بنجاح');
      setPanelOpen(false);
      setForm(emptyForm);
    },
    onError: () => showToast('فشل إنشاء الكود', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: PromoForm & { id: number }) =>
      api.put(`/promos/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promos'] });
      showToast('تم تحديث الكود');
      setPanelOpen(false);
      setForm(emptyForm);
    },
    onError: () => showToast('فشل التحديث', 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.put(`/promos/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['promos'] }),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setErrors({});
    setPanelOpen(true);
  };

  const openEdit = (promo: Promo) => {
    setForm({
      id: promo.id,
      code: promo.code,
      descriptionAr: promo.descriptionAr ?? '',
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minOrderAmount: promo.minOrderAmount,
      maxUses: promo.maxUses,
      validFrom: promo.validFrom?.split('T')[0] ?? '',
      validUntil: promo.validUntil?.split('T')[0] ?? '',
      isActive: promo.isActive,
    });
    setErrors({});
    setPanelOpen(true);
  };

  const copyCode = useCallback(async (promo: Promo) => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopiedId(promo.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  }, []);

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.code.trim()) errs.code = 'مطلوب';
    if (!form.discountValue || form.discountValue <= 0) errs.discountValue = 'يجب أن تكون القيمة أكبر من صفر';
    if (form.discountType === 'percentage' && form.discountValue > 100)
      errs.discountValue = 'لا يمكن أن تتجاوز نسبة الخصم 100%';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const { id, ...payload } = form;
    if (id) {
      updateMutation.mutate({ id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const today = new Date().toISOString().split('T')[0];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-pink-600/7 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-purple-600/7 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-5 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-pink-600 to-rose-600 shadow-lg shadow-pink-500/30">
              <Tag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">أكواد الخصم</h1>
              <p className="text-white/40 text-sm">إدارة عروض مغسلتك</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-sm shadow-lg shadow-pink-500/30 hover:from-pink-500 hover:to-rose-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            كود جديد
          </motion.button>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['الكود', 'النوع', 'القيمة', 'الاستخدامات', 'الصلاحية', 'مفعّل', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-4 text-right text-xs font-semibold text-white/35 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-5 py-4">
                            <div className="h-5 bg-white/8 rounded-lg animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : promos?.map((promo, i) => (
                      <motion.tr
                        key={promo.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/3 transition-colors"
                      >
                        {/* Code */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white bg-white/8 border border-white/10 px-2.5 py-1 rounded-lg tracking-widest">
                              {promo.code}
                            </span>
                          </div>
                          {promo.descriptionAr && (
                            <p className="text-white/35 text-xs mt-0.5">{promo.descriptionAr}</p>
                          )}
                        </td>

                        {/* Type */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              promo.discountType === 'percentage'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {promo.discountType === 'percentage' ? (
                              <><Percent className="w-3 h-3" />خصم %</>
                            ) : (
                              <><BadgeDollarSign className="w-3 h-3" />خصم ريال</>
                            )}
                          </span>
                        </td>

                        {/* Value */}
                        <td className="px-5 py-4">
                          <span className="text-white font-bold text-sm">
                            {promo.discountType === 'percentage'
                              ? `${promo.discountValue}%`
                              : `${promo.discountValue} ر.س`}
                          </span>
                        </td>

                        {/* Uses */}
                        <td className="px-5 py-4">
                          <span className="text-white/60 text-sm font-medium">
                            {promo.usedCount}/
                            {promo.maxUses !== undefined && promo.maxUses !== null ? (
                              promo.maxUses
                            ) : (
                              <InfinityIcon className="w-4 h-4 inline" />
                            )}
                          </span>
                        </td>

                        {/* Validity */}
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-0.5">
                            {promo.validFrom && (
                              <span className="text-white/40 text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(promo.validFrom)}
                              </span>
                            )}
                            {promo.validUntil && (
                              <span className="text-white/60 text-xs">
                                حتى {formatDate(promo.validUntil)}
                              </span>
                            )}
                            {!promo.validFrom && !promo.validUntil && (
                              <span className="text-white/25 text-xs">دائم</span>
                            )}
                          </div>
                        </td>

                        {/* Active toggle */}
                        <td className="px-5 py-4">
                          <ToggleSwitch
                            checked={promo.isActive}
                            onChange={(v) =>
                              toggleActiveMutation.mutate({ id: promo.id, isActive: v })
                            }
                          />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => copyCode(promo)}
                              className="p-2 rounded-lg hover:bg-white/8 transition-colors text-white/40 hover:text-white"
                              title="نسخ الكود"
                            >
                              {copiedId === promo.id ? (
                                <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  نُسخ
                                </span>
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => openEdit(promo)}
                              className="p-2 rounded-lg hover:bg-white/8 transition-colors text-white/40 hover:text-white"
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
              </tbody>
            </table>
            {!isLoading && (!promos || promos.length === 0) && (
              <div className="py-16 text-center text-white/25">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد أكواد خصم بعد</p>
                <button
                  onClick={openCreate}
                  className="mt-3 text-pink-400 text-sm hover:text-pink-300 transition-colors underline underline-offset-2"
                >
                  أنشئ أول كود
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Slide-in Panel */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanelOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />

            {/* Panel (slides in from left in RTL screen = visually right side) */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 h-full w-full max-w-md z-50 bg-[#0f0f1e] border-r border-white/10 shadow-2xl flex flex-col"
              style={{ direction: 'rtl' }}
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-pink-600 to-rose-600">
                    <Tag className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-white font-bold">
                    {form.id ? 'تعديل الكود' : 'كود خصم جديد'}
                  </h2>
                </div>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/8 transition-colors text-white/50 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Code */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-1.5 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    الكود
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setField('code', e.target.value.toUpperCase())}
                    placeholder="SUMMER25"
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white font-mono uppercase placeholder-white/25 text-sm focus:outline-none transition-all ${
                      errors.code ? 'border-red-500/60' : 'border-white/10 focus:border-purple-500/60'
                    }`}
                  />
                  {errors.code && (
                    <p className="text-red-400 text-xs mt-1">{errors.code}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-1.5">
                    الوصف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={form.descriptionAr ?? ''}
                    onChange={(e) => setField('descriptionAr', e.target.value)}
                    placeholder="خصم نهاية الأسبوع"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>

                {/* Discount Type */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-2">
                    نوع الخصم
                  </label>
                  <div className="flex gap-3">
                    {[
                      { value: 'percentage', label: 'نسبة مئوية %', icon: Percent },
                      { value: 'fixed', label: 'مبلغ ثابت ر.س', icon: BadgeDollarSign },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setField('discountType', value as PromoForm['discountType'])}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${
                          form.discountType === value
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                            : 'bg-white/3 border-white/10 text-white/50 hover:border-white/25'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Discount Value */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-1.5">
                    قيمة الخصم
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === 'percentage' ? 100 : undefined}
                    step="0.01"
                    value={form.discountValue || ''}
                    onChange={(e) => setField('discountValue', parseFloat(e.target.value) || 0)}
                    placeholder={form.discountType === 'percentage' ? '25' : '50'}
                    className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none transition-all ${
                      errors.discountValue
                        ? 'border-red-500/60'
                        : 'border-white/10 focus:border-purple-500/60'
                    }`}
                  />
                  {errors.discountValue && (
                    <p className="text-red-400 text-xs mt-1">{errors.discountValue}</p>
                  )}
                </div>

                {/* Min Order */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-1.5">
                    الحد الأدنى للطلب (ر.س) — اختياري
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount ?? ''}
                    onChange={(e) =>
                      setField(
                        'minOrderAmount',
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>

                {/* Max Uses */}
                <div>
                  <label className="block text-sm font-semibold text-white/60 mb-1.5">
                    الحد الأقصى للاستخدام — اتركه فارغاً لـ ∞
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.maxUses ?? ''}
                    onChange={(e) =>
                      setField('maxUses', e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="∞"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">
                      صالح من
                    </label>
                    <input
                      type="date"
                      value={form.validFrom ?? ''}
                      onChange={(e) => setField('validFrom', e.target.value)}
                      max={form.validUntil || undefined}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1">
                      صالح حتى
                    </label>
                    <input
                      type="date"
                      value={form.validUntil ?? ''}
                      onChange={(e) => setField('validUntil', e.target.value)}
                      min={form.validFrom || today}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8">
                  <div>
                    <p className="text-white font-semibold text-sm">تفعيل الكود</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {form.isActive ? 'الكود نشط ومتاح للاستخدام' : 'الكود معطّل'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setField('isActive', !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      form.isActive ? 'bg-emerald-500' : 'bg-white/15'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        form.isActive ? '-translate-x-6' : '-translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </form>

              {/* Panel Footer */}
              <div className="p-5 border-t border-white/10 flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold text-sm shadow-lg shadow-pink-500/30 hover:from-pink-500 hover:to-rose-500 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {form.id ? 'تحديث' : 'إنشاء الكود'}
                    </>
                  )}
                </motion.button>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="px-4 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/25 transition-colors text-sm font-medium"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-red-600 to-rose-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
