import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────
type CostFactor = {
  id: number;
  name: string;
  nameKey?: string;
  costPerWash: string;
  unit?: string;
  isActive: boolean;
  sortOrder: number;
};

type ProfitAnalysis = {
  totalWashes: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  profitPerWash: number;
  profitMargin: number;
  costPerWash: number;
  averageRevenuePerWash: number;
  monthlySalaryTotal: number;
  salaryPerWash: number;
  costBreakdown: Array<{
    name: string;
    nameKey?: string;
    costPerWash: number;
    totalCost: number;
    pct: number;
  }>;
};

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6'];
const ICONS: Record<string, string> = {
  soap: '🧴', water: '💧', towels: '🧻', brushes: '🪣', fuel: '⛽', fragrance: '🌸', salary: '👷',
};

function fmt(n: number) {
  return n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Edit Factor Modal ────────────────────────────────────────────────────────
function FactorModal({
  factor,
  onClose,
  onSaved,
}: {
  factor?: CostFactor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!factor;

  const [form, setForm] = useState({
    name: factor?.name ?? '',
    nameKey: factor?.nameKey ?? '',
    costPerWash: factor?.costPerWash ?? '0',
    unit: factor?.unit ?? 'ريال',
    isActive: factor?.isActive ?? true,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) return apiRequest('PUT', `/api/cost-factors/${factor!.id}`, form);
      return apiRequest('POST', '/api/cost-factors', form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cost-factors'] });
      qc.invalidateQueries({ queryKey: ['profit-analysis'] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white w-full sm:w-[440px] rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6" dir="rtl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'تعديل عامل التكلفة' : 'إضافة عامل تكلفة جديد'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم العامل</label>
              <input
                required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: معطر، زيت، قطع غيار..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة لكل غسلة</label>
                <div className="relative">
                  <input
                    type="number" step="0.01" min="0" required
                    value={form.costPerWash}
                    onChange={e => setForm(f => ({ ...f, costPerWash: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pl-12 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">ريال</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوحدة</label>
                <input
                  value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  placeholder="ريال"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-5 h-5 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700">مفعّل (يُحسب في التكلفة)</span>
            </label>

            {mutation.isError && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">فشل الحفظ — حاول مجدداً</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit" disabled={mutation.isPending}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة'}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfitCalculator() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('this_month');
  const [modal, setModal] = useState<{ open: boolean; factor?: CostFactor | null }>({ open: false });
  const [toast, setToast] = useState('');

  const factorsQ = useQuery<CostFactor[]>({
    queryKey: ['cost-factors'],
    queryFn: () => apiRequest('GET', '/api/cost-factors'),
  });

  const analysisQ = useQuery<ProfitAnalysis>({
    queryKey: ['profit-analysis', period],
    queryFn: () => apiRequest('GET', `/api/cost-factors/profit-analysis?period=${period}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/cost-factors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cost-factors'] });
      qc.invalidateQueries({ queryKey: ['profit-analysis'] });
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const analysis = analysisQ.data;
  const factors = factorsQ.data ?? [];
  const activeFactors = factors.filter(f => f.isActive);
  const totalCostPerWash = activeFactors.reduce((s, f) => s + parseFloat(f.costPerWash), 0);

  // Chart: revenue vs cost per wash
  const breakdownChartData = (analysis?.costBreakdown ?? []).map(b => ({
    name: b.name.length > 10 ? b.name.slice(0, 10) + '…' : b.name,
    تكلفة: b.costPerWash,
  }));

  const pieCostData = (analysis?.costBreakdown ?? []).map(b => ({
    name: b.name, value: parseFloat(b.totalCost.toFixed(2)),
  })).filter(b => b.value > 0);

  const PERIODS = [
    { value: 'today', label: 'اليوم' },
    { value: 'this_week', label: 'هذا الأسبوع' },
    { value: 'this_month', label: 'هذا الشهر' },
  ];

  const profitColor = (n?: number) => (n ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600';
  const profitBg = (n?: number) => (n ?? 0) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="fixed top-5 right-5 z-[100] bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium"
          >
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">حاسبة الربح الحقيقي</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              كل غسلة — كم كلّفت وكم ربحت فعلياً بعد كل المصاريف
            </p>
          </div>
          <button
            onClick={() => setModal({ open: true, factor: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            إضافة عامل تكلفة
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Period selector */}
        <div className="flex gap-2 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 w-fit">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p.value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Big Summary: Profit per wash */}
        {analysisQ.isLoading ? (
          <div className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border-2 p-6 ${profitBg(analysis?.netProfit)}`}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: 'صافي الربح لكل غسلة', icon: '💰',
                  value: `${fmt(analysis?.profitPerWash ?? 0)} ريال`,
                  color: profitColor(analysis?.profitPerWash),
                  sub: `هامش ربح ${analysis?.profitMargin ?? 0}%`,
                },
                {
                  label: 'متوسط سعر الغسلة', icon: '🚗',
                  value: `${fmt(analysis?.averageRevenuePerWash ?? 0)} ريال`,
                  color: 'text-blue-600', sub: 'إيراد كل غسلة',
                },
                {
                  label: 'تكلفة الغسلة الواحدة', icon: '📊',
                  value: `${fmt(analysis?.costPerWash ?? 0)} ريال`,
                  color: 'text-red-600', sub: 'جميع التكاليف',
                },
                {
                  label: 'إجمالي الغسلات', icon: '✅',
                  value: String(analysis?.totalWashes ?? 0),
                  color: 'text-gray-900', sub: 'خلال الفترة',
                },
              ].map((card, i) => (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{card.icon}</span>
                    <span className="text-xs text-gray-500 font-medium">{card.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Inline waterfall: Price - costs = profit */}
            <div className="mt-5 pt-5 border-t border-gray-200">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <span className="text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                  سعر الغسلة: {fmt(analysis?.averageRevenuePerWash ?? 0)} ريال
                </span>
                {(analysis?.costBreakdown ?? []).map((b, i) => (
                  <span key={i} className="text-red-700 bg-red-50 px-3 py-1.5 rounded-lg">
                    − {b.name}: {fmt(b.costPerWash)} ريال
                  </span>
                ))}
                <span className="text-gray-400 text-xl">=</span>
                <span className={`px-3 py-1.5 rounded-lg font-bold text-base ${
                  (analysis?.profitPerWash ?? 0) >= 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-red-600 text-white'
                }`}>
                  ربح صافي: {fmt(analysis?.profitPerWash ?? 0)} ريال
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Period totals */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: analysis?.totalRevenue, icon: '📈', color: 'emerald' },
            { label: 'إجمالي التكاليف', value: analysis?.totalCost, icon: '📉', color: 'red' },
            { label: 'صافي الربح الكلي', value: analysis?.netProfit, icon: '💵', color: (analysis?.netProfit ?? 0) >= 0 ? 'blue' : 'orange' },
          ].map((card, i) => (
            <motion.div
              key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{card.icon}</span>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
              <p className={`text-xl font-bold ${
                card.color === 'emerald' ? 'text-emerald-600'
                : card.color === 'red' ? 'text-red-600'
                : card.color === 'blue' ? 'text-blue-600'
                : 'text-orange-600'
              }`}>
                {fmt(card.value ?? 0)} ريال
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost factors list */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">عوامل التكلفة لكل غسلة</h3>
              <span className="text-sm font-bold text-red-600">
                المجموع: {fmt(totalCostPerWash)} ريال/غسلة
              </span>
            </div>
            {factorsQ.isLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {factors.map((factor, i) => (
                  <motion.div
                    key={factor.id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className={`flex items-center gap-3 px-5 py-3.5 ${!factor.isActive ? 'opacity-40' : ''}`}
                  >
                    <span className="text-xl w-8 text-center">
                      {ICONS[factor.nameKey ?? ''] ?? '📋'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">{factor.name}</p>
                      {!factor.isActive && <span className="text-xs text-gray-400">متوقف</span>}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-red-600 text-sm">{fmt(parseFloat(factor.costPerWash))} ريال</p>
                      <p className="text-xs text-gray-400">لكل غسلة</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModal({ open: true, factor })}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >✏️</button>
                      <button
                        onClick={() => { if (confirm('حذف هذا العامل؟')) deleteMutation.mutate(factor.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >🗑️</button>
                    </div>
                  </motion.div>
                ))}
                {/* Salary row (from payroll) */}
                {analysis && (
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-blue-50/50">
                    <span className="text-xl w-8 text-center">👷</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800 text-sm">رواتب العمالة</p>
                      <p className="text-xs text-gray-500">
                        {fmt(analysis.monthlySalaryTotal)} ريال شهري ÷ 30 يوم ÷ عدد الغسلات
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-blue-600 text-sm">{fmt(analysis.salaryPerWash)} ريال</p>
                      <p className="text-xs text-gray-400">لكل غسلة (تقديري)</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Charts */}
          <div className="space-y-5">
            {/* Cost breakdown bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-bold text-gray-900 mb-4 text-sm">تكلفة كل عامل لكل غسلة</h3>
              {breakdownChartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400 text-sm">لا توجد بيانات</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={breakdownChartData} layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit=" ر" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} ريال`} />
                    <Bar dataKey="تكلفة" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie: cost share */}
            {pieCostData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-4 text-sm">توزيع التكلفة الكلية</h3>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={pieCostData} cx="50%" cy="50%" outerRadius={60} dataKey="value" strokeWidth={0}>
                        {pieCostData.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {pieCostData.slice(0, 6).map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 text-gray-600 truncate">{item.name}</span>
                        <span className="font-semibold text-gray-800">{fmt(item.value)} ر</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tip box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <span>💡</span> كيف تحسب الراتب لكل غسلة؟
          </h3>
          <p className="text-blue-800 text-sm leading-relaxed">
            يتم حساب تكلفة الراتب تلقائياً من إعدادات الرواتب: <strong>الراتب الشهري ÷ 30 يوم ÷ معدل الغسلات اليومية</strong>.
            مثال: راتب 3000 ريال، 20 غسلة يومياً = تكلفة راتب لكل غسلة <strong>5 ريال</strong>.
            أضف باقة الرواتب من صفحة الرواتب لتظهر هنا تلقائياً.
          </p>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <FactorModal
            factor={modal.factor}
            onClose={() => setModal({ open: false })}
            onSaved={() => {
              setModal({ open: false });
              showToast(modal.factor ? 'تم تعديل عامل التكلفة' : 'تم إضافة عامل التكلفة');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
