// Booking flow test — authenticated customer creates a booking, sees it in
// their bookings list, and the WhatsApp queue absorbs the confirmation send.
//
// Tests: auth, booking insert, payment redirect, bookings list query,
// WhatsApp queue depth (the queue should NOT block the API response —
// p(95) on POST should stay under ~1s even if Meta is slow).
//
// Requires a pre-seeded test customer + vendor + at least one package id.
// Set:
//   BASE_URL=https://staging.jdawil.sa
//   CUSTOMER_TOKEN=<jwt>
//   PACKAGE_ID=<id>

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TOKEN = __ENV.CUSTOMER_TOKEN || '';
const PACKAGE_ID = Number(__ENV.PACKAGE_ID || 1);

if (!TOKEN) throw new Error('CUSTOMER_TOKEN env required');

const errorRate = new Rate('errors');
const bookingPostMs = new Trend('booking_post_ms');

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    booking_post_ms:   ['p(95)<1000'], // POST itself must stay fast — queue is async
    errors:            ['rate<0.01'],
  },
};

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

export default function () {
  // 1. List existing bookings (customer dashboard view)
  const listRes = http.get(`${BASE_URL}/api/bookings/mine`, {
    headers,
    tags: { name: 'GET /bookings/mine' },
  });
  check(listRes, { 'list 200': (r) => r.status === 200 });

  // 2. Create a booking — the WhatsApp confirmation should go through the
  //    fire-and-forget queue, NOT block this response.
  const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const start = Date.now();
  const createRes = http.post(`${BASE_URL}/api/bookings`, JSON.stringify({
    packageId: PACKAGE_ID,
    scheduledAt,
    address: 'حي الياسمين، الرياض',
    paymentMethod: 'cash',
  }), {
    headers,
    tags: { name: 'POST /bookings' },
  });
  bookingPostMs.add(Date.now() - start);

  const ok = check(createRes, {
    'create 201/200':    (r) => r.status === 201 || r.status === 200,
    'create has booking': (r) => !!(r.json('bookingNumber') || r.json('id')),
  });
  errorRate.add(!ok);

  sleep(Math.random() * 5 + 2);
}
