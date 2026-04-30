/**
 * ClassicHero — two-column split, warm and welcoming.
 * Used by: salon-queue, beauty-at-home, cleaning-general,
 *          cleaning-carpet, cleaning-postevent.
 *
 * Goal: friendly, traditional-salon vibe. Large logo on one side,
 * inviting copy + CTA on the other.
 */

import { motion } from 'framer-motion';
import { StorefrontHeroProps } from './StorefrontHero';
import { FeatureBadges, HeroCTAs, HeroLogo, MetaRow } from './HeroShared';

export default function ClassicHero({
  vendor, customTheme, features, sections, heroSubtitle,
  whatsappUrl, callUrl, ratingNode,
}: StorefrontHeroProps) {
  return (
    <section className="relative pt-14 pb-12 px-5" style={{ background: customTheme.bg }}>
      {/* Soft warm glow */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div
          className="absolute top-[-15%] right-[10%] w-[500px] h-[500px] rounded-full blur-[150px]"
          style={{ background: `${customTheme.accent}22` }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[120px]"
          style={{ background: `${customTheme.button}22` }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center">
          {/* Left: Big logo / monogram card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-3"
          >
            <div
              className="p-6 border-2 shadow-lg"
              style={{
                background: customTheme.surface,
                borderColor: `${customTheme.accent}55`,
                borderRadius: customTheme.radius === 'pill' ? '32px' : customTheme.radius === 'square' ? '6px' : '20px',
              }}
            >
              <HeroLogo vendor={vendor} customTheme={customTheme} size="lg" />
            </div>
          </motion.div>

          {/* Right: copy + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-5 text-right"
          >
            <div>
              <span
                className="inline-block text-[11px] font-bold tracking-wider mb-2 opacity-80"
                style={{ color: customTheme.accent }}
              >
                أهلاً بك في
              </span>
              <h1 className="text-3xl sm:text-5xl font-black leading-tight mb-3" style={{ color: customTheme.text }}>
                {vendor.nameAr}
              </h1>
              <p className="text-base sm:text-lg leading-relaxed opacity-80 max-w-xl" style={{ color: customTheme.text }}>
                {heroSubtitle}
              </p>
            </div>

            <MetaRow vendor={vendor} customTheme={customTheme} sections={sections} ratingNode={ratingNode} />

            {vendor.descriptionAr && (
              <p className="text-sm leading-relaxed opacity-65 max-w-xl" style={{ color: customTheme.text }}>
                {vendor.descriptionAr}
              </p>
            )}

            <FeatureBadges features={features} accent={customTheme.accent} />

            <HeroCTAs
              customTheme={customTheme}
              features={features}
              sections={sections}
              whatsappUrl={whatsappUrl}
              callUrl={callUrl}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
