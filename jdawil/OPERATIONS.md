# Jdawil — Operations Runbook

Practical playbook for running the platform in production. Read once
before launch, then keep open during incidents.

---

## 1. Deploy checklist

Run before flipping DNS or pushing the marketing campaign live.

```sh
# from jdawil/server
npm run pre-launch          # validates env, DB, indexes, optional infra
npm test                    # 158+ unit tests
npm run build               # tsc — must produce dist/ with 0 errors
```

If any of those exit non-zero, **don't deploy**. Fix the failure first.

After deploy, verify:

```sh
curl -fsS https://jdawil.sa/api/health/live          # 200 + uptime
curl -fsS https://jdawil.sa/api/system-status/health # 200 + ok:true
curl -fsS https://jdawil.sa/api/metrics              # 401 without token (good)
```

---

## 2. Required environment

These MUST be set in production. Missing any of them fails `pre-launch`.

| Var               | What                                                       |
| ----------------- | ---------------------------------------------------------- |
| `DATABASE_URL`    | Postgres connection (primary)                              |
| `JWT_SECRET`      | 32+ char random — used for auth tokens                     |
| `ENCRYPTION_KEY`  | 32+ char random — AES-256 for vendor BYOC creds            |

Strongly recommended:

| Var                   | Why                                                    |
| --------------------- | ------------------------------------------------------ |
| `BASE_URL`            | Outbound URLs (invoices, deep links) — e.g. `https://jdawil.sa` |
| `DOMAIN`              | Same, without scheme — `jdawil.sa`                     |
| `WHATSAPP_TOKEN`      | Platform Meta Cloud token (OTP + shared sender)        |
| `WHATSAPP_PHONE_ID`   | Platform Meta phone number ID                          |
| `MOYASAR_API_KEY`     | Subscription renewal + customer payments               |
| `SENTRY_DSN`          | Error tracking                                         |
| `SENTRY_RELEASE`      | Defaults to `GIT_COMMIT` — pin errors to deploy        |
| `HEALTH_CHECK_TOKEN`  | Required in prod for `/api/health` and `/api/metrics`  |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Web push                  |

Scale infrastructure (recommended past ~1K vendors):

| Var                       | What                                                  |
| ------------------------- | ----------------------------------------------------- |
| `REDIS_URL`               | Shared cache + rate-limit + queue durability          |
| `WHATSAPP_QUEUE_PERSIST`  | `1` to persist transactional sends across restarts    |
| `STORAGE_PROVIDER`        | `s3` to push uploads off local disk                   |
| `S3_*`                    | Bucket + creds — see services/storage.ts header       |
| `DATABASE_REPLICA_URL`    | Read replica for analytics dashboards                 |
| `DB_POOL_MAX`             | Default 100 — tune to (PG max_connections / instances) × 0.8 |

Tuning knobs (safe defaults, override as needed):

| Var                            | Default | Effect                                   |
| ------------------------------ | ------- | ---------------------------------------- |
| `WHATSAPP_QUEUE_CONCURRENT`    | 8       | Parallel sends — raise if Meta is fast  |
| `SENTRY_TRACES_SAMPLE_RATE`    | 0.05    | 5% in prod                               |
| `SLOW_REQUEST_MS`              | 1000    | Threshold for slow-request log           |
| `BACKUP_RETENTION`             | 14      | Daily backups kept locally               |

---

## 3. Maintenance mode

Set `MAINTENANCE_MODE=1` in the host's env panel and restart the process.
Effect:
- GET requests pass through (storefronts stay up)
- POST/PUT/PATCH/DELETE return 503 with an Arabic explanation
- Webhooks (Moyasar, Meta) and `/api/health*` always pass through

Use during DB migrations or to stop the bleeding mid-incident. Remember
to unset it.

---

## 4. Common incidents

### "Customers say WhatsApp messages aren't arriving"

1. `curl -H "x-health-token: $TOKEN" https://jdawil.sa/api/metrics`
   — look at `whatsappQueue`. If `pending` is climbing and
   `oldestEnqueuedMs > 30000`, Meta or the BSP is throttling us.
2. Check the affected vendor: `GET /api/whatsapp/status` (as that
   vendor) — `lastError` shows the most recent provider error.
3. If a single vendor: their token expired. Tell them to reconnect via
   `/vendor/whatsapp` (Meta tokens lapse every 60 days unless renewed).
4. If platform-wide: check `https://www.metastatus.com/whatsapp-business-platform`.

### "DB latency through the roof"

1. `curl -H "x-health-token: $TOKEN" https://jdawil.sa/api/health` —
   `dbLatencyMs` should be < 50ms. If 500+, DB is overloaded.
2. Check for missing indexes by running `npm run pre-launch` — it
   verifies the 6 hot-path indexes exist.
3. Suspect a slow query? Check `pg_stat_statements`:
   ```sql
   SELECT query, calls, mean_exec_time
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 20;
   ```
4. Quick mitigation: scale up `DB_POOL_MAX` slightly OR enable
   `MAINTENANCE_MODE=1` to stop write spikes while you investigate.

### "Subscription renewals failing en masse"

1. Look at `billing_audit` for the last hour:
   ```sql
   SELECT vendor_id, event, metadata, created_at
   FROM billing_audit
   WHERE created_at > NOW() - INTERVAL '1 hour'
     AND event IN ('renewal_attempt_failed', 'subscription_downgraded_after_dunning')
   ORDER BY created_at DESC;
   ```
2. If `metadata.error` says "no saved card token" for many vendors,
   the initial-checkout flow isn't saving tokens — fix
   `services/payments` to set `save_card=1` on Moyasar checkout.
3. If `metadata.error` says "moyasar 401/403", the platform Moyasar
   key is invalid or revoked. Rotate via super-admin platform settings.

### "All vendor logos broken / 404"

1. If you just switched `STORAGE_PROVIDER` from local to s3, the
   existing logos stayed on the old server. Either:
   - Migrate them: `aws s3 sync ./uploads s3://$S3_BUCKET/`
   - Or roll back `STORAGE_PROVIDER` and migrate later.
2. If S3 returns 403, check the bucket public-read policy and that
   `S3_PUBLIC_URL` matches what the vendor saved logos with.

### "Sentry alerts fire from a forgotten old deploy"

`SENTRY_RELEASE` defaults to `GIT_COMMIT`. Make sure the deploy pipeline
sets `GIT_COMMIT` (most platforms do automatically). Otherwise releases
collapse and bisecting becomes guesswork.

---

## 5. Backups

Daily at 02:00 KSA (set in your scheduler):

```sh
cd /app/server && npm run --silent backup -- --upload
```

Keeps the most recent 14 locally, uploads each to
`s3://$S3_BACKUP_BUCKET/backups/`. Retention in S3 is whatever you set
on the bucket lifecycle (recommend: 30 daily + 12 monthly = 1y of
recoverable points).

Restore (test in staging quarterly):

```sh
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname=$STAGING_DATABASE_URL \
  /tmp/jdawil-2026-05-07-0200.dump
```

---

## 6. Scale dials

You can tune these without redeploying — most hosting platforms
(Railway, DO App, Render, AWS) hot-reload env on save.

| Symptom                              | Dial                          |
| ------------------------------------ | ----------------------------- |
| Slow API responses, normal CPU       | Raise `DB_POOL_MAX` to 150    |
| WhatsApp queue piling up             | Raise `WHATSAPP_QUEUE_CONCURRENT` to 16 |
| Storefront feels slow                | Set `STORAGE_PROVIDER=s3` + Cloudflare in front |
| Many slow-request logs               | Profile, then add an index    |
| OTP storms / abuse                   | Lower OTP-limiter from 3 → 2  |

---

## 7. PDPL incident response

If you suspect a data breach or a customer asks "do you have my data?":

- Customer self-service export: `POST /api/customer-pdpl/export`
  (the customer hits this from their account UI)
- Customer self-service deletion: `POST /api/customer-pdpl/delete`
  (soft-deletes immediately, hard-deletes after 30d)
- Audit trail of every request: `audit_logs` table, action `pdpl.*`

For a confirmed breach, you have **72 hours** to notify SDAIA under
PDPL. Capture: scope (which records / how many subjects), root cause,
remediation, communication plan.

---

## 8. Manual operations cheat-sheet

```sh
# Force a vendor's subscription back to active for 30 days (manual recovery)
psql $DATABASE_URL -c "
  UPDATE vendors
  SET subscription_status='active',
      subscription_end_date = NOW() + INTERVAL '30 days'
  WHERE id = $VENDOR_ID;
"

# Disconnect a vendor's WhatsApp (e.g. during abuse investigation)
psql $DATABASE_URL -c "
  UPDATE vendors
  SET whatsapp_provider='none',
      whatsapp_status='not_connected',
      whatsapp_token=NULL,
      whatsapp_phone_id=NULL
  WHERE id = $VENDOR_ID;
"

# Reset a vendor's monthly WhatsApp quota (after upgrade)
psql $DATABASE_URL -c "
  UPDATE vendors SET whatsapp_messages_used = 0 WHERE id = $VENDOR_ID;
"

# Find vendors close to quota (for proactive upgrade nudge)
psql $DATABASE_URL -c "
  SELECT id, name_ar, whatsapp_messages_used, whatsapp_messages_quota
  FROM vendors
  WHERE whatsapp_messages_quota > 0
    AND whatsapp_messages_used::float / whatsapp_messages_quota > 0.9;
"
```
