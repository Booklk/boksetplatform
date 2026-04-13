import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { X, Plus, AlertTriangle, Gauge, Wrench, Settings, ChevronRight, ChevronDown, Users } from 'lucide-react';
import EmptyState from '../../components/EmptyState';

const API = '/api';
const typeEmoji: Record<string, string> = {
  car: '🚗', pickup: '🛻', water_tank: '🚚', van: '🚐', motorcycle: '🏍️', equipment: '🔧',
};
const maintenanceTypes = ['تغيير زيت','تدوير إطارات','فحص مكابح','صيانة شاملة','إصلاح','فحص دوري','أخرى'];
const statusLabel: Record<string, string> = { active: 'نشط', maintenance: 'صيانة', inactive: 'متوقف' };
const statusColor: Record<string, string> = { active: 'bg-green-500/20 text-green-400', maintenance: 'bg-yellow-500/20 text-yellow-400', inactive: 'bg-red-500/20 text-red-400' };

function mileageColor(remaining: number) {
  if (remaining > 1000) return 'bg-green-500';
  if (remaining >= 500) return 'bg-yellow-500';
  return 'bg-red-500';
}

function Overlay({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />;
}

export default function Fleet() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const ax = (method: string, url: string, data?: object) =>
    axios({ method, url: API + url, data, headers: { Authorization: `Bearer ${token}` } }).then(r => r.data);

  const { data: vehicles = [] } = useQuery({ queryKey: ['fleet'], queryFn: () => ax('get', '/fleet'), enabled: !!token });
  const { data: alerts = [], refetch: refetchAlerts } = useQuery({ queryKey: ['fleet-alerts'], queryFn: () => ax('get', '/fleet/alerts'), enabled: !!token });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: () => ax('get', '/employees'), enabled: !!token });
  const [dismissedAlerts, setDismissedAlerts] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [mileageVehicle, setMileageVehicle] = useState<any>(null);
  const [maintVehicle, setMaintVehicle] = useState<any>(null);
  const [settingsVehicle, setSettingsVehicle] = useState<any>(null);

  // Crew management state
  const [expandedCrewVehicle, setExpandedCrewVehicle] = useState<number | null>(null);
  const [crewModalVehicle, setCrewModalVehicle] = useState<any>(null);
  const [crewForm, setCrewForm] = useState({ employeeId: '', role: 'technician' });

  // Per-vehicle crew data
  const crewQueries: Record<number, any> = {};
  // (fetched inline per vehicle when expanded)

  // Add vehicle
  const [addForm, setAddForm] = useState({ type: 'car', nameAr: '', plateNumber: '', brand: '', model: '', year: new Date().getFullYear(), color: '', currentMileage: 0 });
  const createVehicle = useMutation({ mutationFn: (d: any) => ax('post', '/fleet', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet'] }); setShowAdd(false); toast.success('تمت إضافة المركبة'); } });

  // Mileage
  const [newMileage, setNewMileage] = useState('');
  const updateMileage = useMutation({ mutationFn: ({ id, m }: any) => ax('post', `/fleet/${id}/update-mileage`, { currentMileage: Number(m) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet'] }); setMileageVehicle(null); toast.success('تم تحديث العداد'); } });

  // Maintenance
  const [maintForm, setMaintForm] = useState({ type: 'تغيير زيت', mileageAtService: 0, cost: 0, serviceProvider: '', notes: '' });
  const addMaint = useMutation({ mutationFn: ({ id, d }: any) => ax('post', `/fleet/${id}/maintenance`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fleet'] }); setMaintVehicle(null); toast.success('تمت إضافة سجل الصيانة'); } });

  // Settings
  const [settingsForm, setSettingsForm] = useState<any>({ intervalKm: 5000, customKm: '', alertBefore: 300, whatsapp: false, app: true });
  const { data: settingsData } = useQuery({ queryKey: ['fleet-settings', settingsVehicle?.id], queryFn: () => ax('get', `/fleet/${settingsVehicle.id}/settings`), enabled: !!settingsVehicle && !!token, onSuccess: (d: any) => setSettingsForm({ intervalKm: d.intervalKm ?? 5000, customKm: d.customKm ?? '', alertBefore: d.alertBefore ?? 300, whatsapp: d.whatsapp ?? false, app: d.app ?? true }) } as any);
  const saveSettings = useMutation({ mutationFn: ({ id, d }: any) => ax('put', `/fleet/${id}/settings`, d), onSuccess: () => { setSettingsVehicle(null); toast.success('تم حفظ الإعدادات'); } });

  const addCrewMember = useMutation({
    mutationFn: ({ vehicleId, d }: any) => ax('post', `/fleet/${vehicleId}/crew`, d),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fleet-crew', vars.vehicleId] });
      setCrewModalVehicle(null);
      setCrewForm({ employeeId: '', role: 'technician' });
      toast.success('تمت إضافة الموظف للطاقم');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'حدث خطأ');
    },
  });

  const removeCrewMember = useMutation({
    mutationFn: ({ vehicleId, employeeId }: any) => ax('delete', `/fleet/${vehicleId}/crew/${employeeId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['fleet-crew', vars.vehicleId] });
      toast.success('تمت إزالة الموظف من الطاقم');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'حدث خطأ');
    },
  });

  // ── CrewSection component (inline) ──────────────────────────────────────────
  function CrewSection({ vehicle }: { vehicle: any }) {
    const { data: crew = [], isLoading } = useQuery({
      queryKey: ['fleet-crew', vehicle.id],
      queryFn: () => ax('get', `/fleet/${vehicle.id}/crew`),
      enabled: !!token && expandedCrewVehicle === vehicle.id,
    });

    const isExpanded = expandedCrewVehicle === vehicle.id;

    return (
      <div className="border-t border-white/10 pt-3 mt-1">
        <button
          onClick={() => setExpandedCrewVehicle(isExpanded ? null : vehicle.id)}
          className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> طاقم السيارة</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-1.5">
            {isLoading ? (
              <div className="text-xs text-slate-500 py-1">جاري التحميل...</div>
            ) : crew.length === 0 ? (
              <div className="text-xs text-slate-500">لا يوجد طاقم بعد</div>
            ) : (
              crew.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between bg-white/5 rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {member.employee?.name?.charAt(0) ?? '؟'}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white leading-none">{member.employee?.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{member.role === 'driver' ? 'سائق' : 'فني'}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeCrewMember.mutate({ vehicleId: vehicle.id, employeeId: member.employee?.id })}
                    className="text-red-400 hover:text-red-300 transition-colors p-0.5"
                    title="إزالة"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}

            <button
              onClick={() => { setCrewModalVehicle(vehicle); setCrewForm({ employeeId: '', role: 'technician' }); }}
              className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors mt-1"
            >
              <Plus className="w-3 h-3" /> إضافة موظف للطاقم
            </button>
          </div>
        )}
      </div>
    );
  }

  const total = vehicles.length;
  const active = vehicles.filter((v: any) => v.status === 'active').length;
  const needsMaint = vehicles.filter((v: any) => v.status === 'maintenance').length;

  return (
    <div dir="rtl" className="min-h-screen bg-[#040812] text-white p-4 md:p-6">
      {/* Alerts Banner */}
      <AnimatePresence>
        {!dismissedAlerts && alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="mb-4 bg-orange-500/20 border border-orange-500/40 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
              <span className="text-orange-300 text-sm">
                {alerts.length === 1 ? `مركبة واحدة تحتاج صيانة — ${alerts[0]?.nameAr} بعد ${alerts[0]?.kmRemaining ?? 300} كم` : `${alerts.length} مركبات تحتاج صيانة`}
              </span>
            </div>
            <button onClick={() => setDismissedAlerts(true)}><X className="w-4 h-4 text-orange-400" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header + Stats */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">الأسطول</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> إضافة مركبة
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[{ label: 'إجمالي المركبات', val: total, cls: 'text-white' }, { label: 'نشطة', val: active, cls: 'text-green-400' }, { label: 'تحتاج صيانة', val: needsMaint, cls: 'text-red-400' }].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.cls}`}>{s.val}</div>
            <div className="text-xs text-slate-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Vehicle Cards */}
      {(vehicles as any[]).length === 0 ? (
        <EmptyState
          emoji="🚗"
          title="لم تُضف سيارات بعد"
          description="أضف سياراتك المتنقلة وعيّن طاقمها للبدء في التوزيع التلقائي"
          actionLabel="أضف سيارة"
          onAction={() => setShowAdd(true)}
        />
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {vehicles.map((v: any) => {
          const remaining = (v.nextServiceMileage ?? 0) - (v.currentMileage ?? 0);
          const pct = Math.max(0, Math.min(100, (remaining / (v.serviceInterval ?? 5000)) * 100));
          return (
            <motion.div key={v.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl mb-1">{typeEmoji[v.type] ?? '🚗'}</div>
                  <div className="font-semibold text-sm">{v.nameAr}</div>
                  <div className="text-xs text-slate-400">{v.plateNumber}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[v.status] ?? 'bg-slate-500/20 text-slate-400'}`}>{statusLabel[v.status] ?? v.status}</span>
              </div>
              {v.assignedEmployee && (
                <div className="bg-white/5 rounded-lg px-2 py-1 text-xs text-slate-300 w-fit">{v.assignedEmployee}</div>
              )}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>العداد: {v.currentMileage?.toLocaleString()} كم</span>
                  <span>متبقي: {remaining > 0 ? remaining.toLocaleString() : 0} كم</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${mileageColor(remaining)}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {v.lastMaintenance && (
                <div className="text-xs text-slate-400">
                  آخر صيانة: {new Date(v.lastMaintenance.date).toLocaleDateString('ar-SA')} — {v.lastMaintenance.type}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button onClick={() => { setMileageVehicle(v); setNewMileage(String(v.currentMileage ?? 0)); }}
                  className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg py-1.5 text-xs transition-colors">
                  <Gauge className="w-3 h-3" /> العداد
                </button>
                <button onClick={() => { setMaintVehicle(v); setMaintForm({ type: 'تغيير زيت', mileageAtService: v.currentMileage ?? 0, cost: 0, serviceProvider: '', notes: '' }); }}
                  className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg py-1.5 text-xs transition-colors">
                  <Wrench className="w-3 h-3" /> صيانة
                </button>
                <button onClick={() => setSettingsVehicle(v)}
                  className="flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 rounded-lg py-1.5 text-xs transition-colors">
                  <Settings className="w-3 h-3" /> إعدادات
                </button>
              </div>
              <CrewSection vehicle={v} />
            </motion.div>
          );
        })}
      </div>

      {/* Add Vehicle Modal */}
      <AnimatePresence>
        {showAdd && (
          <>
            <Overlay onClose={() => setShowAdd(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">إضافة مركبة جديدة</h2>
                  <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {Object.entries(typeEmoji).map(([t, e]) => (
                    <button key={t} onClick={() => setAddForm(f => ({ ...f, type: t }))}
                      className={`py-3 rounded-xl text-2xl border transition-colors ${addForm.type === t ? 'border-brand-500 bg-brand-500/20' : 'border-white/10 bg-white/5'}`}>{e}</button>
                  ))}
                </div>
                {[['nameAr','اسم المركبة','text'],['plateNumber','رقم اللوحة','text'],['brand','الشركة المصنعة','text'],['model','الموديل','text'],['color','اللون','text']].map(([key, label, type]) => (
                  <div key={key} className="mb-3">
                    <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                    <input type={type} value={(addForm as any)[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">السنة</label>
                    <input type="number" value={addForm.year} onChange={e => setAddForm(f => ({ ...f, year: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">قراءة العداد الحالية</label>
                    <input type="number" value={addForm.currentMileage} onChange={e => setAddForm(f => ({ ...f, currentMileage: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                </div>
                <button onClick={() => createVehicle.mutate(addForm)} disabled={createVehicle.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  {createVehicle.isPending ? 'جاري الحفظ...' : 'إضافة المركبة'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Update Mileage Modal */}
      <AnimatePresence>
        {mileageVehicle && (
          <>
            <Overlay onClose={() => setMileageVehicle(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">تحديث العداد</h2>
                  <button onClick={() => setMileageVehicle(null)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="bg-white/5 rounded-xl p-3 mb-4 text-sm text-slate-300">
                  العداد الحالي: <span className="font-bold text-white">{mileageVehicle.currentMileage?.toLocaleString()} كم</span>
                </div>
                <label className="text-xs text-slate-400 mb-1 block">قراءة العداد الجديدة</label>
                <input type="number" value={newMileage} min={mileageVehicle.currentMileage}
                  onChange={e => setNewMileage(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-brand-500" />
                {Number(newMileage) > mileageVehicle.currentMileage && (
                  <div className="text-xs text-slate-400 mb-4">
                    الكم المتبقي للصيانة: <span className={`font-bold ${mileageColor((mileageVehicle.nextServiceMileage ?? 0) - Number(newMileage)).replace('bg-','text-')}`}>
                      {Math.max(0, (mileageVehicle.nextServiceMileage ?? 0) - Number(newMileage)).toLocaleString()} كم
                    </span>
                  </div>
                )}
                <button onClick={() => updateMileage.mutate({ id: mileageVehicle.id, m: newMileage })}
                  disabled={Number(newMileage) < mileageVehicle.currentMileage || updateMileage.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  {updateMileage.isPending ? 'جاري الحفظ...' : 'تحديث'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Maintenance Modal */}
      <AnimatePresence>
        {maintVehicle && (
          <>
            <Overlay onClose={() => setMaintVehicle(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-lg">إضافة سجل صيانة</h2>
                  <button onClick={() => setMaintVehicle(null)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">نوع الصيانة</label>
                    <select value={maintForm.type} onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                      {maintenanceTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">قراءة العداد عند الصيانة</label>
                    <input type="number" value={maintForm.mileageAtService} onChange={e => setMaintForm(f => ({ ...f, mileageAtService: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">التكلفة (ريال)</label>
                    <input type="number" value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: Number(e.target.value) }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">مزود الخدمة</label>
                    <input type="text" value={maintForm.serviceProvider} onChange={e => setMaintForm(f => ({ ...f, serviceProvider: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">ملاحظات</label>
                    <textarea value={maintForm.notes} onChange={e => setMaintForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 resize-none" />
                  </div>
                </div>
                <button onClick={() => addMaint.mutate({ id: maintVehicle.id, d: maintForm })} disabled={addMaint.isPending}
                  className="w-full mt-4 bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  {addMaint.isPending ? 'جاري الحفظ...' : 'حفظ السجل'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Settings Drawer */}
      <AnimatePresence>
        {settingsVehicle && (
          <>
            <Overlay onClose={() => setSettingsVehicle(null)} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25 }}
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-[#0b1120] border-r border-white/10 z-50 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-bold text-lg">إعدادات التذكير</h2>
                <button onClick={() => setSettingsVehicle(null)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-slate-400 mb-2">تذكيرني كل:</p>
                  <div className="space-y-2">
                    {[5000, 10000, 0].map(km => (
                      <label key={km} className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="interval" checked={settingsForm.intervalKm === km} onChange={() => setSettingsForm((f: any) => ({ ...f, intervalKm: km }))}
                          className="accent-brand-500" />
                        <span className="text-sm">{km === 0 ? 'مخصص' : `${km.toLocaleString()} كم`}</span>
                      </label>
                    ))}
                  </div>
                  {settingsForm.intervalKm === 0 && (
                    <input type="number" value={settingsForm.customKm} placeholder="أدخل المسافة بالكم"
                      onChange={e => setSettingsForm((f: any) => ({ ...f, customKm: e.target.value }))}
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-2">تنبيه قبل:</p>
                  <select value={settingsForm.alertBefore} onChange={e => setSettingsForm((f: any) => ({ ...f, alertBefore: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                    {[300,500,1000].map(km => <option key={km} value={km}>{km} كم</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  {[['whatsapp','تنبيه واتساب'],['app','تنبيه التطبيق']].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm">{label}</span>
                      <div onClick={() => setSettingsForm((f: any) => ({ ...f, [key]: !f[key] }))}
                        className={`w-11 h-6 rounded-full transition-colors ${settingsForm[key] ? 'bg-brand-600' : 'bg-white/20'} relative`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settingsForm[key] ? 'right-0.5' : 'left-0.5'}`} />
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={() => saveSettings.mutate({ id: settingsVehicle.id, d: settingsForm })} disabled={saveSettings.isPending}
                  className="w-full bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  {saveSettings.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Crew Member Modal */}
      <AnimatePresence>
        {crewModalVehicle && (
          <>
            <Overlay onClose={() => setCrewModalVehicle(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-[#0b1120] border border-white/10 rounded-2xl w-full max-w-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-base">إضافة موظف لطاقم {crewModalVehicle.nameAr}</h2>
                  <button onClick={() => setCrewModalVehicle(null)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">الموظف</label>
                    <select value={crewForm.employeeId} onChange={e => setCrewForm(f => ({ ...f, employeeId: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                      <option value="">اختر موظفاً...</option>
                      {(employees as any[]).filter((e: any) => e.role === 'employee').map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">الدور</label>
                    <select value={crewForm.role} onChange={e => setCrewForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500">
                      <option value="driver">سائق</option>
                      <option value="technician">فني</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!crewForm.employeeId) return;
                    addCrewMember.mutate({ vehicleId: crewModalVehicle.id, d: { employeeId: Number(crewForm.employeeId), role: crewForm.role } });
                  }}
                  disabled={!crewForm.employeeId || addCrewMember.isPending}
                  className="w-full mt-4 bg-brand-600 hover:bg-brand-700 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50">
                  {addCrewMember.isPending ? 'جاري الإضافة...' : 'إضافة'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
