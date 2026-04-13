import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Plus, X, Clock, Users, Calendar, Trash2,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? '';

interface Employee { id: number; name: string; phone: string; role: string; isActive: boolean; }
interface Shift {
  id: number; vendorId: number; employeeId: number; date: string;
  startTime: string; endTime: string; shiftType: string; notes: string | null; status: string;
}

const SHIFT_TYPES = [
  { value: 'regular',  label: 'عادي',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'overtime', label: 'إضافي',  color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'off',      label: 'إجازة',  color: 'bg-red-500/20 text-red-300 border-red-500/30' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'مجدول', color: 'text-blue-400' },
  completed:  { label: 'منتهي', color: 'text-green-400' },
  absent:     { label: 'غائب',  color: 'text-red-400' },
  cancelled:  { label: 'ملغي',  color: 'text-slate-400' },
};

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2,'0')}:00`);
  if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2,'0')}:30`);
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day + 1) % 7; // Sat=0 offset
  x.setDate(x.getDate() - diff);
  x.setHours(0,0,0,0);
  return x;
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function toDateStr(d: Date): string { return d.toISOString().split('T')[0]; }

const DAYS_AR = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];

export default function Shifts() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const headers = { Authorization: `Bearer ${token}` };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekParam = toDateStr(weekStart);

  const [modal, setModal] = useState<{ mode: 'add'|'edit'; empId?: number; date?: string; shift?: Shift } | null>(null);
  const [form, setForm] = useState({ startTime: '08:00', endTime: '16:00', shiftType: 'regular', notes: '', status: 'scheduled' });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => axios.get(`${API}/api/employees`, { headers }).then(r => r.data),
  });

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', weekParam],
    queryFn: () => axios.get(`${API}/api/shifts`, { headers, params: { week: weekParam } }).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => axios.post(`${API}/api/shifts`, d, { headers }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setModal(null); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => axios.patch(`${API}/api/shifts/${id}`, data, { headers }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => axios.delete(`${API}/api/shifts/${id}`, { headers }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); setModal(null); },
  });

  const shiftMap = useMemo(() => {
    const m: Record<string, Shift[]> = {};
    for (const s of shifts) {
      const key = `${s.employeeId}_${s.date.split('T')[0]}`;
      (m[key] ??= []).push(s);
    }
    return m;
  }, [shifts]);

  function openAdd(empId: number, date: string) {
    setForm({ startTime: '08:00', endTime: '16:00', shiftType: 'regular', notes: '', status: 'scheduled' });
    setModal({ mode: 'add', empId, date });
  }
  function openEdit(s: Shift) {
    setForm({ startTime: s.startTime, endTime: s.endTime, shiftType: s.shiftType, notes: s.notes ?? '', status: s.status });
    setModal({ mode: 'edit', shift: s });
  }
  function submit() {
    if (modal?.mode === 'add') createMut.mutate({ employeeId: modal.empId, date: modal.date, ...form });
    else if (modal?.shift) updateMut.mutate({ id: modal.shift.id, data: form });
  }

  const activeEmployees = employees.filter(e => e.isActive && ['employee','admin','vendor_admin'].includes(e.role));
  const weekLabel = `${weekDays[0].toLocaleDateString('ar-SA', { month:'short', day:'numeric' })} — ${weekDays[6].toLocaleDateString('ar-SA', { month:'short', day:'numeric', year:'numeric' })}`;

  return (
    <div className="min-h-screen bg-[#040812] text-white p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="text-blue-400" size={28} /> جدول المناوبات
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">إدارة دوامات الموظفين أسبوعياً</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-2">
          <button onClick={() => setWeekStart(d => addDays(d, 7))} className="p-1 hover:bg-white/10 rounded-lg">
            <ChevronRight size={18} />
          </button>
          <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
          <button onClick={() => setWeekStart(d => addDays(d, -7))} className="p-1 hover:bg-white/10 rounded-lg">
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {SHIFT_TYPES.map(t => (
          <span key={t.value} className={`text-xs px-3 py-1 rounded-full border ${t.color}`}>{t.label}</span>
        ))}
      </div>

      {/* Grid */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header row */}
          <div className="grid border-b border-white/10" style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
            <div className="p-3 text-xs text-slate-500 flex items-center gap-1"><Users size={12} /> الموظف</div>
            {weekDays.map((d, i) => {
              const isToday = toDateStr(d) === toDateStr(new Date());
              return (
                <div key={i} className={`p-3 text-center border-r border-white/5 ${isToday ? 'bg-blue-500/10' : ''}`}>
                  <p className={`text-[11px] font-bold ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>{DAYS_AR[i]}</p>
                  <p className={`text-sm font-black ${isToday ? 'text-blue-300' : 'text-white'}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="grid border-b border-white/5 h-16 animate-pulse"
                style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <div key={j} className="m-2 bg-white/5 rounded-xl" />
                ))}
              </div>
            ))
          ) : activeEmployees.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p>لا يوجد موظفون نشطون</p>
            </div>
          ) : (
            activeEmployees.map(emp => (
              <div key={emp.id} className="grid border-b border-white/5 hover:bg-white/[0.02]"
                style={{ gridTemplateColumns: '140px repeat(7, 1fr)' }}>
                <div className="p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {emp.name[0]}
                  </div>
                  <span className="text-xs font-medium truncate">{emp.name}</span>
                </div>
                {weekDays.map((d, di) => {
                  const dateStr = toDateStr(d);
                  const isToday = dateStr === toDateStr(new Date());
                  const cellShifts = shiftMap[`${emp.id}_${dateStr}`] ?? [];
                  return (
                    <div key={di}
                      className={`p-1 border-r border-white/5 min-h-[56px] relative group cursor-pointer ${isToday ? 'bg-blue-500/5' : ''}`}
                      onClick={() => cellShifts.length === 0 && openAdd(emp.id, dateStr)}>
                      {cellShifts.map(s => {
                        const type = SHIFT_TYPES.find(t => t.value === s.shiftType) ?? SHIFT_TYPES[0];
                        return (
                          <button key={s.id} onClick={e => { e.stopPropagation(); openEdit(s); }}
                            className={`w-full text-left px-1.5 py-1 rounded-lg border text-[10px] font-medium mb-0.5 ${type.color} hover:brightness-125`}>
                            <div className="flex items-center gap-0.5">
                              <Clock size={8} /><span>{s.startTime}–{s.endTime}</span>
                            </div>
                            <p className={`text-[9px] ${STATUS_MAP[s.status]?.color ?? ''}`}>{STATUS_MAP[s.status]?.label}</p>
                          </button>
                        );
                      })}
                      {cellShifts.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                            <Plus size={10} className="text-blue-400" />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        {[
          { label: 'مناوبات عادية', value: shifts.filter(s => s.shiftType==='regular').length, color: 'text-blue-400' },
          { label: 'مناوبات إضافية', value: shifts.filter(s => s.shiftType==='overtime').length, color: 'text-orange-400' },
          { label: 'إجازات', value: shifts.filter(s => s.shiftType==='off').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#0f1628] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock size={17} className="text-blue-400" />
                  {modal.mode === 'add' ? 'إضافة مناوبة' : 'تعديل المناوبة'}
                </h3>
                <button onClick={() => setModal(null)}><X size={18} className="text-slate-400" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(['startTime','endTime'] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs text-slate-400 mb-1">{field==='startTime'?'البداية':'النهاية'}</label>
                      <select value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                        {TIME_SLOTS.map(t => <option key={t} value={t} className="bg-[#040812]">{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-2">نوع المناوبة</label>
                  <div className="flex gap-2">
                    {SHIFT_TYPES.map(t => (
                      <button key={t.value} onClick={() => setForm(f => ({ ...f, shiftType: t.value }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${form.shiftType===t.value ? t.color : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {modal.mode === 'edit' && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">الحالة</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                      {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                        <option key={v} value={v} className="bg-[#040812]">{label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">ملاحظات</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="اختياري..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={submit} disabled={createMut.isPending || updateMut.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {createMut.isPending || updateMut.isPending ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                {modal.mode === 'edit' && (
                  <button onClick={() => deleteMut.mutate(modal.shift!.id)}
                    className="p-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-xl">
                    <Trash2 size={16} />
                  </button>
                )}
                <button onClick={() => setModal(null)} className="flex-1 bg-white/10 hover:bg-white/15 text-white py-2.5 rounded-xl text-sm">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
