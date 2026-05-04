import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface MoneyBackStatus {
  eligible: boolean;
  used: boolean;
  until: string | null;
  daysRemaining: number;
  refundableAmount: number;
  windowDays: number;
}

/**
 * In-dashboard banner that explains the 60-day money-back guarantee
 * and offers a one-click "request refund" action while it's still
 * valid. Quietly hides itself after the window closes or the vendor
 * has already redeemed.
 */
export function MoneyBackBanner() {
  const qc = useQueryClient();
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data } = useQuery<MoneyBackStatus>({
    queryKey: ['money-back-status'],
    queryFn: async () => (await api.get('/money-back/status')).data,
    staleTime: 5 * 60 * 1000,
  });

  const requestRefund = useMutation({
    mutationFn: async () =>
      (await api.post('/money-back/request', { reason, feedback: feedback || undefined })).data,
    onSuccess: (resp) => {
      toast.success(resp?.message ?? 'تم استلام طلب الاسترداد');
      setShowCancel(false);
      qc.invalidateQueries({ queryKey: ['money-back-status'] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error ?? 'تعذّر إرسال الطلب');
    },
  });

  if (!data || !data.eligible) return null;

  return (
    <>
      <div
        dir="rtl"
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 mb-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="flex-1">
            <p className="text-emerald-200 font-bold text-sm sm:text-base leading-tight">
              ضمان استرداد كامل خلال {data.windowDays} يوم
            </p>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-1 leading-relaxed">
              ما عجبك جداول؟ بدون أسئلة — تسترد كل ما دفعته خلال 7 أيام عمل.
              <span className="block sm:inline text-emerald-300 font-semibold mt-1 sm:mt-0 sm:mr-1">
                باقي {data.daysRemaining} يوم على انتهاء الفترة.
              </span>
            </p>
            <button
              onClick={() => setShowCancel(true)}
              className="text-xs text-emerald-300/80 underline hover:text-emerald-200 mt-2"
            >
              أريد استرداد {data.refundableAmount > 0 ? `${data.refundableAmount.toFixed(0)} ر.س` : 'مدفوعاتي'}
            </button>
          </div>
        </div>
      </div>

      {showCancel && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setShowCancel(false)}
        >
          <div
            className="bg-[#0d1929] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-black text-lg">طلب استرداد كامل</h2>
              <button
                aria-label="إغلاق"
                onClick={() => setShowCancel(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-400"
              >
                <X className="w-5 h-5 mx-auto" />
              </button>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              أنت ضمن ضمان الـ {data.windowDays} يوم. اضغط الإرسال وسنحوّل لك{' '}
              <span className="text-emerald-300 font-bold">
                {data.refundableAmount.toFixed(0)} ر.س
              </span>{' '}
              خلال 7 أيام عمل.
            </p>

            <label className="block text-sm text-slate-300 mb-1">سبب رئيسي (مطلوب)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3"
            >
              <option value="">اختر السبب</option>
              <option value="ميزة ناقصة">ميزة محددة ناقصة</option>
              <option value="السعر">السعر موب مناسب</option>
              <option value="تعقيد">النظام معقد علي</option>
              <option value="مشكلة تقنية">واجهت مشاكل تقنية</option>
              <option value="غيّرت رأيي">غيّرت رأيي بدون سبب محدد</option>
            </select>

            <label className="block text-sm text-slate-300 mb-1">ملاحظة إضافية (اختياري)</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="رأيك يساعدنا نتحسّن"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm h-20 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCancel(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
              >
                ابقَ معنا
              </button>
              <button
                onClick={() => requestRefund.mutate()}
                disabled={requestRefund.isPending || !reason}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {requestRefund.isPending ? '...' : 'أرسل طلب الاسترداد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
