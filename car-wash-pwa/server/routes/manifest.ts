import { Router } from 'express';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// ─── Hex utilities (server-side, no shared dep) ───────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// ─── GET /api/manifest/:slug.json ────────────────────────────────────────────
router.get('/:slug.json', async (req, res) => {
  try {
    const slug = req.params.slug;

    const [vendor] = await db.select({
      id: vendors.id,
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      appIconUrl: vendors.appIconUrl,
      primaryColor: vendors.primaryColor,
      isActive: vendors.isActive,
    }).from(vendors)
      .where(eq(vendors.slug, slug))
      .limit(1);

    if (!vendor) {
      return res.status(404).json({ error: 'المتجر غير موجود' });
    }

    const primaryColor = vendor.primaryColor ?? '#1e3a8a';
    const backgroundColor = shade(primaryColor, 0.3);
    const displayName = vendor.nameAr ?? vendor.nameEn ?? 'Jdawil';
    const shortName = displayName.length > 12 ? displayName.slice(0, 12) : displayName;

    const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ];

    // Use appIconUrl if set, otherwise fall back to logoUrl
    const iconUrl = vendor.appIconUrl || vendor.logoUrl;
    if (iconUrl) {
      icons.unshift({
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      });
    }

    const manifest = {
      name: displayName,
      short_name: shortName,
      description: `احجز خدماتك مع ${displayName}`,
      lang: 'ar',
      dir: 'rtl',
      start_url: `/store/${vendor.slug}`,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: primaryColor,
      background_color: backgroundColor,
      icons,
      categories: ['shopping', 'lifestyle'],
      screenshots: [],
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    // Browser caches 5min; Cloudflare 1h with SWR for slow-deploy windows.
    res.setHeader(
      'Cache-Control',
      'public, max-age=300, s-maxage=3600, stale-while-revalidate=300',
    );
    return res.json(manifest);
  } catch (e) {
    console.error('[manifest]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
