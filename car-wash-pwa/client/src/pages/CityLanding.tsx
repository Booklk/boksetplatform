import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { MapPin, CheckCircle, ChevronLeft, Star, ArrowLeft } from 'lucide-react';

const CITIES: Record<string, {
  nameAr: string;
  districts: string[];
  population: string;
  serviceDemand: string;
  description: string;
}> = {
  'الرياض': {
    nameAr: 'الرياض',
    districts: ['الياسمين', 'الملقا', 'الصحافة', 'العقيق', 'حطين', 'النرجس', 'العارض', 'الندى', 'الوادي', 'الغدير', 'الربيع', 'قرطبة', 'المروج', 'الملك فهد', 'النخيل', 'الرحمانية', 'السليمانية', 'العليا', 'الورود'],
    population: '7.6 مليون',
    serviceDemand: 'الأعلى في المملكة — أكثر من 3 مليون سيارة مسجلة',
    description: 'الرياض أكبر سوق لمغاسل السيارات في السعودية. الطلب على خدمات الغسيل المتنقل يتزايد سنوياً بسبب الطقس الحار والغبار المستمر.',
  },
  'جدة': {
    nameAr: 'جدة',
    districts: ['الحمراء', 'الروضة', 'الشاطئ', 'أبحر الشمالية', 'أبحر الجنوبية', 'الفيصلية', 'النعيم', 'المحمدية', 'الأندلس', 'السلامة', 'البساتين', 'الزهراء'],
    population: '4.7 مليون',
    serviceDemand: 'ثاني أكبر سوق — الرطوبة العالية تزيد الطلب على التلميع',
    description: 'جدة عروس البحر الأحمر. رطوبة الجو وملوحة الهواء تجعل غسيل السيارات ضرورة أسبوعية وليست رفاهية.',
  },
  'الدمام': {
    nameAr: 'الدمام',
    districts: ['الشاطئ', 'الفيصلية', 'النور', 'الأمانة', 'المريكبات', 'الجلوية', 'البديع', 'الطبيشي'],
    population: '1.2 مليون',
    serviceDemand: 'سوق متنامي — المنطقة الشرقية تشهد توسعاً عمرانياً كبيراً',
    description: 'الدمام مركز المنطقة الشرقية الاقتصادي. قربها من الصحراء والبحر يخلق طلباً مستمراً على خدمات غسيل السيارات.',
  },
  'مكة': {
    nameAr: 'مكة المكرمة',
    districts: ['العزيزية', 'الشوقية', 'الرصيفة', 'النسيم', 'الزاهر', 'العوالي', 'الكعكية'],
    population: '2.4 مليون',
    serviceDemand: 'موسمي مرتفع — مواسم الحج والعمرة ترفع الطلب 300%',
    description: 'مكة المكرمة تستقبل ملايين الزوار سنوياً. خدمات غسيل السيارات المتنقلة مطلوبة جداً خصوصاً في مواسم الحج والعمرة.',
  },
  'المدينة': {
    nameAr: 'المدينة المنورة',
    districts: ['قباء', 'العريض', 'الحرم', 'السلام', 'الخالدية', 'الفتح', 'الجمعة'],
    population: '1.5 مليون',
    serviceDemand: 'سوق موسمي — الزوار يحتاجون خدمة سريعة',
    description: 'المدينة المنورة تشهد حركة زوار مستمرة. المغاسل المتنقلة فرصة ذهبية لخدمة الفنادق والشقق المفروشة.',
  },
  'الخبر': {
    nameAr: 'الخبر',
    districts: ['الحزام الذهبي', 'العليا', 'الكورنيش', 'الروابي', 'اليرموك', 'الثقبة', 'العزيزية'],
    population: '600 ألف',
    serviceDemand: 'قوة شرائية عالية — سكان يفضلون الخدمات المتنقلة',
    description: 'الخبر مدينة راقية بقوة شرائية عالية. سكانها يفضلون خدمات الراحة والجودة — فرصة مثالية للمغاسل المتنقلة الاحترافية.',
  },
  'الطائف': {
    nameAr: 'الطائف',
    districts: ['الحوية', 'الشهداء', 'الحلقة', 'السلامة', 'شبرا'],
    population: '700 ألف',
    serviceDemand: 'طلب صيفي مرتفع — السياحة الداخلية تنعش السوق',
    description: 'الطائف مصيف السعودية. في الصيف يتضاعف عدد السيارات والطلب على الخدمات بسبب السياحة الداخلية.',
  },
  'تبوك': {
    nameAr: 'تبوك',
    districts: ['المروج', 'السليمانية', 'الورود', 'النهضة', 'المصيف'],
    population: '600 ألف',
    serviceDemand: 'سوق صاعد — مشاريع نيوم ترفع الطلب',
    description: 'تبوك بوابة مشروع نيوم. النمو العمراني المتسارع يفتح فرصاً كبيرة لمغاسل السيارات المتنقلة.',
  },
};

const cityKeys = Object.keys(CITIES);

export default function CityLanding() {
  const { city } = useParams<{ city: string }>();
  const data = city ? CITIES[decodeURIComponent(city)] : null;

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center p-6" dir="rtl">
        <h2 className="text-2xl font-black text-white mb-4">المدينة غير موجودة</h2>
        <Link to="/" className="btn-primary">العودة للرئيسية</Link>
      </div>
    );
  }

  const DOMAIN = 'https://jdawil.sa';
  const pageUrl = `${DOMAIN}/city/${encodeURIComponent(city!)}`;
  const title = `أنشئ موقع حجوزات في ${data.nameAr} | منصة حجوزات — Jadawel`;
  const desc = `أفضل برنامج لإدارة أنشئ موقع حجوزات في ${data.nameAr}. نظام حجوزات أونلاين، تتبع GPS، مدفوعات STC Pay. يخدم أحياء ${data.districts.slice(0, 5).join('، ')} وغيرها. تجربة مجانية 14 يوم.`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="ar_SA" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={desc} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": `منصة حجوزات في ${data.nameAr}`,
          "description": desc,
          "url": pageUrl,
          "areaServed": { "@type": "City", "name": data.nameAr },
          "provider": { "@type": "Organization", "name": "Jadawel", "url": DOMAIN },
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "SAR" },
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-surface-1" dir="rtl">
        {/* Hero */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh-hero" />
          <div className="relative z-10 max-w-5xl mx-auto px-4 pt-24 pb-16 text-center">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
              <ArrowLeft size={14} />
              العودة لـ Jadawel
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-400 font-bold">{data.nameAr}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight">
                أفضل منصة حجوزات
                <br />
                <span className="gradient-text">في {data.nameAr}</span>
              </h1>

              <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {data.description} Jadawel يساعدك تدير مشروعك باحترافية — حجوزات، GPS، مدفوعات، تقارير — كل شيء من جوالك.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/onboard" className="btn-primary text-lg px-8 py-4">
                  ابدأ مجاناً في {data.nameAr}
                </Link>
                <Link to="/demo" className="btn-outline text-lg px-8 py-4">
                  شاهد العرض التجريبي
                </Link>
              </div>
            </motion.div>
          </div>
        </div>

        {/* City stats */}
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="grid sm:grid-cols-3 gap-4 mb-16">
            {[
              { label: 'عدد السكان', value: data.population, icon: '👥' },
              { label: 'الطلب على الخدمات', value: data.serviceDemand, icon: '📈' },
              { label: 'أحياء مخدومة', value: `${data.districts.length}+ حي`, icon: '🏘️' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="card-glass p-5 text-center"
              >
                <span className="text-3xl mb-2 block">{s.icon}</span>
                <p className="text-sm text-slate-400 mb-1">{s.label}</p>
                <p className="text-white font-bold">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Districts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card-glass p-6 mb-16"
          >
            <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-blue-400" />
              الأحياء التي يخدمها Jadawel في {data.nameAr}
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.districts.map(d => (
                <span key={d} className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-bold">
                  {d}
                </span>
              ))}
              <span className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold">
                + جميع الأحياء الأخرى
              </span>
            </div>
          </motion.div>

          {/* Why Jadawel for this city */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-2xl font-black text-white mb-6 text-center">
              لماذا جداول لمتجرك في {data.nameAr}؟
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                `حجوزات أونلاين — عملاء ${data.nameAr} يحجزون من جوالهم 24/7`,
                `تتبع GPS — اعرف وين كل موظف في شوارع ${data.nameAr}`,
                `مدفوعات STC Pay ومدى — ما تخسر عميل بسبب الكاش`,
                `واتساب تلقائي — تذكير وتأكيد بدون ما تتصل`,
                `فواتير ضريبية — VAT 15% تلقائي ومتوافق مع هيئة الزكاة`,
                `تقارير يومية — اعرف دخلك ومصاريفك كل يوم`,
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-300 leading-relaxed">{feature}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <div className="glass-premium rounded-3xl p-8 text-center mb-16">
            <h3 className="text-2xl font-black text-white mb-3">جاهز تبدأ في {data.nameAr}؟</h3>
            <p className="text-slate-400 mb-6">14 يوم مجاناً. بدون بطاقة ائتمان. ألغِ وقتما تشاء.</p>
            <Link to="/onboard" className="btn-primary text-lg px-10 py-4 inline-block">
              سجّل مغسلتك الآن — مجاناً
            </Link>
          </div>

          {/* Other cities */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-4">Jadawel متوفر أيضاً في:</h3>
            <div className="flex flex-wrap justify-center gap-2">
              {cityKeys.filter(c => c !== city).map(c => (
                <Link
                  key={c}
                  to={`/city/${encodeURIComponent(c)}`}
                  className="px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.06] text-slate-400 text-sm hover:text-white hover:border-blue-500/30 transition-all"
                >
                  {CITIES[c].nameAr}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-slate-600 text-xs">Jadawel — أفضل منصة حجوزات السيارات في السعودية</p>
        </div>
      </div>
    </>
  );
}
