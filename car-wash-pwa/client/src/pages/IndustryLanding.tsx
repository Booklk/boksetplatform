/**
 * IndustryLanding — a SEO-focused landing page per business activity.
 * Route: /for/:industry  (car-wash | salon | cleaning | movers)
 *
 * Mission: a vendor arriving from Google for their specific activity
 * should feel the page is built for them — same pain points, same
 * vocabulary, same features, same recommended template.
 */

import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import {
  Calendar, Ticket, MapPin, DollarSign, Users, MessageCircle,
  Image as ImageIcon, Lock, Gift, FileText, Building2, Receipt,
  Truck, CheckCircle, ArrowLeft, Sparkles, XCircle, LucideIcon,
} from 'lucide-react';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { getIndustry, IndustrySolution } from '../data/industries';
import { getTheme } from '../lib/storeThemes';

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar, Ticket, MapPin, DollarSign, Users, MessageCircle,
  Image: ImageIcon, Lock, Gift, FileText, Building2, Receipt, Truck,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Sparkles;
}

export default function IndustryLanding() {
  const { industry: slug } = useParams<{ industry: string }>();
  const industry = getIndustry(slug);

  if (!industry) return <Navigate to="/" replace />;

  const template = getTheme(industry.recommendedTemplateId);
  const pageUrl = `https://jdawil.sa/for/${industry.slug}`;
  const metaDescription = `${industry.heroSubtitle} — ${industry.secondaryKeywords.join(' · ')}`;

  return (
    <MarketingLayout>
      <Helmet>
        <title>{industry.heroTitle} | جداول</title>
        <meta name="description" content={metaDescription} />
        <meta name="keywords" content={[industry.primaryKeyword, ...industry.secondaryKeywords].join(', ')} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={industry.heroTitle} />
        <meta property="og:description" content={industry.heroSubtitle} />
        <meta property="og:locale" content="ar_SA" />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: industry.heroTitle,
            description: industry.heroSubtitle,
            provider: { '@type': 'Organization', name: 'Jdawil', url: 'https://jdawil.sa' },
            areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
            inLanguage: 'ar',
          })}
        </script>
      </Helmet>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="border-b border-white/8 pt-16 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300 text-xs font-bold mb-5">
              {industry.heroBadge}
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-5">
              {industry.heroTitle}
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              {industry.heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                to="/onboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-white text-[#0b1220] font-black text-base hover:bg-slate-100 transition-colors"
              >
                {industry.ctaText}
                <ArrowLeft size={16} />
              </Link>
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-white/15 text-slate-200 font-bold text-base hover:bg-white/5 transition-colors"
              >
                شاهد تجربة مباشرة
              </Link>
            </div>
            <p className="text-slate-500 text-xs mt-5">
              باقة مجانية دائمة · بدون بطاقة ائتمان · موقعك جاهز في 10 دقائق
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── PAIN POINTS ─────────────────────────────────────────────────── */}
      <section className="py-20 px-4 border-b border-white/8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-block text-[11px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-full px-3 py-1 mb-4">
              مشاكل يومية
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              تحس إن يومك يمرّ بهالأمور؟
            </h2>
            <p className="text-slate-400 text-sm">
              إذا وحدة منها عندك، جداول جا لك.
            </p>
          </motion.div>

          <div className="grid gap-3 max-w-2xl mx-auto">
            {industry.painPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 p-4 rounded-lg border border-white/8 bg-white/[0.02]"
              >
                <XCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                <p className="text-slate-200 text-sm leading-relaxed">{point}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUTIONS ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4 border-b border-white/8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <span className="inline-block text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-4">
              الحل
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              كل شي تحتاجه — في مكان واحد
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              مصمّم خصيصاً لـ {industry.arName}. بدون قوالب عامة، بدون مميزات ما تحتاجها.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {industry.solutions.map((sol: IndustrySolution, i: number) => {
              const Icon = resolveIcon(sol.icon);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-white/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center mb-4">
                    <Icon size={18} className="text-slate-200" />
                  </div>
                  <h3 className="font-black text-white text-base mb-2">{sol.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{sol.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TEMPLATE PREVIEW ───────────────────────────────────────────── */}
      <section className="py-20 px-4 border-b border-white/8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-block text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 mb-4">
              موقعك جاهز في دقائق
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              قالب احترافي مصمّم لنشاطك
            </h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              اختَر القالب، ارفع شعارك وصور خدماتك، واكتب أسعارك.
              خدماتك أنت تحدّدها — إحنا نرتّب لك الباقي.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Template preview card */}
            <div
              className="rounded-xl overflow-hidden border border-white/10"
            >
              <div className={`h-32 bg-gradient-to-br ${template.gradient} relative`}>
                <div
                  className="absolute top-3 left-3 h-5 w-16 rounded-full"
                  style={{ background: template.accent, opacity: 0.85 }}
                />
                <div className="absolute bottom-3 inset-x-3 flex gap-1.5">
                  <div className="flex-1 h-8 rounded bg-white/10 border border-white/15" />
                  <div className="flex-1 h-8 rounded bg-white/10 border border-white/15" />
                </div>
              </div>
              <div className="p-4 bg-[#131b2e]">
                <p className="text-[10px] text-slate-500 mb-1">قالب موصى به</p>
                <p className="font-black text-white">{template.name}</p>
                <p className="text-xs text-slate-400 mt-1 leading-snug">{template.desc}</p>
              </div>
            </div>

            {/* Highlights list */}
            <div className="flex flex-col justify-center">
              <ul className="space-y-3">
                {industry.templateHighlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-200 text-sm">
                    <CheckCircle size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{h}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/onboard"
                className="inline-flex items-center justify-center gap-2 mt-6 px-5 py-2.5 rounded-md bg-white text-[#0b1220] font-black text-sm hover:bg-slate-100 transition-colors self-start"
              >
                جرّب القالب مجاناً
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-5 leading-tight">
              ابدأ اليوم — موقع حجوزات باسم {industry.arName} يصير جاهز في 10 دقائق
            </h2>
            <p className="text-slate-400 text-base mb-8 max-w-xl mx-auto">
              الباقة المجانية كافية للبزنس الصغير. إذا كبر مشروعك، رقّي لـ Pro وافتح
              كل المميزات + 12 قالب احترافي + إخفاء علامة جداول.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <Link
                to="/onboard"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-white text-[#0b1220] font-black text-base hover:bg-slate-100 transition-colors"
              >
                {industry.ctaText}
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md border border-white/15 text-slate-200 font-bold text-sm hover:bg-white/5 transition-colors"
              >
                شاهد الأسعار
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}
