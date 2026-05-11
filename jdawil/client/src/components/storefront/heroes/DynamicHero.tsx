/**
 * DynamicHero — motion-led: animated wave + "service on the move" feel.
 * Used by: mobile-wash-gps, mobile-wash-fleet, movers-quote,
 *          movers-intercity.
 *
 * Goal: communicate that the service comes to you — live tracking,
 * motion, and an emphasised track-my-order signal.
 */

import { motion } from 'framer-motion';
import { MapPin, Truck } from 'lucide-react';
import { StorefrontHeroProps } from './StorefrontHero';
import { FeatureBadges, HeroCTAs, HeroLogo, MetaRow } from './HeroShared';

export default function DynamicHero({
  vendor, customTheme, features, sections, heroSubtitle,
  whatsappUrl, callUrl, ratingNode,
}: StorefrontHeroProps) {
  return (
    <section className="relative overflow-hidden pt-14 pb-12" style={{ background: customTheme.bg }}>
      {/* Animated wave backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <svg
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-25"
        >
          <motion.path
            d="M0 200 C 300 100, 600 300, 1200 180 L 1200 400 L 0 400 Z"
            fill={customTheme.accent}
            animate={{
              d: [
                'M0 200 C 300 100, 600 300, 1200 180 L 1200 400 L 0 400 Z',
                'M0 180 C 300 280, 600 120, 1200 220 L 1200 400 L 0 400 Z',
                'M0 200 C 300 100, 600 300, 1200 180 L 1200 400 L 0 400 Z',
              ],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.path
            d="M0 260 C 400 160, 700 340, 1200 240 L 1200 400 L 0 400 Z"
            fill={customTheme.button}
            opacity={0.6}
            animate={{
              d: [
                'M0 260 C 400 160, 700 340, 1200 240 L 1200 400 L 0 400 Z',
                'M0 240 C 400 340, 700 160, 1200 280 L 1200 400 L 0 400 Z',
                'M0 260 C 400 160, 700 340, 1200 240 L 1200 400 L 0 400 Z',
              ],
            }}
            transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid md:grid-cols-[auto_1fr] gap-6 items-start"
        >
          <HeroLogo vendor={vendor} customTheme={customTheme} size="lg" />

          <div className="space-y-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-2" style={{ color: customTheme.text }}>
                {vendor.nameAr}
              </h1>
              <p className="text-base leading-relaxed opacity-75 max-w-xl" style={{ color: customTheme.text }}>
                {heroSubtitle}
              </p>
            </div>

            <MetaRow vendor={vendor} customTheme={customTheme} sections={sections} ratingNode={ratingNode} />

            {/* Live-tracking emphasis strip — only when GPS is on */}
            {features.gps && (
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-3 px-4 py-3 border"
                style={{
                  background: `${customTheme.accent}15`,
                  borderColor: `${customTheme.accent}44`,
                  borderRadius: customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '6px' : '14px',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: customTheme.accent }}
                />
                <div className="flex items-center gap-2" style={{ color: customTheme.text }}>
                  <MapPin size={14} style={{ color: customTheme.accent }} />
                  <span className="text-sm font-bold">تتبّع مباشر عبر GPS</span>
                </div>
                <span className="text-xs opacity-70" style={{ color: customTheme.text }}>
                  اعرف وين موظفك لحظة بلحظة
                </span>
              </motion.div>
            )}

            <FeatureBadges features={features} accent={customTheme.accent} />

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

      {/* Truck icon hint for movers */}
      {vendor.nameAr && features.quote && features.gps && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-4 left-4 pointer-events-none"
        >
          <Truck size={80} style={{ color: customTheme.accent }} />
        </motion.div>
      )}
    </section>
  );
}
