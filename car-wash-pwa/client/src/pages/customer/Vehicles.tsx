import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Star, Trash2, X, Car, Check, AlertTriangle, ChevronRight, Clock, Droplets, Wallet, CalendarDays, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface Vehicle {
  id: number;
  label: string;
  type: string;
  plate: string;
  color: string;
  model: string;
  year: number;
  isDefault: boolean;
}

interface VehicleForm {
  label: string;
  type: string;
  plate: string;
  color: string;
  model: string;
  year: string;
  isDefault: boolean;
}

interface BookingRecord {
  id: number;
  date: string;
  serviceName: string | null;
  amount: string | null;
  status: string;
  rating: number | null;
  employeeName: string | null;
}

interface VehicleHistory {
  bookings: BookingRecord[];
  totalWashes: number;
  totalSpent: string;
  lastWashDate: string | null;
  vehicle: Vehicle;
}

const VEHICLE_TYPES = [
  { value: 'سيدان', emoji: '🚗', label: 'سيدان' },
  { value: 'SUV', emoji: '🚙', label: 'SUV' },
  { value: 'بيكاب', emoji: '🛻', label: 'بيكاب' },
  { value: 'فان', emoji: '🚐', label: 'فان' },
  { value: 'كوبيه', emoji: '🏎️', label: 'كوبيه' },
  { value: 'هاتشباك', emoji: '🚗', label: 'هاتشباك' },
  { value: 'سيارة رياضية', emoji: '🏎️', label: 'سيارة رياضية' },
];

const VEHICLE_COLORS = [
  'أبيض', 'أسود', 'فضي', 'رمادي', 'أحمر', 'أزرق', 'بيج', 'ذهبي', 'أخضر', 'بني',
];

function getVehicleEmoji(type: string): string {
  const found = VEHICLE_TYPES.find((t) => t.value === type);
  return found?.emoji ?? '🚗';
}

function getTypeColor(type: string): string {
  const map: Record<string, string> = {
    'سيدان': '#3b82f6',
    'SUV': '#8b5cf6',
    'بيكاب': '#f59e0b',
    'فان': '#10b981',
    'كوبيه': '#ef4444',
    'هاتشباك': '#06b6d4',
    'سيارة رياضية': '#f97316',
  };
  return map[type] ?? '#64748b';
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
  if (days < 365) return `منذ ${Math.floor(days / 30)} أشهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Vehicle History Drawer ───────────────────────────────────────────────────
function VehicleHistoryDrawer({
  vehicleId,
  onClose,
}: {
  vehicleId: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const { data: history, isLoading } = useQuery<VehicleHistory>({
    queryKey: ['vehicle-history', vehicleId],
    queryFn: () => api.get(`/vehicles/${vehicleId}/history`).then((r) => r.data),
    enabled: vehicleId !== null,
  });

  const v = history?.vehicle;
  const color = v ? getTypeColor(v.type) : '#3b82f6';

  return (
    <AnimatePresence>
      {vehicleId !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${color}20`, border: `1px solid ${color}30` }}
                >
                  {v ? getVehicleEmoji(v.type) : '🚗'}
                </div>
                <div>
                  <h3 className="font-black text-white text-base">{v?.label ?? '...'}</h3>
                  <p className="text-slate-400 text-xs">{v?.model} {v?.year ? `· ${v.year}` : ''}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-slate-800/40 rounded-xl h-16 animate-pulse" />
                  ))}
                </div>
              ) : !history ? (
                <div className="p-8 text-center text-slate-400">تعذر تحميل البيانات</div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <Droplets size={16} className="text-blue-400 mx-auto mb-1" />
                      <p className="text-white font-black text-lg leading-none">{history.totalWashes}</p>
                      <p className="text-slate-500 text-xs mt-0.5">عدد الغسلات</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <Clock size={16} className="text-purple-400 mx-auto mb-1" />
                      <p className="text-white font-black text-sm leading-none">
                        {history.lastWashDate ? formatRelativeDate(history.lastWashDate) : '—'}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">آخر غسلة</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-3 text-center">
                      <Wallet size={16} className="text-amber-400 mx-auto mb-1" />
                      <p className="text-white font-black text-sm leading-none">
                        {parseFloat(history.totalSpent).toLocaleString('ar-SA')} ر.س
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">إجمالي المصروف</p>
                    </div>
                  </div>

                  {/* Vehicle details */}
                  <div className="grid grid-cols-2 gap-2">
                    {v?.plate && (
                      <div className="bg-slate-800/30 rounded-xl px-3 py-2">
                        <p className="text-slate-500 text-xs mb-0.5">اللوحة</p>
                        <p className="text-white font-bold text-sm" dir="ltr">{v.plate}</p>
                      </div>
                    )}
                    {v?.color && (
                      <div className="bg-slate-800/30 rounded-xl px-3 py-2">
                        <p className="text-slate-500 text-xs mb-0.5">اللون</p>
                        <p className="text-white font-bold text-sm">{v.color}</p>
                      </div>
                    )}
                  </div>

                  {/* Booking timeline */}
                  {history.bookings.length === 0 ? (
                    <div className="text-center py-8">
                      <Droplets size={40} className="text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">لا توجد غسلات سابقة لهذه السيارة</p>
                    </div>
                  ) : (
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-3">
                        سجل الخدمات ({history.bookings.length})
                      </h4>
                      <div className="space-y-2">
                        {history.bookings.map((b) => (
                          <div
                            key={b.id}
                            className="bg-slate-800/40 border border-white/5 rounded-xl p-3 flex items-center gap-3"
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: `${color}15`, border: `1px solid ${color}25` }}
                            >
                              <Droplets size={14} style={{ color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-bold truncate">
                                {b.serviceName ?? 'خدمة غسيل'}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <CalendarDays size={11} className="text-slate-500" />
                                <span className="text-slate-500 text-xs">{formatFullDate(b.date)}</span>
                                {b.employeeName && (
                                  <span className="text-slate-600 text-xs">· {b.employeeName}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {b.amount && (
                                <p className="text-white font-bold text-sm">
                                  {parseFloat(b.amount).toLocaleString('ar-SA')} ر.س
                                </p>
                              )}
                              {b.rating !== null && (
                                <div className="flex items-center gap-0.5 justify-end mt-0.5">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      size={10}
                                      className={i < (b.rating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Book now CTA */}
            <div className="p-4 border-t border-white/10 shrink-0">
              <button
                onClick={() => navigate('/app')}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3"
              >
                <Car size={17} />
                احجز الآن
                <ArrowRight size={15} className="opacity-70" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center px-4"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="text-7xl mb-5"
      >
        🚗
      </motion.div>
      <h3 className="text-xl font-black text-white mb-2">لا توجد سيارات مضافة</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-xs">
        أضف سياراتك لتسهيل عملية الحجز وتتبع خدمات الغسيل
      </p>
      <button onClick={onAdd} className="btn-primary flex items-center gap-2">
        <Plus size={18} />
        إضافة سيارة
      </button>
    </motion.div>
  );
}

function VehicleCard({
  vehicle,
  onSetDefault,
  onDelete,
  onViewHistory,
}: {
  vehicle: Vehicle;
  onSetDefault: (id: number) => void;
  onDelete: (id: number) => void;
  onViewHistory: (id: number) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const color = getTypeColor(vehicle.type);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.3 }}
      className="relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all duration-300"
      style={{ boxShadow: `0 4px 24px ${color}12` }}
    >
      {/* Default badge */}
      {vehicle.isDefault && (
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 rounded-full px-2.5 py-0.5">
          <Star size={11} className="fill-amber-400 text-amber-400" />
          <span className="text-amber-400 text-xs font-bold">افتراضية</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          {getVehicleEmoji(vehicle.type)}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-black text-white text-lg leading-tight">{vehicle.label}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs font-bold px-2.5 py-0.5 rounded-full"
              style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
            >
              {vehicle.type}
            </span>
            {vehicle.year && (
              <span className="text-slate-500 text-xs">{vehicle.year}</span>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {vehicle.plate && (
          <div className="bg-slate-800/50 rounded-xl px-3 py-2">
            <p className="text-slate-500 text-xs mb-0.5">اللوحة</p>
            <p className="text-white font-bold text-sm" dir="ltr">{vehicle.plate}</p>
          </div>
        )}
        {vehicle.color && (
          <div className="bg-slate-800/50 rounded-xl px-3 py-2">
            <p className="text-slate-500 text-xs mb-0.5">اللون</p>
            <p className="text-white font-bold text-sm">{vehicle.color}</p>
          </div>
        )}
        {vehicle.model && (
          <div className="bg-slate-800/50 rounded-xl px-3 py-2 col-span-2">
            <p className="text-slate-500 text-xs mb-0.5">الموديل</p>
            <p className="text-white font-bold text-sm">{vehicle.model}</p>
          </div>
        )}
      </div>

      {/* View history button */}
      <button
        onClick={() => onViewHistory(vehicle.id)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 bg-brand-900/30 border border-brand-700/30 hover:bg-brand-900/50 transition-all active:scale-95"
      >
        <div className="flex items-center gap-2">
          <Droplets size={14} className="text-brand-400" />
          <span className="text-brand-300 text-xs font-bold">سجل الخدمات والغسلات</span>
        </div>
        <ChevronRight size={14} className="text-brand-500 rotate-180" />
      </button>

      {/* Actions */}
      <div className="flex gap-2">
        {!vehicle.isDefault && (
          <button
            onClick={() => onSetDefault(vehicle.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border border-amber-600/30 text-amber-400 bg-amber-600/10 hover:bg-amber-600/20 transition-all active:scale-95"
          >
            <Star size={13} />
            تعيين كافتراضية
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-red-600/30 text-red-400 bg-red-600/10 hover:bg-red-600/20 transition-all active:scale-95"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Delete confirm overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-surface-1/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 text-center"
          >
            <AlertTriangle size={32} className="text-red-400 mb-3" />
            <p className="text-white font-bold mb-1">حذف السيارة؟</p>
            <p className="text-slate-400 text-xs mb-5">سيتم حذف "{vehicle.label}" نهائياً</p>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => { onDelete(vehicle.id); setShowDeleteConfirm(false); }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95"
              >
                حذف
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-700/60 border border-slate-600/50 text-white font-bold py-2.5 rounded-xl text-sm transition-all active:scale-95"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function VehicleModal({
  isOpen,
  onClose,
  onSubmit,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (form: VehicleForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<VehicleForm>({
    label: '',
    type: 'سيدان',
    plate: '',
    color: '',
    model: '',
    year: new Date().getFullYear().toString(),
    isDefault: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) { toast.error('أدخل تسمية للسيارة'); return; }
    if (!form.type) { toast.error('اختر نوع السيارة'); return; }
    onSubmit(form);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-brand-900/50 border border-brand-700/40 rounded-xl flex items-center justify-center">
                  <Car size={16} className="text-brand-400" />
                </div>
                <h3 className="font-black text-white text-lg">إضافة سيارة</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800/60 hover:bg-slate-700 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Vehicle type selector */}
              <div>
                <label className="label">نوع السيارة *</label>
                <div className="grid grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.value })}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                        form.type === t.value
                          ? 'border-brand-500 bg-brand-900/40 text-brand-300'
                          : 'border-slate-700/40 bg-slate-800/30 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xl">{t.emoji}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">تسمية السيارة *</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="مثال: سيارتي البيضاء"
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">رقم اللوحة</label>
                  <input
                    type="text"
                    value={form.plate}
                    onChange={(e) => setForm({ ...form, plate: e.target.value })}
                    placeholder="أ ب ج 1234"
                    className="input-field"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="label">اللون</label>
                  <select
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="input-field appearance-none"
                  >
                    <option value="">اختر اللون</option>
                    {VEHICLE_COLORS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">الموديل</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="مثال: كامري 2022"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label">سنة الصنع</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    min="1990"
                    max={new Date().getFullYear() + 1}
                    className="input-field"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Default toggle */}
              <button
                type="button"
                onClick={() => setForm({ ...form, isDefault: !form.isDefault })}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                  form.isDefault
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Star
                    size={16}
                    className={form.isDefault ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}
                  />
                  <span className={`text-sm font-bold ${form.isDefault ? 'text-amber-300' : 'text-slate-400'}`}>
                    تعيين كسيارة افتراضية
                  </span>
                </div>
                <div
                  className={`w-10 h-5 rounded-full transition-all duration-300 flex items-center ${
                    form.isDefault ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
                >
                  <motion.div
                    animate={{ x: form.isDefault ? 20 : 2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="w-4 h-4 rounded-full bg-white shadow"
                  />
                </div>
              </button>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                    />
                  ) : (
                    <>
                      <Check size={16} />
                      حفظ السيارة
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline px-5"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Vehicles() {
  const [modalOpen, setModalOpen] = useState(false);
  const [historyVehicleId, setHistoryVehicleId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery<Vehicle[]>({
    queryKey: ['vehicles'],
    queryFn: () => api.get('/vehicles').then((r) => r.data),
  });

  const { mutate: addVehicle, isPending: isAdding } = useMutation({
    mutationFn: (data: VehicleForm) =>
      api.post('/vehicles', { ...data, year: Number(data.year) || undefined }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setModalOpen(false);
      toast.success('تمت إضافة السيارة');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'فشل في الإضافة');
    },
  });

  const { mutate: setDefault } = useMutation({
    mutationFn: (id: number) => api.put(`/vehicles/${id}`, { isDefault: true }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('تم تعيين السيارة الافتراضية');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'فشل في التحديث');
    },
  });

  const { mutate: deleteVehicle } = useMutation({
    mutationFn: (id: number) => api.delete(`/vehicles/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('تم حذف السيارة');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'فشل في الحذف');
    },
  });

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-900/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-black text-white">سياراتي</h1>
            <p className="text-slate-400 text-sm mt-0.5">إدارة سياراتك المحفوظة</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-2 text-sm px-4 py-2.5"
          >
            <Plus size={17} />
            إضافة سيارة
          </motion.button>
        </motion.div>

        {/* Vehicles */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-800/40 rounded-2xl h-52 animate-pulse" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <EmptyState onAdd={() => setModalOpen(true)} />
        ) : (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {vehicles
                .slice()
                .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
                .map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    onSetDefault={setDefault}
                    onDelete={deleteVehicle}
                    onViewHistory={setHistoryVehicleId}
                  />
                ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <VehicleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={addVehicle}
        isPending={isAdding}
      />

      {/* History Drawer */}
      <VehicleHistoryDrawer
        vehicleId={historyVehicleId}
        onClose={() => setHistoryVehicleId(null)}
      />
    </div>
  );
}
