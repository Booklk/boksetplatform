/**
 * /vendor/autopilot — the control room for vendor automation.
 *
 * Four cards, one per engine. Each has a toggle, its rules, and the
 * latest decision this engine made. A live Decisions Feed on the right
 * shows every autonomous action in real time (via WebSocket).
 */

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Bot, UserCheck, Package, Mail, CheckCircle2, Play, Clock,
  AlertCircle, Zap,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, PageHeader, EmptyState, Skeleton, Badge,
} from '../../components/ui';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';
import { useRealtime } from '../../hooks/useRealtime';

interface AutopilotConfig {
  assignEmployee:   { enabled: boolean; strategy: 'round_robin' | 'least_loaded' | 'highest_rated'; minLeadMinutes: number };
  reorderInventory: { enabled: boolean; reorderFactor: number; notifyOwnerOnReorder: boolean };
  dormantRemarket:  { enabled: boolean; dormantDays: number; dailyLimit: number };
  autoConfirm:      { enabled: boolean; minCompletedBookings: number; respectPrayerTimes: boolean };
}

interface Decision {
  id: number;
  action: string;
  metadata: { summary: string; skipped?: boolean; reason?: string } & Record<string, unknown>;
  createdAt: string;
}

const ACTION_META: Record<string, { label: string; icon: any; tint: string }> = {
  'autopilot.assign_employee':     { label: 'تعيين موظف',      icon: UserCheck, tint: 'text-primary-300' },
  'autopilot.reorder_inventory':   { label: 'إعادة طلب مخزون',  icon: Package,    tint: 'text-success-300' },
  'autopilot.dormant_message':     { label: 'رسالة استعادة',    icon: Mail,       tint: 'text-warn-300' },
  'autopilot.auto_confirm':        { label: 'تأكيد تلقائي',     icon: CheckCircle2, tint: 'text-sky-300' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}

export default function Autopilot() {
  const qc = useQueryClient();
  const { subscribe } = useRealtime();
  const [feed, setFeed] = useState<Decision[]>([]);

  const { data: config, isLoading } = useQuery<AutopilotConfig>({
    queryKey: ['autopilot-config'],
    queryFn: async () => (await api.get('/autopilot/config')).data,
  });

  const { data: decisionsData } = useQuery<{ decisions: Decision[] }>({
    queryKey: ['autopilot-decisions'],
    queryFn: async () => (await api.get('/autopilot/decisions?limit=50')).data,
  });

  useEffect(() => {
    if (decisionsData?.decisions) setFeed(decisionsData.decisions);
  }, [decisionsData]);

  // Real-time: every autopilot.decision broadcast lands at the top of the feed.
  useEffect(() => {
    return subscribe<{ id: number; action: string; meta: Record<string, any>; at: string }>(
      'autopilot.decision',
      (ev) => {
        setFeed((prev) => [
          {
            id: ev.payload.id,
            action: ev.payload.action,
            metadata: ev.payload.meta as any,
            createdAt: ev.payload.at,
          },
          ...prev,
        ].slice(0, 50));
      },
    );
  }, [subscribe]);

  const save = useMutation({
    mutationFn: (patch: Partial<AutopilotConfig>) =>
      api.put<AutopilotConfig>('/autopilot/config', patch).then((r) => r.data),
    onSuccess: (next) => {
      qc.setQueryData(['autopilot-config'], next);
      toast.success('حفظت');
    },
    onError: () => toast.error('تعذّر الحفظ'),
  });

  const runNow = useMutation({
    mutationFn: () => api.post('/autopilot/run'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autopilot-decisions'] });
      toast.success('الطيّار الآلي شغّال…');
    },
    onError: () => toast.error('فشل التشغيل'),
  });

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          icon={<Bot size={20} />}
          title="الطيّار الآلي"
          subtitle="خل النظام يشتغل بدالك — توزيع حجوزات، إعادة مخزون، رسائل استعادة — وأنت تراجع."
          actions={
            <Button
              leftIcon={<Play size={14} />}
              loading={runNow.isPending}
              onClick={() => runNow.mutate()}
            >
              شغّل الآن
            </Button>
          }
        />

        {isLoading || !config ? (
          <div className="grid lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr,360px] gap-4">
            {/* ── Engines ───────────────────────────────────────────────── */}
            <motion.div
              className="grid sm:grid-cols-2 gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <EngineCard
                icon={<UserCheck size={18} />}
                title="تعيين الموظفين تلقائياً"
                description="يوزّع الحجوزات المؤكّدة على الموظفين المتاحين — بأقل حمل، أو الأعلى تقييماً، أو بالتدوير."
                tone="primary"
                enabled={config.assignEmployee.enabled}
                onToggle={(v) => save.mutate({ assignEmployee: { ...config.assignEmployee, enabled: v } })}
                loading={save.isPending}
              >
                <Row
                  label="الاستراتيجية"
                  control={
                    <select
                      value={config.assignEmployee.strategy}
                      onChange={(e) => save.mutate({ assignEmployee: { ...config.assignEmployee, strategy: e.target.value as any } })}
                      className="bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-2.5 py-1 text-xs outline-none"
                    >
                      <option value="least_loaded">الأقل حمل</option>
                      <option value="highest_rated">الأعلى تقييماً</option>
                      <option value="round_robin">بالتدوير</option>
                    </select>
                  }
                />
                <Row
                  label="لا يعيّن قبل الموعد بأقل من"
                  control={
                    <NumberInput
                      value={config.assignEmployee.minLeadMinutes}
                      min={0} max={720} step={5} suffix="د"
                      onChange={(n) => save.mutate({ assignEmployee: { ...config.assignEmployee, minLeadMinutes: n } })}
                    />
                  }
                />
              </EngineCard>

              <EngineCard
                icon={<CheckCircle2 size={18} />}
                title="التأكيد التلقائي"
                description="يؤكّد حجوزات العملاء الموثوقين دون تدخّلك — يحترم أوقات الصلاة."
                tone="info"
                enabled={config.autoConfirm.enabled}
                onToggle={(v) => save.mutate({ autoConfirm: { ...config.autoConfirm, enabled: v } })}
                loading={save.isPending}
              >
                <Row
                  label="أقل عدد حجوزات مكتملة للثقة"
                  control={
                    <NumberInput
                      value={config.autoConfirm.minCompletedBookings}
                      min={0} max={50}
                      onChange={(n) => save.mutate({ autoConfirm: { ...config.autoConfirm, minCompletedBookings: n } })}
                    />
                  }
                />
                <Row
                  label="احترام أوقات الصلاة"
                  control={
                    <Switch
                      checked={config.autoConfirm.respectPrayerTimes}
                      onChange={(v) => save.mutate({ autoConfirm: { ...config.autoConfirm, respectPrayerTimes: v } })}
                    />
                  }
                />
              </EngineCard>

              <EngineCard
                icon={<Package size={18} />}
                title="إعادة طلب المخزون"
                description="لما يقل الصنف عن الحد الأدنى، يطلب كمية تكفي لفترة وتنبّهك."
                tone="success"
                enabled={config.reorderInventory.enabled}
                onToggle={(v) => save.mutate({ reorderInventory: { ...config.reorderInventory, enabled: v } })}
                loading={save.isPending}
              >
                <Row
                  label="عامل الطلب (×الحد الأدنى)"
                  control={
                    <NumberInput
                      value={config.reorderInventory.reorderFactor}
                      min={1} max={10}
                      onChange={(n) => save.mutate({ reorderInventory: { ...config.reorderInventory, reorderFactor: n } })}
                    />
                  }
                />
                <Row
                  label="تنبيه واتساب عند الطلب"
                  control={
                    <Switch
                      checked={config.reorderInventory.notifyOwnerOnReorder}
                      onChange={(v) => save.mutate({ reorderInventory: { ...config.reorderInventory, notifyOwnerOnReorder: v } })}
                    />
                  }
                />
              </EngineCard>

              <EngineCard
                icon={<Mail size={18} />}
                title="استعادة العملاء الغائبين"
                description="رسالة واتساب لكل عميل ما زارك من فترة — بلا روتين، بلا اشتراك إضافي."
                tone="warn"
                enabled={config.dormantRemarket.enabled}
                onToggle={(v) => save.mutate({ dormantRemarket: { ...config.dormantRemarket, enabled: v } })}
                loading={save.isPending}
              >
                <Row
                  label="يعتبر العميل غائب بعد"
                  control={
                    <NumberInput
                      value={config.dormantRemarket.dormantDays}
                      min={7} max={365} step={7} suffix="يوم"
                      onChange={(n) => save.mutate({ dormantRemarket: { ...config.dormantRemarket, dormantDays: n } })}
                    />
                  }
                />
                <Row
                  label="حد أقصى يومي"
                  control={
                    <NumberInput
                      value={config.dormantRemarket.dailyLimit}
                      min={1} max={500}
                      onChange={(n) => save.mutate({ dormantRemarket: { ...config.dormantRemarket, dailyLimit: n } })}
                    />
                  }
                />
              </EngineCard>
            </motion.div>

            {/* ── Live feed ─────────────────────────────────────────────── */}
            <Card variant="elevated" padding="none" className="h-fit sticky top-4">
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <Zap size={14} className="text-warn-400" />
                <h3 className="font-bold">تغذية مباشرة</h3>
                <span className="text-[10px] text-ink-500 mr-auto">آخر {feed.length}</span>
              </div>
              {feed.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    compact
                    icon={<Bot size={18} />}
                    title="ما سوى الطيّار شي بعد"
                    body="فعّل محرك واحد على الأقل — أول عملية بتظهر هنا لحظياً."
                  />
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  <ul className="divide-y divide-white/[0.04] max-h-[70vh] overflow-y-auto">
                    {feed.map((d) => <DecisionRow key={d.id} d={d} />)}
                  </ul>
                </AnimatePresence>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function EngineCard({
  icon, title, description, tone, enabled, onToggle, loading, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'primary' | 'success' | 'warn' | 'info';
  enabled: boolean;
  onToggle: (v: boolean) => void;
  loading: boolean;
  children?: React.ReactNode;
}) {
  const tintMap = {
    primary: 'text-primary-300 bg-primary-500/10 border-primary-500/20',
    success: 'text-success-300 bg-success-500/10 border-success-500/20',
    warn:    'text-warn-300    bg-warn-500/10    border-warn-500/20',
    info:    'text-sky-300     bg-sky-500/10     border-sky-500/20',
  }[tone];
  return (
    <motion.div variants={fadeInUp}>
      <Card variant={enabled ? 'elevated' : 'default'} padding="md">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${tintMap}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white">{title}</h3>
              {enabled && <Badge tone="success" size="sm" dot className="mt-1">فعّال</Badge>}
            </div>
          </div>
          <Switch checked={enabled} onChange={onToggle} disabled={loading} />
        </div>
        <p className="text-xs text-ink-400 leading-relaxed mb-3">{description}</p>
        {enabled && (
          <div className="space-y-1.5 pt-3 border-t border-white/[0.06]">
            {children}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function Row({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-ink-400">{label}</span>
      {control}
    </div>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative w-10 h-6 rounded-full transition-colors disabled:opacity-50
        ${checked ? 'bg-primary-500' : 'bg-white/[0.08]'}
      `}
    >
      <motion.span
        animate={{ x: checked ? -16 : 0 }}
        transition={springs.snappy}
        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow"
      />
    </button>
  );
}

function NumberInput({
  value, onChange, min = 0, max = 999, step = 1, suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number; max?: number; step?: number;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-20 bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-lg px-2 py-1 text-xs text-white outline-none text-center tabular-nums"
      />
      {suffix && <span className="text-[10px] text-ink-500">{suffix}</span>}
    </div>
  );
}

function DecisionRow({ d }: { d: Decision }) {
  const meta = ACTION_META[d.action] ?? { label: d.action, icon: Clock, tint: 'text-ink-300' };
  const Icon = meta.icon;
  const skipped = Boolean(d.metadata?.skipped);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={springs.gentle}
      className="p-3 flex items-start gap-2.5"
    >
      <div className={`shrink-0 w-7 h-7 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center ${skipped ? 'opacity-50' : ''}`}>
        {skipped ? <AlertCircle size={13} className="text-ink-500" /> : <Icon size={13} className={meta.tint} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-[11px] font-bold text-ink-300">{meta.label}</span>
          {skipped && <Badge size="sm" tone="neutral">تم التخطّي</Badge>}
        </div>
        <p className="text-xs text-white leading-snug">{d.metadata?.summary}</p>
        <p className="text-[10px] text-ink-600 mt-0.5">{timeAgo(d.createdAt)}</p>
      </div>
    </motion.li>
  );
}
