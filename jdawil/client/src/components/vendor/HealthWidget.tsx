/**
 * Vendor health widget — drops onto the vendor dashboard. Shows the
 * single "X% ready" number plus the underlying checks so the vendor
 * can fix what's missing in one click.
 *
 * The data comes from /api/vendor-health which is per-vendor scoped and
 * auth-gated. Refreshes every 60s in the background — fast enough that
 * a vendor who finishes KYC in another tab sees the green tick within
 * a minute.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, AlertCircle, MessageCircle, CreditCard, ShieldCheck,
  Sparkles, ArrowLeft, Loader2,
} from 'lucide-react';
import api from '../../lib/api';

interface HealthData {
  ready: boolean;
  readinessPercent: number;
  checks: {
    subscription: boolean;
    kycVerified: boolean;
    paymentGateway: boolean;
    whatsappActive: boolean;
    noRecentError: boolean;
  };
  whatsapp: {
    provider: string;
    status: string;
    lastError: string | null;
    plan: string;
    used: number;
    quota: number;
    queueDepth: number;
    queueOldestMs: number;
  };
  subscription: { plan: string; status: string; moneyBackUntil: string | null };
}

interface CheckRowProps {
  done: boolean;
  label: string;
  icon: typeof CheckCircle2;
  href?: string;
  hint?: string;
}

function CheckRow({ done, label, icon: Icon, href, hint }: CheckRowProps) {
  const body = (
    <div className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg transition-all ${
      done ? 'opacity-70' : 'bg-white/3 hover:bg-white/5'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          done ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
        }`}>
          {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{label}</p>
          {!done && hint && <p className="text-[11px] text-white/45 mt-0.5">{hint}</p>}
        </div>
      </div>
      {!done && href && <ArrowLeft className="w-4 h-4 text-white/45" />}
    </div>
  );
  if (done || !href) return body;
  return <Link to={href} className="block">{body}</Link>;
}

export default function HealthWidget() {
  const { data, isLoading } = useQuery<HealthData>({
    queryKey: ['vendor-health'],
    queryFn: async () => (await api.get('/vendor-health')).data,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5 flex items-center justify-center min-h-[180px]">
        <Loader2 className="w-5 h-5 animate-spin text-white/30" />
      </div>
    );
  }
  if (!data) return null;

  const pct = data.readinessPercent;
  const ringColor = pct === 100 ? 'text-emerald-400' : pct >= 70 ? 'text-sky-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400';
  const ringBg = pct === 100 ? 'stroke-emerald-500' : pct >= 70 ? 'stroke-sky-500' : pct >= 40 ? 'stroke-amber-500' : 'stroke-rose-500';

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/3 p-5">
      <div className="flex items-start gap-4 mb-4">
        {/* Ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" strokeWidth="6" fill="none" className="stroke-white/10" />
            <circle
              cx="32" cy="32" r="28" strokeWidth="6" fill="none" strokeLinecap="round"
              className={ringBg}
              strokeDasharray={`${(pct / 100) * 175.93} 175.93`}
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${ringColor}`}>
            {pct}%
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white">جاهزية متجرك</h3>
          <p className="text-xs text-white/55 mt-0.5">
            {data.ready
              ? 'كل شي جاهز — متجرك يستقبل عملاء بثقة'
              : 'أكمل الخطوات الناقصة لتجربة مثالية للعميل'}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <CheckRow
          done={data.checks.subscription}
          label="الاشتراك مفعّل"
          icon={Sparkles}
          href="/vendor/platform-subscription"
          hint="فعّل اشتراكك لتفعيل كل المميزات"
        />
        <CheckRow
          done={data.checks.kycVerified}
          label="التوثيق (KYC)"
          icon={ShieldCheck}
          href="/vendor/kyc"
          hint="ارفع السجل التجاري أو وثيقة العمل الحر"
        />
        <CheckRow
          done={data.checks.paymentGateway}
          label="بوابة الدفع"
          icon={CreditCard}
          href="/vendor/payment-gateway"
          hint="اربط Moyasar لاستقبال المدفوعات الإلكترونية"
        />
        <CheckRow
          done={data.checks.whatsappActive}
          label="واتساب الأعمال"
          icon={MessageCircle}
          href="/vendor/whatsapp"
          hint="فعّل الإشعارات التلقائية للعملاء"
        />
        <CheckRow
          done={data.checks.noRecentError}
          label="بدون أعطال مؤخراً"
          icon={AlertCircle}
          href="/vendor/whatsapp"
          hint={data.whatsapp.lastError ?? 'تحقق من إعدادات واتساب'}
        />
      </div>

      {/* WhatsApp usage strip — only show when connected */}
      {data.checks.whatsappActive && data.whatsapp.quota > 0 && (
        <div className="mt-4 pt-4 border-t border-white/8">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-white/55">استهلاك واتساب الشهري</span>
            <span className="text-white/70 font-bold">{data.whatsapp.used} / {data.whatsapp.quota}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500"
              style={{ width: `${Math.min(100, (data.whatsapp.used / data.whatsapp.quota) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
