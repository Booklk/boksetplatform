import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle2, XCircle, Plane, Stethoscope, AlertCircle, LogIn, LogOut, Plus, X } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface LeaveRequest {
  id: number;
  type: LeaveType;
  status: LeaveStatus;
  fromDate: string;
  toDate: string;
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employeeId: number;
  employeeName: string | null;
}

interface AttendanceRecord {
  id: number;
  checkInAt: string;
  checkOutAt: string | null;
  notes: string | null;
  employeeId?: number;
  employeeName?: string | null;
}

const TYPE_ICON: Record<LeaveType, typeof Plane> = {
  annual: Plane,
  sick: Stethoscope,
  emergency: AlertCircle,
  unpaid: Calendar,
};
const TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'سنوية',
  sick: 'مرضية',
  emergency: 'اضطرارية',
  unpaid: 'بدون راتب',
};
const STATUS_BADGE: Record<LeaveStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  approved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  cancelled: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};
const STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'قيد المراجعة', approved: 'موافق', rejected: 'مرفوض', cancelled: 'ملغي',
};

export default function VendorHrSuite() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'vendor_admin' || user?.role === 'admin';
  const qc = useQueryClient();
  const [tab, setTab] = useState<'leave' | 'attendance'>('leave');
  const [showNew, setShowNew] = useState(false);

  // Leave list
  const { data: leaves = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['hr-leave'],
    queryFn: async () => (await api.get('/hr/leave')).data,
  });

  // My today attendance
  const { data: myToday } = useQuery<{ active: AttendanceRecord | null }>({
    queryKey: ['hr-attendance-today'],
    queryFn: async () => (await api.get('/hr/attendance/me/today')).data,
    refetchInterval: 60_000,
  });

  // Admin attendance log
  const { data: attendanceLog = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['hr-attendance-log'],
    queryFn: async () => (await api.get('/hr/attendance?days=14')).data,
    enabled: isAdmin && tab === 'attendance',
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      let coords: { lat?: number; lng?: number } = {};
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }),
        );
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch { /* GPS optional */ }
      return (await api.post('/hr/attendance/check-in', coords)).data;
    },
    onSuccess: () => {
      toast.success('تم تسجيل الدخول');
      qc.invalidateQueries({ queryKey: ['hr-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['hr-attendance-log'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر التسجيل'),
  });

  const checkOut = useMutation({
    mutationFn: async () => (await api.post('/hr/attendance/check-out')).data,
    onSuccess: () => {
      toast.success('تم تسجيل الخروج');
      qc.invalidateQueries({ queryKey: ['hr-attendance-today'] });
      qc.invalidateQueries({ queryKey: ['hr-attendance-log'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر تسجيل الخروج'),
  });

  const reviewLeave = useMutation({
    mutationFn: async ({ id, status, note }: { id: number; status: LeaveStatus; note?: string }) =>
      (await api.patch(`/hr/leave/${id}`, { status, reviewNote: note })).data,
    onSuccess: () => {
      toast.success('تم تحديث الطلب');
      qc.invalidateQueries({ queryKey: ['hr-leave'] });
    },
  });

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">الموارد البشرية</h1>
          <p className="text-slate-400 text-sm mt-1">
            {isAdmin ? 'راجع طلبات الإجازات وحضور فريقك' : 'تابع إجازاتك وسجّل حضورك'}
          </p>
        </div>
        <div className="flex bg-white/5 rounded-xl p-1 text-xs">
          <button
            onClick={() => setTab('leave')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
              tab === 'leave' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            الإجازات
          </button>
          <button
            onClick={() => setTab('attendance')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
              tab === 'attendance' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            الحضور
          </button>
        </div>
      </div>

      {tab === 'leave' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold px-4 py-2 rounded-xl"
            >
              <Plus className="w-4 h-4" />
              طلب إجازة
            </button>
          </div>

          {leaves.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-slate-300">لا توجد طلبات</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaves.map((l) => {
                const Icon = TYPE_ICON[l.type];
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-300">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-bold text-sm">{TYPE_LABEL[l.type]}</span>
                            <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${STATUS_BADGE[l.status]}`}>
                              {STATUS_LABEL[l.status]}
                            </span>
                            {isAdmin && l.employeeName && (
                              <span className="text-xs text-slate-400">— {l.employeeName}</span>
                            )}
                          </div>
                          <p className="text-slate-300 text-xs mt-1">
                            من {new Date(l.fromDate).toLocaleDateString('ar-SA')}
                            {' '}إلى {new Date(l.toDate).toLocaleDateString('ar-SA')}
                          </p>
                          {l.reason && <p className="text-slate-400 text-xs mt-1">{l.reason}</p>}
                          {l.reviewNote && (
                            <p className="text-slate-500 text-xs mt-1 italic">رد المدير: {l.reviewNote}</p>
                          )}
                        </div>
                      </div>

                      {isAdmin && l.status === 'pending' && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => reviewLeave.mutate({ id: l.id, status: 'approved' })}
                            className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 flex items-center justify-center"
                            aria-label="موافقة"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => reviewLeave.mutate({ id: l.id, status: 'rejected' })}
                            className="w-8 h-8 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 flex items-center justify-center"
                            aria-label="رفض"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {!isAdmin && l.status === 'pending' && (
                        <button
                          onClick={() => reviewLeave.mutate({ id: l.id, status: 'cancelled' })}
                          className="text-xs text-slate-400 hover:text-rose-300"
                        >
                          إلغاء
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'attendance' && (
        <>
          {/* My check-in/out card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
          >
            <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              دوامك اليوم
            </h2>
            {myToday?.active ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-emerald-300 font-bold text-sm">
                    دخول: {new Date(myToday.active.checkInAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {myToday.active.checkOutAt ? (
                    <p className="text-slate-300 text-sm">
                      خروج: {new Date(myToday.active.checkOutAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : (
                    <p className="text-blue-300 text-xs">دوامك مفتوح حالياً</p>
                  )}
                </div>
                {!myToday.active.checkOutAt && (
                  <button
                    onClick={() => checkOut.mutate()}
                    disabled={checkOut.isPending}
                    className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    تسجيل خروج
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => checkIn.mutate()}
                disabled={checkIn.isPending}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {checkIn.isPending ? '...' : 'سجّل دخولك الآن'}
              </button>
            )}
          </motion.div>

          {/* Admin: team attendance log */}
          {isAdmin && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-white font-bold text-base mb-3">سجل حضور الفريق (آخر 14 يوم)</h2>
              {attendanceLog.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">لا توجد سجلات</p>
              ) : (
                <div className="space-y-1.5 text-sm">
                  {attendanceLog.map((a) => {
                    const ms = a.checkOutAt
                      ? new Date(a.checkOutAt).getTime() - new Date(a.checkInAt).getTime()
                      : null;
                    const hours = ms ? (ms / 3_600_000).toFixed(1) : null;
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
                        <div className="min-w-0">
                          <p className="text-white font-bold text-xs truncate">{a.employeeName ?? `موظف #${a.employeeId}`}</p>
                          <p className="text-slate-500 text-[11px]">
                            {new Date(a.checkInAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                            {a.checkOutAt && (
                              <> ← {new Date(a.checkOutAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</>
                            )}
                          </p>
                        </div>
                        <span className={`text-xs font-bold ${a.checkOutAt ? 'text-emerald-300' : 'text-blue-300'}`}>
                          {a.checkOutAt ? `${hours} ساعة` : 'مفتوح'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showNew && <NewLeaveModal onClose={() => setShowNew(false)} onCreated={() => qc.invalidateQueries({ queryKey: ['hr-leave'] })} />}
    </div>
  );
}

function NewLeaveModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<LeaveType>('annual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');

  const submit = useMutation({
    mutationFn: async () =>
      (await api.post('/hr/leave', {
        type,
        fromDate: new Date(fromDate).toISOString(),
        toDate: new Date(toDate).toISOString(),
        reason: reason || undefined,
      })).data,
    onSuccess: () => {
      toast.success('تم إرسال طلب الإجازة');
      onCreated();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الإرسال'),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#0d1929] border border-white/10 rounded-2xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">طلب إجازة جديد</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400">
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>

        <label className="block text-xs text-slate-400 mb-1.5">نوع الإجازة</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(Object.keys(TYPE_LABEL) as LeaveType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`p-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${
                type === t ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/10 text-slate-400 hover:border-white/20'
              }`}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">من</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-2 text-white text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">إلى</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-2.5 py-2 text-white text-sm" />
          </div>
        </div>

        <label className="block text-xs text-slate-400 mb-1.5">السبب (اختياري)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm h-20 resize-none mb-4"
        />

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5">إلغاء</button>
          <button
            onClick={() => fromDate && toDate && submit.mutate()}
            disabled={!fromDate || !toDate || submit.isPending}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold disabled:opacity-50"
          >
            {submit.isPending ? '...' : 'إرسال'}
          </button>
        </div>
      </div>
    </div>
  );
}
