/**
 * StorefrontHero — picks the right hero variant for the vendor's chosen
 * template and renders it. The archetype is driven by theme.preview.heroStyle
 * and normalised to one of 5 layouts:
 *
 *   minimal-clean  → MinimalistHero     (barber, universal, small salons)
 *   full-cover     → ShowcaseHero       (spa, studio, nails, henna, VIP wash)
 *   wave-bg        → DynamicHero        (mobile wash, movers, fleet)
 *   bold-centered  → CorporateHero      (B2B cleaning, facade, integrated)
 *   gradient-split → ClassicHero        (women's salon, general cleaning)
 */

import { ReactNode } from 'react';
import { CustomTheme } from '../../../lib/customTheme';
import { ThemeFeatures } from '../../../lib/storeThemes';

export interface VendorHeroData {
  id: number;
  slug: string;
  nameAr: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  descriptionAr?: string | null;
  city?: string | null;
  rating?: number | null;
  reviewsCount?: number;
  serviceAreas?: string[];
}

export interface StorefrontSections {
  showRating?: boolean;
  showAreas?: boolean;
  showSlots?: boolean;
  showReviews?: boolean;
  showWhatsApp?: boolean;
  showCallButton?: boolean;
}

export interface StorefrontHeroProps {
  vendor: VendorHeroData;
  customTheme: CustomTheme;
  features: ThemeFeatures;
  sections: StorefrontSections;
  heroSubtitle: string;
  whatsappUrl: string;
  callUrl: string;
  /** Rendered rating node (keeps StarRating dep out of the variants). */
  ratingNode?: ReactNode;
}

import MinimalistHero from './MinimalistHero';
import ShowcaseHero from './ShowcaseHero';
import DynamicHero from './DynamicHero';
import CorporateHero from './CorporateHero';
import ClassicHero from './ClassicHero';

export default function StorefrontHero({
  heroStyle,
  ...props
}: StorefrontHeroProps & { heroStyle: string }) {
  switch (heroStyle) {
    case 'full-cover':
      return <ShowcaseHero {...props} />;
    case 'wave-bg':
      return <DynamicHero {...props} />;
    case 'bold-centered':
      return <CorporateHero {...props} />;
    case 'gradient-split':
      return <ClassicHero {...props} />;
    case 'minimal-clean':
    default:
      return <MinimalistHero {...props} />;
  }
}
