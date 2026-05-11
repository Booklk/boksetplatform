/**
 * Super-admin profitability dashboard — answers "هل المنصة كسبانة من كل تاجر؟"
 *
 * Shows aggregate platform revenue/cost/margin at the top, then a sortable
 * list of vendors prioritized by losing > thin > inactive > profitable so
 * the platform owner can see problems first.
 *
 * Route: /super-admin/profitability
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Loader2, Wallet, Activity, Search,
} from 'lucide-react';
import api from '../../lib/api';

type Health = 'profitable' | 'thin' | 'losing' | 'inactive';

interface VendorRow {
  vendorId: number;
  nameAr: string;
  slug: string;
  status: string;
  plan: string;
  addons: string[];
  subscriptionRevenue: number;
  addonsRevenue: number;
  overflowRevenue: number;
  totalRevenue: number;
  variableCost: number;
  fixedCost: number;
  totalCost: number;
  netMargin: number;
  marginPercent: number;
  health: Health;
  usage: {
    bookings: number;
    ai_messages: number;
    whatsapp_marketing: number;
    storage_mb: number;
  };
}

interface Response {
  vendors: VendorRow[];
  totals: {
    revenue: number;
    cost: number;
    margin: number;
    losingCount: number;
    thinCount: number;
    profitableCount: number;
    inactiveCount: number;
  };
}

const HEALTH_META: Record<Health, { label: string; color: string; icon: React.ElementType }> = {
  profitable: { label: 'مربح', color: 'emerald', icon: CheckCircle2 },
  thin:       { label: 'هامش رفيع', color: 'amber', icon: TrendingUp },
  losing:     { label: 'خسارة', color: 'red', icon: AlertTriangle },
  inactive:   { label: 'غير نشط', color: 'slate', icon: Activity },
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  red:     { bg: 'bg-red-500/15',     text: 'text-red-300',     border: 'border-red-500/30' },
  slate:   { bg: 'bg-slate-500/15',   text: 'text-slate-300',   border: 'border-slate-500/30' },
};

export default function Profitability() {
  const [filter, setFilter] = useState<Health | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<Response>({
    queryKey: ['profitability'],
    queryFn: () => api.get('/super-admin/profitability').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.vendors.filter((v) =>
      (filter === 'all' || v.health === filter) &&
      (search === '' || v.nameAr.includes(search) || v.slug.includes(search))
    );
  }, [data, filter, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" size={28} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2.5">
            <Wallet size={22} className="text-orange-400" />
            ربحية المنصة
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            إيراد - تكلفة لكل تاجر هذا الشهر. التجار الخاسرون يظهرون أولاً.
          </p>
        </div>

        {/* Top totals */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="الإيراد الكلي" value={`${data.totals.revenue.toLocaleString()} ر.س`} color="emerald" />
          <Stat label="التكلفة الكلية" value={`${data.totals.cost.toLocaleString()} ر.س`} color="slate" />
          <Stat
            label="الصافي"
            value={`${data.totals.margin >= 0 ? '+' : ''}${data.totals.margin.toLocaleString()} ر.س`}
            color={data.totals.margin >= 0 ? 'emerald' : 'red'}
          />
          <Stat
            label="هامش %"
            value={data.totals.revenue > 0 ? `${Math.round((data.totals.margin / data.totals.revenue) * 100)}%` : '—'}
            color={data.totals.margin >= 0 ? 'emerald' : 'red'}
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
            الكل ({data.vendors.length})
          </FilterPill>
          {data.totals.losingCount > 0 && (
            <FilterPill active={filter === 'losing'} onClick={() => setFilter('losing')} color="red">
              خسارة ({data.totals.losingCount})
            </FilterPill>
          )}
          {data.totals.thinCount > 0 && (
            <FilterPill active={filter === 'thin'} onClick={() => setFilter('thin')} color="amber">
              هامش رفيع ({data.totals.thinCount})
            </FilterPill>
          )}
          <FilterPill active={filter === 'profitable'} onClick={() => setFilter('profitable')} color="emerald">
            مربح ({data.totals.profitableCount})
          </FilterPill>
          <FilterPill active={filter === 'inactive'} onClick={() => setFilter('inactive')}>
            غير نشط ({data.totals.inactiveCount})
          </FilterPill>

          <div className="relative ms-auto">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم..."
              className="bg-slate-900 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-orange-500/40 w-56"
            />
          </div>
        </div>

        {/* Critical alert */}
        {data.totals.losingCount > 0 && filter === 'all' && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 mb-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-black text-red-300">
                {data.totals.losingCount} تاجر يخسّرك المال هذا الشهر
              </p>
              <p className="text-xs text-red-200/80 mt-1 leading-relaxed">
                تجار في الباقة المجانية يستهلكون موارد بدون إيراد. اضغط الفلتر "خسارة" لرؤيتهم وقرّر: ترقية إجبارية، تعليق، أو خصم تكلفة.
              </p>
            </div>
          </div>
        )}

        {/* Vendor rows */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div>التاجر</div>
            <div className="text-left">الإيراد</div>
            <div className="text-left">التكلفة</div>
            <div className="text-left">الصافي</div>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">لا توجد نتائج للفلتر الحالي</div>
          ) : (
            filtered.map((v) => <VendorRowCard key={v.vendorId} v={v} />)
          )}
        </div>

        {/* Cost model footer */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 mt-6 text-[11px] text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-400 mb-1">نموذج التكلفة المستخدم في الحساب</p>
          <p>
            حجز ٠.٠٠٢ ر.س · رسالة AI ٠.١٠ ر.س · رسالة WhatsApp تسويق ٠.١٥ ر.س ·
            تخزين ٠.٠٠١ ر.س/MB · ثابت ٢.٤ ر.س/تاجر/شهر (بنية تحتية مقسومة على ٣٠٠ تاجر).
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const c = COLOR_CLASSES[color];
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-4`}>
      <p className="text-[11px] text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-black ${c.text}`}>{value}</p>
    </div>
  );
}

function FilterPill({
  active, onClick, children, color = 'slate',
}: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
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

function VendorRowCard({ v }: { v: VendorRow }) {
  const meta = HEALTH_META[v.health];
  const c = COLOR_CLASSES[meta.color];
  const Icon = meta.icon;
  const isPositive = v.netMargin >= 0;

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-3.5 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={15} className={c.text} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{v.nameAr}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${c.bg} ${c.text}`}>
              {meta.label}
            </span>
            <span className="text-[10px] text-slate-500">{v.plan}</span>
            {v.addons.length > 0 && (
              <span className="text-[10px] text-orange-400">+{v.addons.length} إضافات</span>
            )}
            <span className="text-[10px] text-slate-600">·</span>
            <span className="text-[10px] text-slate-500">
              {v.usage.bookings} حجز · {v.usage.ai_messages} رسالة AI
            </span>
          </div>
        </div>
      </div>

      <div className="text-left">
        <p className="text-sm font-bold text-emerald-300">{v.totalRevenue.toFixed(0)}</p>
        <p className="text-[9px] text-slate-500">ر.س</p>
      </div>

      <div className="text-left">
        <p className="text-sm font-bold text-slate-300">{v.totalCost.toFixed(2)}</p>
        <p className="text-[9px] text-slate-500">ر.س</p>
      </div>

      <div className="text-left min-w-[80px]">
        <p className={`text-base font-black ${isPositive ? 'text-emerald-300' : 'text-red-300'}`}>
          {isPositive ? '+' : ''}{v.netMargin.toFixed(2)}
        </p>
        <p className={`text-[10px] ${isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
          {isPositive ? <TrendingUp size={10} className="inline" /> : <TrendingDown size={10} className="inline" />}
          {' '}{v.marginPercent}%
        </p>
      </div>
    </div>
  );
}
