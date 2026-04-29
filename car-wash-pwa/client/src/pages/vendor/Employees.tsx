import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  Plus, X, MessageCircle, Key, Car, Power,
  BarChart2, TrendingUp, Star, XCircle, Banknote, ChevronLeft, ChevronRight,
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';

const API = '/api';
const avatarColors = ['bg-purple-600', 'bg-blue-600', 'bg-green-600', 'bg-orange-600', 'bg-pink-600', 'bg-teal-600'];
const roleLabel: Record<string, string> = { admin: 'مدير', employee: 'موظف' };

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function Overlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />;
}

// ─── Performance Panel ────────────────────────────────────────────────────────

interface PerformanceData {
  employeeId: number;
  month: number;
  year: number;
  completedBookings: number;
  totalRevenue: number;
  avgRating: number | null;
  cancelledBookings: number;
  baseSalary: number | null;
  commissionAmount: number | null;
  totalPayroll: number | null;
  payrollStatus: string | null;
}

function PerformancePanel({ emp, token, onClose }: { emp: any; token: string; onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: perf, isLoading } = useQuery<PerformanceData>({
    queryKey: ['emp-performance', emp.id, month, year],
    queryFn: () =>
      axios
        .get(`${API}/employees/${emp.id}/performance`, {
          params: { month, year },
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
    enabled: !!token,
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const payrollStatusLabel: Record<string, string> = { paid: 'مدفوع', pending: 'قيد الانتظار' };
  const payrollStatusColor: Record<string, string> = { paid: 'text-green-400', pending: 'text-yellow-400' };

  return (
    <>
      <Overlay onClose={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        className="fixed top-0 left-0 h-full w-full max-w-sm bg-[#0b1120] border-l border-white/10 z-50 p-6 overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-brand-400" />
            <h2 className="font-bold text-lg">أداء الموظف</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Employee name */}
        <div className="flex items-center gap-3 mb-5 bg-white/5 rounded-xl p-3">
          <div className={`w-10 h-10 rounded-full ${avatarColors[Number(emp.id) % avatarColors.length]} flex items-center justify-center font-bold shrink-0`}>
            {emp.name?.[0] ?? '?'}
          </div>
          <div>
            <div className="font-semibold">{emp.name}</div>
            <div className="text-xs text-slate-400">{emp.phone}</div>
          </div>
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-between mb-5 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
          <button onClick={prevMonth} className="p-1 hover:text-white text-slate-400 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="font-medium text-sm">{MONTHS_AR[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1 hover:text-white text-slate-400 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            {/* Bookings row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-slate-400">الحجوزات المكتملة</span>
                </div>
                <div className="text-2xl font-bold">{perf?.completedBookings ?? 0}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-slate-400">الملغية</span>
                </div>
                <div className="text-2xl font-bold">{perf?.cancelledBookings ?? 0}</div>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-slate-400">الإيراد المحقق</span>
              </div>
              <div className="text-2xl font-bold">
                {perf?.totalRevenue != null
                  ? `${Number(perf.totalRevenue).toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ر.س`
                  : '—'}
              </div>
            </div>

            {/* Rating */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400">متوسط التقييم</span>
              </div>
              <div className="text-2xl font-bold flex items-baseline gap-1">
                {perf?.avgRating != null ? (
                  <>
                    <span>{Number(perf.avgRating).toFixed(1)}</span>
                    <span className="text-sm text-slate-400">/ 5</span>
                  </>
                ) : (
                  <span className="text-slate-500 text-base">لا يوجد تقييمات</span>
                )}
              </div>
            </div>

            {/* Payroll */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">الرواتب والعمولات</span>
                {perf?.payrollStatus && (
                  <span className={`text-xs font-medium ${payrollStatusColor[perf.payrollStatus] ?? 'text-slate-400'}`}>
                    {payrollStatusLabel[perf.payrollStatus] ?? perf.payrollStatus}
                  </span>
                )}
              </div>
              {perf?.totalPayroll == null ? (
                <p className="text-xs text-slate-500">لا توجد سجلات رواتب لهذا الشهر</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">الراتب الأساسي</span>
                    <span>{Number(perf.baseSalary ?? 0).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">العمولة</span>
                    <span className="text-green-400">+{Number(perf.commissionAmount ?? 0).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-semibold">
                    <span>الإجمالي</span>
                    <span>{Number(perf.totalPayroll).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Employees() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const ax = (method: string, url: string, data?: object) =>
    axios({ method, url: API + url, data, headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => ax('get', '/employees'), enabled: !!token });
  const { data: fleet = [] } = useQuery({ queryKey: ['fleet'], queryFn: () => ax('get', '/fleet'), enabled: !!token });

  const [showAdd, setShowAdd] = useState(false);
  const [pwdEmployee, setPwdEmployee] = useState<any>(null);
  const [vehicleEmployee, setVehicleEmployee] = useState<any>(null);
  const [perfEmployee, setPerfEmployee] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [addForm, setAddForm] = useState({ name: '', phone: '', password: '', role: 'employee', vehicleId: '' });

  const createEmployee = useMutation({
    mutationFn: (d: any) => ax('post', '/employees', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowAdd(false);
      setAddForm({ name: '', phone: '', password: '', role: 'employee', vehicleId: '' });
      toast.success('تمت إضافة الموظف');
    },
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => ax('patch', `/employees/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success('تم تغيير الحالة'); },
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, pwd }: any) => ax('patch', `/employees/${id}/password`, { password: pwd }),
    onSuccess: () => { setPwdEmployee(null); setNewPassword(''); toast.success('تم تغيير كلمة المرور'); },
  });

  const assignVehicle = useMutation({
    mutationFn: ({ id, vehicleId }: any) => ax('post', `/employees/${id}/assign-vehicle`, { vehicleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setVehicleEmployee(null);
      setSelectedVehicle('');
      toast.success('تم تعيين المركبة');
    },
  });

  const activeFleet = (fleet as any[]).filter((v: any) => v.status === 'active');

  return (
    <div dir="rtl" className="min-h-screen bg-surface-1 text-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">الفريق</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> موظف جديد
        </button>
      </div>

      {/* Employee Cards */}
      {(employees as any[]).length === 0 ? (
        <EmptyState
          emoji="👷"
          title="لم تُضف موظفين بعد"
          description="أضف أول موظف لبدء توزيع الحجوزات تلقائياً"
          actionLabel="أضف موظف"
          onAction={() => setShowAdd(true)}
        />
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(employees as any[]).map((emp: any) => {
          const colorClass = avatarColors[Number(emp.id ?? 0) % avatarColors.length];
          const initial = emp.name?.[0] ?? '?';
          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4"
            >
              {/* Employee info row — clickable for performance */}
              <button
                className="flex items-start gap-3 mb-3 w-full text-right"
                onClick={() => setPerfEmployee(emp)}
              >
                <div className={`w-12 h-12 rounded-full ${colorClass} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{emp.name}</span>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${emp.isActive ? 'bg-green-400' : 'bg-slate-500'}`} />
                    <span className="text-xs text-slate-400">{emp.isActive ? 'نشط' : 'متوقف'}</span>
                  </div>
                  <div className="text-sm text-slate-400">{emp.phone}</div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-brand-400">
                    <BarChart2 className="w-3 h-3" />
                    <span>عرض الأداء</span>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 shrink-0">
                  {roleLabel[emp.role] ?? emp.role}
                </span>
              </button>

              {emp.assignedVehicle && (
                <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 rounded-lg px-2 py-1 w-fit mb-3">
                  <span>🚗</span> {emp.assignedVehicle}
                </div>
              )}

              <div className="grid grid-cols-4 gap-1.5">
                <a
                  href={`https://wa.me/${emp.phone?.replace(/\D/g, '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex flex-col items-center justify-center gap-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-xl py-2 text-green-400 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-[10px]">واتساب</span>
                </a>
                <button
                  onClick={() => { setPwdEmployee(emp); setNewPassword(''); }}
                  className="flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2 text-slate-300 transition-colors"
                >
                  <Key className="w-4 h-4" />
                  <span className="text-[10px]">كلمة المرور</span>
                </button>
                <button
                  onClick={() => { setVehicleEmployee(emp); setSelectedVehicle(''); }}
                  className="flex flex-col items-center justify-center gap-1 bg-white/5 hover:bg-white/10 rounded-xl py-2 text-slate-300 transition-colors"
                >
                  <Car className="w-4 h-4" />
                  <span className="text-[10px]">مركبة</span>
                </button>
                <button
                  onClick={() => toggleActive.mutate(String(emp.id))}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 transition-colors ${emp.isActive ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}
                >
                  <Power className="w-4 h-4" />
                  <span className="text-[10px]">{emp.isActive ? 'إيقاف' : 'تفعيل'}</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Performance Panel */}
      <AnimatePresence>
        {perfEmployee && (
          <PerformancePanel
            emp={perfEmployee}
            token={token ?? ''}
            onClose={() => setPerfEmployee(null)}
          />
        )}
      </AnimatePresence>

      {/* Add Employee Slide-in Panel */}
      <AnimatePresence>
        {showAdd && (
          <>
            <Overlay onClose={() => setShowAdd(false)} />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-[#0b1120] border-r border-white/10 z-50 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg">إضافة موظف جديد</h2>
                <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="space-y-3">
                {[['name', 'الاسم', 'text'], ['phone', 'رقم الهاتف', 'tel'], ['password', 'كلمة المرور', 'password']].map(([key, label, type]) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                    <input
                      type={type}
                      value={(addForm as any)[key]}
                      onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">الصلاحية</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="employee">موظف</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">تعيين مركبة (اختياري)</label>
                  <select
                    value={addForm.vehicleId}
                    onChange={(e) => setAddForm((f) => ({ ...f, vehicleId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">بدون مركبة</option>
                    {activeFleet.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.nameAr} — {v.plateNumber}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => createEmployee.mutate(addForm)}
                  disabled={createEmployee.isPending || !addForm.name || !addForm.phone || !addForm.password}
                  className="w-full mt-2 bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {createEmployee.isPending ? 'جاري الحفظ...' : 'إضافة الموظف'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {pwdEmployee && (
          <>
            <Overlay onClose={() => setPwdEmployee(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">تغيير كلمة المرور</h2>
                  <button onClick={() => setPwdEmployee(null)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <p className="text-sm text-slate-400 mb-4">{pwdEmployee.name}</p>
                <label className="text-xs text-slate-400 mb-1 block">كلمة المرور الجديدة</label>
                <input
                  type="password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => resetPassword.mutate({ id: String(pwdEmployee.id), pwd: newPassword })}
                  disabled={!newPassword || resetPassword.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {resetPassword.isPending ? 'جاري الحفظ...' : 'تغيير كلمة المرور'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Assign Vehicle Modal */}
      <AnimatePresence>
        {vehicleEmployee && (
          <>
            <Overlay onClose={() => setVehicleEmployee(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">تعيين مركبة</h2>
                  <button onClick={() => setVehicleEmployee(null)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <p className="text-sm text-slate-400 mb-4">{vehicleEmployee.name}</p>
                <label className="text-xs text-slate-400 mb-1 block">اختر المركبة</label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-brand-500"
                >
                  <option value="">اختر...</option>
                  {activeFleet.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nameAr} — {v.plateNumber}</option>
                  ))}
                </select>
                <button
                  onClick={() => assignVehicle.mutate({ id: String(vehicleEmployee.id), vehicleId: selectedVehicle })}
                  disabled={!selectedVehicle || assignVehicle.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {assignVehicle.isPending ? 'جاري الحفظ...' : 'تعيين المركبة'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
