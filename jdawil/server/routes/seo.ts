/**
 * Public SEO endpoints: sitemap.xml + robots.txt.
 *
 * Sitemap is generated dynamically from the static marketing routes
 * + every published industry slug + (later) every active vendor's
 * public storefront. Cached in-memory for 1 hour to keep crawlers
 * cheap.
 */
import { Router } from 'express';

const router = Router();

// Hard-coded mirror of client/src/data/industries.ts INDUSTRY_SLUGS.
// Server can't import client modules; sitemap doesn't need runtime
// updates so this stays in sync via the parity test.
const INDUSTRY_SLUGS = [
  'car-wash', 'salon', 'home-cleaning', 'movers',
  'ac-maintenance', 'plumbing', 'electrical',
  'beauty-home', 'freelancer', 'appliance-repair',
  'clinic', 'professional-services', 'spa',
];

const SITE = process.env.PUBLIC_DOMAIN ?? 'https://jdawil.sa';

const STATIC_PATHS: Array<{ path: string; priority: number; changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly' }> = [
  { path: '/',         priority: 1.0, changefreq: 'weekly' },
  { path: '/pricing',  priority: 0.9, changefreq: 'monthly' },
  { path: '/demo',     priority: 0.9, changefreq: 'monthly' },
  { path: '/onboard',  priority: 0.95, changefreq: 'weekly' },
  { path: '/blog',     priority: 0.7, changefreq: 'weekly' },
  { path: '/status',   priority: 0.4, changefreq: 'weekly' },
  { path: '/privacy',  priority: 0.3, changefreq: 'yearly' },
  { path: '/terms',    priority: 0.3, changefreq: 'yearly' },
  { path: '/help',     priority: 0.6, changefreq: 'monthly' },
];

let cache: { at: number; xml: string } | null = null;
const CACHE_MS = 60 * 60 * 1000;

router.get('/sitemap.xml', async (_req, res) => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(cache.xml);
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [];

  for (const r of STATIC_PATHS) {
    urls.push(`<url><loc>${SITE}${r.path}</loc><lastmod>${today}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`);
  }

  // Industry-specific landing pages
  for (const slug of INDUSTRY_SLUGS) {
    urls.push(`<url><loc>${SITE}/for/${slug}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  cache = { at: Date.now(), xml };
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.send(xml);
});

router.get('/robots.txt', (_req, res) => {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /vendor/',
    'Disallow: /admin/',
    'Disallow: /super-admin/',
    'Disallow: /app/',
    'Disallow: /employee/',
    'Disallow: /quote/',
    '',
    `Sitemap: ${SITE}/sitemap.xml`,
  ].join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.send(body);
});

export default router;
