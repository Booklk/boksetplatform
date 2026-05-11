import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Wallet, CreditCard, Banknote, Loader2, Smartphone, CheckCircle, XCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  amount: number;
  onSuccess: () => void;
}

type PaymentMethod = 'stcpay' | 'mada' | 'visa' | 'apple_pay' | 'bnpl' | 'cash';

type PaymentStatus = 'idle' | 'waiting' | 'paid' | 'failed';

declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments: () => boolean;
    };
  }
}

const hasApplePay =
  typeof window !== 'undefined' &&
  !!window.ApplePaySession &&
  window.ApplePaySession.canMakePayments();

function buildOptions(applePayAvailable: boolean): {
  method: PaymentMethod;
  labelAr: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  note?: string;
}[] {
  const opts: {
    method: PaymentMethod;
    labelAr: string;
    icon: React.ReactNode;
    color: string;
    borderColor: string;
    note?: string;
  }[] = [
    {
      method: 'stcpay',
      labelAr: 'STC Pay',
      icon: <Wallet className="w-7 h-7" />,
      color: 'text-green-400',
      borderColor: 'border-green-500/40 hover:border-green-400',
      note: 'أدخل رقم جوالك المرتبط بـ STC Pay',
    },
    {
      method: 'mada',
      labelAr: 'مدى',
      icon: <CreditCard className="w-7 h-7" />,
      color: 'text-blue-400',
      borderColor: 'border-blue-500/40 hover:border-blue-400',
      note: 'سيتم التحويل لصفحة دفع آمنة',
    },
    {
      method: 'visa',
      labelAr: 'Visa / Mastercard',
      icon: <CreditCard className="w-7 h-7" />,
      color: 'text-indigo-400',
      borderColor: 'border-indigo-500/40 hover:border-indigo-400',
      note: 'سيتم التحويل لصفحة دفع آمنة',
    },
    {
      method: 'bnpl',
      labelAr: 'تابي / تمارة (BNPL)',
      icon: <Banknote className="w-7 h-7" />,
      color: 'text-purple-400',
      borderColor: 'border-purple-500/40 hover:border-purple-400',
      note: 'قسّم المبلغ على 4 دفعات بدون فوائد',
    },
    {
      method: 'cash',
      labelAr: 'نقداً عند الوصول',
      icon: <Banknote className="w-7 h-7" />,
      color: 'text-slate-400',
      borderColor: 'border-slate-600/40 hover:border-slate-500',
    },
  ];

  if (applePayAvailable) {
    opts.splice(3, 0, {
      method: 'apple_pay',
      labelAr: 'Apple Pay',
      icon: <Smartphone className="w-7 h-7" />,
      color: 'text-white',
      borderColor: 'border-white/20 hover:border-white/50',
      note: 'الدفع السريع عبر Apple Pay',
    });
  }

  return opts;
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // 2 minutes

export default function PaymentModal({ isOpen, onClose, bookingId, amount, onSuccess }: PaymentModalProps) {
  const { token, user } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [stcPhone, setStcPhone] = useState<string>((user as any)?.phone ?? '');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [pollError, setPollError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  const PAYMENT_OPTIONS = buildOptions(hasApplePay);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setPollError(null);
      pollCountRef.current = 0;
    }
  }, [isOpen]);

  const startPolling = (bId: number) => {
    pollCountRef.current = 0;
    setPaymentStatus('waiting');

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > POLL_MAX_ATTEMPTS) {
        stopPolling();
        setPaymentStatus('failed');
        setPollError('انتهت مهلة انتظار الدفع. يرجى التحقق يدوياً من حالة الدفع.');
        return;
      }

      try {
        const { data } = await axios.get(`/api/payments/booking/${bId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.status === 'paid') {
          stopPolling();
          setPaymentStatus('paid');
          toast.success('تم الدفع بنجاح!');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        } else if (data.status === 'failed') {
          stopPolling();
          setPaymentStatus('failed');
          setPollError('فشل الدفع. يرجى المحاولة مرة أخرى.');
        }
      } catch {
        // Silently continue polling — network blip
      }
    }, POLL_INTERVAL_MS);
  };

  const { mutate: initiatePayment, isPending } = useMutation({
    mutationFn: (payload: { method: PaymentMethod; customerPhone?: string }) =>
      axios.post(
        '/api/payments/initiate',
        { bookingId, method: payload.method, customerPhone: payload.customerPhone },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    onSuccess: (response, payload) => {
      const { data } = response;

      if (payload.method === 'cash') {
        setPaymentStatus('paid');
        toast.success('تم تسجيل الدفع النقدي');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1000);
        return;
      }

      if (payload.method === 'bnpl') {
        toast('سيتم تحويلك لصفحة تابي/تمارة', { icon: 'ℹ️' });
        if (data.redirectUrl) window.open(data.redirectUrl, '_blank');
        startPolling(bookingId);
        return;
      }

      // For redirect-based methods (mada, visa, apple_pay): open in new tab + poll
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
      }

      // STC Pay may be OTP-based without redirect; just poll
      startPolling(bookingId);
    },
    onError: () => {
      setPaymentStatus('failed');
      setPollError('فشل بدء عملية الدفع. يرجى المحاولة مرة أخرى.');
      toast.error('فشل إتمام الدفع، يرجى المحاولة مجدداً');
    },
  });

  const handleSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setPollError(null);

    if (method === 'stcpay') {
      // Don't initiate yet — wait for phone input confirmation
      return;
    }

    initiatePayment({ method });
  };

  const handleStcConfirm = () => {
    if (!stcPhone.trim()) {
      toast.error('يرجى إدخال رقم الجوال');
      return;
    }
    initiatePayment({ method: 'stcpay', customerPhone: stcPhone.trim() });
  };

  const handleClose = () => {
    stopPolling();
    setSelectedMethod(null);
    setPaymentStatus('idle');
    setPollError(null);
    pollCountRef.current = 0;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative z-10 bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md"
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">اختر طريقة الدفع</h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount */}
            <div className="bg-slate-800/60 rounded-xl px-4 py-3 mb-6 text-center">
              <p className="text-slate-400 text-sm mb-1">المبلغ المطلوب</p>
              <p className="text-2xl font-bold text-white">
                {amount.toLocaleString('ar-SA')}
                <span className="text-slate-400 text-base font-normal mr-1">ريال</span>
              </p>
            </div>

            {/* ── Status overlay: waiting / paid / failed ── */}
            <AnimatePresence>
              {paymentStatus === 'waiting' && (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="mb-5 bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-4 text-center space-y-2"
                >
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                  <p className="text-blue-300 font-semibold text-sm">⏳ في انتظار التأكيد...</p>
                  <p className="text-blue-300/60 text-xs">سيتم تحديث الحالة تلقائياً</p>
                </motion.div>
              )}
              {paymentStatus === 'paid' && (
                <motion.div
                  key="paid"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-4 text-center space-y-2"
                >
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
                  <p className="text-emerald-300 font-bold text-base">✅ تم الدفع بنجاح!</p>
                </motion.div>
              )}
              {paymentStatus === 'failed' && pollError && (
                <motion.div
                  key="failed"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">{pollError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── STC Pay phone input ── */}
            <AnimatePresence>
              {selectedMethod === 'stcpay' && paymentStatus === 'idle' && (
                <motion.div
                  key="stc-phone"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="bg-slate-800/60 border border-green-500/30 rounded-xl px-4 py-4 space-y-3">
                    <p className="text-green-300 text-sm font-semibold">رقم جوالك المرتبط بـ STC Pay</p>
                    <input
                      type="tel"
                      value={stcPhone}
                      onChange={(e) => setStcPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      className="w-full bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-green-500/60 transition-colors"
                    />
                    <button
                      onClick={handleStcConfirm}
                      disabled={isPending}
                      className="w-full py-2.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-300 font-bold text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          جاري الإرسال...
                        </>
                      ) : (
                        'تأكيد الدفع عبر STC Pay'
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Payment options (hidden while waiting/paid) ── */}
            {paymentStatus === 'idle' && (
              <div className="space-y-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const isSelected = selectedMethod === option.method;
                  const isLoading = isPending && isSelected;

                  return (
                    <button
                      key={option.method}
                      onClick={() => !isPending && handleSelect(option.method)}
                      disabled={isPending}
                      className={`w-full flex items-center gap-4 bg-slate-800/60 border rounded-xl px-4 py-4 transition-all ${option.borderColor} ${
                        isSelected ? 'ring-2 ring-blue-500/50' : ''
                      } disabled:opacity-60`}
                    >
                      <span className={option.color}>
                        {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : option.icon}
                      </span>
                      <div className="flex-1 text-right">
                        <span className="text-white font-semibold text-base block">{option.labelAr}</span>
                        {option.note && (
                          <span className="text-slate-500 text-xs">{option.note}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Retry button when failed */}
            {paymentStatus === 'failed' && (
              <button
                onClick={() => {
                  setPaymentStatus('idle');
                  setSelectedMethod(null);
                  setPollError(null);
                }}
                className="w-full mt-4 py-3 rounded-xl bg-slate-700/60 border border-slate-600 text-white font-semibold text-sm hover:bg-slate-700 transition-colors"
              >
                المحاولة مرة أخرى
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
