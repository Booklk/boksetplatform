/**
 * Custom Theme Tokens — vendor-level theming for storefront (/store/:slug).
 *
 * Every vendor can override any token. Tokens are stored in
 * vendors.settings.customTheme (JSONB). VendorLanding.tsx reads them and
 * exposes them as CSS custom properties, so the store renders with the
 * vendor's chosen colours / shape without code changes.
 */

export interface CustomThemePalette {
  bg: string;            // page background
  surface: string;       // card background
  button: string;        // primary button / CTA
  accent: string;        // links, highlights, selected state
  text: string;          // body text
  calendar: string;      // calendar / slot highlight
}

export type CustomThemeRadius = 'square' | 'rounded' | 'pill';
export type CustomThemeMode = 'dark' | 'light';

export interface CustomTheme extends CustomThemePalette {
  radius: CustomThemeRadius;
  mode: CustomThemeMode;
}

/** 8 curated palette presets — used by StoreBuilder's preset row. */
export interface PalettePreset {
  id: string;
  name: string;
  palette: CustomThemePalette;
  mode: CustomThemeMode;
}

export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: 'navy-classic',
    name: 'نيفي كلاسيكي',
    mode: 'dark',
    palette: { bg: '#0b1220', surface: '#131b2e', button: '#1e3a8a', accent: '#c9a96e', text: '#e8ecf1', calendar: '#1e3a8a' },
  },
  {
    id: 'gold-luxury',
    name: 'ذهبي فاخر',
    mode: 'dark',
    palette: { bg: '#0a0a0a', surface: '#171717', button: '#d4a574', accent: '#f59e0b', text: '#f1f5f9', calendar: '#d4a574' },
  },
  {
    id: 'rose-feminine',
    name: 'وردي أنثوي',
    mode: 'dark',
    palette: { bg: '#1a0b14', surface: '#2a1520', button: '#be185d', accent: '#f472b6', text: '#fdf2f8', calendar: '#be185d' },
  },
  {
    id: 'saudi-green',
    name: 'أخضر سعودي',
    mode: 'dark',
    palette: { bg: '#0a1512', surface: '#0f2a22', button: '#065f46', accent: '#d4a574', text: '#ecfdf5', calendar: '#065f46' },
  },
  {
    id: 'copper-warm',
    name: 'نحاسي دافئ',
    mode: 'dark',
    palette: { bg: '#1a0f08', surface: '#2a1810', button: '#7c2d12', accent: '#f59e0b', text: '#fef3c7', calendar: '#7c2d12' },
  },
  {
    id: 'water-blue',
    name: 'أزرق مياه',
    mode: 'dark',
    palette: { bg: '#071523', surface: '#0c2a3f', button: '#0c4a6e', accent: '#38bdf8', text: '#e0f2fe', calendar: '#0c4a6e' },
  },
  {
    id: 'purple-premium',
    name: 'بنفسجي راقي',
    mode: 'dark',
    palette: { bg: '#130821', surface: '#22103a', button: '#581c87', accent: '#c084fc', text: '#faf5ff', calendar: '#581c87' },
  },
  {
    id: 'grey-pro',
    name: 'رمادي مهني',
    mode: 'dark',
    palette: { bg: '#0f1419', surface: '#1a1f26', button: '#334155', accent: '#94a3b8', text: '#f1f5f9', calendar: '#334155' },
  },
];

/** Look up a preset by id. */
export function getPreset(id: string): PalettePreset | undefined {
  return PALETTE_PRESETS.find((p) => p.id === id);
}

/** Merge a palette preset into a full CustomTheme (defaults radius='rounded'). */
export function paletteToTheme(preset: PalettePreset, radius: CustomThemeRadius = 'rounded'): CustomTheme {
  return { ...preset.palette, mode: preset.mode, radius };
}

/** Default theme when a vendor has not customised anything. */
export const DEFAULT_CUSTOM_THEME: CustomTheme = {
  ...PALETTE_PRESETS[0].palette,
  mode: PALETTE_PRESETS[0].mode,
  radius: 'rounded',
};

/**
 * Suggested default palette per industry template. StoreBuilder seeds the
 * customizer with this when a vendor first picks a template, so they see a
 * polished result from second zero.
 */
export const TEMPLATE_DEFAULT_PALETTE: Record<string, string> = {
  // Tier 1
  'universal-clean': 'grey-pro',
  'barber-queue': 'copper-warm',
  'salon-queue': 'rose-feminine',
  'beauty-at-home': 'purple-premium',
  'cleaning-pro-b2b': 'navy-classic',
  'home-services': 'copper-warm',
  'spa-sanctuary': 'saudi-green',
  'mobile-wash-gps': 'water-blue',
  'fixed-wash-queue': 'navy-classic',
  'clinic-pro': 'water-blue',
  'studio-portfolio': 'grey-pro',
  'movers-quote': 'copper-warm',
  'cleaning-general': 'water-blue',
  // Tier 2
  'cleaning-carpet': 'water-blue',
  'cleaning-tanks': 'water-blue',
  'cleaning-facade': 'navy-classic',
  'cleaning-postevent': 'purple-premium',
  'salon-luxury': 'gold-luxury',
  'nails-studio': 'rose-feminine',
  'brow-lash': 'rose-feminine',
  'kids-salon': 'copper-warm',
  'henna-studio': 'copper-warm',
  'mobile-wash-fleet': 'water-blue',
  'premium-wash-detail': 'gold-luxury',
  'movers-intercity': 'copper-warm',
  'integrated-pro': 'navy-classic',
};

/** Border radius per 'radius' token — used in CSS variables. */
export const RADIUS_VALUES: Record<CustomThemeRadius, string> = {
  square: '4px',
  rounded: '12px',
  pill: '9999px',
};

/**
 * Convert a CustomTheme to CSS custom properties for the storefront root.
 * Keys are --jadawel-* so they don't collide with anything.
 */
export function themeToCssVars(theme: CustomTheme): Record<string, string> {
  return {
    '--jadawel-bg': theme.bg,
    '--jadawel-surface': theme.surface,
    '--jadawel-button': theme.button,
    '--jadawel-accent': theme.accent,
    '--jadawel-text': theme.text,
    '--jadawel-calendar': theme.calendar,
    '--jadawel-radius': RADIUS_VALUES[theme.radius],
    'colorScheme': theme.mode,
  };
}
