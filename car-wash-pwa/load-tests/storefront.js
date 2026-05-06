// Storefront browse test — simulates customers landing on a vendor page,
// reading reviews, browsing packages and the gallery. This is the path
// the 300K marketing campaign will hammer hardest.
//
// Ramp: 0 → 500 VUs (3min) → 1000 VUs (5min) → 2000 VUs (3min) → 0 (1min)
// Total run: ~12 minutes
//
// Pass criteria:
//   - p(95) < 800ms
//   - error rate < 1%
//   - cache hit ratio > 80% on /vendors/public/:slug

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const VENDOR_SLUG = __ENV.VENDOR_SLUG || 'test-vendor';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '3m',  target: 500 },
    { duration: '5m',  target: 1000 },
    { duration: '3m',  target: 2000 },
    { duration: '1m',  target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed:   ['rate<0.01'],
    errors:            ['rate<0.01'],
  },
};

export default function () {
  // 1. Land on storefront (the big one — every visitor hits this)
  const vendorRes = http.get(`${BASE_URL}/api/vendors/public/${VENDOR_SLUG}`, {
    tags: { name: 'GET /vendors/public/:slug' },
  });
  const vendorOk = check(vendorRes, {
    'vendor 200':         (r) => r.status === 200,
    'vendor has nameAr':  (r) => !!(r.json('nameAr')),
  });
  errorRate.add(!vendorOk);

  // 2. Reviews block (loaded as soon as the page renders)
  const reviewsRes = http.get(`${BASE_URL}/api/vendors/public/${VENDOR_SLUG}/reviews`, {
    tags: { name: 'GET /vendors/public/:slug/reviews' },
  });
  check(reviewsRes, { 'reviews 200': (r) => r.status === 200 });

  // 3. Service catalogue (packages)
  const pkgRes = http.get(`${BASE_URL}/api/services/public/${VENDOR_SLUG}`, {
    tags: { name: 'GET /services/public/:slug' },
  });
  check(pkgRes, { 'packages 200/404': (r) => r.status === 200 || r.status === 404 });

  // 4. Gallery (lazy-loaded, ~50% of users)
  if (Math.random() < 0.5) {
    const galRes = http.get(`${BASE_URL}/api/photos/gallery/${VENDOR_SLUG}`, {
      tags: { name: 'GET /photos/gallery/:slug' },
    });
    check(galRes, { 'gallery 200': (r) => r.status === 200 });
  }

  // Real users spend ~5-15s on the page before bouncing or booking.
  sleep(Math.random() * 10 + 5);
}
