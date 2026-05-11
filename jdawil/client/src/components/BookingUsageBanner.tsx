/**
 * Free-plan booking usage indicator. Pulls /api/addons/me/usage and shows
 * a colored progress bar with upgrade CTA. Renders nothing for paid plans
 * (limit is null), so the dashboard stays clean for vendors who don't
 * need the prompt.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Sparkles } from 'lucide-react';
import api from '../lib/api';

interface UsageResponse {
  count: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  plan: string;
}

export function BookingUsageBanner() {
  const { data } = useQuery<UsageResponse>({
    queryKey: ['booking-usage'],
    queryFn: () => api.get('/addons/me/usage').then((r) => r.data),
    staleTime: 60 * 1000,
  });

  // Hide for paid plans (limit is null) and while loading
  if (!data || data.limit == null) return null;

  const { count, limit, percent } = data;
  const isCritical = percent >= 90;
  const isWarning = percent >= 70;

  // Calm state — under 70%
  if (!isWarning) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {count} <span className="text-slate-400 font-normal">/ {limit} حجز هذا الشهر</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">الباقة المجانية</p>
          </div>
        </div>
        <div className="text-left">
          <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-orange-500 rounded-full"
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">{percent}%</p>
        </div>
      </div>
    );
  }

  // Warning state — 70-89%
  // Critical state — 90%+
  const color = isCritical ? 'red' : 'amber';
  const Icon = isCritical ? AlertTriangle : TrendingUp;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-5 mb-4 ${
        isCritical
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-amber-500/30 bg-amber-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isCritical ? 'bg-red-500/15' : 'bg-amber-500/15'
          }`}>
            <Icon size={18} className={isCritical ? 'text-red-300' : 'text-amber-300'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white">
              {isCritical
                ? `قاربت على حد الباقة المجانية (${count}/${limit})`
                : `استخدمت ${count} من ${limit} حجز هذا الشهر`}
            </p>
            <p className={`text-xs mt-1 leading-relaxed ${isCritical ? 'text-red-200/80' : 'text-amber-200/80'}`}>
              {isCritical
                ? 'بعد الحد لن يستطيع عملاؤك الحجز عبر متجرك. ارفع الباقة الآن لاستقبال حجوزات بلا حدود.'
                : 'لما توصل للحد، ستتوقف الحجوزات الجديدة. ابقَ مستعداً لترقية الباقة.'}
            </p>
          </div>
        </div>
        <div className="text-left flex-shrink-0">
          <div className={`text-2xl font-black leading-none ${isCritical ? 'text-red-300' : 'text-amber-300'}`}>
            {percent}%
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-4">
        <motion.div
          className={`h-full rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      <Link
        to="/vendor/platform-sub"
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-white text-xs transition-colors ${
          isCritical ? 'bg-red-500 hover:bg-red-400' : 'bg-amber-500 hover:bg-amber-400'
        }`}
      >
        <Sparkles size={12} />
        ترقية لباقة Pro — حجوزات غير محدودة
      </Link>
    </motion.div>
  );
}
