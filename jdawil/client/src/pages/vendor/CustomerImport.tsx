import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  Upload, FileSpreadsheet, ChevronLeft, CheckCircle,
  AlertTriangle, Users, ArrowRight, X, Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  preview: Record<string, string>[];
}

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; name: string; reason: string }>;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'الاسم', phone: 'الجوال', vehicleType: 'نوع السيارة',
  vehiclePlate: 'اللوحة', vehicleColor: 'اللون', vehicleModel: 'الموديل', notes: 'ملاحظات',
};

export default function CustomerImport() {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [csvText, setCsvText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parseMutation = useMutation({
    mutationFn: (text: string) => api.post('/customer-import/parse-csv', { csvText: text }).then(r => r.data),
    onSuccess: (data: ParsedData) => {
      setParsedData(data);
      setStep('preview');
    },
    onError: () => toast.error('فشل في قراءة الملف'),
  });

  const importMutation = useMutation({
    mutationFn: (customers: Record<string, string>[]) =>
      api.post('/customer-import/bulk', { customers }).then(r => r.data),
    onSuccess: (data: ImportResult) => {
      setResult(data);
      setStep('result');
      if (data.imported > 0) toast.success(`تم استيراد ${data.imported} عميل بنجاح!`);
    },
    onError: () => toast.error('فشل في الاستيراد'),
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseMutation.mutate(text);
    };
    reader.readAsText(file);
  }

  function handlePaste() {
    if (!csvText.trim()) return toast.error('الصق بيانات العملاء أولاً');
    parseMutation.mutate(csvText);
  }

  const sampleCsv = 'الاسم,الجوال,نوع السيارة,اللوحة,اللون\nأحمد محمد,0501234567,كامري,ABC 1234,أبيض\nسعد العتيبي,0559876543,أكورد,XYZ 5678,أسود';

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/vendor/crm" className="btn-icon"><ChevronLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" />
              استيراد العملاء
            </h1>
            <p className="text-xs text-slate-500">انقل عملاءك من Excel أو CSV للمنصة</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">

              {/* File upload */}
              <div className="card-glass p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  رفع ملف CSV أو Excel
                </h3>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-white/[0.1] hover:border-blue-500/40 rounded-2xl p-10 text-center transition-all group"
                >
                  <Upload className="w-10 h-10 text-slate-500 group-hover:text-blue-400 mx-auto mb-3 transition-colors" />
                  <p className="text-white font-bold">اضغط لرفع الملف</p>
                  <p className="text-slate-500 text-sm mt-1">CSV, TXT — الحد الأقصى 500 عميل</p>
                </button>
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFileUpload} className="hidden" />
              </div>

              {/* Or paste */}
              <div className="card-glass p-6">
                <h3 className="font-bold text-white mb-4">أو الصق البيانات مباشرة</h3>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={sampleCsv}
                  className="input-field h-40 font-mono text-xs resize-none"
                  dir="ltr"
                />
                <div className="flex justify-between items-center mt-3">
                  <button onClick={() => { setCsvText(sampleCsv); toast.success('تم نسخ المثال'); }} className="btn-ghost text-xs">
                    <Download className="w-3 h-3 inline ml-1" />
                    استخدم المثال
                  </button>
                  <button
                    onClick={handlePaste}
                    disabled={!csvText.trim() || parseMutation.isPending}
                    className="btn-primary text-sm px-6 py-2"
                  >
                    {parseMutation.isPending ? 'جاري القراءة...' : 'تحليل البيانات'}
                  </button>
                </div>
              </div>

              {/* Format guide */}
              <div className="card-glass p-5">
                <h4 className="font-bold text-white text-sm mb-3">صيغة الملف المطلوبة</h4>
                <p className="text-slate-400 text-xs leading-relaxed mb-3">
                  الصف الأول يجب أن يحتوي أسماء الأعمدة. الأعمدة المطلوبة: <span className="text-blue-400">الاسم</span> و<span className="text-blue-400">الجوال</span>. الأعمدة الاختيارية: نوع السيارة، اللوحة، اللون، الموديل، ملاحظات.
                </p>
                <div className="bg-surface-1 rounded-xl p-3 font-mono text-xs text-slate-400 overflow-x-auto" dir="ltr">
                  الاسم,الجوال,نوع السيارة,اللوحة,اللون<br/>
                  أحمد محمد,0501234567,كامري,ABC 1234,أبيض
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && parsedData && (
            <motion.div key="preview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              <div className="card-glass p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    معاينة البيانات ({parsedData.totalRows} عميل)
                  </h3>
                  <button onClick={() => setStep('upload')} className="btn-ghost text-xs">
                    <ArrowRight className="w-3 h-3 inline ml-1" />
                    رجوع
                  </button>
                </div>

                {/* Preview table */}
                <div className="overflow-x-auto">
                  <table className="modern-table w-full">
                    <thead>
                      <tr>
                        <th>#</th>
                        {parsedData.headers.map(h => (
                          <th key={h}>{FIELD_LABELS[h] ?? h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.preview.map((row, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          {parsedData.headers.map(h => (
                            <td key={h}>{row[h] ?? '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.totalRows > 5 && (
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    يظهر أول 5 صفوف من أصل {parsedData.totalRows}
                  </p>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => importMutation.mutate(parsedData.rows)}
                disabled={importMutation.isPending}
                className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
              >
                {importMutation.isPending ? (
                  <>جاري الاستيراد...</>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    استيراد {parsedData.totalRows} عميل
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="card-glass p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 ${
                    result.imported > 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'
                  }`}
                >
                  {result.imported > 0 ? (
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-10 h-10 text-amber-400" />
                  )}
                </motion.div>

                <h2 className="text-2xl font-black text-white mb-2">
                  {result.imported > 0 ? 'تم الاستيراد بنجاح!' : 'لم يتم استيراد أي عميل'}
                </h2>

                <div className="flex justify-center gap-6 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-400">{result.imported}</p>
                    <p className="text-xs text-slate-500">تم استيرادهم</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-amber-400">{result.skipped}</p>
                    <p className="text-xs text-slate-500">تم تخطيهم</p>
                  </div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="card-glass p-5">
                  <h4 className="font-bold text-white text-sm mb-3">تفاصيل التخطي</h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {result.errors.map((err, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-white/[0.02]">
                        <span className="text-slate-500">صف {err.row}</span>
                        <span className="text-white font-bold">{err.name}</span>
                        <span className="text-amber-400 mr-auto">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setStep('upload'); setResult(null); setParsedData(null); setCsvText(''); }} className="btn-outline flex-1">
                  استيراد آخر
                </button>
                <Link to="/vendor/crm" className="btn-primary flex-1 text-center">
                  عرض العملاء
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
