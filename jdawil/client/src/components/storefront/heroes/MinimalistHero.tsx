/**
 * MinimalistHero — quiet, single-column, centred CTA.
 * Used by: universal-clean, barber-queue, salon-queue, clinic-pro,
 *          studio-portfolio, home-services.
 *
 * Goal: get out of the way — the vendor's logo + name + one CTA.
 */

import { motion } from 'framer-motion';
import { StorefrontHeroProps } from './StorefrontHero';
import { FeatureBadges, HeroCTAs, HeroLogo, MetaRow } from './HeroShared';

export default function MinimalistHero({
  vendor, customTheme, features, sections, heroSubtitle,
  whatsappUrl, callUrl, ratingNode,
}: StorefrontHeroProps) {
  return (
    <section
      className="relative pt-14 pb-10 px-5"
      style={{ background: customTheme.bg }}
    >
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full flex flex-col items-center gap-5"
        >
          <HeroLogo vendor={vendor} customTheme={customTheme} size="md" />

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight" style={{ color: customTheme.text }}>
              {vendor.nameAr}
            </h1>
            <p className="text-base leading-relaxed max-w-xl opacity-75" style={{ color: customTheme.text }}>
              {heroSubtitle}
            </p>
          </div>

          <div className="flex justify-center">
            <MetaRow vendor={vendor} customTheme={customTheme} sections={sections} ratingNode={ratingNode} />
          </div>

          <FeatureBadges features={features} accent={customTheme.accent} />

          <div className="pt-2">
            <HeroCTAs
              customTheme={customTheme}
              features={features}
              sections={sections}
              whatsappUrl={whatsappUrl}
              callUrl={callUrl}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
