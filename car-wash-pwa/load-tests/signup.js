// Signup funnel test — vendor registration via /api/vendors/onboard.
// Stresses: DB write throughput, slug uniqueness check, OTP send rate-limit,
// JWT signing, sentry/audit log writes.
//
// Each iteration creates a fresh "test vendor" with a random slug.
// Run requires staging mode — refuse to hit production.
//
// Ramp: 0 → 50 → 200 → 0
// Pass criteria:
//   - p(95) < 1500ms
//   - error rate < 1% (rate-limit responses don't count as errors)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

if (BASE_URL.includes('jdawil.sa') && !BASE_URL.includes('staging')) {
  throw new Error('refuse: do not run signup load test against production');
}

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    errors:            ['rate<0.01'],
  },
};

function randomSaudiPhone() {
  const head = ['50', '53', '54', '55', '56', '58', '59'];
  const prefix = head[Math.floor(Math.random() * head.length)];
  let n = '';
  for (let i = 0; i < 7; i++) n += Math.floor(Math.random() * 10);
  return `05${prefix.slice(0, 1)}${n}`;
}

function randomSlug() {
  return `loadtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function () {
  const slug = randomSlug();
  const phone = randomSaudiPhone();

  const onboardRes = http.post(`${BASE_URL}/api/vendors/onboard`, JSON.stringify({
    nameAr: `متجر اختبار ${slug.slice(-6)}`,
    slug,
    phone,
    industry: 'car_wash',
    city: 'الرياض',
    ownerName: 'مالك اختبار',
    password: 'StrongPass!2026',
  }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /vendors/onboard' },
  });

  // 201 = created, 409 = slug taken (acceptable race), 429 = rate-limited (acceptable)
  const ok = check(onboardRes, {
    'onboard accepted or rate-limited': (r) =>
      r.status === 201 || r.status === 409 || r.status === 429,
  });
  if (!ok) errorRate.add(1);

  sleep(Math.random() * 3 + 1);
}
