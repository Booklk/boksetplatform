/**
 * Storefront settings live inside vendors.settings.storefront. Centralised
 * here so both the vendor-facing editor and the public /store/:slug read
 * go through one typed accessor (and the same coerce step).
 *
 * Shape (v1):
 *   {
 *     announcement: {
 *       enabled: boolean;
 *       text: string;
 *       href?: string;           // optional CTA URL
 *       tone: 'info' | 'success' | 'warn' | 'danger' | 'brand';
 *       startsAt?: string;       // ISO — display only on/after this
 *       endsAt?: string;         // ISO — hide on/after this
 *     };
 *     hero: {
 *       mediaType: 'none' | 'image' | 'video';
 *       // For mediaType='video' we support YouTube/Vimeo URLs OR an
 *       // /uploads/... path we host ourselves. UI chooses the renderer.
 *       mediaUrl?: string;
 *       posterUrl?: string;      // poster frame for self-hosted video
 *       headlineAr?: string;
 *       subheadlineAr?: string;
 *       ctaLabelAr?: string;
 *       ctaHref?: string;
 *     };
 *   }
 */

import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export type BannerTone = 'info' | 'success' | 'warn' | 'danger' | 'brand';
export type HeroMediaType = 'none' | 'image' | 'video';

// Brand identity (Pro) ────────────────────────────────────────────────────
export type HeroAlignment    = 'center' | 'start' | 'end' | 'full';
export type ServicesLayout   = 'grid' | 'list' | 'cards';
export type TypographyScale  = 'compact' | 'comfortable' | 'spacious';
export type ButtonShape      = 'rounded' | 'pill' | 'square';

/** Curated Arabic fonts the vendor can pick from. Each id maps to a
 *  Google Fonts family loaded at runtime by the storefront. */
export const FONT_CATALOG = [
  { id: 'tajawal',    label: 'Tajawal',      familyCss: '"Tajawal", sans-serif',     weight: '400;500;700;900' },
  { id: 'cairo',      label: 'Cairo',        familyCss: '"Cairo", sans-serif',       weight: '400;600;700;900' },
  { id: 'almarai',    label: 'Almarai',      familyCss: '"Almarai", sans-serif',     weight: '400;700;800' },
  { id: 'readex',     label: 'Readex Pro',   familyCss: '"Readex Pro", sans-serif',  weight: '400;500;700' },
  { id: 'ibm',        label: 'IBM Plex Arabic', familyCss: '"IBM Plex Sans Arabic", sans-serif', weight: '400;500;700' },
  { id: 'rubik',      label: 'Rubik',        familyCss: '"Rubik", sans-serif',       weight: '400;500;700;900' },
  { id: 'noto',       label: 'Noto Kufi Arabic', familyCss: '"Noto Kufi Arabic", sans-serif', weight: '400;600;800' },
  { id: 'baloo',      label: 'Baloo Bhaijaan 2', familyCss: '"Baloo Bhaijaan 2", sans-serif', weight: '500;700;800' },
] as const;
export type FontId = (typeof FONT_CATALOG)[number]['id'];

const FONT_IDS = FONT_CATALOG.map((f) => f.id);

export interface Brand {
  colors: {
    primary:    string;  // main accent
    accent:     string;  // secondary highlight
    background: string;  // page background
    surface:    string;  // cards / chips background
    text:       string;  // main text colour
  };
  fonts: {
    heading: FontId;
    body:    FontId;
  };
  typographyScale: TypographyScale;
  buttonShape: ButtonShape;
  layout: {
    heroAlignment:  HeroAlignment;
    servicesLayout: ServicesLayout;
    /** Ordered section keys. Unknown keys are ignored by the renderer;
     *  missing keys fall back to their canonical position. */
    sectionsOrder: string[];
  };
  identity: {
    logoUrl:    string;
    faviconUrl: string;
    ogImageUrl: string;
  };
}

export interface Announcement {
  enabled: boolean;
  text: string;
  href: string;
  tone: BannerTone;
  startsAt: string | null;
  endsAt: string | null;
}

export interface Hero {
  mediaType: HeroMediaType;
  mediaUrl: string;
  posterUrl: string;
  headlineAr: string;
  subheadlineAr: string;
  ctaLabelAr: string;
  ctaHref: string;
}

export interface StorefrontSettings {
  announcement: Announcement;
  hero: Hero;
  brand: Brand;
}

const TONES: BannerTone[] = ['info', 'success', 'warn', 'danger', 'brand'];
const HERO_TYPES: HeroMediaType[] = ['none', 'image', 'video'];
const HERO_ALIGN: HeroAlignment[] = ['center', 'start', 'end', 'full'];
const SRV_LAYOUT: ServicesLayout[] = ['grid', 'list', 'cards'];
const TYPE_SCALE: TypographyScale[] = ['compact', 'comfortable', 'spacious'];
const BTN_SHAPE:  ButtonShape[] = ['rounded', 'pill', 'square'];
/** Canonical section order — any saved sectionsOrder is reconciled to
 *  this list (unknown sections are dropped, missing sections appended). */
const CANONICAL_SECTIONS = [
  'announcement', 'hero', 'services', 'gallery', 'testimonials',
  'faq', 'location', 'contact',
];

const DEFAULT_BRAND: Brand = {
  colors: {
    primary:    '#4f46e5',
    accent:     '#0ea5e9',
    background: '#0b1220',
    surface:    '#12131e',
    text:       '#ffffff',
  },
  fonts: {
    heading: 'tajawal',
    body:    'tajawal',
  },
  typographyScale: 'comfortable',
  buttonShape: 'rounded',
  layout: {
    heroAlignment:  'center',
    servicesLayout: 'grid',
    sectionsOrder:  [...CANONICAL_SECTIONS],
  },
  identity: {
    logoUrl:    '',
    faviconUrl: '',
    ogImageUrl: '',
  },
};

export const DEFAULT_SETTINGS: StorefrontSettings = {
  announcement: {
    enabled: false,
    text: '',
    href: '',
    tone: 'brand',
    startsAt: null,
    endsAt: null,
  },
  hero: {
    mediaType: 'none',
    mediaUrl: '',
    posterUrl: '',
    headlineAr: '',
    subheadlineAr: '',
    ctaLabelAr: '',
    ctaHref: '',
  },
  brand: DEFAULT_BRAND,
};

function safeColor(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  // Accept #rgb / #rrggbb / rgb()/rgba()/hsl() — reject anything else so
  // we never inject arbitrary CSS.
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)) return s;
  if (/^(rgba?|hsla?)\([^)]{1,60}\)$/.test(s)) return s;
  return fallback;
}

function safeUrl(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const s = v.trim();
  if (!s) return '';
  if (s.startsWith('/')) return s.slice(0, 500);
  if (/^https?:\/\//.test(s)) return s.slice(0, 500);
  return fallback;
}

function clampStr(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, max);
}

function coerceBrand(raw: unknown): Brand {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  const c = r.colors ?? {};
  const f = r.fonts ?? {};
  const l = r.layout ?? {};
  const i = r.identity ?? {};
  // Reconcile the sections order against the canonical list.
  const rawOrder: string[] = Array.isArray(l.sectionsOrder)
    ? l.sectionsOrder.filter((s: unknown) => typeof s === 'string')
    : [];
  const seen = new Set<string>();
  const keptOrder = rawOrder.filter((s) => {
    if (!CANONICAL_SECTIONS.includes(s) || seen.has(s)) return false;
    seen.add(s); return true;
  });
  const finalOrder = [...keptOrder, ...CANONICAL_SECTIONS.filter((s) => !seen.has(s))];
  return {
    colors: {
      primary:    safeColor(c.primary,    DEFAULT_BRAND.colors.primary),
      accent:     safeColor(c.accent,     DEFAULT_BRAND.colors.accent),
      background: safeColor(c.background, DEFAULT_BRAND.colors.background),
      surface:    safeColor(c.surface,    DEFAULT_BRAND.colors.surface),
      text:       safeColor(c.text,       DEFAULT_BRAND.colors.text),
    },
    fonts: {
      heading: FONT_IDS.includes(f.heading) ? f.heading : DEFAULT_BRAND.fonts.heading,
      body:    FONT_IDS.includes(f.body)    ? f.body    : DEFAULT_BRAND.fonts.body,
    },
    typographyScale: TYPE_SCALE.includes(r.typographyScale) ? r.typographyScale : DEFAULT_BRAND.typographyScale,
    buttonShape:     BTN_SHAPE.includes(r.buttonShape)      ? r.buttonShape      : DEFAULT_BRAND.buttonShape,
    layout: {
      heroAlignment:  HERO_ALIGN.includes(l.heroAlignment)  ? l.heroAlignment  : DEFAULT_BRAND.layout.heroAlignment,
      servicesLayout: SRV_LAYOUT.includes(l.servicesLayout) ? l.servicesLayout : DEFAULT_BRAND.layout.servicesLayout,
      sectionsOrder:  finalOrder,
    },
    identity: {
      logoUrl:    safeUrl(i.logoUrl,    ''),
      faviconUrl: safeUrl(i.faviconUrl, ''),
      ogImageUrl: safeUrl(i.ogImageUrl, ''),
    },
  };
}

/** Strict coercion — anything invalid falls back to its default. The
 *  storefront renders whatever comes out of here without further checks. */
export function coerce(raw: unknown): StorefrontSettings {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  const a = r.announcement ?? {};
  const h = r.hero ?? {};
  return {
    announcement: {
      enabled: Boolean(a.enabled),
      text:    clampStr(a.text, 200),
      href:    clampStr(a.href, 500),
      tone:    TONES.includes(a.tone) ? a.tone : 'brand',
      startsAt: typeof a.startsAt === 'string' ? a.startsAt : null,
      endsAt:   typeof a.endsAt   === 'string' ? a.endsAt   : null,
    },
    hero: {
      mediaType:     HERO_TYPES.includes(h.mediaType) ? h.mediaType : 'none',
      mediaUrl:      clampStr(h.mediaUrl, 500),
      posterUrl:     clampStr(h.posterUrl, 500),
      headlineAr:    clampStr(h.headlineAr, 120),
      subheadlineAr: clampStr(h.subheadlineAr, 200),
      ctaLabelAr:    clampStr(h.ctaLabelAr, 60),
      ctaHref:       clampStr(h.ctaHref, 500),
    },
    brand: coerceBrand(r.brand),
  };
}

/** Is the announcement currently live? Used by the public endpoint so
 *  the UI never ships a pre-scheduled or expired banner to customers. */
export function isAnnouncementLive(a: Announcement, now: Date = new Date()): boolean {
  if (!a.enabled || !a.text.trim()) return false;
  if (a.startsAt && new Date(a.startsAt) > now) return false;
  if (a.endsAt   && new Date(a.endsAt)   < now) return false;
  return true;
}

export async function readStorefrontSettings(vendorId: number): Promise<StorefrontSettings> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const raw = ((row?.settings ?? {}) as any)?.storefront;
  return coerce(raw);
}

export async function writeStorefrontSettings(vendorId: number, patch: Partial<StorefrontSettings>): Promise<StorefrontSettings> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const current  = coerce(settings.storefront);
  // Deep-ish merge for nested sub-objects so a partial brand.colors
  // patch doesn't wipe the rest of brand.
  const brandPatch = (patch.brand ?? {}) as Partial<Brand>;
  const nextBrand = {
    ...current.brand,
    ...brandPatch,
    colors:   { ...current.brand.colors,   ...(brandPatch.colors   ?? {}) },
    fonts:    { ...current.brand.fonts,    ...(brandPatch.fonts    ?? {}) },
    layout:   { ...current.brand.layout,   ...(brandPatch.layout   ?? {}) },
    identity: { ...current.brand.identity, ...(brandPatch.identity ?? {}) },
  };
  const next = coerce({
    announcement: { ...current.announcement, ...(patch.announcement ?? {}) },
    hero:         { ...current.hero,         ...(patch.hero         ?? {}) },
    brand:        nextBrand,
  });
  await db.update(vendors)
    .set({ settings: { ...settings, storefront: next }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
  return next;
}

/** Public merchant code — a short, printable ID the vendor can put on
 *  receipts, QR codes, business cards. Base36 keeps it compact
 *  (vendor.id → ~4-5 chars past 10k tenants). */
export function publicMerchantNumber(vendorId: number): string {
  const n = Math.max(0, Math.floor(vendorId)).toString(36).toUpperCase().padStart(4, '0');
  return `JW-${n}`;
}
