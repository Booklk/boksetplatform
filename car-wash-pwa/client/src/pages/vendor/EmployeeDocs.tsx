import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FileText, Upload, AlertCircle, Trash2, X, Calendar } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

type Category = 'contract' | 'id' | 'iqama' | 'health_card' | 'training_cert' | 'bank_iban' | 'other';

interface DocRow {
  id: number;
  employeeId: number;
  employeeName: string | null;
  category: Category;
  title: string;
  fileUrl: string;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface Employee {
  id: number;
  name: string;
}

const CATEGORY_LABEL: Record<Category, string> = {
  contract: 'عقد عمل',
  id: 'هوية',
  iqama: 'إقامة',
  health_card: 'بطاقة صحية',
  training_cert: 'شهادة تدريب',
  bank_iban: 'IBAN بنكي',
  other: 'أخرى',
};

export default function VendorEmployeeDocs() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState<number | ''>('');

  const { data: docs = [] } = useQuery<DocRow[]>({
    queryKey: ['employee-docs', filterEmployee],
    queryFn: async () => (await api.get(`/employee-docs${filterEmployee ? `?employeeId=${filterEmployee}` : ''}`)).data,
  });

  const { data: expiring = [] } = useQuery<DocRow[]>({
    queryKey: ['employee-docs-expiring'],
    queryFn: async () => (await api.get('/employee-docs/expiring')).data,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-flat'],
    queryFn: async () => {
      const r = await api.get('/employees');
      return Array.isArray(r.data) ? r.data : r.data.employees ?? [];
    },
  });

  const removeDoc = useMutation({
    mutationFn: async (id: number) => api.delete(`/employee-docs/${id}`),
    onSuccess: () => {
      toast.success('تم الحذف');
      qc.invalidateQueries({ queryKey: ['employee-docs'] });
      qc.invalidateQueries({ queryKey: ['employee-docs-expiring'] });
    },
  });

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            وثائق الموظفين
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            عقود + هويات + شهادات + IBAN — مرتّبة لكل موظف
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold px-4 py-2 rounded-xl"
        >
          <Upload className="w-4 h-4" /> رفع وثيقة
        </button>
      </div>

      {/* Expiring alert */}
      {expiring.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-300" />
            <p className="text-amber-200 font-bold text-sm">{expiring.length} وثيقة تحتاج تجديد قريباً</p>
          </div>
          <ul className="text-xs text-amber-100/80 space-y-1">
            {expiring.slice(0, 5).map((d) => (
              <li key={d.id}>
                • {d.employeeName ?? 'موظف'} — {d.title}
                {d.expiresAt && (
                  <span className="text-slate-400 mr-2">
                    تنتهي: {new Date(d.expiresAt).toLocaleDateString('ar-SA')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value ? Number(e.target.value) : '')}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
        >
          <option value="">كل الموظفين</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-bold text-slate-300">لا توجد وثائق بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <motion.div
              key={d.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-300">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold text-sm">{d.title}</p>
                    <span className="text-[10px] font-bold border border-white/10 rounded-full px-2 py-0.5 text-slate-300">
                      {CATEGORY_LABEL[d.category]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">{d.employeeName ?? 'موظف'}</p>
                  {d.expiresAt && (
                    <p className="text-amber-300 text-[11px] mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      تنتهي: {new Date(d.expiresAt).toLocaleDateString('ar-SA')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-300 hover:text-blue-200 font-bold px-2 py-1 rounded-lg"
                >
                  فتح
                </a>
                <button
                  onClick={() => confirm('حذف الوثيقة؟') && removeDoc.mutate(d.id)}
                  className="text-rose-300 hover:text-rose-200 px-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showNew && (
        <NewDocModal
          employees={employees}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['employee-docs'] });
            qc.invalidateQueries({ queryKey: ['employee-docs-expiring'] });
          }}
        />
      )}
    </div>
  );
}

function NewDocModal({ employees, onClose, onCreated }: { employees: Employee[]; onClose: () => void; onCreated: () => void }) {
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [category, setCategory] = useState<Category>('contract');
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const submit = useMutation({
    mutationFn: async () =>
      (await api.post('/employee-docs', {
        employeeId: Number(employeeId),
        category,
        title: title.trim(),
        fileUrl: fileUrl.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
      })).data,
    onSuccess: () => {
      toast.success('تم رفع الوثيقة');
      onCreated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الرفع'),
  });

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0d1929] border border-white/10 rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">رفع وثيقة موظف</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <label className="block text-xs text-slate-400 mb-1.5">الموظف</label>
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3">
          <option value="">اختر موظف</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>

        <label className="block text-xs text-slate-400 mb-1.5">نوع الوثيقة</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>

        <label className="block text-xs text-slate-400 mb-1.5">عنوان</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عقد عمل أبو فهد" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3" />

        <label className="block text-xs text-slate-400 mb-1.5">رابط الملف (URL)</label>
        <input type="url" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." dir="ltr" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-1" />
        <p className="text-[11px] text-slate-500 mb-3">ارفع ملف عبر "رفع الملفات" ثم انسخ الرابط هنا.</p>

        <label className="block text-xs text-slate-400 mb-1.5">تاريخ الانتهاء (اختياري)</label>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3" />

        <label className="block text-xs text-slate-400 mb-1.5">ملاحظات (اختياري)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm h-16 resize-none mb-4" />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5">إلغاء</button>
          <button
            onClick={() => employeeId && title && fileUrl && submit.mutate()}
            disabled={!employeeId || !title || !fileUrl || submit.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold disabled:opacity-50"
          >
            {submit.isPending ? '...' : 'رفع'}
          </button>
        </div>
      </div>
    </div>
  );
}
