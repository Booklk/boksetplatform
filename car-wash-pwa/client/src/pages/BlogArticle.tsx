import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, CheckCircle } from 'lucide-react';
import { ARTICLES } from './Blog';
import MarketingLayout from '../components/marketing/MarketingLayout';

const DOMAIN = 'https://bokset.sa';

function RegisterCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="my-12 rounded-2xl overflow-hidden border border-white/10 bg-[#131b2e]"
    >
      <div className="p-6 sm:p-10">
        <div className="max-w-xl">
          <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold mb-4">
            باقة مجانية دائمة
          </span>
          <h3 className="text-white font-black text-2xl leading-tight mb-3">
            جرّب بوكست — نظام حجوزات بدون تعب
          </h3>
          <p className="text-slate-400 text-[15px] leading-relaxed mb-6">
            لو مشروعك صغير، اشترك في الباقة المجانية وابدأ بدون ما تدفع ريال واحد.
            تحصل على صفحة حجز خاصة بك، تأكيد تلقائي عبر واتساب، ولوحة تحكم بسيطة.
          </p>

          <ul className="space-y-2.5 mb-7">
            {[
              'صفحة حجز جاهزة باسمك وشعارك',
              'حجوزات تلقائية بدون اتصال أو تنسيق يدوي',
              'تأكيد فوري للعميل عبر واتساب',
              'بدون بطاقة ائتمان، إلغاء في أي وقت',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-300 text-sm">
                <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/onboard"
              className="inline-flex items-center justify-center gap-2 bg-white text-[#0b1220] font-black text-base py-3 px-6 rounded-md hover:bg-slate-100 transition-colors"
            >
              ابدأ مجاناً الآن
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 border border-white/15 text-slate-200 font-bold text-base py-3 px-6 rounded-md hover:bg-white/5 transition-colors"
            >
              شاهد تجربة مباشرة
            </Link>
          </div>
          <p className="text-slate-500 text-xs mt-4">
            الإعداد ما ياخذ أكثر من 10 دقائق — جاهز تستقبل أول حجز اليوم.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const article = ARTICLES.find(a => a.slug === slug);

  if (!article) {
    return (
      <MarketingLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl font-black mb-4 text-white">404</p>
            <p className="text-slate-400 mb-6">المقال غير موجود</p>
            <Link to="/blog" className="inline-flex items-center gap-2 text-slate-200 hover:text-white transition-colors">
              <ArrowRight size={16} /> العودة للمدونة
            </Link>
          </div>
        </div>
      </MarketingLayout>
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
    <MarketingLayout>
      <Helmet>
        <title>{article.title} | مدونة بوكست</title>
        <meta name="description" content={article.description} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={article.description} />
        <meta property="og:locale" content="ar_SA" />
        <meta property="article:published_time" content={article.date} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={article.title} />
        <meta name="twitter:description" content={article.description} />
        <script type="application/ld+json">{JSON.stringify(articleSchema)}</script>
      </Helmet>

      <div>
        {/* Back */}
        <div className="max-w-3xl mx-auto px-4 pt-8">
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

          {/* Register CTA */}
          <RegisterCTA />

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
    </MarketingLayout>
  );
}
