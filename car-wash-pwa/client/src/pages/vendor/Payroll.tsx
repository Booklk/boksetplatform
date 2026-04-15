import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Calculator,
  ChevronDown,
  X,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Edit2,
  CreditCard,
  AlertCircle,
  Award,
  Plus,
  Zap,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// ─── Constants ────────────────────────────────────────────────────────────────

const API = '/api/payroll';

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface EmployeeConfig {
  id: number;
  name: string;
  phone: string;
  isActive: boolean;
  baseSalary: number | null;
  commissionRate: number | null;
  configId: number | null;
}

interface PayrollRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  employeePhone: string;
  month: number;
  year: number;
  baseSalary: number;
  commissionAmount: number;
  bonusAmount: number;
  deductions: number;
  totalAmount: number;
  bookingsCount: number;
  revenueGenerated: number;
  notes: string | null;
  status: 'pending' | 'paid';
  paidAt: string | null;
}

interface CalculateResult {
  success: boolean;
  processed: number;
  results: Array<{ employeeId: number; employeeName: string; totalAmount: number }>;
}

interface SalaryConfigForm {
  baseSalary: string;
  commissionRate: string;
}

interface AdjustForm {
  bonusAmount: string;
  deductions: string;
  notes: string;
}

interface BonusRule {
  id: number;
  vendorId: number;
  name: string;
  conditionType: string;
  threshold: string;
  bonusAmount: string;
  period: string;
  isActive: boolean;
  createdAt: string | null;
}

interface BonusRuleForm {
  name: string;
  conditionType: string;
  threshold: string;
  bonusAmount: string;
  period: string;
}

interface AutoBonusResult {
  totalBonusEarned: number;
  rulesTriggered: Array<{ ruleName: string; bonusAmount: number }>;
}

const CONDITION_LABELS: Record<string, string> = {
  jobs_per_day: 'عدد الغسلات في اليوم',
  rating_avg: 'متوسط التقييم',
  revenue_target: 'الإيراد المستهدف (ر.س)',
  no_cancellation_week: 'أسبوع بدون إلغاء',
  top_performer: 'الموظف الأفضل أداءً',
};

const PERIOD_LABELS: Record<string, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((message: string, type: ToastMsg['type'] = 'info') => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

function Overlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'pending' | 'paid' }) {
  return status === 'paid' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
      <CheckCircle className="w-3 h-3" /> مدفوع
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
      <Clock className="w-3 h-3" /> معلق
    </span>
  );
}

// ─── Format currency ──────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

// ─── Salary Config Modal ──────────────────────────────────────────────────────

interface ConfigModalProps {
  employee: EmployeeConfig;
  onClose: () => void;
  onSave: (employeeId: number, form: SalaryConfigForm) => void;
  isSaving: boolean;
}

function SalaryConfigModal({ employee, onClose, onSave, isSaving }: ConfigModalProps) {
  const [form, setForm] = useState<SalaryConfigForm>({
    baseSalary: employee.baseSalary != null ? String(employee.baseSalary) : '',
    commissionRate: employee.commissionRate != null ? String(employee.commissionRate) : '',
  });

  return (
    <>
      <Overlay onClose={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">إعداد الراتب</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 bg-white/5 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
              {employee.name[0]}
            </div>
            <div>
              <p className="font-semibold text-sm text-white">{employee.name}</p>
              <p className="text-xs text-slate-400">{employee.phone}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                الراتب الأساسي (ريال)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.baseSalary}
                onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))}
                placeholder="مثال: 3000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                نسبة العمولة (%) — اختياري
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.commissionRate}
                onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                placeholder="مثال: 5"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => onSave(employee.id, form)}
              disabled={isSaving || !form.baseSalary}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {isSaving ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl py-2.5 text-sm font-medium transition-colors border border-white/10"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Adjust Bonus/Deductions Modal ────────────────────────────────────────────

interface AdjustModalProps {
  record: PayrollRecord;
  onClose: () => void;
  onSave: (id: number, form: AdjustForm) => void;
  isSaving: boolean;
}

function AdjustModal({ record, onClose, onSave, isSaving }: AdjustModalProps) {
  const [form, setForm] = useState<AdjustForm>({
    bonusAmount: String(record.bonusAmount ?? 0),
    deductions: String(record.deductions ?? 0),
    notes: record.notes ?? '',
  });

  return (
    <>
      <Overlay onClose={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white">تعديل المكافأة والخصومات</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-4 bg-white/5 rounded-xl p-3">
            <p className="font-semibold text-sm text-white">{record.employeeName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {MONTH_NAMES[record.month - 1]} {record.year}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                المكافأة (ريال)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.bonusAmount}
                onChange={e => setForm(f => ({ ...f, bonusAmount: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                الخصومات (ريال)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.deductions}
                onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                ملاحظات
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظة اختيارية..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => onSave(record.id, form)}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl py-2.5 text-sm font-medium transition-colors border border-white/10"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Bonus Rule Modal ─────────────────────────────────────────────────────────

interface BonusRuleModalProps {
  onClose: () => void;
  onSave: (form: BonusRuleForm) => void;
  isSaving: boolean;
}

function BonusRuleModal({ onClose, onSave, isSaving }: BonusRuleModalProps) {
  const [form, setForm] = useState<BonusRuleForm>({
    name: '',
    conditionType: 'jobs_per_day',
    threshold: '',
    bonusAmount: '',
    period: 'monthly',
  });

  return (
    <>
      <Overlay onClose={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-bold text-white">إضافة قاعدة مكافأة</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">اسم القاعدة</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: مكافأة 8 غسلات يومياً"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">نوع الشرط</label>
              <select
                value={form.conditionType}
                onChange={e => setForm(f => ({ ...f, conditionType: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#0b1120]">{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">الحد الأدنى للشرط</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.threshold}
                onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                placeholder={form.conditionType === 'rating_avg' ? 'مثال: 4.8' : form.conditionType === 'revenue_target' ? 'مثال: 1000' : 'مثال: 8'}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">مبلغ المكافأة (ر.س)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.bonusAmount}
                onChange={e => setForm(f => ({ ...f, bonusAmount: e.target.value }))}
                placeholder="مثال: 75"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">الفترة</label>
              <select
                value={form.period}
                onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="daily" className="bg-[#0b1120]">يومي</option>
                <option value="weekly" className="bg-[#0b1120]">أسبوعي</option>
                <option value="monthly" className="bg-[#0b1120]">شهري</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => onSave(form)}
              disabled={isSaving || !form.name || !form.threshold || !form.bonusAmount}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {isSaving ? 'جارٍ الحفظ...' : 'احفظ القاعدة'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl py-2.5 text-sm font-medium transition-colors border border-white/10"
            >
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Payroll() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toasts, addToast, removeToast } = useToast();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<'salary' | 'payroll' | 'bonus-rules'>('salary');

  const [configModalEmployee, setConfigModalEmployee] = useState<EmployeeConfig | null>(null);
  const [adjustModalRecord, setAdjustModalRecord] = useState<PayrollRecord | null>(null);
  const [showBonusRuleModal, setShowBonusRuleModal] = useState(false);

  const ax = useCallback(
    (method: string, url: string, data?: object) =>
      axios({
        method,
        url,
        data,
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.data),
    [token],
  );

  // ── Queries ────────────────────────────────────────────────────────────────

  const {
    data: configs = [],
    isLoading: configsLoading,
  } = useQuery<EmployeeConfig[]>({
    queryKey: ['payroll-configs'],
    queryFn: () => ax('get', `${API}/configs`),
    enabled: !!token,
  });

  const {
    data: records = [],
    isLoading: recordsLoading,
  } = useQuery<PayrollRecord[]>({
    queryKey: ['payroll-records', selectedMonth, selectedYear],
    queryFn: () => ax('get', `${API}?month=${selectedMonth}&year=${selectedYear}`),
    enabled: !!token,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const calculateMutation = useMutation<CalculateResult, Error, void>({
    mutationFn: () => ax('post', `${API}/calculate`, { month: selectedMonth, year: selectedYear }),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['payroll-records', selectedMonth, selectedYear] });
      addToast(`تمت معالجة رواتب ${data.processed} موظف بنجاح`, 'success');
    },
    onError: () => addToast('فشل في حساب الرواتب، حاول مجدداً', 'error'),
  });

  const saveConfigMutation = useMutation<unknown, Error, { employeeId: number; form: SalaryConfigForm }>({
    mutationFn: ({ employeeId, form }) =>
      ax('put', `${API}/configs/${employeeId}`, {
        baseSalary: form.baseSalary,
        commissionRate: form.commissionRate !== '' ? form.commissionRate : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-configs'] });
      setConfigModalEmployee(null);
      addToast('تم حفظ إعدادات الراتب', 'success');
    },
    onError: () => addToast('فشل في حفظ الإعدادات', 'error'),
  });

  const adjustMutation = useMutation<unknown, Error, { id: number; form: AdjustForm }>({
    mutationFn: ({ id, form }) =>
      ax('patch', `${API}/${id}`, {
        bonusAmount: Number(form.bonusAmount),
        deductions: Number(form.deductions),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-records', selectedMonth, selectedYear] });
      setAdjustModalRecord(null);
      addToast('تم تحديث السجل بنجاح', 'success');
    },
    onError: () => addToast('فشل في تحديث السجل', 'error'),
  });

  const payMutation = useMutation<unknown, Error, number>({
    mutationFn: (id: number) => ax('post', `${API}/${id}/pay`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-records', selectedMonth, selectedYear] });
      addToast('تم تسجيل الدفع بنجاح', 'success');
    },
    onError: () => addToast('فشل في تسجيل الدفع', 'error'),
  });

  // ── Bonus rules ────────────────────────────────────────────────────────────

  const { data: bonusRulesList = [], isLoading: bonusRulesLoading } = useQuery<BonusRule[]>({
    queryKey: ['bonus-rules'],
    queryFn: () => ax('get', `${API}/bonus-rules`),
    enabled: !!token,
  });

  const createBonusRuleMutation = useMutation<BonusRule, Error, BonusRuleForm>({
    mutationFn: (form) => ax('post', `${API}/bonus-rules`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonus-rules'] });
      setShowBonusRuleModal(false);
      addToast('تم إضافة قاعدة المكافأة', 'success');
    },
    onError: () => addToast('فشل في إضافة القاعدة', 'error'),
  });

  const toggleBonusRuleMutation = useMutation<BonusRule, Error, { id: number; isActive: boolean }>({
    mutationFn: ({ id, isActive }) => ax('put', `${API}/bonus-rules/${id}`, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonus-rules'] });
    },
    onError: () => addToast('فشل في تحديث القاعدة', 'error'),
  });

  const autoBonusMutation = useMutation<AutoBonusResult, Error, number>({
    mutationFn: (employeeId: number) => ax('post', `${API}/auto-bonus/${employeeId}`, {}),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payroll-records', selectedMonth, selectedYear] });
      if (data.rulesTriggered.length === 0) {
        addToast('لا توجد مكافآت مستحقة حالياً', 'info');
      } else {
        addToast(`تم احتساب ${data.rulesTriggered.length} مكافأة بإجمالي ${data.totalBonusEarned} ر.س`, 'success');
      }
    },
    onError: () => addToast('فشل في احتساب المكافآت', 'error'),
  });

  // ── Summary stats ──────────────────────────────────────────────────────────

  const totalPayroll = records.reduce((s, r) => s + r.totalAmount, 0);
  const paidCount = records.filter(r => r.status === 'paid').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-surface-1 text-white p-4 md:p-6">

      {/* ── Toast container ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium border ${
                t.type === 'success'
                  ? 'bg-green-900/90 border-green-500/40 text-green-200'
                  : t.type === 'error'
                  ? 'bg-red-900/90 border-red-500/40 text-red-200'
                  : 'bg-blue-900/90 border-blue-500/40 text-blue-200'
              }`}
            >
              {t.type === 'success' && <CheckCircle className="w-4 h-4 shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">كشف الرواتب</h1>
          <p className="text-slate-400 text-sm mt-1">إدارة رواتب الموظفين والعمولات</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Month selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1} className="bg-[#0b1120]">
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Year selector */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm pr-8 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {YEARS.map(y => (
                <option key={y} value={y} className="bg-[#0b1120]">
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Calculate button */}
          <button
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-900/30"
          >
            <Calculator className="w-4 h-4" />
            {calculateMutation.isPending ? 'جارٍ الحساب...' : 'احسب الرواتب'}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-6 w-fit">
        {[
          { key: 'salary' as const, label: 'إعدادات الرواتب', icon: TrendingUp },
          { key: 'payroll' as const, label: 'كشف الرواتب', icon: CreditCard },
          { key: 'bonus-rules' as const, label: 'قواعد المكافآت', icon: Award },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'إجمالي الرواتب', value: `${fmt(totalPayroll)} ر.س`, icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'عدد الموظفين', value: String(records.length), icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'مدفوع', value: String(paidCount), icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'معلق', value: String(pendingCount), icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map(stat => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-4"
          >
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Salary Configs section ── */}
      {activeTab === 'salary' && <section className="bg-white/5 border border-white/10 rounded-2xl mb-6 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">إعدادات رواتب الموظفين</h2>
          </div>
          <span className="text-xs text-slate-400">{configs.length} موظف</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-3 text-right font-medium text-slate-400">الموظف</th>
                <th className="px-5 py-3 text-right font-medium text-slate-400">الراتب الأساسي</th>
                <th className="px-5 py-3 text-right font-medium text-slate-400">نسبة العمولة</th>
                <th className="px-5 py-3 text-right font-medium text-slate-400">الحالة</th>
                <th className="px-5 py-3 text-right font-medium text-slate-400"></th>
              </tr>
            </thead>
            <tbody>
              {configsLoading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                : configs.length === 0
                ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                      لا يوجد موظفون مسجلون
                    </td>
                  </tr>
                )
                : configs.map(emp => (
                  <motion.tr
                    key={emp.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {emp.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-white">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {emp.baseSalary != null ? (
                        <span className="text-white font-medium">{fmt(emp.baseSalary)} ر.س</span>
                      ) : (
                        <span className="text-slate-500 text-xs">غير محدد</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {emp.commissionRate != null ? (
                        <span className="text-white">{emp.commissionRate}%</span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${emp.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                        {emp.isActive ? 'نشط' : 'متوقف'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setConfigModalEmployee(emp)}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> تعديل
                      </button>
                    </td>
                  </motion.tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </section>}

      {/* ── Payroll Records section ── */}
      {activeTab === 'payroll' && <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">
              كشف رواتب {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h2>
          </div>
          <span className="text-xs text-slate-400">{records.length} سجل</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-right font-medium text-slate-400">الموظف</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">الأساسي</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">العمولة</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">المكافأة</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">الخصومات</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">الإجمالي</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">الحجوزات</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">الحالة</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {recordsLoading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
                : records.length === 0
                ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                      <div className="flex flex-col items-center gap-2">
                        <Calculator className="w-8 h-8 opacity-30" />
                        <span>لا توجد سجلات رواتب لهذا الشهر</span>
                        <span className="text-xs text-slate-600">اضغط "احسب الرواتب" لإنشاء السجلات</span>
                      </div>
                    </td>
                  </tr>
                )
                : records.map(rec => (
                  <motion.tr
                    key={rec.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-white">{rec.employeeName}</p>
                        <p className="text-xs text-slate-400">{rec.employeePhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{fmt(rec.baseSalary)} ر.س</td>
                    <td className="px-4 py-3 text-blue-300">{fmt(rec.commissionAmount)} ر.س</td>
                    <td className="px-4 py-3 text-green-300">{fmt(rec.bonusAmount)} ر.س</td>
                    <td className="px-4 py-3 text-red-300">{fmt(rec.deductions)} ر.س</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-white">{fmt(rec.totalAmount)} ر.س</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{rec.bookingsCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAdjustModalRecord(rec)}
                          className="text-xs text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                          title="تعديل المكافأة والخصومات"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => autoBonusMutation.mutate(rec.employeeId)}
                          disabled={autoBonusMutation.isPending}
                          className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors bg-yellow-500/10 hover:bg-yellow-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                          title="احسب المكافآت التلقائية"
                        >
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                        {rec.status === 'pending' && (
                          <button
                            onClick={() => payMutation.mutate(rec.id)}
                            disabled={payMutation.isPending}
                            className="text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> دفع
                          </button>
                        )}
                        {rec.status === 'paid' && rec.paidAt && (
                          <span className="text-xs text-slate-500">
                            {new Date(rec.paidAt).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              }
            </tbody>
            {records.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/10 bg-white/5">
                  <td colSpan={5} className="px-4 py-3 font-semibold text-slate-300">الإجمالي</td>
                  <td className="px-4 py-3 font-bold text-white text-base">
                    {fmt(totalPayroll)} ر.س
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-sm">
                    {records.reduce((s, r) => s + r.bookingsCount, 0)} حجز
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>}

      {/* ── Bonus Rules section ── */}
      {activeTab === 'bonus-rules' && (
        <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" />
              <h2 className="font-semibold text-white">قواعد المكافآت التلقائية</h2>
            </div>
            <button
              onClick={() => setShowBonusRuleModal(true)}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة قاعدة
            </button>
          </div>

          {/* Example hints */}
          <div className="px-5 py-3 border-b border-white/5 bg-yellow-500/5">
            <p className="text-xs text-yellow-400/80 font-medium mb-2">أمثلة على القواعد المقترحة:</p>
            <div className="flex flex-wrap gap-2">
              {[
                '8 غسلات يومياً → +75 ر.س',
                'تقييم 4.8+ → +50 ر.س',
                'أسبوع بدون إلغاء → +100 ر.س',
              ].map(ex => (
                <span key={ex} className="text-xs bg-yellow-500/10 text-yellow-300 px-3 py-1 rounded-full border border-yellow-500/20">
                  {ex}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-3 text-right font-medium text-slate-400">اسم القاعدة</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-400">نوع الشرط</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-400">الحد الأدنى</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-400">المكافأة</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-400">الفترة</th>
                  <th className="px-5 py-3 text-right font-medium text-slate-400">مفعّل</th>
                </tr>
              </thead>
              <tbody>
                {bonusRulesLoading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                  : bonusRulesList.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                        <div className="flex flex-col items-center gap-2">
                          <Award className="w-8 h-8 opacity-30" />
                          <span>لا توجد قواعد مكافآت بعد</span>
                          <span className="text-xs text-slate-600">اضغط "+ إضافة قاعدة" لإنشاء قاعدة جديدة</span>
                        </div>
                      </td>
                    </tr>
                  )
                  : bonusRulesList.map(rule => (
                    <motion.tr
                      key={rule.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{rule.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-blue-500/10 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/20">
                          {CONDITION_LABELS[rule.conditionType] ?? rule.conditionType}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-200">
                        {parseFloat(rule.threshold).toFixed(rule.conditionType === 'rating_avg' ? 1 : 0)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-yellow-300">+{fmt(parseFloat(rule.bonusAmount))} ر.س</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-400">{PERIOD_LABELS[rule.period] ?? rule.period}</span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleBonusRuleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                            rule.isActive
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'
                          }`}
                        >
                          {rule.isActive
                            ? <><ToggleRight className="w-3.5 h-3.5" /> مفعّل</>
                            : <><ToggleLeft className="w-3.5 h-3.5" /> معطّل</>
                          }
                        </button>
                      </td>
                    </motion.tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {configModalEmployee && (
          <SalaryConfigModal
            key="config-modal"
            employee={configModalEmployee}
            onClose={() => setConfigModalEmployee(null)}
            onSave={(employeeId, form) => saveConfigMutation.mutate({ employeeId, form })}
            isSaving={saveConfigMutation.isPending}
          />
        )}
        {adjustModalRecord && (
          <AdjustModal
            key="adjust-modal"
            record={adjustModalRecord}
            onClose={() => setAdjustModalRecord(null)}
            onSave={(id, form) => adjustMutation.mutate({ id, form })}
            isSaving={adjustMutation.isPending}
          />
        )}
        {showBonusRuleModal && (
          <BonusRuleModal
            key="bonus-rule-modal"
            onClose={() => setShowBonusRuleModal(false)}
            onSave={(form) => createBonusRuleMutation.mutate(form)}
            isSaving={createBonusRuleMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
