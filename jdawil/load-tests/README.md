# Jdawil Load Tests (k6)

Pre-launch load tests covering the three traffic patterns the 300K marketing
campaign will create:

1. **Storefront browse** — public visitors hitting `/api/vendors/public/:slug`,
   reviews, gallery, packages. The hottest path.
2. **Signup funnel** — `/api/vendors/onboard` + OTP send/verify under burst.
   Tests the cache layer, OTP rate-limit, and DB write throughput.
3. **Booking flow** — authenticated customer creating bookings, confirming
   payment, listing their bookings. Tests the WhatsApp queue, payment
   redirect, and per-vendor concurrency.

## Setup

Install k6 (one-time):
```sh
brew install k6                 # macOS
sudo apt install k6             # Debian/Ubuntu
choco install k6                # Windows
```

## Running against staging

Set the target URL and run a script:

```sh
export BASE_URL=https://staging.jdawil.sa
export VENDOR_SLUG=test-vendor

k6 run storefront.js
k6 run signup.js
k6 run booking.js
```

Each script ramps to its target VU count (virtual users), holds, then ramps
down. Pass-fail thresholds are baked in (P95 < 1s, error rate < 1%) so CI
can green/red on the run.

## Reading the output

k6 prints a summary table at the end. Watch:

- `http_req_duration` — overall latency. P95 should stay under 1s.
- `http_req_failed` — error rate. Should be < 1%.
- `iteration_duration` — how long one full simulated user trip takes.
- `checks` — assertion pass rate (e.g. did we get back 200 + the expected JSON shape).

If a threshold breaches, k6 exits non-zero so it can gate deploys.

## Expected capacity (target)

| Scenario | Sustained VUs | Peak VUs | Acceptable P95 |
|----------|---------------|----------|----------------|
| Storefront browse | 500 | 2,000 | 800ms |
| Signup funnel    | 50  | 200   | 1.5s  |
| Booking flow     | 100 | 500   | 1.5s  |

If the storefront test struggles past 500 VUs, the cache layer (Redis or
in-memory) is doing its job — the bottleneck is likely DB or the upstream
proxy. Add an HTTP cache (Cloudflare) before scaling DB.

## Don't run against production

These tests will absolutely melt prod. Always point `BASE_URL` at staging.
A separate seed script populates staging with synthetic vendors, customers,
and packages — see `seed-staging.sh`.
