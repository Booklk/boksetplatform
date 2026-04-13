import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, MessageCircle, Calendar, CheckCircle } from 'lucide-react';
import { ARTICLES } from './Blog';

const CONSULTATION_PHONE = '966500000000'; // رقم واتساب Bokset
const DOMAIN = 'https://bokset.sa';

const SCHEDULE = [
  { day: 'الأحد', slots: ['10:00 ص', '2:00 م', '4:00 م'] },
  { day: 'الإثنين', slots: ['10:00 ص', '12:00 م', '3:00 م'] },
  { day: 'الثلاثاء', slots: ['11:00 ص', '2:00 م', '5:00 م'] },
  { day: 'الأربعاء', slots: ['10:00 ص', '1:00 م', '4:00 م'] },
  { day: 'الخميس', slots: ['10:00 ص', '12:00 م', '3:00 م'] },
];

function ConsultationCTA({ articleTitle }: { articleTitle: string }) {
  const waMsg = encodeURIComponent(
    `مرحباً 👋\nقرأت مقال "${articleTitle}" في موقع Bokset.\n\nأريد استشارة مجانية لبدء مشروع مغسلة سيارات متنقلة — هل يمكننا التحدث؟`
  );
  const waUrl = `https://wa.me/${CONSULTATION_PHONE}?text=${waMsg}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="my-10 rounded-3xl overflow-hidden border border-green-500/20 bg-gradient-to-br from-green-950/40 to-emerald-950/20"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={26} className="text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-black text-xl">نساعدك تبدأ مغسلتك المتنقلة — مجاناً 🚗</h3>
            <p className="text-slate-400 text-sm mt-1">استشارة شخصية مع خبير Bokset — بدون رسوم، بدون التزام</p>
          </div>
        </div>

        <ul className="space-y-2.5 mb-6">
          {[
            'نساعدك تحسب التكاليف الحقيقية لمشروعك',
            'نشرح كيف تبدأ وأين تحصل على المعدات',
            'نريك كيف يعمل نظام الحجوزات مع مغسلتك',
            'نجيب على كل أسئلتك بصراحة',
          ].map((item, i) => (
            <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
              <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* Schedule */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-blue-400" />
            <span className="text-white font-bold text-sm">مواعيد الاستشارات المتاحة</span>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold mr-auto">مجاناً</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {SCHEDULE.map(({ day, slots }) => (
              <div key={day} className="text-center">
                <p className="text-slate-400 text-xs font-bold mb-1.5">{day}</p>
                {slots.map(slot => (
                  <a key={slot} href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="block text-xs bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/30 text-slate-300 hover:text-green-300 rounded-lg py-1.5 mb-1 transition-all font-bold">
                    {slot}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        <a href={waUrl} target="_blank" rel="noopener noreferrer">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-400 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-green-500/25 transition-all"
          >
            <MessageCircle size={22} />
            اطلب استشارتك المجانية الآن عبر واتساب
          </motion.button>
        </a>
        <p className="text-center text-slate-600 text-xs mt-3">عادةً نرد خلال دقائق ⚡</p>
      </div>
    </motion.div>
  );
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = ARTICLES.find(a => a.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-5xl mb-4">404</p>
          <p className="text-slate-400 mb-6">المقال غير موجود</p>
          <Link to="/blog" className="text-blue-400 hover:text-blue-300 flex items-center justify-center gap-2">
            <ArrowRight size={16} /> العودة للمدونة
          </Link>
        </div>
      </div>
    );
  }

  const Icon = article.icon;
  const articleUrl = `${DOMAIN}/blog/${article.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: articleUrl,
    inLanguage: 'ar',
    datePublished: article.date,
    dateModified: article.date,
    author: { '@type': 'Organization', name: 'Bokset', url: DOMAIN },
    publisher: { '@type': 'Organization', name: 'Bokset', url: DOMAIN, logo: `${DOMAIN}/icons/icon-192x192.png` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': articleUrl },
  };

  const related = ARTICLES.filter(a => a.slug !== slug).slice(0, 3);

  return (
    <>
      <Helmet>
        <title>{article.title} | مدونة Bokset</title>
        <meta name="description" content={article.description} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        <meta property="og:locale" content="ar_SA" />
        <meta property="article:published_time" content={article.date} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.description} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>

      <div className="min-h-screen bg-[#0a0f1e] text-white font-arabic" dir="rtl">
        {/* Back */}
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <Link to="/blog" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-8">
            <ArrowRight size={16} /> العودة للمدونة
          </Link>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${article.color} flex items-center justify-center shadow-lg`}>
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{article.category}</span>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-slate-500 text-xs">
                    <Clock size={11} /> {article.readTime} دقائق قراءة
                  </span>
                  <span className="text-slate-600 text-xs">{new Date(article.date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-6">
              {article.title}
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8 border-r-4 border-blue-500/50 pr-4">
              {article.description}
            </p>
          </motion.div>

          {/* Article Content */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="prose-article"
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {/* Consultation CTA */}
          <ConsultationCTA articleTitle={article.title} />

          {/* Related articles */}
          {related.length > 0 && (
            <div className="mt-12 mb-16">
              <h2 className="text-xl font-black text-white mb-5">مقالات ذات صلة</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map(rel => {
                  const RelIcon = rel.icon;
                  return (
                    <Link key={rel.slug} to={`/blog/${rel.slug}`}
                      className="bg-white/5 border border-white/10 hover:border-white/20 rounded-xl p-4 group transition-all">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${rel.color} flex items-center justify-center mb-3`}>
                        <RelIcon size={16} className="text-white" />
                      </div>
                      <p className="text-white text-sm font-bold leading-snug group-hover:text-blue-300 transition-colors line-clamp-2">
                        {rel.title}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
