/**
 * RefundDialog — triggers a refund on a previous payment.
 *
 * Vendor flow:
 *   1. Button (anywhere) opens the dialog
 *   2. Vendor selects the payment provider + enters an amount
 *      (defaults to full booking total)
 *   3. Calls POST /payment-gateway/refund with
 *      { provider, providerRef, amountSar }
 *
 * The providerRef is the gateway's own payment id from
 * vendor_subscription_payments.gateway_ref — we pass it in as a prop so
 * the caller decides where it came from.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Undo2, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { Button, Card, Input, Badge } from '../ui';
import { scaleIn } from '../../design/motion';

const PROVIDERS: Array<{ slug: string; label: string }> = [
  { slug: 'moyasar',  label: 'ميسر' },
  { slug: 'tap',      label: 'Tap' },
  { slug: 'hyperpay', label: 'HyperPay' },
  { slug: 'paytabs',  label: 'PayTabs' },
  { slug: 'stcpay',   label: 'STC Pay' },
  { slug: 'tabby',    label: 'تابي' },
  { slug: 'tamara',   label: 'تمارا' },
];

export default function RefundDialog({
  open, onClose, bookingNumber, providerRef, provider, defaultAmount,
}: {
  open: boolean;
  onClose: () => void;
  bookingNumber?: string;
  providerRef?: string;
  provider?: string;
  defaultAmount?: number;
}) {
  const [ref, setRef]           = useState(providerRef ?? '');
  const [slug, setSlug]         = useState(provider ?? 'moyasar');
  const [amount, setAmount]     = useState<string>(defaultAmount ? String(defaultAmount) : '');
  const [confirming, setConfirm] = useState(false);

  const refund = useMutation({
    mutationFn: async () => {
      const body = {
        provider: slug,
        providerRef: ref.trim(),
        amountSar: amount ? Number(amount) : undefined,
      };
      return (await api.post('/payment-gateway/refund', body)).data as { success: boolean; error?: string };
    },
    onSuccess: (r) => {
      if (r.success) {
        toast.success('تم طلب الاسترجاع ✓');
        onClose();
      } else {
        toast.error(r.error ?? 'فشل الاسترجاع');
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الاسترجاع'),
  });

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !refund.isPending && onClose()}
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
      >
        <Card variant="elevated" padding="lg" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
              <Undo2 size={16} className="text-danger-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-white">استرجاع مبلغ</h3>
              {bookingNumber && <p className="text-[11px] text-ink-500">حجز #{bookingNumber}</p>}
            </div>
            {confirming && <Badge tone="warn" size="sm">تأكيد مطلوب</Badge>}
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-300 mb-1.5">البوابة</label>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSlug(p.slug)}
                  className={`px-3 h-8 rounded-lg text-xs font-bold transition-colors ${
                    slug === p.slug ? 'bg-primary-500 text-white' : 'bg-white/[0.04] text-ink-300 hover:bg-white/[0.08]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="معرّف الدفعة (من البوابة)"
            dir="ltr"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            help="موجود في تفاصيل الدفعة الأصلية — يبدأ عادةً بـ pay_ أو ch_"
          />
          <Input
            label="المبلغ (اختياري — اتركه فاضي لاسترجاع كامل)"
            type="number"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          {!confirming ? (
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="danger"
                fullWidth
                leftIcon={<Undo2 size={14} />}
                disabled={!ref.trim()}
                onClick={() => setConfirm(true)}
              >
                متابعة
              </Button>
              <Button variant="secondary" onClick={onClose}>إلغاء</Button>
            </div>
          ) : (
            <div className="rounded-xl bg-danger-500/5 border border-danger-500/20 p-3">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle size={14} className="text-danger-300 shrink-0 mt-0.5" />
                <p className="text-[11px] text-danger-200 leading-relaxed">
                  سيتم خصم المبلغ من محفظة البوابة الخاصة بك وإرجاعه للعميل. لا يمكن التراجع.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="danger"
                  fullWidth
                  loading={refund.isPending}
                  onClick={() => refund.mutate()}
                >
                  تأكيد الاسترجاع
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>رجوع</Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
