/**
 * Per-vendor PWA manifest.
 *
 * GET /api/store/:slug/manifest.json
 *
 * Each vendor's public store URL gets its own installable PWA. When the
 * customer visits /store/[slug] and chooses "Add to Home Screen", they
 * get an icon + name + theme matching THAT specific vendor — not the
 * platform brand. Two stores on the same device can both be installed
 * with their own identities side by side because each manifest sets a
 * unique `id` and `start_url` scoped to /store/[slug].
 *
 * The icons are generated on the fly via the existing /api/store/:slug/
 * icon route — see services/iconRenderer.ts for the SVG/PNG output.
 */
import { Router } from 'express';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/:slug/manifest.json', async (req, res) => {
  try {
    const slug = req.params.slug;
    const [v] = await db.select({
      nameAr: vendors.nameAr,
      nameEn: vendors.nameEn,
      slug: vendors.slug,
      logoUrl: vendors.logoUrl,
      primaryColor: vendors.primaryColor,
      descriptionAr: vendors.descriptionAr,
    }).from(vendors).where(eq(vendors.slug, slug)).limit(1);

    if (!v) return res.status(404).json({ error: 'not found' });

    const themeColor = v.primaryColor ?? '#FF8C00';
    const startUrl = `/store/${v.slug}?source=pwa`;
    const scope = `/store/${v.slug}/`;

    // Use vendor logo if uploaded, else fallback to a generated SVG initial icon
    const iconBase = v.logoUrl
      ? v.logoUrl
      : `/api/store/${v.slug}/icon`;

    const manifest = {
      id: scope,
      name: v.nameAr,
      short_name: (v.nameAr ?? '').slice(0, 12),
      description: v.descriptionAr ?? `متجر ${v.nameAr} — احجز خدمتك الآن`,
      start_url: startUrl,
      scope,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: themeColor,
      background_color: '#0f172a',
      lang: 'ar',
      dir: 'rtl',
      categories: ['lifestyle', 'business', 'shopping'],
      icons: [
        { src: iconBase, sizes: '192x192', type: v.logoUrl ? 'image/png' : 'image/svg+xml', purpose: 'any maskable' },
        { src: iconBase, sizes: '512x512', type: v.logoUrl ? 'image/png' : 'image/svg+xml', purpose: 'any maskable' },
      ],
      shortcuts: [
        {
          name: 'احجز موعد',
          short_name: 'احجز',
          description: `احجز موعدك في ${v.nameAr}`,
          url: `/store/${v.slug}/book`,
        },
      ],
    };

    res.set('Content-Type', 'application/manifest+json');
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(manifest);
  } catch (e) {
    console.error('[manifest]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// SVG fallback icon — vendor's first letter on their primaryColor background.
// Browsers can render SVG icons directly for installability.
router.get('/:slug/icon', async (req, res) => {
  try {
    const slug = req.params.slug;
    const [v] = await db.select({
      nameAr: vendors.nameAr,
      primaryColor: vendors.primaryColor,
    }).from(vendors).where(eq(vendors.slug, slug)).limit(1);
    if (!v) return res.status(404).send('not found');

    const initial = (v.nameAr ?? '?').trim().charAt(0);
    const color = v.primaryColor ?? '#FF8C00';
    // Lighter shade for the gradient end
    const gradEnd = lighten(color, 25);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${gradEnd}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
    font-family="'Cairo', 'Tahoma', sans-serif" font-size="280" font-weight="900"
    fill="#ffffff">${escapeXml(initial)}</text>
</svg>`;

    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  } catch (e) {
    return res.status(500).send('error');
  }
});

function lighten(hex: string, percent: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * (percent / 100)));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * (percent / 100)));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * (percent / 100)));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export default router;
