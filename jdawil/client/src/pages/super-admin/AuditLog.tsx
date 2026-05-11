/**
 * Super-admin Audit Log — append-only billing events viewer.
 * Lets the platform owner see every quota / addon / subscription event
 * across all vendors with filters by event type and vendor.
 *
 * Route: /super-admin/audit
 */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ScrollText, AlertTriangle, CheckCircle2, Sparkles,
  TrendingUp, XCircle, Loader2, Search, Activity,
} from 'lucide-react';
import api from '../../lib/api';

interface AuditRow {
  id: number;
  vendorId: number;
  vendorName: string | null;
  event: string;
  resource: string | null;
  amount: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface Response {
  rows: AuditRow[];
  summary: Record<string, number>;
  total: number;
}

const EVENT_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  addon_activated:                    { label: 'تفعيل إضافة',           color: 'emerald', icon: Sparkles },
  addon_deactivated:                  { label: 'إلغاء إضافة',           color: 'slate',   icon: XCircle },
  quota_exceeded:                     { label: 'تجاوز الحد',             color: 'red',     icon: AlertTriangle },
  overflow_charged:                   { label: 'رسوم تجاوز',             color: 'amber',   icon: TrendingUp },
  denied_subscription_inactive:       { label: 'رفض — اشتراك غير نشط',  color: 'red',     icon: XCircle },
  denied_plan_locked:                 { label: 'رفض — الميزة مقفلة',    color: 'amber',   icon: XCircle },
  subscription_grant:                 { label: 'منحة اشتراك',            color: 'sky',     icon: Sparkles },
  addons_disabled_subscription_inactive: { label: 'إلغاء آلي — انتهاء اشتراك', color: 'slate', icon: Activity },
  payment_succeeded:                  { label: 'دفع ناجح',               color: 'emerald', icon: CheckCircle2 },
  payment_failed:                     { label: 'دفع فاشل',               color: 'red',     icon: XCircle },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/20' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-300',     border: 'border-red-500/20' },
  sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/20' },
  slate:   { bg: 'bg-slate-500/10',   text: 'text-slate-300',   border: 'border-slate-500/20' },
};

export default function AuditLog() {
  const [eventFilter, setEventFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery<Response>({
    queryKey: ['billing-audit', eventFilter, days],
    queryFn: () => api.get('/super-admin/billing-audit', {
      params: { event: eventFilter || undefined, days },
    }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter((r) =>
      r.vendorName?.toLowerCase().includes(q) ||
      String(r.vendorId).includes(q) ||
      r.event.includes(q),
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2.5">
            <ScrollText size={22} className="text-orange-400" />
            سجل الأحداث المالية
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            كل حدث يخص الاشتراكات / الإضافات / الحدود — قابل للقراءة فقط، لا يُحذف ولا يُعدَّل (append-only).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <FilterPill active={eventFilter === ''} onClick={() => setEventFilter('')}>الكل ({data.total})</FilterPill>
          {Object.entries(data.summary).map(([event, count]) => {
            const meta = EVENT_META[event] ?? { label: event, color: 'slate', icon: Activity };
            return (
              <FilterPill
                key={event}
                active={eventFilter === event}
                onClick={() => setEventFilter(event)}
                color={meta.color}
              >
                {meta.label} ({count})
              </FilterPill>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم التاجر أو رقمه..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
            />
          </div>
          <div className="flex items-center gap-1 text-xs">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`px-3 py-2 rounded-lg font-bold transition-colors ${
                  days === d ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {d} يوم
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">لا توجد أحداث للفلتر الحالي</div>
          ) : (
            filtered.map((r) => <AuditRowCard key={r.id} row={r} />)
          )}
        </div>
      </div>
    </div>
  );
}

function FilterPill({
  active, onClick, children, color = 'slate',
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  const c = COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
        active ? `${c.bg} ${c.border} ${c.text}` : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function AuditRowCard({ row }: { row: AuditRow }) {
  const meta = EVENT_META[row.event] ?? { label: row.event, color: 'slate', icon: Activity };
  const c = COLOR_CLASSES[meta.color];
  const Icon = meta.icon;
  const meta2 = (row.metadata ?? {}) as Record<string, unknown>;

  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-start">
      <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={14} className={c.text} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-xs font-bold ${c.text}`}>{meta.label}</span>
          <span className="text-[10px] text-slate-600">·</span>
          <span className="text-xs text-white truncate">{row.vendorName ?? `Vendor #${row.vendorId}`}</span>
          {row.resource && (
            <>
              <span className="text-[10px] text-slate-600">·</span>
              <code className="text-[10px] text-slate-500 bg-slate-900/40 px-1.5 py-0.5 rounded">{row.resource}</code>
            </>
          )}
        </div>
        {Object.keys(meta2).length > 0 && (
          <p className="text-[10px] text-slate-500 truncate font-mono">
            {Object.entries(meta2)
              .filter(([k]) => !['grantedByUserId', 'previousAddons'].includes(k))
              .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
              .join(' · ')}
          </p>
        )}
      </div>
      <div className="text-left flex-shrink-0">
        {row.amount && parseFloat(row.amount) !== 0 && (
          <p className="text-sm font-bold text-orange-300">{parseFloat(row.amount).toFixed(2)} ر.س</p>
        )}
        <p className="text-[10px] text-slate-600">
          {new Date(row.createdAt).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
        </p>
      </div>
    </div>
  );
}
