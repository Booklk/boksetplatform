import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────
type FinancialType = 'income' | 'expense' | 'salary' | 'maintenance';
type FinancialRecord = {
  id: number;
  type: FinancialType;
  category: string;
  amount: string;
  description: string;
  notes?: string;
  date: string;
  referenceType: string;
  employeeName?: string;
};
type Summary = {
  income: number; expense: number; salary: number; maintenance: number; net: number; totalTransactions: number;
};
type MonthTrend = {
  month: string; income: number; expense: number; salary: number; maintenance: number; net: number;
};
type CategoryBreakdown = { category: string; type: string; total: string; count: string };

// ─── Constants ────────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { value: 'maintenance', label: 'صيانة السيارات والمعدات', icon: '🔧' },
  { value: 'rent', label: 'إيجار', icon: '🏠' },
  { value: 'electricity', label: 'كهرباء وطاقة', icon: '⚡' },
  { value: 'water', label: 'مياه', icon: '💧' },
  { value: 'goods', label: 'شراء سلع ومواد', icon: '🛒' },
  { value: 'fuel', label: 'وقود', icon: '⛽' },
  { value: 'insurance', label: 'تأمين', icon: '🛡️' },
  { value: 'marketing', label: 'تسويق وإعلان', icon: '📢' },
  { value: 'software', label: 'اشتراكات برامج', icon: '💻' },
  { value: 'other_expense', label: 'مصروفات أخرى', icon: '📋' },
];
const INCOME_CATEGORIES = [
  { value: 'bookings', label: 'حجوزات', icon: '🚗' },
  { value: 'corporate', label: 'عقود شركات', icon: '🏢' },
  { value: 'subscription', label: 'اشتراكات عملاء', icon: '🔄' },
  { value: 'pos_cash', label: 'نقد POS', icon: '💵' },
  { value: 'other_income', label: 'إيرادات أخرى', icon: '💰' },
];
const SALARY_CATEGORIES = [
  { value: 'monthly_salary', label: 'راتب شهري', icon: '👷' },
  { value: 'bonus', label: 'مكافأة', icon: '🏆' },
  { value: 'overtime', label: 'ساعات إضافية', icon: '⏰' },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...SALARY_CATEGORIES,
  { value: 'maintenance_income', label: 'صيانة (إيراد)', icon: '🔧' }];

const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];

function getCategoryLabel(value: string) {
  return ALL_CATEGORIES.find(c => c.value === value)?.label ?? value;
}
function getCategoryIcon(value: string) {
  return ALL_CATEGORIES.find(c => c.value === value)?.icon ?? '📋';
}

const TYPE_LABELS: Record<string, string> = {
  income: 'إيراد', expense: 'مصروف', salary: 'راتب', maintenance: 'صيانة',
};
const TYPE_COLORS: Record<string, string> = {
  income: 'text-emerald-600 bg-emerald-50',
  expense: 'text-red-600 bg-red-50',
  salary: 'text-blue-600 bg-blue-50',
  maintenance: 'text-amber-600 bg-amber-50',
};

function formatAmount(n: number | string) {
  return Number(n).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function periodDates(period: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (period === 'this_month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  }
  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(start), to: fmt(end) };
  }
  if (period === 'last_3months') {
    const start = new Date(now); start.setMonth(start.getMonth() - 3);
    return { from: fmt(start), to: fmt(now) };
  }
  if (period === 'this_year') {
    return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
  }
  return { from: '', to: '' };
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────
function RecordModal({ record, onClose, onSaved }: {
  record?: FinancialRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!record;

  const [form, setForm] = useState({
    type: record?.type ?? 'expense' as FinancialType,
    category: record?.category ?? '',
    amount: record?.amount ?? '',
    description: record?.description ?? '',
    notes: record?.notes ?? '',
    date: record?.date ? record.date.split('T')[0] : new Date().toISOString().split('T')[0],
  });

  const categories = form.type === 'income' ? INCOME_CATEGORIES
    : form.type === 'salary' ? SALARY_CATEGORIES
    : form.type === 'maintenance' ? [{ value: 'maintenance', label: 'صيانة', icon: '🔧' }]
    : EXPENSE_CATEGORIES;

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return apiRequest('PUT', `/api/financials/${record!.id}`, form);
      }
      return apiRequest('POST', '/api/financials', form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financials'] });
      onSaved();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white w-full sm:w-[520px] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'تعديل السجل' : 'إضافة قيد جديد'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">نوع القيد</label>
              <div className="grid grid-cols-4 gap-2">
                {(['income','expense','salary','maintenance'] as FinancialType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: t, category: '' }))}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${
                      form.type === t
                        ? t === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : t === 'expense' ? 'border-red-500 bg-red-50 text-red-700'
                          : t === 'salary' ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">التصنيف</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                    className={`flex items-center gap-2 py-2 px-3 rounded-lg text-sm border-2 transition-all text-right ${
                      form.category === cat.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (ريال)</label>
              <input
                type="number" step="0.01" min="0" required
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
              <input
                type="text" required minLength={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="مثال: فاتورة كهرباء شهر أبريل"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
              <input
                type="date" required
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="أي تفاصيل إضافية..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {mutation.isError && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                فشل الحفظ — تأكد من تعبئة جميع الحقول
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={mutation.isPending || !form.category || !form.amount || !form.description}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {mutation.isPending ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة القيد'}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
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
export default function Expenses() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'charts'>('list');
  const [modal, setModal] = useState<{ open: boolean; record?: FinancialRecord | null }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const dates = useMemo(() => {
    if (period === 'custom') return { from: customFrom, to: customTo };
    return periodDates(period);
  }, [period, customFrom, customTo]);

  const summaryQ = useQuery<Summary>({
    queryKey: ['financials', 'summary', dates],
    queryFn: () => apiRequest('GET', `/api/financials/summary?from=${dates.from}&to=${dates.to}`),
    enabled: !!(dates.from || period !== 'custom'),
  });

  const recordsQ = useQuery<FinancialRecord[]>({
    queryKey: ['financials', 'list', dates, filterType, filterCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dates.from) params.set('from', dates.from);
      if (dates.to) params.set('to', dates.to);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      return apiRequest('GET', `/api/financials?${params}`);
    },
  });

  const trendQ = useQuery<MonthTrend[]>({
    queryKey: ['financials', 'trend'],
    queryFn: () => apiRequest('GET', '/api/financials/monthly-trend'),
  });

  const categoryQ = useQuery<CategoryBreakdown[]>({
    queryKey: ['financials', 'by-category', dates, filterType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dates.from) params.set('from', dates.from);
      if (dates.to) params.set('to', dates.to);
      if (filterType !== 'all') params.set('type', filterType);
      return apiRequest('GET', `/api/financials/by-category?${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/financials/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financials'] });
      setDeleteConfirm(null);
      showToast('تم الحذف بنجاح');
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const summary = summaryQ.data ?? { income: 0, expense: 0, salary: 0, maintenance: 0, net: 0, totalTransactions: 0 };
  const totalExpenses = summary.expense + summary.salary + summary.maintenance;

  const records = (recordsQ.data ?? []).filter(r => {
    if (!search) return true;
    return r.description.includes(search) || getCategoryLabel(r.category).includes(search);
  });

  // Pie data for expenses breakdown
  const expensePieData = (categoryQ.data ?? [])
    .filter(c => c.type !== 'income')
    .map(c => ({ name: getCategoryLabel(c.category), value: parseFloat(c.total) }))
    .filter(c => c.value > 0);

  // Bar chart data for income vs expense
  const comparisonData = (trendQ.data ?? []).slice(-6).map(m => ({
    month: m.month.slice(5),
    إيرادات: Math.round(m.income),
    مصروفات: Math.round(m.expense + m.salary + m.maintenance),
    صافي: Math.round(m.net),
  }));

  const PERIODS = [
    { value: 'this_month', label: 'هذا الشهر' },
    { value: 'last_month', label: 'الشهر الماضي' },
    { value: 'last_3months', label: 'آخر 3 أشهر' },
    { value: 'this_year', label: 'هذه السنة' },
    { value: 'custom', label: 'مخصص' },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900">إدارة المصروفات والدخل</h1>
            <p className="text-gray-500 text-sm mt-0.5">تتبع كل ريال — مصروفاتك ودخلك في مكان واحد</p>
          </div>
          <button
            onClick={() => setModal({ open: true, record: null })}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="text-lg leading-none">+</span>
            إضافة قيد جديد
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Period Filter */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-500 ml-1">الفترة:</span>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  period === p.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
            {period === 'custom' && (
              <div className="flex gap-2 mt-2 sm:mt-0">
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                <span className="self-center text-gray-400">—</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'إجمالي الإيرادات', value: summary.income, icon: '📈', color: 'emerald', sub: 'دخل المغسلة' },
            { label: 'إجمالي المصروفات', value: totalExpenses, icon: '📉', color: 'red', sub: 'كل أنواع المصروفات' },
            { label: 'صافي الربح', value: summary.net, icon: summary.net >= 0 ? '💰' : '⚠️', color: summary.net >= 0 ? 'blue' : 'orange', sub: summary.net >= 0 ? 'ربح صافي' : 'خسارة' },
            { label: 'عدد القيود', value: summary.totalTransactions, icon: '📋', color: 'purple', sub: 'في الفترة المحددة', isCount: true },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{card.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    card.color === 'emerald' ? 'text-emerald-600'
                    : card.color === 'red' ? 'text-red-600'
                    : card.color === 'blue' ? 'text-blue-600'
                    : card.color === 'orange' ? 'text-orange-600'
                    : 'text-purple-600'
                  }`}>
                    {card.isCount ? card.value : `${formatAmount(card.value)} ر`}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                </div>
                <span className="text-2xl">{card.icon}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Breakdown bar: expenses split */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">تفصيل المصروفات</h3>
          <div className="space-y-3">
            {[
              { label: 'مصروفات تشغيلية', value: summary.expense, color: 'bg-red-400', total: totalExpenses },
              { label: 'رواتب وأجور', value: summary.salary, color: 'bg-blue-400', total: totalExpenses },
              { label: 'صيانة', value: summary.maintenance, color: 'bg-amber-400', total: totalExpenses },
            ].map((item, i) => {
              const pct = totalExpenses > 0 ? (item.value / totalExpenses * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-gray-600 text-left">{item.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className={`h-full ${item.color} rounded-full`}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                    />
                  </div>
                  <div className="w-28 text-xs font-semibold text-gray-700 text-left">
                    {formatAmount(item.value)} ر ({pct.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs: List / Charts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            {[{ key: 'list', label: '📋 القيود والمعاملات' }, { key: 'charts', label: '📊 التحليلات والمخططات' }].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  activeTab === tab.key
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── LIST TAB ─────────────────────────────── */}
          {activeTab === 'list' && (
            <div className="p-5">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 mb-5">
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="🔍 بحث في الوصف..."
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={filterType} onChange={e => { setFilterType(e.target.value); setFilterCategory('all'); }}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="income">إيرادات</option>
                  <option value="expense">مصروفات</option>
                  <option value="salary">رواتب</option>
                  <option value="maintenance">صيانة</option>
                </select>
                <select
                  value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">كل التصنيفات</option>
                  {(filterType === 'income' ? INCOME_CATEGORIES
                    : filterType === 'salary' ? SALARY_CATEGORIES
                    : filterType === 'maintenance' ? [{ value: 'maintenance', label: 'صيانة' }]
                    : ALL_CATEGORIES
                  ).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Table */}
              {recordsQ.isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-5xl mb-3">💸</div>
                  <p className="font-medium">لا توجد قيود في هذه الفترة</p>
                  <p className="text-sm mt-1">اضغط "إضافة قيد جديد" لبدء التسجيل</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs border-b border-gray-100">
                        <th className="py-3 px-3 text-right font-medium">التاريخ</th>
                        <th className="py-3 px-3 text-right font-medium">الوصف</th>
                        <th className="py-3 px-3 text-right font-medium">التصنيف</th>
                        <th className="py-3 px-3 text-right font-medium">النوع</th>
                        <th className="py-3 px-3 text-left font-medium">المبلغ</th>
                        <th className="py-3 px-3 text-center font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {records.map((rec, i) => (
                          <motion.tr
                            key={rec.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                              {new Date(rec.date).toLocaleDateString('ar-SA')}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-medium text-gray-800">{rec.description}</div>
                              {rec.notes && <div className="text-xs text-gray-400 mt-0.5">{rec.notes}</div>}
                            </td>
                            <td className="py-3 px-3">
                              <span className="flex items-center gap-1 text-gray-600">
                                <span>{getCategoryIcon(rec.category)}</span>
                                <span>{getCategoryLabel(rec.category)}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLORS[rec.type]}`}>
                                {TYPE_LABELS[rec.type]}
                              </span>
                            </td>
                            <td className={`py-3 px-3 text-left font-bold whitespace-nowrap ${
                              rec.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {rec.type === 'income' ? '+' : '-'}{formatAmount(rec.amount)} ر
                            </td>
                            <td className="py-3 px-3">
                              {deleteConfirm === rec.id ? (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => deleteMutation.mutate(rec.id)}
                                    className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg hover:bg-red-100"
                                  >تأكيد</button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="text-xs text-gray-500 px-2 py-1 rounded-lg hover:bg-gray-100"
                                  >إلغاء</button>
                                </div>
                              ) : (
                                <div className="flex gap-1 justify-center">
                                  <button
                                    onClick={() => setModal({ open: true, record: rec })}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="تعديل"
                                  >✏️</button>
                                  <button
                                    onClick={() => setDeleteConfirm(rec.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="حذف"
                                  >🗑️</button>
                                </div>
                              )}
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                  <div className="mt-4 flex justify-between items-center text-sm text-gray-500 px-3">
                    <span>{records.length} قيد</span>
                    <span className={`font-bold ${summary.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      الصافي: {summary.net >= 0 ? '+' : ''}{formatAmount(summary.net)} ريال
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CHARTS TAB ───────────────────────────── */}
          {activeTab === 'charts' && (
            <div className="p-5 space-y-8">
              {/* Monthly Comparison */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4">مقارنة الإيرادات والمصروفات (آخر 6 أشهر)</h3>
                {trendQ.isLoading ? (
                  <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} ر`} />
                      <Legend />
                      <Bar dataKey="إيرادات" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Net profit trend */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4">صافي الربح الشهري</h3>
                {trendQ.isLoading ? (
                  <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={comparisonData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} ر`} />
                      <Line type="monotone" dataKey="صافي" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Expenses by category */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-4">توزيع المصروفات بالتصنيف</h3>
                  {expensePieData.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">لا توجد بيانات كافية</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={85} dataKey="value"
                          label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {expensePieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} ر`} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Category list */}
                <div>
                  <h3 className="text-base font-semibold text-gray-800 mb-4">أعلى المصروفات</h3>
                  <div className="space-y-3">
                    {expensePieData.slice(0, 6).map((item, i) => {
                      const pct = totalExpenses > 0 ? (item.value / totalExpenses * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-sm text-gray-700 flex-1 truncate">{item.name}</span>
                          <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {formatAmount(item.value)} ر
                          </span>
                          <span className="text-xs text-gray-400 w-10 text-left">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                    {expensePieData.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">لا توجد بيانات</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <RecordModal
            record={modal.record}
            onClose={() => setModal({ open: false })}
            onSaved={() => { setModal({ open: false }); showToast(modal.record ? 'تم التعديل بنجاح' : 'تم إضافة القيد بنجاح'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
