/**
 * PackageCard — renders a service package with a style variant driven by
 * theme.preview.cardStyle, so every template gets a distinct look without
 * the storefront having to branch on theme ids.
 *
 * Variants:
 *   bordered        quiet, 1px border, flat surface
 *   glass           glassmorphism (translucent + blur)
 *   elevated        strong shadow, lifted card
 *   solid           chunky block, no border
 *   gradient-border accent-coloured gradient ring
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Clock } from 'lucide-react';
import { CustomTheme, RADIUS_VALUES } from '../../lib/customTheme';

export type PackageCardStyle = 'bordered' | 'glass' | 'elevated' | 'solid' | 'gradient-border';

interface PackageData {
  id: number;
  name: string;
  price: string | number;
  duration: number;
  features?: string[] | null;
}

interface PackageCardProps {
  pkg: PackageData;
  vendorId: number;
  customTheme: CustomTheme;
  cardStyle: PackageCardStyle;
  index?: number;
  formatCurrency: (p: string | number) => string;
}

export default function PackageCard({
  pkg,
  vendorId,
  customTheme,
  cardStyle,
  index = 0,
  formatCurrency,
}: PackageCardProps) {
  const radius = RADIUS_VALUES[customTheme.radius];
  const textColor = customTheme.text;
  const accent = customTheme.accent;
  const button = customTheme.button;

  // Resolve the outer card shell styling per variant
  const shell = (() => {
    switch (cardStyle) {
      case 'glass':
        return {
          style: {
            background: `${customTheme.surface}cc`,
            borderRadius: radius,
            border: `1px solid ${textColor}15`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          },
          className: 'shadow-lg',
        };
      case 'elevated':
        return {
          style: {
            background: customTheme.surface,
            borderRadius: radius,
            border: `1px solid ${textColor}08`,
            boxShadow: `0 10px 30px -12px ${accent}22, 0 4px 12px -6px rgba(0,0,0,0.35)`,
          },
          className: 'hover:-translate-y-0.5 transition-transform',
        };
      case 'solid':
        return {
          style: {
            background: customTheme.surface,
            borderRadius: customTheme.radius === 'pill' ? '24px' : customTheme.radius === 'square' ? '4px' : '10px',
            border: 'none',
          },
          className: '',
        };
      case 'gradient-border':
        return {
          style: {
            background: `linear-gradient(135deg, ${accent}33, ${button}22) padding-box, linear-gradient(135deg, ${accent}, ${button}) border-box`,
            borderRadius: radius,
            border: '1.5px solid transparent',
          },
          className: '',
        };
      case 'bordered':
      default:
        return {
          style: {
            background: customTheme.surface,
            borderRadius: radius,
            border: `1px solid ${textColor}12`,
          },
          className: 'hover:border-opacity-50 transition-colors',
        };
    }
  })();

  // Price pill style — rounded on pill radius, a bit squarer elsewhere
  const priceRadius = customTheme.radius === 'pill' ? '9999px' : customTheme.radius === 'square' ? '4px' : '9999px';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-5 flex flex-col ${shell.className}`}
      style={shell.style}
    >
      <div className="flex items-start justify-between mb-3 gap-3">
        <h3 className="font-black text-base leading-tight" style={{ color: textColor }}>
          {pkg.name}
        </h3>
        <div className="text-right shrink-0">
          <div
            className="inline-block px-3 py-1 text-sm font-black text-white"
            style={{ background: button, borderRadius: priceRadius }}
          >
            {formatCurrency(pkg.price)}
          </div>
          <div className="flex items-center gap-1 text-xs mt-1 justify-end opacity-60" style={{ color: textColor }}>
            <Clock size={11} />
            {pkg.duration} دقيقة
          </div>
        </div>
      </div>

      {pkg.features && pkg.features.length > 0 && (
        <ul className="space-y-1.5 mb-4 flex-1">
          {pkg.features.map((feature, fi) => (
            <li
              key={fi}
              className="flex items-center gap-2 text-sm opacity-80"
              style={{ color: textColor }}
            >
              <CheckCircle size={13} style={{ color: accent }} className="shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/app/book/${pkg.id}?vendorId=${vendorId}`}
        className="mt-auto block w-full text-center font-bold text-sm py-2.5 transition-all active:scale-[0.97] text-white hover:opacity-90"
        style={{ background: button, borderRadius: radius }}
      >
        احجز الآن
      </Link>
    </motion.div>
  );
}
