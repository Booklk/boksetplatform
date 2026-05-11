/**
 * BrandStyleProvider — injects vendor brand (Pro) into the storefront:
 *   1. CSS variables on document.documentElement:
 *      --vendor-primary, --vendor-accent, --vendor-background,
 *      --vendor-surface, --vendor-text
 *   2. Google Fonts <link> for the chosen heading + body families
 *   3. Favicon / OG image <meta> tags via useEffect
 *
 * Pure side-effects — it never renders markup. Safe to mount early in
 * the storefront tree. Clean up on unmount.
 */

import { useEffect } from 'react';

interface Brand {
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
  };
  fonts: { heading: string; body: string };
  typographyScale: 'compact' | 'comfortable' | 'spacious';
  buttonShape: 'rounded' | 'pill' | 'square';
  identity: { logoUrl: string; faviconUrl: string; ogImageUrl: string };
}

// Canonical font metadata in sync with the server's FONT_CATALOG.
const FONT_LOOKUP: Record<string, { label: string; family: string; weight: string }> = {
  tajawal: { label: 'Tajawal',              family: '"Tajawal", sans-serif',              weight: '400;500;700;900' },
  cairo:   { label: 'Cairo',                family: '"Cairo", sans-serif',                weight: '400;600;700;900' },
  almarai: { label: 'Almarai',              family: '"Almarai", sans-serif',              weight: '400;700;800' },
  readex:  { label: 'Readex Pro',           family: '"Readex Pro", sans-serif',           weight: '400;500;700' },
  ibm:     { label: 'IBM Plex Sans Arabic', family: '"IBM Plex Sans Arabic", sans-serif', weight: '400;500;700' },
  rubik:   { label: 'Rubik',                family: '"Rubik", sans-serif',                weight: '400;500;700;900' },
  noto:    { label: 'Noto Kufi Arabic',     family: '"Noto Kufi Arabic", sans-serif',     weight: '400;600;800' },
  baloo:   { label: 'Baloo Bhaijaan 2',     family: '"Baloo Bhaijaan 2", sans-serif',     weight: '500;700;800' },
};

function safeColor(v: string | undefined, fallback: string) {
  if (!v) return fallback;
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? v : fallback;
}

const SCALE_SIZE: Record<Brand['typographyScale'], string> = {
  compact:     '15px',
  comfortable: '16px',
  spacious:    '18px',
};

export default function BrandStyleProvider({ brand }: { brand?: Brand | null }) {
  useEffect(() => {
    if (!brand) return;
    const root = document.documentElement;

    const primary    = safeColor(brand.colors.primary,    '#4f46e5');
    const accent     = safeColor(brand.colors.accent,     '#0ea5e9');
    const background = safeColor(brand.colors.background, '#0b1220');
    const surface    = safeColor(brand.colors.surface,    '#12131e');
    const text       = safeColor(brand.colors.text,       '#ffffff');

    root.style.setProperty('--vendor-primary',    primary);
    root.style.setProperty('--vendor-accent',     accent);
    root.style.setProperty('--vendor-background', background);
    root.style.setProperty('--vendor-surface',    surface);
    root.style.setProperty('--vendor-text',       text);
    root.style.setProperty('--vendor-text-size',  SCALE_SIZE[brand.typographyScale] ?? '16px');
    root.style.setProperty('--vendor-btn-radius',
      brand.buttonShape === 'pill'   ? '9999px'
      : brand.buttonShape === 'square' ? '0.25rem'
      :                                   '0.75rem');

    const heading = FONT_LOOKUP[brand.fonts.heading] ?? FONT_LOOKUP.tajawal;
    const body    = FONT_LOOKUP[brand.fonts.body]    ?? FONT_LOOKUP.tajawal;
    root.style.setProperty('--vendor-font-heading', heading.family);
    root.style.setProperty('--vendor-font-body',    body.family);

    // Load the Google Fonts stylesheet for both families (dedupe if
    // identical). Insert once per page — subsequent renders find and reuse.
    const fontKey = `${heading.label}:${heading.weight}|${body.label}:${body.weight}`;
    const existing = document.getElementById('vendor-brand-fonts');
    if (!existing || existing.getAttribute('data-key') !== fontKey) {
      existing?.remove();
      const params = [
        `family=${heading.label.replace(/ /g, '+')}:wght@${heading.weight}`,
        heading.label !== body.label
          ? `family=${body.label.replace(/ /g, '+')}:wght@${body.weight}`
          : null,
      ].filter(Boolean).join('&');
      const link = document.createElement('link');
      link.id = 'vendor-brand-fonts';
      link.rel = 'stylesheet';
      link.setAttribute('data-key', fontKey);
      link.href = `https://fonts.googleapis.com/css2?${params}&display=swap`;
      document.head.appendChild(link);
    }

    // Favicon — replace the default if the vendor set one.
    if (brand.identity.faviconUrl) {
      const existingFav = document.querySelector('link[rel="icon"]');
      if (existingFav) existingFav.setAttribute('href', brand.identity.faviconUrl);
    }
    // OG image — meta tag swap for crawlers / share previews.
    if (brand.identity.ogImageUrl) {
      let ogTag = document.querySelector('meta[property="og:image"]');
      if (!ogTag) {
        ogTag = document.createElement('meta');
        ogTag.setAttribute('property', 'og:image');
        document.head.appendChild(ogTag);
      }
      ogTag.setAttribute('content', brand.identity.ogImageUrl);
    }

    return () => {
      // Don't nuke globals on unmount — other parts of the storefront
      // might still rely on the CSS vars. A subsequent page load
      // overwrites them anyway.
    };
  }, [brand]);

  return null;
}
