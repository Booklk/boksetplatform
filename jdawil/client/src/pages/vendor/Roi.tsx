import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { TrendingUp, Calendar, Shield, Clock, Users, DollarSign, Sparkles } from 'lucide-react';
import api from '../../lib/api';

interface RoiPayload {
  since: string;
  currency: string;
  totals: {
    bookings: number;
    grossRevenue: number;
    depositsCollected: number;
    depositsCount: number;
    estNoShowsPrevented: number;
    noShowSavingsSar: number;
    adminHoursSaved: number;
    timeSavingsSar: number;
    customerReach: number;
    totalValueDelivered: number;
  };
  cost: {
    totalPaidToJdawil: number;
    plan: string | null;
    status: string | null;
  };
  roiMultiplier: number | null;
  assumptions: {
    adminMinutesPerBooking: number;
    hourlyValueSar: number;
    depositNoShowReductionRate: number;
  };
}

function fmtSar(n: number): string {
  return new Intl.NumberFormat('ar-SA').format(Math.round(n)) + ' ر.س';
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  accent: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
    blue:    'border-blue-500/30 bg-blue-500/5 text-blue-300',
    amber:   'border-amber-500/30 bg-amber-500/5 text-amber-300',
    purple:  'border-purple-500/30 bg-purple-500/5 text-purple-300',
    rose:    'border-rose-500/30 bg-rose-500/5 text-rose-300',
  };
  return (
    <div className={`rounded-2xl border ${tones[accent]} p-5`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-bold opacity-90">{label}</span>
      </div>
      <p className="text-2xl font-black text-white leading-tight">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

export default function VendorRoi() {
  const { data, isLoading } = useQuery<RoiPayload>({
    queryKey: ['vendor-roi'],
    queryFn: async () => (await api.get('/roi/me')).data,
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-slate-400" dir="rtl">
        جاري احتساب عائد استثمارك…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-center text-slate-400" dir="rtl">
        لا توجد بيانات حالياً.
      </div>
    );
  }

  const t = data.totals;
  const c = data.cost;
  const since = new Date(data.since).toLocaleDateString('ar-SA');

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
      <Helmet>
        <title>عائدك من Jdawil — لوحة ROI</title>
      </Helmet>

      {/* Hero — the punchline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 sm:p-8 mb-6 text-center"
      >
        <Sparkles className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
        {data.roiMultiplier !== null ? (
          <>
            <p className="text-emerald-200 text-sm font-bold mb-2">عائدك من Jdawil حتى الآن</p>
            <p className="text-5xl sm:text-6xl font-black text-emerald-300 leading-none">
              ×{data.roiMultiplier}
            </p>
            <p className="text-slate-300 text-sm mt-3 max-w-md mx-auto leading-relaxed">
              مقابل كل ريال دفعته لـ Jdawil، عاد عليك{' '}
              <span className="text-white font-bold">{data.roiMultiplier} ريال</span> في إيراد + توفير وقت + حماية من
              الإلغاءات.
            </p>
          </>
        ) : (
          <>
            <p className="text-slate-300 text-sm font-bold mb-2">ابدأ الحجوزات لتشاهد عائدك</p>
            <p className="text-3xl font-black text-white">جاهز للقياس</p>
            <p className="text-slate-400 text-xs mt-2">
              لما تبدأ تستقبل حجوزات، نحسب لك عائدك الفعلي بالأرقام.
            </p>
          </>
        )}
        <p className="text-xs text-slate-500 mt-4">منذ تاريخ تسجيلك: {since}</p>
      </motion.div>

      {/* Big numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={DollarSign}
          label="إيرادك عبر النظام"
          value={fmtSar(t.grossRevenue)}
          hint={`من ${t.bookings} حجز`}
          accent="emerald"
        />
        <StatCard
          icon={Shield}
          label="إلغاءات منعتها العربون"
          value={fmtSar(t.noShowSavingsSar)}
          hint={`${t.estNoShowsPrevented} no-show محتمل`}
          accent="blue"
        />
        <StatCard
          icon={Clock}
          label="وقت إداري وفّرته"
          value={`${t.adminHoursSaved} ساعة`}
          hint={`= ${fmtSar(t.timeSavingsSar)}`}
          accent="amber"
        />
        <StatCard
          icon={Users}
          label="عملاء وصلتهم"
          value={String(t.customerReach)}
          hint="عميل عبر النظام"
          accent="purple"
        />
      </div>

      {/* Cost vs value */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs text-slate-500 mb-1">دفعت لـ Jdawil</p>
          <p className="text-3xl font-black text-white">{fmtSar(c.totalPaidToJdawil)}</p>
          <p className="text-xs text-slate-500 mt-2">
            خطة: {c.plan ?? 'مجانية'} • حالة: {c.status ?? '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
          <p className="text-xs text-emerald-300/80 mb-1">القيمة الفعلية اللي رجعت لك</p>
          <p className="text-3xl font-black text-emerald-300">{fmtSar(t.totalValueDelivered)}</p>
          <p className="text-xs text-slate-400 mt-2">
            إيراد + إلغاءات منعتها + وقت وفّرته
          </p>
        </div>
      </div>

      {/* Deposits stat */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            عربون حصّلته من العملاء
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">مبلغ العربون</p>
            <p className="text-2xl font-black text-white">{fmtSar(t.depositsCollected)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">عدد الحجوزات بعربون</p>
            <p className="text-2xl font-black text-white">{t.depositsCount}</p>
          </div>
        </div>
      </div>

      {/* Methodology */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm">
        <summary className="cursor-pointer text-white font-bold mb-2">
          كيف نحسب هذي الأرقام؟
        </summary>
        <ul className="text-slate-400 leading-relaxed mt-3 space-y-2 list-disc pr-4">
          <li>
            <strong className="text-white">إيراد عبر النظام</strong>: مجموع قيم الحجوزات اللي تمت من خلال Jdawil منذ
            تسجيلك.
          </li>
          <li>
            <strong className="text-white">إلغاءات منعتها العربون</strong>: تقدير محافظ — كل حجز فيه عربون له ~25٪ احتمال
            كان يصير no-show بدون عربون. النتيجة: عربون = حماية مالية فعلية.
          </li>
          <li>
            <strong className="text-white">وقت إداري وفّرته</strong>: متوسط {data.assumptions.adminMinutesPerBooking}{' '}
            دقيقة لكل حجز يدوي (تأكيد + جدولة + تذكير) × ساعتك بـ {data.assumptions.hourlyValueSar} ر.س.
          </li>
          <li>
            <strong className="text-white">عائدك (ROI)</strong>: القيمة الفعلية ÷ ما دفعته لنا. أي رقم فوق ×3 يعتبر
            استثمار ممتاز.
          </li>
        </ul>
      </details>
    </div>
  );
}
