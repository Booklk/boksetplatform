import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Clock, ArrowLeft, TrendingUp, Car, Wrench, DollarSign, Users, Smartphone } from 'lucide-react';

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: number; // minutes
  icon: typeof BookOpen;
  color: string;
  date: string;
  content: string; // HTML string
}

export const ARTICLES: Article[] = [
  {
    slug: 'mobile-car-wash-startup-cost',
    title: 'تكاليف مشروع مغسلة السيارات المتنقلة في السعودية',
    description: 'دليل شامل لتكاليف بدء مشروع مغسلة سيارات متنقلة في السعودية — من الأدوات والمعدات إلى التراخيص والتشغيل.',
    category: 'ريادة الأعمال',
    readTime: 7,
    icon: DollarSign,
    color: 'from-amber-500 to-orange-500',
    date: '2026-04-01',
    content: `
<h2>ما هي مغسلة السيارات المتنقلة؟</h2>
<p>مغسلة السيارات المتنقلة هي خدمة تأتي إلى العميل — في بيته أو مكتبه أو أي مكان يختاره. الطلب عليها ارتفع بشكل كبير في السعودية خلال السنوات الأخيرة لأن العميل يوفر وقته وجهده.</p>

<h2>التكاليف الأولية (الأدوات والمعدات)</h2>
<ul>
  <li><strong>ضغاط ماء محمول (pressure washer):</strong> 800 – 2,500 ريال</li>
  <li><strong>جهاز بخار للتنظيف الداخلي:</strong> 1,500 – 4,000 ريال</li>
  <li><strong>خزان ماء (200 لتر):</strong> 300 – 600 ريال</li>
  <li><strong>مولد كهربائي (إذا لزم):</strong> 1,200 – 3,000 ريال</li>
  <li><strong>سيارة للتنقل (بيكاب أو فان):</strong> 30,000 – 80,000 ريال</li>
  <li><strong>مواد التنظيف والشمع والأدوات:</strong> 500 – 1,500 ريال/شهر</li>
</ul>

<h2>التكاليف الشهرية التشغيلية</h2>
<ul>
  <li><strong>الوقود:</strong> 500 – 1,500 ريال</li>
  <li><strong>مواد التنظيف:</strong> 300 – 800 ريال</li>
  <li><strong>رواتب موظفين (موظف واحد):</strong> 1,500 – 2,500 ريال</li>
  <li><strong>نظام إدارة الحجوزات:</strong> 29 – 199 ريال</li>
  <li><strong>تأمين السيارة:</strong> 200 – 400 ريال</li>
</ul>

<h2>الإيراد المتوقع</h2>
<p>متوسط سعر غسلة السيارة المتنقلة في السعودية: <strong>60 – 200 ريال</strong> حسب نوع الخدمة.</p>
<p>إذا أنجزت <strong>8 غسلات يومياً</strong> بمتوسط <strong>80 ريال</strong> للغسلة:</p>
<ul>
  <li>الدخل اليومي: 640 ريال</li>
  <li>الدخل الشهري (26 يوم): <strong>16,640 ريال</strong></li>
  <li>الربح الصافي بعد المصاريف: <strong>10,000 – 13,000 ريال</strong></li>
</ul>

<h2>متى تسترد استثمارك؟</h2>
<p>عند استثمار إجمالي <strong>40,000 – 50,000 ريال</strong>، يمكن استرداد الاستثمار خلال <strong>4 – 6 أشهر</strong> مع التشغيل المنتظم.</p>

<h2>نصائح لتحسين ربحية المغسلة المتنقلة</h2>
<ol>
  <li>ركز على خدمات البخار الداخلي — هامش ربح أعلى</li>
  <li>اعرض باقات اشتراك شهري للعملاء المنتظمين</li>
  <li>استخدم نظام حجوزات أونلاين لتقليل الوقت الضائع</li>
  <li>تتبع مصاريفك بدقة — كل ريال مهم</li>
  <li>اجمع تقييمات العملاء — تصل المبيعات بالسمعة</li>
</ol>
    `,
  },
  {
    slug: 'how-to-manage-mobile-car-wash-employees',
    title: 'كيف تدير موظفي مغسلة السيارات المتنقلة بشكل فعّال',
    description: 'نصائح عملية لإدارة موظفي المغاسل المتنقلة — التوزيع، التتبع، الرواتب، والتحفيز.',
    category: 'إدارة الفريق',
    readTime: 5,
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    date: '2026-03-20',
    content: `
<h2>التحدي الأول: أين موظفيك؟</h2>
<p>أكبر تحدٍّ لصاحب المغسلة المتنقلة هو معرفة مكان الموظفين ومتابعة عملهم بدون أن يكون موجوداً معهم. الحل هو نظام تتبع GPS يُظهر موقع كل موظف لحظياً على الخريطة.</p>

<h2>توزيع الحجوزات على الموظفين</h2>
<p>لا توزع الحجوزات عشوائياً — راعِ:</p>
<ul>
  <li>موقع الموظف الحالي ومدى قربه من الحجز</li>
  <li>عدد الحجوزات المفتوحة لكل موظف</li>
  <li>نوع المركبة المطلوب تنظيفها</li>
  <li>تقييمات الموظف من العملاء السابقين</li>
</ul>

<h2>نظام الرواتب والعمولات</h2>
<p>الأنظمة الأفضل أداءً تجمع بين راتب ثابت + عمولة:</p>
<ul>
  <li>راتب أساسي ثابت: يضمن الاستقرار للموظف</li>
  <li>عمولة على كل غسلة: تحفز على الإنجاز</li>
  <li>بونص التقييم العالي: يشجع على جودة الخدمة</li>
</ul>

<h2>تتبع أداء كل موظف</h2>
<p>احتفظ بإحصاءات دقيقة لكل موظف:</p>
<ul>
  <li>عدد الغسلات المنجزة</li>
  <li>متوسط تقييم العملاء</li>
  <li>الإيراد المُحقق</li>
  <li>نسبة الحجوزات المكتملة في الوقت المحدد</li>
</ul>

<h2>التواصل والتوجيه</h2>
<p>استخدم واتساب أو نظام الإشعارات لإبلاغ الموظف بكل حجز فوراً — مع تفاصيل العميل والخدمة المطلوبة والمبلغ.</p>
    `,
  },
  {
    slug: 'car-wash-booking-system-benefits',
    title: 'لماذا يحتاج كل صاحب مغسلة نظام حجوزات أونلاين؟',
    description: 'الفوائد الحقيقية لنظام الحجوزات الأونلاين لمغاسل السيارات — وكيف يزيد دخلك ويوفر وقتك.',
    category: 'التقنية',
    readTime: 4,
    icon: Smartphone,
    color: 'from-purple-500 to-pink-500',
    date: '2026-03-10',
    content: `
<h2>المشكلة: الحجوزات عبر واتساب</h2>
<p>أغلب أصحاب المغاسل يستقبلون الحجوزات عبر واتساب أو الهاتف. هذا يعني ضياع طلبات، تضارب مواعيد، وضغط مستمر على صاحب المغسلة.</p>

<h2>ما يوفره نظام الحجوزات الأونلاين</h2>
<ul>
  <li><strong>استقبال حجوزات ٢٤ ساعة بدون تدخل:</strong> العميل يحجز في أي وقت — حتى الساعة 2 صباحاً</li>
  <li><strong>لا تضارب في المواعيد:</strong> النظام يُظهر الفتحات المتاحة فقط</li>
  <li><strong>تأكيد تلقائي للعميل:</strong> رسالة واتساب فورية بتفاصيل الحجز</li>
  <li><strong>تذكير قبل الموعد:</strong> يقلل حالات الإلغاء المفاجئ</li>
  <li><strong>قبول الدفع مسبقاً:</strong> يضمن جدية العميل</li>
</ul>

<h2>تأثيره على الإيراد</h2>
<p>أصحاب المغاسل الذين يستخدمون نظام حجوزات أونلاين يُبلّغون عن:</p>
<ul>
  <li>زيادة الحجوزات بنسبة <strong>30-50%</strong></li>
  <li>تقليل الحجوزات الملغاة بنسبة <strong>40%</strong></li>
  <li>توفير <strong>2-3 ساعات يومياً</strong> من التنسيق اليدوي</li>
</ul>

<h2>كيف تختار النظام المناسب؟</h2>
<ol>
  <li>يدعم العربية ويعمل بالجوال</li>
  <li>يرسل تأكيدات واتساب تلقائياً</li>
  <li>يقبل STC Pay ومدى</li>
  <li>يعرض تقارير مالية</li>
  <li>سعر شهري معقول بدون عقد سنوي</li>
</ol>
    `,
  },
  {
    slug: 'car-wash-quality-standards',
    title: 'معايير الجودة في مغاسل السيارات: دليل صاحب المغسلة',
    description: 'كيف تحافظ على جودة ثابتة في مغسلتك وتكسب تقييمات 5 نجوم من عملائك.',
    category: 'الجودة',
    readTime: 6,
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    date: '2026-02-28',
    content: `
<h2>لماذا الجودة الثابتة صعبة؟</h2>
<p>أكبر شكوى من عملاء المغاسل ليست السعر — بل عدم الثبات. الموظف نفسه يعطي جودة مختلفة من حجز لآخر. الحل هو <strong>بروتوكول عمل موثق</strong>.</p>

<h2>بروتوكول الغسلة الاحترافية</h2>
<ol>
  <li><strong>فحص السيارة قبل البدء:</strong> التقط صور للخدوش والضرر الموجود مسبقاً</li>
  <li><strong>الغسيل الخارجي:</strong> من الأعلى للأسفل، العجلات آخراً</li>
  <li><strong>التجفيف:</strong> قماش ناعم مخصص — لا جرائد أو قماش خشن</li>
  <li><strong>الداخل:</strong> شفط الغبار، تنظيف اللوحة، تلميع الزجاج</li>
  <li><strong>الإنهاء:</strong> صورة بعد الغسلة وإرسالها للعميل</li>
</ol>

<h2>الأخطاء الأكثر شيوعاً</h2>
<ul>
  <li>استخدام إسفنجة ملوثة تخدش الطلاء</li>
  <li>ترك بقايا ماء تحت المرايا والمقابض</li>
  <li>إهمال تنظيف الإطارات بالكامل</li>
  <li>عدم التحقق من الزجاج بعد التجفيف</li>
</ul>

<h2>كيف تجمع تقييمات 5 نجوم؟</h2>
<p>الوقت المثالي لطلب التقييم هو <strong>30 دقيقة</strong> بعد إتمام الخدمة — عندما يرى العميل سيارته لامعة. أرسل رسالة واتساب مع رابط التقييم مباشرة.</p>
    `,
  },
  {
    slug: 'fixed-vs-mobile-car-wash',
    title: 'مغسلة ثابتة أم متنقلة؟ المقارنة الكاملة لعام 2026',
    description: 'مقارنة تفصيلية بين مغسلة السيارات الثابتة والمتنقلة — التكاليف، المزايا، والمثالية لكل نوع.',
    category: 'ريادة الأعمال',
    readTime: 8,
    icon: Car,
    color: 'from-rose-500 to-red-500',
    date: '2026-02-15',
    content: `
<h2>الفرق الجوهري</h2>
<p>المغسلة الثابتة لها موقع محدد يأتي إليه العميل. المتنقلة تذهب إلى العميل. كلٌّ لها جمهورها الخاص ونموذج ربح مختلف.</p>

<h2>المغسلة الثابتة</h2>
<h3>المزايا:</h3>
<ul>
  <li>مكان معروف يبني ثقة مع الوقت</li>
  <li>قدرة على استيعاب عدد أكبر من السيارات يومياً</li>
  <li>تكلفة أقل للمياه والكهرباء بالوحدة</li>
</ul>
<h3>التحديات:</h3>
<ul>
  <li>إيجار الموقع: 3,000 – 15,000 ريال/شهر</li>
  <li>رأس مال أولي كبير (50,000 – 200,000 ريال)</li>
  <li>ترخيص تجاري وبلدي</li>
</ul>

<h2>المغسلة المتنقلة</h2>
<h3>المزايا:</h3>
<ul>
  <li>رأس مال أولي منخفض (20,000 – 60,000 ريال)</li>
  <li>لا إيجار موقع</li>
  <li>قابلة للتوسع بإضافة سيارات جديدة</li>
  <li>تجربة مميزة — العميل يوفر وقت التنقل</li>
</ul>
<h3>التحديات:</h3>
<ul>
  <li>تكاليف وقود أعلى</li>
  <li>تحديات إيجاد مصدر مياه</li>
  <li>تنسيق الجداول أصعب</li>
</ul>

<h2>ما هو الأنسب لك؟</h2>
<p><strong>اختر المتنقلة إذا:</strong> ميزانيتك محدودة، تريد البدء بسرعة، أو المنطقة تفتقر للمغاسل الجيدة.</p>
<p><strong>اختر الثابتة إذا:</strong> لديك موقع مميز، رأس مال كافٍ، وتريد بناء علامة تجارية محلية.</p>
    `,
  },
  {
    slug: 'car-wash-inventory-management',
    title: 'كيف تدير مخزون مغسلتك وتوقف هدر المواد',
    description: 'دليل عملي لإدارة مخزون مواد التنظيف في مغسلة السيارات — تتبع الاستهلاك وتقليل الهدر وتحسين الربح.',
    category: 'الإدارة',
    readTime: 5,
    icon: Wrench,
    color: 'from-indigo-500 to-violet-500',
    date: '2026-01-30',
    content: `
<h2>لماذا إدارة المخزون مهمة؟</h2>
<p>كثير من أصحاب المغاسل لا يعرفون بدقة كم ينفقون على المواد. الهدر الصغير يومياً يتراكم إلى خسارة كبيرة نهاية الشهر.</p>

<h2>المواد الأساسية وتكلفتها</h2>
<ul>
  <li><strong>شامبو الغسيل:</strong> 15-30 مل لكل غسلة</li>
  <li><strong>واكس/تلميع:</strong> 5-10 مل للخارج</li>
  <li><strong>منظف الزجاج:</strong> 10-15 مل للسيارة</li>
  <li><strong>معطر داخلي:</strong> 2-5 مل</li>
  <li><strong>منشفات الميكروفايبر:</strong> 3-5 منشفات لكل سيارة</li>
</ul>

<h2>كيف تحسب تكلفة المواد لكل غسلة؟</h2>
<p>مثال عملي: إذا اشتريت شامبو 5 لترات بـ 80 ريال:</p>
<ul>
  <li>5,000 مل ÷ 20 مل لكل غسلة = <strong>250 غسلة</strong></li>
  <li>80 ريال ÷ 250 = <strong>0.32 ريال تكلفة المادة لكل غسلة</strong></li>
</ul>

<h2>نظام إدارة المخزون</h2>
<ol>
  <li>حدد كمية الاستهلاك لكل خدمة</li>
  <li>حدد مستوى إعادة الطلب (الحد الأدنى)</li>
  <li>تتبع الاستهلاك الفعلي مقابل المتوقع</li>
  <li>استخدم نظاماً يخصم المواد تلقائياً عند إتمام الحجز</li>
</ol>

<h2>نصائح لتقليل الهدر</h2>
<ul>
  <li>استخدم موزعات بكميات محددة للمواد السائلة</li>
  <li>اشترِ بكميات كبيرة لتوفير التكاليف</li>
  <li>ابنِ علاقة مع مورد موثوق للحصول على أفضل سعر</li>
  <li>راجع المخزون أسبوعياً لا شهرياً</li>
</ul>
    `,
  },
];

function ArticleCard({ article }: { article: Article }) {
  const Icon = article.icon;
  return (
    <Link to={`/blog/${article.slug}`}>
      <motion.article
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden group transition-all duration-300 h-full"
      >
        {/* Top gradient bar */}
        <div className={`h-1.5 bg-gradient-to-l ${article.color}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${article.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
              <Icon size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{article.category}</span>
              <h2 className="text-white font-bold text-base leading-snug mt-1 group-hover:text-blue-300 transition-colors line-clamp-2">
                {article.title}
              </h2>
            </div>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed mt-3 line-clamp-3">{article.description}</p>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Clock size={12} />
              <span>{article.readTime} دقائق قراءة</span>
            </div>
            <span className="text-xs text-blue-400 group-hover:text-blue-300 font-bold flex items-center gap-1">
              اقرأ المزيد <ArrowLeft size={12} className="rotate-180" />
            </span>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

export default function Blog() {
  return (
    <>
      <Helmet>
        <title>مدونة Jdawil — مقالات إدارة مغاسل السيارات الثابتة والمتنقلة</title>
        <meta name="description" content="مقالات وأدلة عملية لأصحاب مغاسل السيارات الثابتة والمتنقلة — تكاليف، إدارة، جودة، وتقنية." />
        <meta property="og:title" content="مدونة Jdawil — إدارة مغاسل السيارات" />
        <meta property="og:description" content="مقالات ونصائح عملية لأصحاب مغاسل السيارات." />
        <link rel="canonical" href="https://jdawil.sa/blog" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'مدونة Jdawil',
          url: 'https://jdawil.sa/blog',
          description: 'مقالات إدارة مغاسل السيارات الثابتة والمتنقلة',
          inLanguage: 'ar',
          publisher: { '@type': 'Organization', name: 'Jdawil', url: 'https://jdawil.sa' },
        })}</script>
      </Helmet>
      <div className="min-h-screen bg-[#0a0f1e] text-white font-arabic" dir="rtl">
        {/* Hero */}
        <div className="relative bg-gradient-to-b from-blue-950/40 to-transparent pt-20 pb-16 px-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-6">
              <BookOpen size={14} className="text-blue-400" />
              <span className="text-xs text-blue-400 font-bold">مدونة Jdawil</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-4">
              أدلة عملية لأصحاب
              <span className="bg-gradient-to-l from-blue-400 to-cyan-400 bg-clip-text text-transparent"> مغاسل السيارات</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              مقالات متخصصة في إدارة المغاسل الثابتة والمتنقلة — التكاليف، الجودة، الإدارة، والتقنية
            </p>
          </div>
        </div>

        {/* Articles grid */}
        <div className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ARTICLES.map((article, i) => (
              <motion.div key={article.slug}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                <ArticleCard article={article} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
