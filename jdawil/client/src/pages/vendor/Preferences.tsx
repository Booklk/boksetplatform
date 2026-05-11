/**
 * /vendor/preferences — operational preferences for the store.
 *
 * Four tabs so the page doesn't turn into a one-hour scroll:
 *   1. ساعات العمل  — per-day open/close + rest-day toggle
 *   2. القواعد      — lead time, cancel window, slot, capacity, auto-accept
 *   3. العربون      — required? percentage vs fixed amount
 *   4. الحقول       — hide / optional / required for each customer field
 *
 * All writes go through one optimistic-ish mutation: we update local
 * state first, show "حفظ" per tab (no global save bar), and fall back
 * to toast on server rejection.
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Clock, Calendar, Settings2, Coins, Users, Save,
  Plus, X, CalendarX, CheckCircle2,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton,
} from '../../components/ui';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

type FieldMode = 'hidden' | 'optional' | 'required';

interface DayHours { open: string; close: string; closed: boolean; }

interface Preferences {
  hours: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>;
  holidays: string[];
  booking: {
    minLeadMinutes: number;
    maxLeadDays: number;
    cancelDeadlineHours: number;
    slotDurationMinutes: 15 | 30 | 45 | 60;
    maxConcurrent: number;
    autoAccept: boolean;
  };
  deposit: {
    required: boolean;
    type: 'percentage' | 'fixed';
    amount: number;
  };
  fields: Record<'email' | 'vehiclePlate' | 'vehicleType' | 'address' | 'notes', FieldMode>;
}

const DAYS: Array<{ n: 0 | 1 | 2 | 3 | 4 | 5 | 6; label: string }> = [
  { n: 0, label: 'الأحد' },
  { n: 1, label: 'الإثنين' },
  { n: 2, label: 'الثلاثاء' },
  { n: 3, label: 'الأربعاء' },
  { n: 4, label: 'الخميس' },
  { n: 5, label: 'الجمعة' },
  { n: 6, label: 'السبت' },
];

const TABS = [
  { id: 'hours',   label: 'ساعات العمل', icon: Clock },
  { id: 'booking', label: 'قواعد الحجز', icon: Settings2 },
  { id: 'deposit', label: 'العربون',      icon: Coins },
  { id: 'fields',  label: 'حقول العميل',  icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Preferences() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('hours');

  const { data, isLoading } = useQuery<Preferences>({
    queryKey: ['vendor-preferences'],
    queryFn: async () => (await api.get('/vendor-preferences')).data,
  });

  const [local, setLocal] = useState<Preferences | null>(null);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Preferences>) =>
      api.put<Preferences>('/vendor-preferences', patch).then((r) => r.data),
    onSuccess: (next) => {
      qc.setQueryData(['vendor-preferences'], next);
      toast.success('حفظت');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  if (isLoading || !local) {
    return (
      <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
        <div className="max-w-3xl mx-auto space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          icon={<Settings2 size={20} />}
          title="الإعدادات التشغيلية"
          subtitle="ساعات العمل، قواعد الحجز، العربون، الحقول اللي تطلبها من العميل."
        />

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  active
                    ? 'bg-primary-500 text-white'
                    : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={springs.gentle}
          >
            {tab === 'hours' && (
              <HoursPanel
                hours={local.hours}
                holidays={local.holidays}
                onHoursChange={(hours) => setLocal({ ...local, hours })}
                onHolidaysChange={(holidays) => setLocal({ ...local, holidays })}
                onSave={() => save.mutate({ hours: local.hours, holidays: local.holidays })}
                busy={save.isPending}
              />
            )}
            {tab === 'booking' && (
              <BookingPanel
                value={local.booking}
                onChange={(booking) => setLocal({ ...local, booking })}
                onSave={() => save.mutate({ booking: local.booking })}
                busy={save.isPending}
              />
            )}
            {tab === 'deposit' && (
              <DepositPanel
                value={local.deposit}
                onChange={(deposit) => setLocal({ ...local, deposit })}
                onSave={() => save.mutate({ deposit: local.deposit })}
                busy={save.isPending}
              />
            )}
            {tab === 'fields' && (
              <FieldsPanel
                value={local.fields}
                onChange={(fields) => setLocal({ ...local, fields })}
                onSave={() => save.mutate({ fields: local.fields })}
                busy={save.isPending}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// HOURS

function HoursPanel({
  hours, holidays, onHoursChange, onHolidaysChange, onSave, busy,
}: {
  hours: Preferences['hours'];
  holidays: string[];
  onHoursChange: (h: Preferences['hours']) => void;
  onHolidaysChange: (h: string[]) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const [holidayInput, setHolidayInput] = useState('');

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <motion.div variants={fadeInUp}>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-primary-400" />
            <h3 className="font-bold">ساعات العمل الأسبوعية</h3>
          </div>
          <div className="space-y-2">
            {DAYS.map(({ n, label }) => {
              const day = hours[n];
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-bold text-ink-200">{label}</span>
                  <label className="inline-flex items-center gap-1 text-[11px] text-ink-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(e) => onHoursChange({ ...hours, [n]: { ...day, closed: e.target.checked } })}
                      className="accent-primary-500"
                    />
                    مغلق
                  </label>
                  <div className={`flex items-center gap-2 flex-1 ${day.closed ? 'opacity-40 pointer-events-none' : ''}`}>
                    <input
                      type="time"
                      value={day.open}
                      onChange={(e) => onHoursChange({ ...hours, [n]: { ...day, open: e.target.value } })}
                      className="bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-2 py-1.5 text-xs outline-none"
                    />
                    <span className="text-ink-500 text-xs">إلى</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={(e) => onHoursChange({ ...hours, [n]: { ...day, close: e.target.value } })}
                      className="bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-2 py-1.5 text-xs outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card variant="default" padding="md">
          <div className="flex items-center gap-2 mb-3">
            <CalendarX size={15} className="text-warn-400" />
            <h3 className="font-bold">أيام العطلات</h3>
          </div>
          <p className="text-[11px] text-ink-400 mb-3">
            أضف أيام معيّنة يكون فيها المتجر مغلق (عيد، إجازة، يوم وطني…). العملاء ما يقدرون يحجزون فيها.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="date"
              value={holidayInput}
              onChange={(e) => setHolidayInput(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-3 py-2 text-xs outline-none"
            />
            <Button
              size="sm"
              leftIcon={<Plus size={13} />}
              disabled={!holidayInput || holidays.includes(holidayInput)}
              onClick={() => {
                onHolidaysChange([...holidays, holidayInput].sort());
                setHolidayInput('');
              }}
            >
              إضافة
            </Button>
          </div>
          {holidays.length === 0 ? (
            <p className="text-[11px] text-ink-500">ما في عطلات مضافة</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {holidays.map((d) => (
                <button
                  key={d}
                  onClick={() => onHolidaysChange(holidays.filter((x) => x !== d))}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-warn-500/15 border border-warn-500/30 text-warn-200 text-[11px] font-mono hover:bg-warn-500/25"
                  dir="ltr"
                >
                  {d}
                  <X size={10} />
                </button>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <RamadanAutoToggle />
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
          حفظ ساعات العمل والعطلات
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// BOOKING RULES

function BookingPanel({
  value, onChange, onSave, busy,
}: {
  value: Preferences['booking'];
  onChange: (v: Preferences['booking']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Settings2 size={15} className="text-primary-400" />
        <h3 className="font-bold">قواعد الحجز</h3>
      </div>

      <NumberRow
        label="أقل وقت بين الحجز والموعد"
        help="كم دقيقة قبل الموعد يقدر العميل يحجز فيه"
        value={value.minLeadMinutes}
        suffix="دقيقة"
        min={0} max={20160}
        onChange={(v) => onChange({ ...value, minLeadMinutes: v })}
      />
      <NumberRow
        label="أبعد يوم يقدر العميل يحجز فيه"
        help="مثلاً 30 يعني لا يسمح الحجز أبعد من شهر"
        value={value.maxLeadDays}
        suffix="يوم"
        min={1} max={365}
        onChange={(v) => onChange({ ...value, maxLeadDays: v })}
      />
      <NumberRow
        label="حد الإلغاء قبل الموعد"
        help="أقل عدد ساعات يسمح فيها العميل يلغي قبل الموعد"
        value={value.cancelDeadlineHours}
        suffix="ساعة"
        min={0} max={168}
        onChange={(v) => onChange({ ...value, cancelDeadlineHours: v })}
      />

      <div>
        <label className="block text-xs font-bold text-ink-300 mb-1.5">مدة الفترة الواحدة</label>
        <div className="flex flex-wrap gap-1.5">
          {[15, 30, 45, 60].map((n) => {
            const active = value.slotDurationMinutes === n;
            return (
              <button
                key={n}
                onClick={() => onChange({ ...value, slotDurationMinutes: n as 15 | 30 | 45 | 60 })}
                className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
                  active
                    ? 'bg-primary-500 text-white'
                    : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
                }`}
              >
                {n} دقيقة
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-ink-500">الفترات اللي يظهرها الموقع للعميل (كل 30 دقيقة مثلاً).</p>
      </div>

      <NumberRow
        label="الحد الأقصى للحجوزات بنفس الوقت"
        help="لو عندك 3 موظفين = 3"
        value={value.maxConcurrent}
        suffix="حجز"
        min={1} max={50}
        onChange={(v) => onChange({ ...value, maxConcurrent: v })}
      />

      <div className="flex items-start justify-between gap-3 pt-2 border-t border-white/[0.06]">
        <div>
          <p className="text-sm font-bold text-white">قبول الحجوزات تلقائياً</p>
          <p className="text-[11px] text-ink-400 leading-relaxed">
            لو أقفلت، كل حجز يدخل يكون "بانتظار التأكيد" ويحتاج منك ضغطة.
          </p>
        </div>
        <Toggle checked={value.autoAccept} onChange={(v) => onChange({ ...value, autoAccept: v })} />
      </div>

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ قواعد الحجز
      </Button>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// DEPOSIT

function DepositPanel({
  value, onChange, onSave, busy,
}: {
  value: Preferences['deposit'];
  onChange: (v: Preferences['deposit']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Coins size={15} className="text-warn-400" />
        <h3 className="font-bold">العربون لتأكيد الحجز</h3>
      </div>
      <p className="text-xs text-ink-400 leading-relaxed">
        تفعيل العربون يقلّل No-Shows بشكل كبير. يُطلب من العميل يدفع نسبة أو مبلغ ثابت لحجز الموعد، والباقي يُدفع في الموقع.
      </p>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">طلب عربون لكل حجز</p>
        <Toggle checked={value.required} onChange={(v) => onChange({ ...value, required: v })} />
      </div>

      {value.required && (
        <div className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div>
            <label className="block text-xs font-bold text-ink-300 mb-1.5">نوع العربون</label>
            <div className="flex gap-1.5">
              {(['percentage', 'fixed'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...value, type: t })}
                  className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
                    value.type === t
                      ? 'bg-warn-500 text-ink-900'
                      : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
                  }`}
                >
                  {t === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}
                </button>
              ))}
            </div>
          </div>
          <Input
            label={value.type === 'percentage' ? 'النسبة %' : 'المبلغ (ر.س)'}
            type="number"
            dir="ltr"
            value={String(value.amount)}
            min={0}
            max={value.type === 'percentage' ? 100 : 100000}
            onChange={(e) => onChange({ ...value, amount: Math.max(0, Number(e.target.value) || 0) })}
            help={value.type === 'percentage'
              ? 'يُحسب كنسبة من قيمة الخدمة. 20% شائع.'
              : 'مبلغ ثابت لكل حجز. مناسب لو الأسعار متقاربة.'}
          />
        </div>
      )}

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ إعدادات العربون
      </Button>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// CUSTOMER FIELDS

const FIELD_ROWS: Array<{ key: keyof Preferences['fields']; label: string; hint: string }> = [
  { key: 'address',      label: 'العنوان',           hint: 'للخدمات المنزلية' },
  { key: 'email',        label: 'البريد الإلكتروني',  hint: 'لإرسال الإيصال' },
  { key: 'vehiclePlate', label: 'رقم لوحة السيارة',   hint: 'لمغاسل السيارات' },
  { key: 'vehicleType',  label: 'نوع السيارة',        hint: 'لتحديد السعر' },
  { key: 'notes',        label: 'ملاحظات إضافية',     hint: 'للطلبات الخاصة' },
];

function FieldsPanel({
  value, onChange, onSave, busy,
}: {
  value: Preferences['fields'];
  onChange: (v: Preferences['fields']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md" className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Users size={15} className="text-success-400" />
        <h3 className="font-bold">الحقول اللي تطلبها من العميل</h3>
      </div>
      <p className="text-xs text-ink-400 leading-relaxed">
        خليه مخفي إذا ما تحتاجه، اختياري لو يساعدك، إلزامي لو ضروري. تقليل الحقول يزيد نسبة إتمام الحجوزات.
      </p>
      {FIELD_ROWS.map(({ key, label, hint }) => {
        const mode = value[key];
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.04] last:border-0">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-[11px] text-ink-500">{hint}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              {(['hidden', 'optional', 'required'] as FieldMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ ...value, [key]: m })}
                  className={`px-2.5 h-7 rounded-lg text-[10px] font-bold transition-colors ${
                    mode === m
                      ? m === 'required' ? 'bg-danger-500 text-white'
                        : m === 'optional' ? 'bg-warn-500 text-ink-900'
                        : 'bg-white/[0.1] text-white'
                      : 'bg-white/[0.04] text-ink-400 hover:bg-white/[0.08]'
                  }`}
                >
                  {m === 'hidden' ? 'مخفي' : m === 'optional' ? 'اختياري' : 'إلزامي'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
        حفظ الحقول
      </Button>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function NumberRow({
  label, help, value, suffix, min, max, onChange,
}: {
  label: string;
  help?: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-300 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isFinite(n)) return;
            onChange(Math.max(min ?? 0, Math.min(max ?? 99999, n)));
          }}
          className="w-24 bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-3 py-1.5 text-sm text-center tabular-nums outline-none"
          dir="ltr"
        />
        {suffix && <span className="text-xs text-ink-400">{suffix}</span>}
      </div>
      {help && <p className="mt-1 text-[11px] text-ink-500">{help}</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-white/[0.08]'}`}
    >
      <motion.span
        animate={{ x: checked ? -16 : 0 }}
        transition={springs.snappy}
        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow"
      />
    </button>
  );
}

// Kept for badge-reuse suppression
void CheckCircle2; void Calendar; void Badge;

/** Ramadan auto-shift toggle — self-contained. Hits /vendor-preferences/ramadan. */
function RamadanAutoToggle() {
  const qc = useQueryClient();
  const { data } = useQuery<{ enabled: boolean; applied: boolean }>({
    queryKey: ['ramadan-toggle'],
    queryFn: async () => (await api.get('/vendor-preferences/ramadan')).data,
  });
  const mut = useMutation({
    mutationFn: (enabled: boolean) => api.put('/vendor-preferences/ramadan', { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ramadan-toggle'] });
      toast.success('تم الحفظ');
    },
  });
  const enabled = data?.enabled ?? false;
  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white mb-0.5">🌙 توقيت رمضان التلقائي</p>
          <p className="text-xs text-ink-400 leading-relaxed">
            لما يبدأ رمضان، يحوّل متجرك تلقائياً لساعات ما بعد الإفطار (4 عصراً — 2 صباحاً)،
            ويرجعه بعد العيد لساعاتك السابقة.
          </p>
          {data?.applied && (
            <Badge tone="warn" size="sm" className="mt-2">مفعّل حالياً · نحن في رمضان</Badge>
          )}
        </div>
        <Toggle checked={enabled} onChange={(v) => mut.mutate(v)} />
      </div>
    </Card>
  );
}
