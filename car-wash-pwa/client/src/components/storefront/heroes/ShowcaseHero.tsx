/**
 * ShowcaseHero — big cover image, content overlaid at the bottom.
 * Used by: spa-sanctuary, nails-studio, brow-lash, henna-studio,
 *          premium-wash-detail, salon-luxury, kids-salon.
 *
 * Goal: let the work speak — giant visual, then a clean overlay card.
 */

import { motion } from 'framer-motion';
import { StorefrontHeroProps } from './StorefrontHero';
import { FeatureBadges, HeroCTAs, HeroLogo, MetaRow } from './HeroShared';

export default function ShowcaseHero({
  vendor, customTheme, features, sections, heroSubtitle,
  whatsappUrl, callUrl, ratingNode,
}: StorefrontHeroProps) {
  return (
    <section className="relative" style={{ background: customTheme.bg }}>
      {/* Cover */}
      <div className="h-56 sm:h-72 md:h-96 relative overflow-hidden">
        {vendor.coverImageUrl ? (
          <img
            src={vendor.coverImageUrl}
            alt={vendor.nameAr}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${customTheme.accent}55 0%, ${customTheme.button}66 50%, ${customTheme.bg} 100%)`,
            }}
          />
        )}
        {/* Gradient fade into page background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 20%, ${customTheme.bg}cc 75%, ${customTheme.bg} 100%)`,
          }}
        />
      </div>

      {/* Content — overlapping the cover */}
      <div className="max-w-4xl mx-auto px-5 -mt-24 sm:-mt-28 relative z-10 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-6 sm:p-8 border shadow-2xl"
          style={{
            background: customTheme.surface,
            borderColor: `${customTheme.accent}22`,
            borderRadius: customTheme.radius === 'pill' ? '28px' : customTheme.radius === 'square' ? '10px' : '20px',
          }}
        >
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <HeroLogo vendor={vendor} customTheme={customTheme} size="lg" />

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-2" style={{ color: customTheme.text }}>
                  {vendor.nameAr}
                </h1>
                <p className="text-sm sm:text-base leading-relaxed opacity-75 max-w-xl" style={{ color: customTheme.text }}>
                  {heroSubtitle}
                </p>
              </div>

              <MetaRow vendor={vendor} customTheme={customTheme} sections={sections} ratingNode={ratingNode} />

              {vendor.descriptionAr && (
                <p className="text-sm leading-relaxed opacity-60 max-w-xl" style={{ color: customTheme.text }}>
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
                layout="stacked"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
