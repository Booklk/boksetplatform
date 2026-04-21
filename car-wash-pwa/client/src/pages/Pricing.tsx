import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  CheckCircle, ArrowLeft, Zap, Star, Building2, Users,
} from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';

const plans = [
  {
    id: 'free',
    name: 'مجاني',
    desc: 'متجر إلكتروني كامل بدون تكلفة',
    price: 0,
    popular: false,
    features: [
      'كل القوالب الـ 40 مفتوحة',
      'حجوزات غير محدودة',
      'طابور رقمي + معرض أعمال',
      'Customizer كامل (ألوان، أزرار، كالندر)',
      'White-label — بدون علامة جداول',
      'دومين مخصص باسم متجرك',
      'صفحات مخصصة (أسعار، شروط، FAQ…)',
      'إشعارات واتساب تلقائية',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    desc: 'مميزات أصحاب الأعمال المتقدمة',
    price: 99,
    yearlyPrice: 999,
    popular: true,
    features: [
      'كل مميزات الباقة المجانية',
      '🗺️ Google Maps متكامل',
      '📊 قوائم مالية متقدمة (P&L، Cashflow، VAT)',
      '👥 إدارة موظفين متعددين',
      '📍 تتبع GPS للموظفين',
      '📈 لوحة تحكم متقدمة + تحليلات',
      '🤖 المستشار الذكي بالـ AI',
      'دعم فني ذو أولوية',
    ],
  },
];

const BILLING_CYCLES = [
  { id: 'monthly', label: 'شهري', suffix: '/شهر' },
  { id: 'yearly', label: 'سنوي', suffix: '/سنة', badge: 'وفّر 17%' },
];

const faqs = [
  { q: 'هل أقدر أجرب قبل ما أدفع؟', a: 'نعم! كل مشترك جديد يبدأ بـ Pro مجاناً لمدة 14 يوم بكل المميزات. بعدها إذا ما اشتركت ترجع تلقائياً للباقة المجانية — ما تخسر بياناتك.' },
  { q: 'هل فيه عقد أو التزام؟', a: 'لا، الاشتراك شهري بدون أي التزام. ألغِ وقتما تشاء.' },
  { q: 'هل Jadawel يأخذ عمولة على المدفوعات؟', a: 'لا. المال يدخل حسابك البنكي مباشرة. Jadawel لا يلمس أموالك.' },
  { q: 'أقدر أغير الباقة لاحقاً؟', a: 'نعم، تقدر ترقّي أو تنزّل باقتك في أي وقت من إعدادات حسابك.' },
  { q: 'هل يدعم أكثر من نوع خدمة؟', a: 'نعم، Jadawel يدعم مغاسل سيارات، صالونات، تنظيف منازل، صيانة، تجميل، فري لانسر، وأي نوع خدمة.' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const isYearly = billing === 'yearly';

  return (
    <MarketingLayout>
      <Helmet>
        <title>الأسعار — جداول | مجاني للأبد أو Pro بـ 99 ر.س/شهر</title>
        <meta name="description" content="جداول مجاني للأبد مع حجوزات غير محدودة للبزنس الصغير. باقة Pro بـ 99 ريال شهرياً لكل شيء مفتوح. بدون عمولة. بدون عقد. ألغِ وقتما تشاء." />
        <link rel="canonical" href="https://bokset.sa/pricing" />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 pt-4 pb-4">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" />
          الرئيسية
        </Link>
      </div>
      <div>

        {/* Header */}
        <div className="text-center px-4 pb-12">
          <motion.h1 {...fadeUp()} className="text-3xl sm:text-4xl font-black text-white mb-3">
            أسعار بسيطة وشفافة
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-slate-500 text-base max-w-lg mx-auto">
            ابدأ مجاناً 14 يوم. بدون بطاقة. بدون عقد. بدون عمولة على مدفوعاتك.
          </motion.p>
        </div>

        {/* Plans */}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          {/* Billing toggle */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              {BILLING_CYCLES.map(c => (
                <button
                  key={c.id}
                  onClick={() => setBilling(c.id as 'monthly' | 'yearly')}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    billing === c.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {c.label}
                  {c.badge && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">{c.badge}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                {...fadeUp(i * 0.08)}
                className={`rounded-2xl p-6 flex flex-col ${
                  plan.popular
                    ? 'bg-indigo-600/10 border-2 border-indigo-500/30 relative'
                    : 'bg-white/[0.03] border border-white/[0.06]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    الأكثر طلباً
                  </div>
                )}

                <h3 className="text-lg font-black text-white">{plan.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{plan.desc}</p>

                <div className="mt-4 mb-5">
                  {plan.price === 0 ? (
                    <span className="text-3xl font-black text-white">مجاني</span>
                  ) : (
                    <>
                      <span className="text-3xl font-black text-white">
                        {isYearly ? (plan as any).yearlyPrice ?? plan.price : plan.price}
                      </span>
                      <span className="text-sm text-slate-500 mr-1">
                        ر.س / {isYearly ? 'سنة' : 'شهر'}
                      </span>
                      {isYearly && (
                        <div className="text-xs text-emerald-400 mt-1">
                          وفّر {(plan.price * 12) - ((plan as any).yearlyPrice ?? plan.price * 12)} ر.س مقارنة بالشهري
                        </div>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/onboard"
                  className={`mt-6 block text-center font-bold text-sm py-3 rounded-xl transition-colors ${
                    plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]'
                  }`}
                >
                  ابدأ مجاناً
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            جميع الأسعار بالريال السعودي · شاملة ضريبة القيمة المضافة · Pro مجاني 14 يوم بدون بطاقة
          </p>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-black text-white text-center mb-8">أسئلة عن الأسعار</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                {...fadeUp(i * 0.05)}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5"
              >
                <p className="font-bold text-white text-sm mb-2">{faq.q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center px-4 pb-16">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 max-w-lg mx-auto">
            <h3 className="text-xl font-black text-white mb-2">جاهز تبدأ؟</h3>
            <p className="text-slate-500 text-sm mb-5">14 يوم مجاناً. جرّب كل المميزات.</p>
            <Link to="/onboard" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-colors">
              أنشئ موقعك الآن
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
