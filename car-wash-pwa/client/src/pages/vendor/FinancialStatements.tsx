import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Download, TrendingUp, TrendingDown, DollarSign, Receipt,
  AlertTriangle, Building2, Edit3, Save, X, Landmark, CreditCard, Hash,
  MapPin, User, Briefcase, ArrowUpRight, ArrowDownRight, Wallet, PieChart, Printer,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const fmt = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FinancialStatements() {
  const [tab, setTab] = useState<'income' | 'balance' | 'cashflow'>('income');
  const [from, setFrom] = useState(() => { const d = new Date(); d.setMonth(0, 1); return d.toISOString().split('T')[0]; });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityForm, setIdentityForm] = useState<Record<string, string>>({});
  const qc = useQueryClient();

  const period = `from=${from}&to=${to}`;

  const { data: summary } = useQuery({
    queryKey: ['fin-summary', from, to],
    queryFn: () => api.get(`/financial-statements/summary?${period}`).then(r => r.data),
  });

  const { data: incomeData } = useQuery({
    queryKey: ['fin-income', from, to],
    queryFn: () => api.get(`/financial-statements/income-statement?${period}`).then(r => r.data),
    enabled: tab === 'income',
  });

  const { data: balanceData } = useQuery({
    queryKey: ['fin-balance'],
    queryFn: () => api.get('/financial-statements/balance-sheet').then(r => r.data),
    enabled: tab === 'balance',
  });

  const { data: cashflowData } = useQuery({
    queryKey: ['fin-cashflow', from, to],
    queryFn: () => api.get(`/financial-statements/cash-flow?${period}`).then(r => r.data),
    enabled: tab === 'cashflow',
  });

  const identity = summary?.vendorIdentity ?? incomeData?.vendorIdentity ?? balanceData?.vendorIdentity;
  const identityComplete = identity?.crNumber && identity?.vatNumber;

  const updateIdentity = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/financial-statements/vendor-identity', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fin-summary'] });
      qc.invalidateQueries({ queryKey: ['fin-income'] });
      setEditingIdentity(false);
      toast.success('تم تحديث الهوية التجارية');
    },
    onError: () => toast.error('خطأ في التحديث'),
  });

  function startEditIdentity() {
    setIdentityForm({
      crNumber: identity?.crNumber ?? '', vatNumber: identity?.vatNumber ?? '',
      nationalAddress: identity?.nationalAddress ?? '', bankName: identity?.bankName ?? '',
      bankIban: identity?.bankIban ?? '', ownerName: identity?.ownerName ?? '',
      businessType: identity?.businessType ?? '', maroofNumber: identity?.maroofNumber ?? '',
    });
    setEditingIdentity(true);
  }

  async function handleExport(type: string) {
    try {
      const res = await api.get(`/financial-statements/export/${type}?${period}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${new Date().toLocaleDateString('ar-SA')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم التحميل');
    } catch { toast.error('خطأ في التصدير'); }
  }

  // Professional multi-sheet export (P&L + monthly + cashflow + YoY).
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);
  const [proExporting, setProExporting] = useState(false);

  function toggleYear(y: number) {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y].sort((a, b) => b - a),
    );
  }

  async function handleProExport() {
    if (selectedYears.length === 0) {
      toast.error('اختر سنة واحدة على الأقل');
      return;
    }
    setProExporting(true);
    try {
      const res = await api.get(
        `/financial-statements/export-professional?years=${selectedYears.join(',')}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `القوائم-المالية-${selectedYears.join('-')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('تم تحميل القوائم المالية الكاملة');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'تعذّر التصدير');
    } finally {
      setProExporting(false);
    }
  }

  const TABS = [
    { id: 'income' as const, label: 'قائمة الدخل', icon: TrendingUp },
    { id: 'balance' as const, label: 'المركز المالي', icon: PieChart },
    { id: 'cashflow' as const, label: 'التدفقات النقدية', icon: Wallet },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-surface-1 text-white p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><FileText size={28} /> القوائم المالية</h1>
          <p className="text-slate-400 mt-1">تقارير مالية احترافية بهوية متجرك — جاهزة للتصدير</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <span className="text-slate-500">—</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors no-print">
            <Printer size={16} /> طباعة
          </button>
          <div className="relative group">
            <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <Download size={16} /> تصدير Excel
            </button>
            <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl hidden group-hover:block z-10 min-w-[200px]">
              {[
                { type: 'income-statement', label: 'قائمة الدخل' },
                { type: 'balance-sheet', label: 'المركز المالي' },
                { type: 'cash-flow', label: 'التدفقات النقدية' },
              ].map(opt => (
                <button key={opt.type} onClick={() => handleExport(opt.type)}
                  className="w-full text-right px-4 py-2.5 hover:bg-slate-700 transition-colors text-sm first:rounded-t-lg last:rounded-b-lg">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Professional Financial Statements export (Pro) ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-900/20 via-slate-900/40 to-transparent p-5"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-white">القوائم المالية الكاملة — ملف Excel واحد</p>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              قائمة الدخل السنوية + التفصيل الشهري + تحليل المصروفات حسب الفئة +
              التدفقات النقدية + المقارنة السنوية — كلها ورقة ورقة في ملف واحد.
            </p>

            {/* Year chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              {availableYears.map((y) => {
                const active = selectedYears.includes(y);
                return (
                  <button
                    key={y}
                    onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {active ? '✓ ' : ''}{y}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              اختر سنة واحدة أو أكثر — لو اخترت أكثر من سنة، تنضاف ورقة "مقارنة سنوية" تلقائياً.
            </p>
          </div>
          <button
            onClick={handleProExport}
            disabled={proExporting || selectedYears.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-50 transition-colors shrink-0"
          >
            <Download size={14} />
            {proExporting ? 'جاري الإنشاء...' : 'تصدير القوائم الكاملة'}
          </button>
        </div>
      </motion.div>

      {/* Identity Warning */}
      {!identityComplete && identity && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle className="text-yellow-400 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-yellow-300 font-medium">أكمل بيانات الهوية التجارية</p>
            <p className="text-yellow-400/70 text-sm">عشان تطلع تقارير رسمية بسجلك التجاري ورقمك الضريبي</p>
          </div>
          <button onClick={startEditIdentity} className="bg-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors">أكمل الآن</button>
        </motion.div>
      )}

      {/* Vendor Identity Card */}
      {identity && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg flex items-center gap-2"><Building2 size={18} /> الهوية التجارية</h2>
            <button onClick={startEditIdentity} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"><Edit3 size={14} /> تعديل</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'اسم المنشأة', value: identity.nameAr },
              { label: 'السجل التجاري', value: identity.crNumber || '—' },
              { label: 'الرقم الضريبي', value: identity.vatNumber || '—' },
              { label: 'العنوان الوطني', value: identity.nationalAddress || '—' },
              { label: 'البنك', value: identity.bankName || '—' },
              { label: 'IBAN', value: identity.bankIban || '—' },
              { label: 'المالك', value: identity.ownerName || '—' },
              { label: 'نوع المنشأة', value: identity.businessType || '—' },
            ].map((f, i) => (
              <div key={i}>
                <p className="text-slate-500 text-xs">{f.label}</p>
                <p className="text-slate-200 font-medium truncate">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Summary */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'إجمالي الإيرادات', value: fmt(summary.totalRevenue), icon: TrendingUp, color: 'green', sub: summary.revenueChange > 0 ? `+${summary.revenueChange.toFixed(1)}%` : `${summary.revenueChange.toFixed(1)}%` },
            { label: 'إجمالي المصروفات', value: fmt(summary.totalExpenses), icon: TrendingDown, color: 'red' },
            { label: 'صافي الربح', value: fmt(summary.netProfit), icon: DollarSign, color: summary.netProfit >= 0 ? 'green' : 'red' },
            { label: 'ضريبة مستحقة', value: fmt(summary.vatOwed), icon: Receipt, color: 'yellow' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <stat.icon size={18} className={`text-${stat.color}-400 mb-2`} />
              <p className="text-xl font-bold">{stat.value} <span className="text-xs text-slate-500">ر.س</span></p>
              <p className="text-xs text-slate-400">{stat.label}</p>
              {stat.sub && (
                <span className={`text-xs ${summary.revenueChange >= 0 ? 'text-green-400' : 'text-red-400'} flex items-center gap-0.5 mt-1`}>
                  {summary.revenueChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {stat.sub} عن الفترة السابقة
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 whitespace-nowrap ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:text-white'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Income Statement ── */}
      {tab === 'income' && incomeData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Revenue */}
            <div className="bg-slate-800/50 border border-green-500/20 rounded-xl p-5">
              <h3 className="font-bold text-green-400 mb-4 flex items-center gap-2"><TrendingUp size={18} /> الإيرادات</h3>
              {Object.entries(incomeData.revenue.breakdown as Record<string, number>).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-300">{cat}</span>
                  <span className="font-medium">{fmt(amt)} ر.س</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-bold text-green-400">
                <span>إجمالي الإيرادات</span>
                <span>{fmt(incomeData.revenue.total)} ر.س</span>
              </div>
            </div>

            {/* Expenses */}
            <div className="bg-slate-800/50 border border-red-500/20 rounded-xl p-5">
              <h3 className="font-bold text-red-400 mb-4 flex items-center gap-2"><TrendingDown size={18} /> المصروفات</h3>
              {Object.entries(incomeData.expenses.breakdown as Record<string, number>).map(([cat, amt]) => (
                <div key={cat} className="flex justify-between py-2 border-b border-slate-700/30">
                  <span className="text-slate-300">{cat}</span>
                  <span className="font-medium">{fmt(amt)} ر.س</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 font-bold text-red-400">
                <span>إجمالي المصروفات</span>
                <span>{fmt(incomeData.expenses.total)} ر.س</span>
              </div>
            </div>
          </div>

          {/* Net Profit */}
          <div className={`bg-slate-800/50 border ${incomeData.netProfit >= 0 ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl p-6 text-center`}>
            <p className="text-slate-400 mb-1">صافي الربح</p>
            <p className={`text-4xl font-bold ${incomeData.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(incomeData.netProfit)} <span className="text-lg">ر.س</span>
            </p>
            <p className="text-slate-500 text-sm mt-2">هامش الربح: {incomeData.profitMargin.toFixed(1)}% | ضريبة مستحقة: {fmt(incomeData.vatCollected)} ر.س</p>
          </div>
        </div>
      )}

      {/* ── Balance Sheet ── */}
      {tab === 'balance' && balanceData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 border border-blue-500/20 rounded-xl p-5">
            <h3 className="font-bold text-blue-400 mb-4">الأصول</h3>
            {[
              { label: 'نقدية', value: balanceData.assets.cash },
              { label: 'ذمم مدينة', value: balanceData.assets.receivables },
              { label: 'مخزون', value: balanceData.assets.inventory },
            ].map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-700/30">
                <span className="text-slate-300">{item.label}</span>
                <span>{fmt(item.value)} ر.س</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold text-blue-400">
              <span>إجمالي الأصول</span><span>{fmt(balanceData.assets.total)} ر.س</span>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-orange-500/20 rounded-xl p-5">
            <h3 className="font-bold text-orange-400 mb-4">الالتزامات</h3>
            {[
              { label: 'رواتب مستحقة', value: balanceData.liabilities.unpaidPayroll },
              { label: 'ضريبة مستحقة', value: balanceData.liabilities.vatOwed },
            ].map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-slate-700/30">
                <span className="text-slate-300">{item.label}</span>
                <span>{fmt(item.value)} ر.س</span>
              </div>
            ))}
            <div className="flex justify-between pt-3 font-bold text-orange-400">
              <span>إجمالي الالتزامات</span><span>{fmt(balanceData.liabilities.total)} ر.س</span>
            </div>
          </div>

          <div className={`bg-slate-800/50 border ${balanceData.equity >= 0 ? 'border-green-500/20' : 'border-red-500/20'} rounded-xl p-5 flex flex-col justify-center items-center`}>
            <h3 className="font-bold text-slate-400 mb-2">حقوق الملكية</h3>
            <p className={`text-3xl font-bold ${balanceData.equity >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(balanceData.equity)} ر.س</p>
            <p className="text-xs text-slate-500 mt-2">الأصول - الالتزامات</p>
          </div>
        </div>
      )}

      {/* ── Cash Flow ── */}
      {tab === 'cashflow' && cashflowData && (
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-bold mb-4">التدفقات التشغيلية</h3>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-green-400">المقبوضات من العملاء</span><span className="text-green-400">+{fmt(cashflowData.operating.inflow)} ر.س</span></div>
              <div className="flex justify-between"><span className="text-red-400">المدفوعات (مصروفات + رواتب)</span><span className="text-red-400">-{fmt(cashflowData.operating.outflow)} ر.س</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-2 font-bold">
                <span>صافي التدفق التشغيلي</span>
                <span className={cashflowData.operating.net >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(cashflowData.operating.net)} ر.س</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="font-bold mb-4">التدفقات الاستثمارية</h3>
            <div className="flex justify-between"><span className="text-red-400">شراء معدات وصيانة</span><span className="text-red-400">-{fmt(cashflowData.investing.outflow)} ر.س</span></div>
          </div>

          <div className={`bg-slate-800/50 border ${cashflowData.netCashFlow >= 0 ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl p-6 text-center`}>
            <p className="text-slate-400 mb-1">صافي التدفق النقدي</p>
            <p className={`text-4xl font-bold ${cashflowData.netCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmt(cashflowData.netCashFlow)} <span className="text-lg">ر.س</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Edit Identity Modal ── */}
      {editingIdentity && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">الهوية التجارية</h2>
              <button onClick={() => setEditingIdentity(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'crNumber', label: 'رقم السجل التجاري', placeholder: '1010XXXXXX', icon: Hash },
                { key: 'vatNumber', label: 'الرقم الضريبي', placeholder: '300XXXXXXXXX', icon: Receipt },
                { key: 'nationalAddress', label: 'العنوان الوطني', placeholder: 'RJHI1234 - الرياض 12345', icon: MapPin },
                { key: 'bankName', label: 'اسم البنك', placeholder: 'بنك الراجحي', icon: Landmark },
                { key: 'bankIban', label: 'IBAN', placeholder: 'SA...', icon: CreditCard },
                { key: 'ownerName', label: 'اسم المالك / الممثل النظامي', placeholder: '', icon: User },
                { key: 'businessType', label: 'نوع المنشأة', placeholder: 'مؤسسة فردية', icon: Briefcase },
                { key: 'maroofNumber', label: 'رقم معروف', placeholder: '', icon: Hash },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm text-slate-400 mb-1 flex items-center gap-1"><f.icon size={14} /> {f.label}</label>
                  <input value={identityForm[f.key] ?? ''} onChange={e => setIdentityForm({ ...identityForm, [f.key]: e.target.value })}
                    placeholder={f.placeholder} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => updateIdentity.mutate(identityForm)} disabled={updateIdentity.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors">
                <Save size={16} /> {updateIdentity.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setEditingIdentity(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg transition-colors">إلغاء</button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
