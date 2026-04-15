import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  CheckCircle, ArrowLeft, Zap, Star, Building2, Users,
} from 'lucide-react';

const plans = [
  {
    id: 'starter',
    name: 'أساسي',
    desc: 'لمقدم خدمة واحد أو فري لانسر',
    price: 29,
    popular: false,
    features: [
      'حجوزات غير محدودة',
      'موقع حجز خاص بمشروعك',
      'إشعارات واتساب',
      'تقارير مبسطة',
      '20 ثيم لتصميم موقعك',
      'فواتير ضريبية PDF',
    ],
  },
  {
    id: 'professional',
    name: 'احترافي',
    desc: 'حتى 5 موظفين',
    price: 119,
    popular: false,
    features: [
      'كل مميزات الأساسي',
      'تتبع GPS للموظفين',
      'نقطة بيع (كاشير)',
      'إدارة مخزون',
      'مدفوعات إلكترونية',
      'حملات واتساب',
    ],
  },
  {
    id: 'business',
    name: 'أعمال',
    desc: 'موقع ثابت + فريق عمل',
    price: 199,
    popular: true,
    features: [
      'كل مميزات الاحترافي',
      'طابور انتظار ذكي',
      'برنامج ولاء عملاء',
      'تقارير VAT ضريبية',
      'CRM إدارة عملاء',
      'مستشار ذكي AI',
      'Webhooks للربط الخارجي',
    ],
  },
  {
    id: 'enterprise',
    name: 'مؤسسي',
    desc: 'فريق كبير أو فروع متعددة',
    price: 299,
    popular: false,
    features: [
      'كل مميزات الأعمال',
      'موظفون غير محدودون',
      'إدارة رواتب تلقائية',
      'فروع متعددة',
      'API + Webhooks',
      'أولوية دعم فني',
      'تحليلات متقدمة',
    ],
  },
];

const faqs = [
  { q: 'هل أقدر أجرب قبل ما أدفع؟', a: 'نعم، 14 يوم تجربة مجانية كاملة بدون بطاقة ائتمان. تقدر تلغي في أي وقت.' },
  { q: 'هل فيه عقد أو التزام؟', a: 'لا، الاشتراك شهري بدون أي التزام. ألغِ وقتما تشاء.' },
  { q: 'هل Bokset يأخذ عمولة على المدفوعات؟', a: 'لا. المال يدخل حسابك البنكي مباشرة. Bokset لا يلمس أموالك.' },
  { q: 'أقدر أغير الباقة لاحقاً؟', a: 'نعم، تقدر ترقّي أو تنزّل باقتك في أي وقت من إعدادات حسابك.' },
  { q: 'هل يدعم أكثر من نوع خدمة؟', a: 'نعم، Bokset يدعم مغاسل سيارات، صالونات، تنظيف منازل، صيانة، تجميل، فري لانسر، وأي نوع خدمة.' },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

export default function Pricing() {
  return (
    <>
      <Helmet>
        <title>الأسعار — Bokset | أنشئ موقع حجوزاتك يبدأ من 29 ريال/شهر</title>
        <meta name="description" content="أسعار Bokset تبدأ من 29 ريال شهرياً. تجربة مجانية 14 يوم بدون بطاقة ائتمان. بدون عمولة. بدون عقد. اختر الباقة المناسبة لمشروعك." />
      </Helmet>

      <div dir="rtl" className="min-h-screen bg-surface-1 text-white">
        {/* Nav */}
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-4">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            الرئيسية
          </Link>
        </div>

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
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                  <span className="text-sm text-slate-500 mr-1">ر.س / شهر</span>
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
            جميع الأسعار بالريال السعودي · شاملة ضريبة القيمة المضافة · تجربة مجانية 14 يوم لجميع الباقات
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
    </>
  );
}
