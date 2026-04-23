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
}

const TONES: BannerTone[] = ['info', 'success', 'warn', 'danger', 'brand'];
const HERO_TYPES: HeroMediaType[] = ['none', 'image', 'video'];

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
};

/** Strict coercion — anything invalid falls back to its default. The
 *  storefront renders whatever comes out of here without further checks. */
export function coerce(raw: unknown): StorefrontSettings {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  const a = r.announcement ?? {};
  const h = r.hero ?? {};
  const clampStr = (v: unknown, max: number): string => {
    if (typeof v !== 'string') return '';
    return v.trim().slice(0, max);
  };
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
  const next     = coerce({
    announcement: { ...current.announcement, ...(patch.announcement ?? {}) },
    hero:         { ...current.hero,         ...(patch.hero         ?? {}) },
  });
  await db.update(vendors)
    .set({ settings: { ...settings, storefront: next }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
  return next;
}
