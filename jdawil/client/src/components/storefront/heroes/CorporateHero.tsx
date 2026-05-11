/**
 * CorporateHero — formal, structured, B2B-ready.
 * Used by: cleaning-pro-b2b, cleaning-facade, cleaning-tanks,
 *          fixed-wash-queue, integrated-pro.
 *
 * Goal: communicate reliability and scale. Square lines, no animation
 * flourishes, emphasis on "quote" and "enterprise contracts".
 */

import { ShieldCheck, CheckCircle } from 'lucide-react';
import { StorefrontHeroProps } from './StorefrontHero';
import { FeatureBadges, HeroCTAs, HeroLogo, MetaRow } from './HeroShared';

export default function CorporateHero({
  vendor, customTheme, features, sections, heroSubtitle,
  whatsappUrl, callUrl, ratingNode,
}: StorefrontHeroProps) {
  const trustPoints = [
    'فاتورة ضريبية ١٥٪ معتمدة',
    'عقود شهرية/سنوية',
    'فرق عمل متخصصة ومدرّبة',
  ];

  return (
    <section
      className="relative pt-14 pb-12 px-5 border-b"
      style={{ background: customTheme.bg, borderColor: `${customTheme.text}15` }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Left: identity + subtitle + CTAs */}
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <HeroLogo vendor={vendor} customTheme={customTheme} size="md" />
              <div className="min-w-0">
                <span
                  className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase mb-2 border"
                  style={{
                    color: customTheme.accent,
                    borderColor: `${customTheme.accent}44`,
                    borderRadius: customTheme.radius === 'pill' ? '9999px' : '4px',
                  }}
                >
                  خدمات احترافية للقطاع الخاص والأعمال
                </span>
                <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ color: customTheme.text }}>
                  {vendor.nameAr}
                </h1>
              </div>
            </div>

            <p className="text-sm sm:text-base leading-relaxed opacity-80" style={{ color: customTheme.text }}>
              {heroSubtitle}
            </p>

            <MetaRow vendor={vendor} customTheme={customTheme} sections={sections} ratingNode={ratingNode} />

            <FeatureBadges features={features} accent={customTheme.accent} />

            <HeroCTAs
              customTheme={customTheme}
              features={features}
              sections={sections}
              whatsappUrl={whatsappUrl}
              callUrl={callUrl}
            />
          </div>

          {/* Right: trust card */}
          <div
            className="p-6 border self-start"
            style={{
              background: customTheme.surface,
              borderColor: `${customTheme.accent}33`,
              borderRadius: customTheme.radius === 'pill' ? '20px' : customTheme.radius === 'square' ? '4px' : '12px',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} style={{ color: customTheme.accent }} />
              <h3 className="font-black text-sm" style={{ color: customTheme.text }}>
                لماذا يختارنا عملاء الشركات؟
              </h3>
            </div>
            <ul className="space-y-3">
              {trustPoints.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm" style={{ color: customTheme.text }}>
                  <CheckCircle size={16} style={{ color: customTheme.accent }} className="shrink-0 mt-0.5" />
                  <span className="opacity-85">{p}</span>
                </li>
              ))}
            </ul>

            {vendor.descriptionAr && (
              <>
                <div className="h-px my-4" style={{ background: `${customTheme.text}15` }} />
                <p className="text-xs leading-relaxed opacity-60" style={{ color: customTheme.text }}>
                  {vendor.descriptionAr}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
