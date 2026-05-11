/**
 * Super-admin: manage mobile app orders.
 * Lists every order with filter by status. Click an order to update status
 * + paste URLs for the delivered files (APK, IPA project, GitHub repo, manual).
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, Loader2, ExternalLink, X, Save, Search, Smartphone, Apple, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

type Status = 'pending_payment' | 'paid' | 'in_production' | 'ready' | 'delivered' | 'cancelled' | 'refunded';

interface Order {
  id: number;
  vendorId: number;
  vendorName: string;
  vendorSlug: string;
  planId: 'android' | 'ios' | 'both' | 'support_hour';
  pricePaidSar: string;
  status: Status;
  appName?: string;
  iconUrl?: string;
  primaryColor?: string;
  description?: string;
  bundleId?: string;
  androidApkUrl?: string;
  iosProjectUrl?: string;
  githubRepoUrl?: string;
  manualUrl?: string;
  adminNotes?: string;
  createdAt: string;
  paidAt?: string;
  deliveredAt?: string;
  plan?: { nameAr: string; durationDays: number };
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  pending_payment: { label: 'في انتظار الدفع', color: 'amber' },
  paid:            { label: 'تم الدفع',          color: 'sky' },
  in_production:   { label: 'قيد البناء',         color: 'sky' },
  ready:           { label: 'جاهز',               color: 'emerald' },
  delivered:       { label: 'تم التسليم',         color: 'emerald' },
  cancelled:       { label: 'ملغي',               color: 'slate' },
  refunded:        { label: 'مسترد',              color: 'slate' },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
  sky:     { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/30' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  slate:   { bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30' },
};

const PLAN_ICONS = { android: Smartphone, ios: Apple, both: Sparkles, support_hour: Package };

export default function MobileAppOrders() {
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['admin-mobile-app-orders'],
    queryFn: () => api.get('/super-admin/mobile-app-orders').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const filtered = useMemo(() => {
    return orders.filter((o) =>
      (filter === 'all' || o.status === filter) &&
      (search === '' ||
        o.vendorName?.includes(search) ||
        o.appName?.toLowerCase().includes(search.toLowerCase())),
    );
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  if (isLoading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-orange-400" /></div>;
  }

  const totalRevenue = orders
    .filter((o) => ['paid', 'in_production', 'ready', 'delivered'].includes(o.status))
    .reduce((s, o) => s + parseFloat(o.pricePaidSar), 0);

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2.5">
              <Package size={22} className="text-orange-400" />
              طلبات تطبيقات الجوال
            </h1>
            <p className="text-slate-400 text-sm mt-2">إدارة طلبات بناء التطبيقات وتسليم الملفات للتجار.</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400">إجمالي الإيراد</p>
            <p className="text-xl font-black text-emerald-300">{totalRevenue.toLocaleString()} ر.س</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>الكل ({counts.all})</FilterPill>
          {(['pending_payment', 'paid', 'in_production', 'ready', 'delivered', 'cancelled'] as Status[]).map((s) => {
            if (!counts[s]) return null;
            const m = STATUS_META[s];
            return (
              <FilterPill key={s} active={filter === s} onClick={() => setFilter(s)} color={m.color}>
                {m.label} ({counts[s]})
              </FilterPill>
            );
          })}

          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث..."
              className="w-full bg-slate-900 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>

        {/* Orders list */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">لا توجد طلبات</div>
          ) : (
            filtered.map((o) => <OrderRow key={o.id} order={o} onClick={() => setEditing(o)} />)
          )}
        </div>
      </div>

      {editing && <EditModal order={editing} onClose={() => setEditing(null)} />}
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

function OrderRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const meta = STATUS_META[order.status];
  const c = COLOR_CLASSES[meta.color];
  const Icon = PLAN_ICONS[order.planId];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-right grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-3.5 border-b border-white/5 hover:bg-white/[0.03] transition-colors items-center"
    >
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        {order.iconUrl ? (
          <img src={order.iconUrl} alt="" className="w-full h-full rounded-lg object-cover" />
        ) : (
          <Icon size={16} className="text-orange-400" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold text-white truncate">{order.appName ?? `طلب #${order.id}`}</span>
          <span className={`text-[10px] font-bold ${c.text} ${c.bg} px-2 py-0.5 rounded-full`}>{meta.label}</span>
        </div>
        <p className="text-[11px] text-slate-500">
          {order.vendorName} · {order.plan?.nameAr ?? order.planId}
        </p>
      </div>
      <div className="text-left">
        <p className="text-sm font-bold text-emerald-300">{parseFloat(order.pricePaidSar).toLocaleString()} ر.س</p>
        <p className="text-[10px] text-slate-500">{new Date(order.createdAt).toLocaleDateString('ar-SA')}</p>
      </div>
      <ExternalLink size={12} className="text-slate-500" />
    </button>
  );
}

function EditModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    status: order.status,
    androidApkUrl: order.androidApkUrl ?? '',
    iosProjectUrl: order.iosProjectUrl ?? '',
    githubRepoUrl: order.githubRepoUrl ?? '',
    manualUrl: order.manualUrl ?? '',
    adminNotes: order.adminNotes ?? '',
  });

  const save = useMutation({
    mutationFn: () => api.patch(`/super-admin/mobile-app-orders/${order.id}`, form),
    onSuccess: () => {
      toast.success('تم التحديث');
      qc.invalidateQueries({ queryKey: ['admin-mobile-app-orders'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل التحديث'),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-slate-900">
          <div>
            <h3 className="text-base font-black text-white">طلب #{order.id}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{order.vendorName} · {order.appName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order details */}
          <div className="rounded-xl bg-white/[0.02] border border-white/8 p-4 space-y-2 text-xs">
            <Row label="الباقة" value={order.plan?.nameAr ?? order.planId} />
            <Row label="القيمة" value={`${parseFloat(order.pricePaidSar).toLocaleString()} ر.س`} />
            <Row label="Bundle ID" value={order.bundleId ?? '—'} mono />
            <Row label="اللون" value={order.primaryColor ?? '—'} />
            {order.description && <Row label="الوصف" value={order.description.slice(0, 100) + '...'} />}
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">الحالة</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Status })}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
            >
              {Object.entries(STATUS_META).map(([k, m]) => (
                <option key={k} value={k}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Delivery URLs */}
          <UrlField label="رابط Android APK" value={form.androidApkUrl} onChange={(v) => setForm({ ...form, androidApkUrl: v })} />
          <UrlField label="رابط iOS Project (zip)" value={form.iosProjectUrl} onChange={(v) => setForm({ ...form, iosProjectUrl: v })} />
          <UrlField label="رابط GitHub Repo" value={form.githubRepoUrl} onChange={(v) => setForm({ ...form, githubRepoUrl: v })} />
          <UrlField label="رابط دليل النشر (PDF)" value={form.manualUrl} onChange={(v) => setForm({ ...form, manualUrl: v })} />

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">ملاحظات داخلية</label>
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
              rows={2}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none"
            />
          </div>

          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-[11px] text-amber-200">
            عند تغيير الحالة لـ <span className="font-bold">"جاهز" أو "تم التسليم"</span>، يصل التاجر إشعار واتساب تلقائياً.
          </div>

          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ التحديثات
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-white truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</span>
    </div>
  );
}

function UrlField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-300 block mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://..."
        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs font-mono outline-none focus:border-orange-500/40"
      />
    </div>
  );
}
