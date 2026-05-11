import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  DollarSign,
  Calendar,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

async function downloadFile(url: string, filename: string) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('فشل التحميل');
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

interface Toast {
  msg: string;
  type: 'success' | 'error';
}

type StatusOption = { value: string; label: string };

const BOOKING_STATUSES: StatusOption[] = [
  { value: '', label: 'كل الحالات' },
  { value: 'pending', label: 'معلق' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'in_progress', label: 'جاري' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغي' },
];

function DateInput({
  label,
  value,
  onChange,
  max,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: string;
  min?: string;
}) {
  return (
    <div className="flex-1">
      <label className="block text-xs font-semibold text-white/50 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        max={max}
        min={min}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
        style={{ colorScheme: 'dark' }}
      />
    </div>
  );
}

function LastExportTime({ storageKey }: { storageKey: string }) {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;
  const date = new Date(raw);
  const label = date.toLocaleString('ar-SA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div className="flex items-center gap-1.5 text-white/30 text-xs">
      <Clock className="w-3 h-3" />
      آخر تصدير: {label}
    </div>
  );
}

export default function VendorExports() {
  useAuth();
  const [toast, setToast] = useState<Toast | null>(null);

  // Customers export state
  const [customersLoading, setCustomersLoading] = useState(false);

  // Financials export state
  const [finFrom, setFinFrom] = useState('');
  const [finTo, setFinTo] = useState('');
  const [finLoading, setFinLoading] = useState(false);

  // Bookings export state
  const [bookFrom, setBookFrom] = useState('');
  const [bookTo, setBookTo] = useState('');
  const [bookStatus, setBookStatus] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [, forceUpdate] = useState(0);

  const showToast = (msg: string, type: Toast['type'] = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveLastExport = (key: string) => {
    localStorage.setItem(key, new Date().toISOString());
    forceUpdate((n) => n + 1);
  };

  const handleCustomersExport = async () => {
    setCustomersLoading(true);
    try {
      await downloadFile('/api/exports/customers', 'customers.xlsx');
      saveLastExport('lastExport_customers');
      showToast('تم تصدير بيانات العملاء بنجاح');
    } catch {
      showToast('فشل تصدير بيانات العملاء', 'error');
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleFinancialsExport = async () => {
    setFinLoading(true);
    try {
      const params = new URLSearchParams();
      if (finFrom) params.set('from', finFrom);
      if (finTo) params.set('to', finTo);
      const url = `/api/exports/financials${params.toString() ? `?${params}` : ''}`;
      await downloadFile(url, 'financials.xlsx');
      saveLastExport('lastExport_financials');
      showToast('تم تصدير التقرير المالي بنجاح');
    } catch {
      showToast('فشل تصدير التقرير المالي', 'error');
    } finally {
      setFinLoading(false);
    }
  };

  const handleBookingsExport = async () => {
    setBookingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookFrom) params.set('from', bookFrom);
      if (bookTo) params.set('to', bookTo);
      if (bookStatus) params.set('status', bookStatus);
      const url = `/api/exports/bookings${params.toString() ? `?${params}` : ''}`;
      await downloadFile(url, 'bookings.xlsx');
      saveLastExport('lastExport_bookings');
      showToast('تم تصدير الحجوزات بنجاح');
    } catch {
      showToast('فشل تصدير الحجوزات', 'error');
    } finally {
      setBookingsLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, type: 'spring', stiffness: 260, damping: 22 },
    }),
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-emerald-600/7 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-blue-600/7 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 shadow-lg shadow-emerald-500/30">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">تصدير البيانات</h1>
            <p className="text-white/40 text-sm">تحميل تقاريرك بصيغة Excel</p>
          </div>
        </motion.div>

        <div className="space-y-5">
          {/* Card 1: Customers */}
          <motion.div
            custom={0}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/30">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">تصدير العملاء</h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      قائمة عملائك مع بيانات السيارات وعدد الحجوزات
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <FileSpreadsheet className="w-3 h-3" />
                  .xlsx
                </div>
              </div>

              <div className="flex items-center justify-between">
                <LastExportTime storageKey="lastExport_customers" />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCustomersExport}
                  disabled={customersLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {customersLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      تحميل
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Financials */}
          <motion.div
            custom={1}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">تصدير المالية</h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      التقرير المالي التفصيلي حسب الفترة
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <FileSpreadsheet className="w-3 h-3" />
                  .xlsx
                </div>
              </div>

              {/* Date Range */}
              <div className="flex gap-3 mb-4">
                <DateInput
                  label="من تاريخ"
                  value={finFrom}
                  onChange={setFinFrom}
                  max={finTo || today}
                />
                <DateInput
                  label="إلى تاريخ"
                  value={finTo}
                  onChange={setFinTo}
                  min={finFrom}
                  max={today}
                />
              </div>

              <div className="flex items-center justify-between">
                <LastExportTime storageKey="lastExport_financials" />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleFinancialsExport}
                  disabled={finLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-bold shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-orange-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {finLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      تحميل
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Bookings */}
          <motion.div
            custom={2}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/30">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">تصدير الحجوزات</h3>
                    <p className="text-white/40 text-xs mt-0.5">
                      سجل الحجوزات مفصّلاً بالخدمات والعملاء
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <FileSpreadsheet className="w-3 h-3" />
                  .xlsx
                </div>
              </div>

              {/* Date Range */}
              <div className="flex gap-3 mb-3">
                <DateInput
                  label="من تاريخ"
                  value={bookFrom}
                  onChange={setBookFrom}
                  max={bookTo || today}
                />
                <DateInput
                  label="إلى تاريخ"
                  value={bookTo}
                  onChange={setBookTo}
                  min={bookFrom}
                  max={today}
                />
              </div>

              {/* Status Filter */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-white/50 mb-1">
                  تصفية بالحالة
                </label>
                <div className="relative">
                  <select
                    value={bookStatus}
                    onChange={(e) => setBookStatus(e.target.value)}
                    className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                    style={{ direction: 'rtl' }}
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s.value} value={s.value} className="bg-[#1a1a2e]">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <LastExportTime storageKey="lastExport_bookings" />
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleBookingsExport}
                  disabled={bookingsLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-bold shadow-lg shadow-blue-500/30 hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {bookingsLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري التحميل...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      تحميل
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
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
