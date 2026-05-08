import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Search, MessageCircle, Mail, Calendar, ChevronDown, BookOpen, ChevronLeft, Clock } from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { Link } from 'react-router-dom';
import { HELP_ARTICLES, HELP_CATEGORIES } from '../data/helpArticles';

interface Faq {
  q: string;
  a: string;
  category: 'pricing' | 'setup' | 'features' | 'support' | 'compliance';
}

const FAQS: Faq[] = [
  // Pricing
  { category: 'pricing', q: 'كم سعر الاشتراك؟', a: 'الباقة المجانية مدى الحياة تشمل 30 حجز شهرياً، باقة Pro 99 ر.س/شهر بدون حدود. لا توجد عمولات على الحجوزات.' },
  { category: 'pricing', q: 'هل هناك ضمان استرداد؟', a: 'نعم، ضمان استرداد كامل خلال 60 يوم بدون أسئلة. إذا قررت أن النظام موب مناسب، نرجّع كامل المبلغ خلال 7 أيام عمل.' },
  { category: 'pricing', q: 'هل ترتفع الأسعار للمشتركين الحاليين؟', a: 'لا. التزام مكتوب بأن سعرك ثابت مدى اشتراكك. لو رفعنا الأسعار للجدد، أنت تحتفظ بسعرك الأصلي.' },
  { category: 'pricing', q: 'الـ Add-ons ليش مدفوعة منفصلة؟', a: 'GPS و WhatsApp Bot يكلّفونا فعلياً عند Google Maps وOpenAI. ندفع التكلفة الفعلية + هامش بسيط، شفافية كاملة. أي ميزة أخرى مدمجة بالاشتراك.' },

  // Setup
  { category: 'setup', q: 'كم يأخذ إعداد المتجر؟', a: 'موقعك الإلكتروني جاهز خلال 5-10 دقائق. تختار اسمك + قطاعك + شعارك، والقوالب الجاهزة تتعبأ تلقائياً بخدمات وأسعار مرجعية.' },
  { category: 'setup', q: 'هل أحتاج خبرة تقنية؟', a: 'إطلاقاً. النظام موجّه لأصحاب الأعمال، ليس للمطورين. كل شيء بالعربي + لمسة واحدة على الجوال.' },
  { category: 'setup', q: 'هل يدعم نشاطي؟', a: '13 قطاع جاهز: مغاسل، صالونات، عيادات، سبا، تنظيف، صيانة، سباكة، كهرباء، استشارات، فري لانسر وغيرها. لو نشاطك خدمي قائم على حجز، نخدمك.' },

  // Features
  { category: 'features', q: 'هل تأخذون عمولة على المدفوعات؟', a: 'لا. المدفوعات تذهب مباشرة لحسابك البنكي عبر بوابتك (ميسر، تاب، باي تابز...). Jdawil لا يلمس فلوسك.' },
  { category: 'features', q: 'هل النظام يرسل واتساب لعملائي؟', a: 'نعم. تأكيدات الحجز، التذكيرات، طلبات التقييم — كلها تنطلق تلقائياً. تستخدم رقمك أنت أو رقم Jdawil المشترك.' },
  { category: 'features', q: 'هل يوجد تطبيق جوال؟', a: 'نعم — مرتين. (1) تطبيقك أنت لإدارة العمل عبر PWA + إشعارات فورية. (2) تطبيق على App Store/Play Store لعملائك (5,000 ر.س مرة واحدة).' },
  { category: 'features', q: 'هل أقدر أربط فروعي؟', a: 'نعم. الباقة Pro تدعم فروع غير محدودة بـ تقارير لكل فرع + لوحة موحّدة.' },
  { category: 'features', q: 'هل يدعم زاتكا (الفاتورة الإلكترونية)؟', a: 'نعم. Phase 1 بـ QR موحّد للفواتير المبسّطة. Phase 2 (B2B) متوفر للحسابات Enterprise.' },

  // Compliance
  { category: 'compliance', q: 'هل بياناتي آمنة؟', a: 'مخزّنة في مراكز سعودية. متوافقون مع نظام حماية البيانات السعودي (PDPL). تشفير في النقل وعند التخزين + نسخ احتياطية يومية.' },
  { category: 'compliance', q: 'هل أقدر أصدّر بياناتي؟', a: 'نعم في أي وقت — Excel أو JSON. مش حبيس عندنا. إذا لغيت اشتراكك، تحصل على تصدير كامل قبل الحذف.' },
  { category: 'compliance', q: 'هل عندكم شهادات؟', a: 'مسجّلون لدى هيئة الزكاة والضريبة (ZATCA) كمزوّد حلول معتمد، متوافقون مع PDPL، قيد الحصول على ISO 27001.' },

  // Support
  { category: 'support', q: 'كم يأخذ الدعم الفني للرد؟', a: 'متوسط 30 دقيقة في وقت العمل (8 صباحاً - 10 مساءً). 4 ساعات خارج وقت العمل. الـ Pro له أولوية في الطابور.' },
  { category: 'support', q: 'كيف أتواصل مع الدعم؟', a: 'واتساب من داخل لوحة التحكم (الأسرع) + إيميل support@jdawil.sa. لا توجد قوائم انتظار طويلة — تاجر سعودي يكلّمك.' },
  { category: 'support', q: 'هل يوجد تدريب مجاني؟', a: 'نعم — أكاديمية Jdawil داخل النظام: 12 دورة قصيرة + ندوات أسبوعية مجانية + AI tutor للأسئلة المتعلقة بنشاطك.' },
];

const CATEGORIES: Array<{ id: Faq['category'] | 'all'; label: string }> = [
  { id: 'all', label: 'الكل' },
  { id: 'pricing', label: 'الأسعار والاشتراك' },
  { id: 'setup', label: 'البدء والإعداد' },
  { id: 'features', label: 'المميزات' },
  { id: 'compliance', label: 'الأمان والامتثال' },
  { id: 'support', label: 'الدعم الفني' },
];

export default function Help() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Faq['category'] | 'all'>('all');
  const [open, setOpen] = useState<number | null>(0);

  const filtered = FAQS.filter((f) => {
    if (category !== 'all' && f.category !== category) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <MarketingLayout>
      <Helmet>
        <title>مركز المساعدة — Jdawil</title>
        <meta name="description" content="إجابات مباشرة عن الأسعار، الإعداد، المميزات، الأمان، والدعم الفني لمنصة Jdawil." />
        <link rel="canonical" href="https://jdawil.sa/help" />
      </Helmet>

      <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white pt-12 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <BookOpen className="w-10 h-10 text-blue-300 mx-auto mb-3" />
            <h1 className="text-3xl sm:text-4xl font-black mb-3">كيف نقدر نساعدك؟</h1>
            <p className="text-slate-400">إجابات مباشرة + روابط للدعم الفوري</p>
          </div>

          {/* Search */}
          <div className="relative mb-5">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن سؤالك…"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-3 py-3 pr-10 text-white outline-none focus:border-blue-500/60"
            />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  category === c.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/[0.04] text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* FAQ */}
          {filtered.length === 0 ? (
            <p className="text-center py-10 text-slate-500">لا توجد نتائج — جرّب كلمات أخرى</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((f, i) => {
                const isOpen = open === i;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-right"
                    >
                      <span className="text-white font-bold text-sm sm:text-base">{f.q}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-slate-300 text-sm leading-relaxed px-4 sm:px-5 pb-4 sm:pb-5"
                      >
                        {f.a}
                      </motion.p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Operations guides — for merchants who already signed up */}
          <OperationsGuides />

          {/* Still need help */}
          <div className="mt-10 rounded-3xl border border-white/10 bg-gradient-to-bl from-blue-500/10 to-transparent p-6 sm:p-8 text-center">
            <h2 className="text-xl sm:text-2xl font-black mb-2">ما لقيت إجابتك؟</h2>
            <p className="text-slate-400 text-sm mb-5">تواصل معنا مباشرة — سعودي يفهم نشاطك يردّك في دقائق</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <a
                href="https://wa.me/966500000000"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-3 rounded-xl"
              >
                <MessageCircle className="w-4 h-4" /> واتساب الدعم
              </a>
              <Link
                to="/demo-request"
                className="inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold px-5 py-3 rounded-xl"
              >
                <Calendar className="w-4 h-4" /> احجز جلسة Demo
              </Link>
              <a
                href="mailto:support@jdawil.sa"
                className="inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold px-5 py-3 rounded-xl"
              >
                <Mail className="w-4 h-4" /> support@jdawil.sa
              </a>
            </div>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

/**
 * Section: operational guides for merchants already on the platform.
 * Distinct from the FAQ above (which targets prospects) — these answer
 * "how do I do X" questions that come up while running a store.
 */
function OperationsGuides() {
  return (
    <div className="mt-10 rounded-3xl border border-white/10 bg-white/3 p-6">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen className="w-5 h-5 text-blue-300" />
        <h2 className="text-xl font-black">دليل التاجر — أدلة تشغيل المنصة</h2>
      </div>
      <p className="text-slate-400 text-sm mb-5">
        أدلة عملية للتجار المسجّلين — كيف تشارك متجرك، تربط بوابة الدفع، تدير حجوزاتك، وتفهم تقاريرك المالية.
      </p>

      <div className="space-y-6">
        {HELP_CATEGORIES.map((cat) => {
          const articles = HELP_ARTICLES.filter((a) => a.category === cat.id);
          if (articles.length === 0) return null;
          return (
            <div key={cat.id}>
              <h3 className="text-sm font-bold text-white/85 mb-2">
                {cat.emoji} {cat.nameAr}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {articles.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/help/article/${a.slug}`}
                    className="group flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 px-4 py-3 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate group-hover:text-blue-200">
                        {a.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {a.minutes} دقائق
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-500 group-hover:text-white shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
