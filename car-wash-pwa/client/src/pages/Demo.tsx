import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Palette, CreditCard, BarChart3, Users, MapPin,
  CheckCircle, ChevronLeft, Star, ArrowLeft, Smartphone,
  Layout, Zap, Shield, MessageCircle, TrendingUp,
  Package, ExternalLink,
} from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

/* ── Theme previews ── */
const themes = [
  { name: 'بريميوم داكن', color: '#0369A1' },
  { name: 'عصري نظيف', color: '#1E3A8A' },
  { name: 'تدرج جريء', color: '#5B21B6' },
  { name: 'ذهبي كلاسيك', color: '#78350F' },
  { name: 'زمردي', color: '#065F46' },
  { name: 'قرمزي', color: '#991B1B' },
];

export default function Demo() {
  const [activeTheme, setActiveTheme] = useState(0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#071020] text-white">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-50 bg-[#071020]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" />
            الرئيسية
          </Link>
          <Link to="/onboard" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors">
            ابدأ مجاناً
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-20">

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: ابنِ موقعك مجاناً
            ══════════════════════════════════════════════════════════════════ */}
        <section className="text-center">
          <motion.div {...fadeUp()}>
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-bold">بدون ما تدفع ريال واحد</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              ابنِ موقع حجز لمشروعك
              <br />
              <span className="text-blue-400">خلال 5 دقائق</span>
            </h1>

            <p className="text-slate-500 text-base max-w-xl mx-auto mb-10 leading-relaxed">
              اختر تصميم، أضف خدماتك، وشارك الرابط مع عملائك. موقع حجز احترافي جاهز — بدون مبرمج ولا مصمم.
            </p>
          </motion.div>

          {/* ── Live theme picker ── */}
          <motion.div {...fadeUp(0.1)} className="max-w-3xl mx-auto">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
              <p className="text-sm text-slate-400 mb-4">اختر تصميم لمشروعك:</p>
              <div className="flex gap-2 justify-center mb-6 flex-wrap">
                {themes.map((t, i) => (
                  <button
                    key={t.name}
                    onClick={() => setActiveTheme(i)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeTheme === i
                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        : 'bg-white/[0.04] text-slate-500 border border-white/[0.06] hover:text-slate-300'
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>

              {/* Phone mockup with live theme */}
              <div className="flex justify-center">
                <div className="w-[220px] rounded-[2rem] border-2 border-white/[0.08] bg-[#0a1020] p-1.5 shadow-2xl">
                  <div className="rounded-[1.6rem] overflow-hidden bg-[#060e1e]" style={{ aspectRatio: '9/18' }}>
                    {/* Notch */}
                    <div className="relative">
                      <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-14 h-3 bg-black rounded-full z-10" />
                    </div>
                    {/* Hero */}
                    <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${themes[activeTheme].color}, ${themes[activeTheme].color}80)` }}>
                      <div className="absolute inset-0 bg-black/20" />
                      <div className="absolute bottom-3 right-3">
                        <div className="w-6 h-6 rounded-md bg-white/20 mb-1" />
                        <div className="h-2 w-16 bg-white/40 rounded-full mb-1" />
                        <div className="h-1.5 w-10 bg-white/20 rounded-full" />
                      </div>
                    </div>
                    {/* Content */}
                    <div className="p-3 space-y-2">
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-2 h-2 rounded-sm bg-amber-400/60" />)}
                      </div>
                      {[1,2].map(i => (
                        <div key={i} className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                          <div className="h-1.5 w-3/4 bg-white/15 rounded-full mb-1" />
                          <div className="h-1 w-1/3 bg-white/10 rounded-full" />
                        </div>
                      ))}
                      <div
                        className="h-6 rounded-md flex items-center justify-center"
                        style={{ background: themes[activeTheme].color }}
                      >
                        <span className="text-[8px] text-white font-bold">احجز الآن</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-4">20 ثيم متوفر · تخصيص كامل · بدون كود</p>
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: 3 خطوات
            ══════════════════════════════════════════════════════════════════ */}
        <section>
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="text-2xl font-black text-white mb-2">كيف يشتغل؟</h2>
            <p className="text-slate-500 text-sm">3 خطوات وموقعك جاهز</p>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                step: '1',
                icon: Layout,
                title: 'اختر التصميم',
                desc: 'اختر من 20 ثيم احترافي. غيّر الألوان، النصوص، والأقسام اللي تبي تعرضها.',
              },
              {
                step: '2',
                icon: Package,
                title: 'أضف خدماتك',
                desc: 'أضف خدماتك وأسعارك — أو استخدم قوالب جاهزة لجميع أنواع المشاريع الخدمية.',
              },
              {
                step: '3',
                icon: Globe,
                title: 'شارك الرابط',
                desc: 'موقعك جاهز على jdawil.sa/store/اسمك — أرسله لعملائك عبر واتساب أو انستقرام.',
              },
            ].map((item, i) => (
              <motion.div key={item.step} {...fadeUp(i * 0.1)}
                className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 text-center"
              >
                <div className="w-10 h-10 mx-auto rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-xs text-blue-400 font-bold mb-2">الخطوة {item.step}</div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: بوابة الدفع
            ══════════════════════════════════════════════════════════════════ */}
        <section>
          <motion.div {...fadeUp()} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-4">
                  <CreditCard className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-bold">ربط بسيط</span>
                </div>
                <h2 className="text-2xl font-black text-white mb-3">
                  اربط بوابة الدفع بدقيقة
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-5">
                  ضع مفتاح API من بوابة الدفع الخاصة بك — والمال يدخل حسابك البنكي مباشرة. Jdawil لا يلمس أموالك ولا يأخذ عمولة.
                </p>
                <div className="space-y-3">
                  {[
                    'STC Pay — الأكثر استخداماً في السعودية',
                    'مدى — بطاقات الصراف مباشرة',
                    'Apple Pay — للآيفون بنقرة واحدة',
                    'Moyasar / Checkout.com — بوابات دفع معتمدة',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-sm text-slate-400">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
                <p className="text-xs text-slate-600 mb-3">إعداد بوابة الدفع</p>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">البوابة</div>
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white flex items-center justify-between">
                      Moyasar
                      <ChevronLeft className="w-4 h-4 text-slate-600 rotate-90" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">مفتاح API</div>
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-slate-600 font-mono" dir="ltr">
                      sk_live_•••••••••••••
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-bold">متصل — المدفوعات تدخل حسابك مباشرة</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: وش تحصل بالضبط
            ══════════════════════════════════════════════════════════════════ */}
        <section>
          <motion.div {...fadeUp()} className="text-center mb-10">
            <h2 className="text-2xl font-black text-white mb-2">وش تحصل بالمجان؟</h2>
            <p className="text-slate-500 text-sm">كل هذا متوفر في التجربة المجانية — 14 يوم كاملة</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { icon: Globe, title: 'موقع حجز خاص بمشروعك', desc: 'رابط مخصص + 20 ثيم + تخصيص كامل' },
              { icon: Smartphone, title: 'يشتغل على كل جهاز', desc: 'جوال، تابلت، كمبيوتر — بدون تطبيق' },
              { icon: CreditCard, title: 'مدفوعات إلكترونية', desc: 'STC Pay، مدى، Apple Pay بحسابك' },
              { icon: MapPin, title: 'تتبع GPS مباشر', desc: 'العميل يشوف الموظف على الخريطة' },
              { icon: BarChart3, title: 'تقارير مالية', desc: 'دخل، مصاريف، أرباح — كل يوم' },
              { icon: MessageCircle, title: 'إشعارات واتساب', desc: 'تأكيد وتذكير تلقائي للعملاء' },
              { icon: Users, title: 'إدارة موظفين', desc: 'رواتب، جدولة، أداء، GPS' },
              { icon: Shield, title: 'فواتير ضريبية', desc: 'PDF تلقائي مع VAT 15%' },
              { icon: TrendingUp, title: 'مستشار ذكي AI', desc: 'تحليل أعمالك وتوصيات مخصصة' },
            ].map((f, i) => (
              <motion.div key={f.title} {...fadeUp(i * 0.04)}
                className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4"
              >
                <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5">{f.title}</h3>
                  <p className="text-xs text-slate-500">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: القطاعات المدعومة
            ══════════════════════════════════════════════════════════════════ */}
        <section>
          <motion.div {...fadeUp()} className="text-center mb-8">
            <h2 className="text-2xl font-black text-white mb-2">يناسب أي نوع خدمة</h2>
            <p className="text-slate-500 text-sm">قوالب جاهزة لكل قطاع — أو عرّف خدماتك بنفسك</p>
          </motion.div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {[
              { icon: '🚗', name: 'مغاسل سيارات' },
              { icon: '💈', name: 'صالونات' },
              { icon: '💄', name: 'تجميل منزلي' },
              { icon: '🏠', name: 'تنظيف منازل' },
              { icon: '❄️', name: 'مكيفات' },
              { icon: '🔧', name: 'سباكة' },
              { icon: '⚡', name: 'كهرباء' },
              { icon: '💼', name: 'فري لانسر' },
            ].map((ind, i) => (
              <motion.div key={ind.name} {...fadeUp(i * 0.04)}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                <span className="text-2xl block mb-2">{ind.icon}</span>
                <p className="text-xs font-bold text-slate-400">{ind.name}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: CTA
            ══════════════════════════════════════════════════════════════════ */}
        <motion.section {...fadeUp()} className="text-center pb-8">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-10">
            <h2 className="text-2xl font-black text-white mb-3">جاهز تبني موقعك؟</h2>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">
              سجّل مجاناً، اختر التصميم، وأرسل الرابط لعملائك. خلال 5 دقائق يكون عندك موقع حجز احترافي.
            </p>
            <Link
              to="/onboard"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-colors"
            >
              ابدأ الآن — مجاناً
            </Link>
            <p className="text-xs text-slate-600 mt-4">14 يوم مجاناً · بدون بطاقة · إلغاء في أي وقت</p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
