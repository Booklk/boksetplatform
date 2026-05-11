/**
 * PaymentMethodPicker — lets a customer pick from every payment method
 * the vendor has enabled. Renders cards grouped by kind with the right
 * tagline per provider ("قسّم على 4 دفعات" for Tabby, etc.).
 *
 * Callers pass the vendorId + bookingId; the picker calls
 * POST /payment-gateway/checkout and redirects to the provider on click.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { CreditCard, Layers, Wallet, ArrowLeft, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { Skeleton } from './ui';
import { fadeInUp, staggerContainer, springs } from '../design/motion';

type Kind = 'card' | 'bnpl' | 'wallet' | 'manual';

interface EnabledProvider {
  slug: string;
  kind: Kind;
  labelAr: string;
  descriptionAr: string;
}

interface CheckoutResp {
  provider: string;
  providerRef: string;
  redirectUrl: string;
}

const KIND_ICON: Record<Kind, any> = {
  card: CreditCard, bnpl: Layers, wallet: Wallet, manual: CheckCircle2,
};

// Provider-specific tagline overrides the generic description.
const TAGLINES: Record<string, string> = {
  tabby:  'قسّم على 4 دفعات — بدون فوائد',
  tamara: 'ادفع الآن، قسّم لاحقاً',
  stcpay: 'دفع فوري من محفظتك',
};

export default function PaymentMethodPicker({
  vendorId, bookingId, returnUrl, onPaid,
}: {
  vendorId: number;
  bookingId: number;
  returnUrl?: string;
  /** Called if the backend reports instant success (e.g. manual). */
  onPaid?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ providers: EnabledProvider[] }>({
    queryKey: ['enabled-providers', vendorId],
    queryFn: async () => (await api.get(`/payment-gateway/enabled/${vendorId}`)).data,
    staleTime: 30_000,
  });

  const providers = data?.providers ?? [];
  const hasBnpl  = useMemo(() => providers.some((p) => p.kind === 'bnpl'), [providers]);

  async function pay(slug: string) {
    if (busy) return;
    setBusy(slug);
    try {
      const { data } = await api.post<CheckoutResp>('/payment-gateway/checkout', {
        bookingId,
        provider: slug,
        returnUrl,
      });
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        // Manual provider or instant success
        onPaid?.();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذّر بدء الدفع');
      setBusy(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }
  if (providers.length === 0) {
    return (
      <div className="text-center p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <p className="text-sm text-ink-300">المتجر لم يفعّل الدفع الإلكتروني بعد.</p>
      </div>
    );
  }

  return (
    <div dir="rtl">
      {hasBnpl && (
        <p className="text-[11px] text-ink-400 mb-2">
          💡 تقدر تقسّم الدفعة على دفعات بدون فوائد مع تمارا أو تابي.
        </p>
      )}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        {providers.map((p) => {
          const Icon = KIND_ICON[p.kind];
          const tagline = TAGLINES[p.slug] ?? p.descriptionAr;
          const active = busy === p.slug;
          return (
            <motion.button
              key={p.slug}
              variants={fadeInUp}
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.98 }}
              transition={springs.snappy}
              onClick={() => pay(p.slug)}
              disabled={Boolean(busy) && busy !== p.slug}
              className="w-full group flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-primary-500/30 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:opacity-50"
              aria-label={`ادفع عبر ${p.labelAr}`}
            >
              <div className="shrink-0 w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                <Icon size={18} className={
                  p.kind === 'bnpl' ? 'text-warn-300' :
                  p.kind === 'wallet' ? 'text-sky-300' :
                  'text-primary-300'
                } />
              </div>
              <div className="flex-1 text-right min-w-0">
                <p className="text-sm font-black text-white">{p.labelAr}</p>
                <p className="text-[11px] text-ink-400 leading-relaxed">{tagline}</p>
              </div>
              {active ? (
                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowLeft
                  size={14}
                  className="text-ink-500 group-hover:text-primary-400 group-hover:-translate-x-1 transition-all shrink-0"
                />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
