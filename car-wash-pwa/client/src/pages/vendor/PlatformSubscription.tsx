import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, CheckCircle2, Clock, CreditCard, Zap, Building2,
  Sparkles, ArrowLeft, MessageCircle, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Check,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';

const WHATSAPP_SUPPORT = '966500000000';

const PLANS = [
  {
    key: 'basic',
    label: 'أساسي',
    priceMonthly: 249,
    priceAnnual: 2400,
    annualSaving: 188,
    color: 'from-slate-800/80 to-slate-700/60',
    border: 'border-slate-600/50',
    accent: 'text-slate-300',
    badge: null,
    icon: Building2,
    features: [
      'حتى 3 موظفين',
      'حجوزات غير محدودة',
      'تقارير أساسية',
      'إشعارات واتساب',
      'تتبع GPS',
      'دعم عبر البريد',
    ],
  },
  {
    key: 'pro',
    label: 'احترافي',
    priceMonthly: 449,
    priceAnnual: 4800,
    annualSaving: 588 - 0,
    color: 'from-blue-900/60 to-blue-800/40',
    border: 'border-blue-500/50',
    accent: 'text-blue-300',
    badge: 'الأكثر شعبية',
    icon: Zap,
    features: [
      'حتى 15 موظفاً',
      'خريطة مباشرة',
      'اشتراكات العملاء',
      'برنامج الولاء',
      'تقارير متقدمة',
      'POS كاشير',
      'إدارة المخزون',
      'دعم ذو أولوية',
    ],
  },
  {
    key: 'enterprise',
    label: 'مؤسسي',
    priceMonthly: 849,
    priceAnnual: 9600,
    annualSaving: 588,
    color: 'from-purple-900/60 to-purple-800/40',
    border: 'border-purple-500/50',
    accent: 'text-purple-300',
    badge: 'للأسطول والفروع',
    icon: Crown,
    features: [
      'موظفون غير محدودون',
      'حسابات مؤسسية (B2B)',
      'متعدد الفروع',
      'API مخصص',
      'مدير حساب مخصص',
      'تكامل ERP',
      'تقارير ضريبية VAT',
      'أولوية قصوى في الدعم',
    ],
  },
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: 'نشط', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  trial: { label: 'تجريبي', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  expired: { label: 'منتهي', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  suspended: { label: 'موقوف', color: 'bg-slate-700/40 text-slate-400 border-slate-600/30' },
};

export default function PlatformSubscription() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Handle Moyasar callback redirect
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const plan = searchParams.get('plan');
    if (paymentStatus === 'success') {
      toast.success(`تم تفعيل خطة ${plan ?? 'الاشتراك'} بنجاح! 🎉`);
      queryClient.invalidateQueries({ queryKey: ['vendor-detail'] });
      setSearchParams({});
    } else if (paymentStatus === 'failed') {
      toast.error('فشل الدفع — لم يتم خصم أي مبلغ. حاول مرة أخرى.');
      setSearchParams({});
    } else if (paymentStatus === 'error') {
      toast.error('خطأ غير متوقع — تواصل معنا على واتساب.');
      setSearchParams({});
    }
  }, []);

  const { data: vendorData, isLoading } = useQuery({
    queryKey: ['vendor-detail', user?.vendorId],
    queryFn: () =>
      axios.get(`/api/vendors/${user!.vendorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.data),
    enabled: !!token && !!user?.vendorId,
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['vendor-platform-payments', user?.vendorId],
    queryFn: () =>
      axios.get(`/api/super-admin/vendor-payments?vendorId=${user!.vendorId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.data),
    enabled: !!token && !!user?.vendorId,
  });

  const subscribeMutation = useMutation({
    mutationFn: ({ plan, cycle }: { plan: string; cycle: string }) =>
      axios.post(
        `/api/vendors/${user!.vendorId}/platform-subscribe`,
        { plan, billingCycle: cycle },
        { headers: { Authorization: `Bearer ${token}` } },
      ).then(r => r.data),
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast.error('لم يتم الحصول على رابط الدفع');
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error ?? 'فشل في إنشاء جلسة الدفع');
    },
  });

  const vendor = vendorData?.vendor ?? vendorData;
  const payments: any[] = paymentsData?.payments ?? paymentsData ?? [];
  const currentPlan = vendor?.subscriptionPlan ?? 'basic';
  const status = vendor?.subscriptionStatus ?? 'trial';
  const statusInfo = STATUS_LABEL[status] ?? STATUS_LABEL.trial;
  const endDate = vendor?.subscriptionEndDate ? new Date(vendor.subscriptionEndDate) : null;
  const daysRemaining = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000)) : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7;

  function handleSelectPlan(planKey: string) {
    setSelectedPlan(planKey);
    setConfirmOpen(true);
  }

  function handleConfirmPay() {
    if (!selectedPlan) return;
    subscribeMutation.mutate({ plan: selectedPlan, cycle: billingCycle });
  }

  const chosenPlan = PLANS.find(p => p.key === selectedPlan);
  const chosenPrice = chosenPlan
    ? billingCycle === 'annual' ? chosenPlan.priceAnnual : chosenPlan.priceMonthly
    : 0;

  const faqs = [
    { q: 'هل يمكنني الإلغاء في أي وقت؟', a: 'نعم — اشتراكك يستمر حتى نهاية الفترة المدفوعة ثم لا يتجدد تلقائياً. لا رسوم إلغاء.' },
    { q: 'هل بياناتي آمنة بعد الإلغاء؟', a: 'نحتفظ ببياناتك 30 يوماً بعد انتهاء الاشتراك. بعدها تُحذف بشكل آمن ما لم تجدد.' },
    { q: 'ما طرق الدفع المتاحة؟', a: 'مدى، فيزا، ماستر كارد، Apple Pay، وSTC Pay — كلها عبر بوابة ميسر الآمنة.' },
    { q: 'هل يمكنني الترقية من أساسي إلى احترافي؟', a: 'نعم — الترقية فورية. يُحتسب الفرق تناسبياً على الفترة المتبقية.' },
    { q: 'هل تصدر فاتورة ضريبية؟', a: 'نعم — فاتورة PDF باللغة العربية مع الرقم الضريبي بعد كل دفعة مباشرة.' },
  ];

  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/20 rounded-xl">
            <Crown className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">اشتراك المنصة</h1>
            <p className="text-slate-500 text-sm">ادفع بنفسك — الاشتراك يُفعَّل فوراً</p>
          </div>
        </div>

        {/* Current plan banner */}
        {!isLoading && vendor && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 border ${
              isExpiringSoon
                ? 'bg-red-900/30 border-red-500/40'
                : 'bg-slate-900/80 border-slate-700/50'
            }`}
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="text-slate-400 text-sm mb-1">خطتك الحالية</p>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white">
                    {PLANS.find(p => p.key === currentPlan)?.label ?? currentPlan}
                  </h2>
                  <span className={`text-xs px-3 py-1 rounded-xl border font-medium ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                {endDate && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {isExpiringSoon
                        ? `⚠️ ينتهي خلال ${daysRemaining} يوم — جدد الآن لتجنب انقطاع الخدمة`
                        : `ينتهي في ${endDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })} (${daysRemaining} يوم متبقٍ)`}
                    </span>
                  </div>
                )}
              </div>
              {isExpiringSoon && (
                <div className="flex items-center gap-2 text-red-300 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">يوشك على الانتهاء</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              billingCycle === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            شهري
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              billingCycle === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            سنوي
            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-lg border border-green-500/30">
              وفّر حتى 20%
            </span>
          </button>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;
            const isCurrent = plan.key === currentPlan && status === 'active';
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className={`relative bg-gradient-to-br ${plan.color} border ${plan.border} rounded-2xl p-6 flex flex-col ${
                  plan.key === 'pro' ? 'ring-2 ring-blue-500/30 scale-[1.02]' : ''
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 right-5 bg-blue-600 text-white text-xs px-3 py-1 rounded-xl font-medium shadow-lg">
                    {plan.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="absolute -top-3 left-5 bg-green-600 text-white text-xs px-3 py-1 rounded-xl font-medium shadow-lg">
                    خطتك الحالية
                  </span>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-xl bg-white/5`}>
                    <Icon className={`w-5 h-5 ${plan.accent}`} />
                  </div>
                  <h3 className="text-white font-bold text-lg">{plan.label}</h3>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-black text-white">
                    {price.toLocaleString('ar-SA')}
                  </span>
                  <span className="text-slate-400 text-sm mr-1">
                    ريال / {billingCycle === 'annual' ? 'سنة' : 'شهر'}
                  </span>
                  {billingCycle === 'annual' && (
                    <p className="text-green-400 text-xs mt-1">
                      ≈ {Math.round(price / 12).toLocaleString('ar-SA')} ريال/شهر
                    </p>
                  )}
                </div>

                <ul className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-slate-300 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPlan(plan.key)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    isCurrent
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30 cursor-default'
                      : plan.key === 'pro'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                  }`}
                >
                  {isCurrent ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" /> خطتك الحالية
                    </span>
                  ) : (
                    `اشترك الآن — ${price.toLocaleString('ar-SA')} ريال`
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Payment modal */}
        <AnimatePresence>
          {confirmOpen && chosenPlan && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={() => setConfirmOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                className="fixed inset-x-4 bottom-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl z-50 p-6"
              >
                <h3 className="text-xl font-bold text-white mb-1">تأكيد الاشتراك</h3>
                <p className="text-slate-400 text-sm mb-5">
                  ستُحوَّل إلى بوابة ميسر الآمنة لإتمام الدفع
                </p>

                <div className="bg-slate-800/60 rounded-xl p-4 mb-5 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">الخطة</span>
                    <span className="text-white font-medium">{chosenPlan.label}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">دورة الفوترة</span>
                    <span className="text-white font-medium">{billingCycle === 'annual' ? 'سنوية' : 'شهرية'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">مدة الاشتراك</span>
                    <span className="text-white font-medium">{billingCycle === 'annual' ? '12 شهراً' : 'شهر واحد'}</span>
                  </div>
                  <div className="border-t border-slate-700/50 pt-2 flex justify-between">
                    <span className="text-white font-bold">الإجمالي</span>
                    <span className="text-blue-300 font-black text-lg">
                      {chosenPrice.toLocaleString('ar-SA')} ريال
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-5">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                  دفع آمن عبر بروتوكول SSL — لا نحتفظ ببيانات بطاقتك
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-700/60 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleConfirmPay}
                    disabled={subscribeMutation.isPending}
                    className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {subscribeMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التحويل...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        ادفع الآن
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Payment history */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-400" />
            سجل المدفوعات
          </h2>
          <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-10 text-center">
                <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">لا توجد مدفوعات بعد</p>
                <p className="text-slate-600 text-xs mt-1">مدفوعاتك ستظهر هنا بعد أول اشتراك</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-800/20 transition-colors">
                    <div>
                      <p className="text-white text-sm font-medium">{p.description ?? p.plan ?? 'اشتراك المنصة'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <div className="text-left flex flex-col items-end gap-1">
                      <span className="text-green-400 font-bold text-sm">
                        {p.amount ? `${Number(p.amount).toLocaleString('ar-SA')} ريال` : '—'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                        p.status === 'paid'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {p.status === 'paid' ? 'مدفوع' : p.status ?? 'غير معروف'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            أسئلة شائعة
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-right"
                >
                  <span className="text-white text-sm font-medium">{faq.q}</span>
                  {expandedFaq === i
                    ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>
                <AnimatePresence>
                  {expandedFaq === i && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-4 text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* WhatsApp support */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/30 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <p className="text-white font-bold">هل لديك سؤال قبل الاشتراك؟</p>
            <p className="text-slate-400 text-sm mt-0.5">فريقنا متاح على واتساب — يرد خلال دقائق</p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_SUPPORT}?text=${encodeURIComponent('مرحباً، لدي سؤال حول اشتراك Bokset')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            تحدث معنا
          </a>
        </motion.div>

      </div>
    </div>
  );
}
