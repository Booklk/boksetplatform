import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, TrendingUp, TrendingDown, DollarSign, Wrench, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { Financial, FinancialSummary, Employee } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

type FinancialType = 'income' | 'expense' | 'salary' | 'maintenance';

const TYPE_CONFIG: Record<FinancialType, { label: string; icon: any; color: string; bg: string }> = {
  income: { label: 'دخل', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
  expense: { label: 'مصروفات', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
  salary: { label: 'رواتب', icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  maintenance: { label: 'صيانة', icon: Wrench, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

export default function AdminFinancials() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<FinancialType | ''>('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    type: 'expense' as FinancialType,
    category: '',
    amount: '',
    description: '',
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
  });

  const { data: summary } = useQuery<FinancialSummary>({
    queryKey: ['financial-summary'],
    queryFn: () => api.get('/financials/summary').then(r => r.data),
  });

  const { data: records = [], isLoading } = useQuery<Financial[]>({
    queryKey: ['financials', typeFilter],
    queryFn: () => api.get(`/financials${typeFilter ? `?type=${typeFilter}` : ''}`).then(r => r.data),
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data),
  });

  const { mutate: createRecord, isPending: creating } = useMutation({
    mutationFn: () => api.post('/financials', {
      ...form,
      employeeId: form.employeeId ? Number(form.employeeId) : undefined,
    }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('تم إضافة السجل');
      setShowAdd(false);
      setForm({ type: 'expense', category: '', amount: '', description: '', employeeId: '', date: new Date().toISOString().split('T')[0] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  const { mutate: deleteRecord } = useMutation({
    mutationFn: (id: number) => api.delete(`/financials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financials'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('تم الحذف');
    },
  });

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">الإدارة المالية</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-2.5 flex items-center gap-2">
          <Plus size={16} /> إضافة سجل
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.keys(TYPE_CONFIG) as FinancialType[]).map(type => {
            const cfg = TYPE_CONFIG[type];
            const Icon = cfg.icon;
            return (
              <div key={type} className={`card ${cfg.bg}`}>
                <Icon size={20} className={`${cfg.color} mb-3`} />
                <p className={`text-2xl font-black ${cfg.color}`}>
                  {formatCurrency(summary[type] ?? 0)}
                </p>
                <p className="text-xs text-slate-400 mt-1">{cfg.label}</p>
              </div>
            );
          })}
          <div className="col-span-2 lg:col-span-4 card bg-gradient-to-l from-brand-900/40 to-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">صافي الربح</p>
                <p className={`text-3xl font-black ${summary.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(summary.net)}
                </p>
              </div>
              <div className="text-5xl opacity-20">{summary.net >= 0 ? '📈' : '📉'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Add Record */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="card border-brand-600/40">
            <h3 className="font-black text-white mb-4">إضافة سجل مالي</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">النوع *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(TYPE_CONFIG) as FinancialType[]).map(t => {
                    const cfg = TYPE_CONFIG[t];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-bold transition-colors border ${
                          form.type === t ? `${cfg.bg} ${cfg.color} border-current` : 'bg-slate-700 text-slate-400 border-slate-600'
                        }`}
                      >
                        <Icon size={16} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">الوصف *</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" placeholder="وصف السجل..." />
              </div>
              <div>
                <label className="label">المبلغ (ريال) *</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input-field" placeholder="0" />
              </div>
              <div>
                <label className="label">التاريخ</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label">التصنيف</label>
                <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field" placeholder="مثال: مواد تنظيف" />
              </div>
              {form.type === 'salary' && (
                <div>
                  <label className="label">الموظف</label>
                  <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className="input-field">
                    <option value="">اختر موظف...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="btn-outline flex-1 text-sm">إلغاء</button>
              <button
                onClick={() => createRecord()}
                disabled={creating || !form.description || !form.amount}
                className="btn-primary flex-1 text-sm"
              >
                {creating ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setTypeFilter('')}
          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${typeFilter === '' ? 'bg-brand-700 text-white' : 'bg-slate-800 text-slate-400'}`}
        >
          الكل
        </button>
        {(Object.entries(TYPE_CONFIG) as [FinancialType, any][]).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${typeFilter === type ? `${cfg.bg} ${cfg.color}` : 'bg-slate-800 text-slate-400'}`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card animate-pulse h-14" />)}</div>
      ) : (
        <div className="space-y-2">
          {records.map((record, i) => {
            const cfg = TYPE_CONFIG[record.type];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`card py-3 ${cfg.bg}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                      <Icon size={15} className={cfg.color} />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">{record.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>{formatDate(record.date)}</span>
                        {record.category && <span>· {record.category}</span>}
                        {record.employeeName && <span>· {record.employeeName}</span>}
                        {record.referenceId && <span>· حجز #{record.referenceId}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-black ${cfg.color}`}>{formatCurrency(record.amount)}</span>
                    {record.referenceType === 'manual' && (
                      <button
                        onClick={() => { if (confirm('هل تريد حذف هذا السجل؟')) deleteRecord(record.id); }}
                        className="p-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-red-400 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {records.length === 0 && (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">💰</div>
              <p>لا توجد سجلات مالية</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
