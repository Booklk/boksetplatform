# 🚀 Jdawil — Production Deployment

Complete package for taking the platform from "I just bought a VPS" to
"https://jdawil.sa is live" in under 30 minutes.

---

## What's in this folder

| File | Role |
|------|------|
| `Dockerfile.server`     | Multi-stage build for the Node API + WebSocket server |
| `Dockerfile.client`     | Vite build → static assets served from Nginx |
| `docker-compose.yml`    | Full stack: Postgres, Redis, API, Nginx |
| `nginx/jdawil.conf`     | Nginx vhost — gzip, security headers, /api proxy, WebSocket |
| `.env.example`          | Every env var with comments + generation hints |
| `scripts/install.sh`    | First-run installer for a fresh Ubuntu/Debian VPS |
| `scripts/deploy.sh`     | Pull + rebuild + zero-downtime restart for updates |
| `scripts/smoke-test.sh` | Post-deploy verification (12 health checks) |
| `scripts/backup.sh`     | Daily Postgres backup → local + optional S3 |

---

## 0. Prerequisites — what you need before starting

| Item | Where to get it |
|------|-----------------|
| **VPS** (Ubuntu 22.04+ or Debian 12+, 4 vCPU / 8GB RAM minimum) | Salam Cloud, STC Cloud, Azure Saudi, DigitalOcean, Hetzner |
| **Domain** | nic.sa (jdawil.sa) — ~120 ر.س/year |
| **Cloudflare account** | cloudflare.com — free |
| **Saudi commercial registration (CR)** | منصة أعمال — needed for Moyasar + ZATCA but NOT for first deploy |
| **Root SSH access** to the VPS | The VPS provider gives this on creation |

Optional (can wire in later — the platform runs without them):

- Moyasar account (payments)
- WhatsApp Business account on Meta
- Sentry account (error tracking)
- Firebase project (push notifications, OTP fallback)
- Cloudflare R2 bucket (uploads at scale)

---

## 1. First deploy — fresh VPS to live in 5 commands

SSH into your VPS as root, then:

```bash
# Download just the installer
curl -fsSL https://raw.githubusercontent.com/booklk/boksetplatform/main/car-wash-pwa/deploy/scripts/install.sh -o install.sh

# Run it. The script:
#   - installs Docker, git, cron
#   - clones the repo to /opt/jdawil
#   - generates strong random secrets for JWT_SECRET, ENCRYPTION_KEY, etc
#   - builds the stack and starts it
#   - applies DB migrations
#   - prompts you for a super-admin account
#   - runs the smoke test
#   - installs the daily backup cron
bash install.sh
```

After ~5 minutes you'll see:

```
✅  Jdawil is up.
   Local probe:       curl http://127.0.0.1/api/health/live
   Logs:              cd /opt/jdawil/car-wash-pwa/deploy && docker compose logs -f
```

Test it:

```bash
curl http://127.0.0.1/api/health/live      # → {"status":"ok","uptime":...}
curl http://127.0.0.1/api/system-status/health   # → full status snapshot
```

---

## 2. Point your domain at the server

DNS (Cloudflare):

```
Type   Name                Content              Proxy
A      jdawil.sa           <your VPS IP>        ON (orange cloud)
A      www                 <your VPS IP>        ON
A      api (optional)      <your VPS IP>        ON
```

Cloudflare → **SSL/TLS** → set to **Full (Strict)**.
Cloudflare → **Edge Certificates** → enable **Always Use HTTPS**, **HSTS** (max-age 1y).

Test:
```
https://jdawil.sa            → SPA loads
https://jdawil.sa/api/health/live → JSON 200
```

If TLS errors: in Cloudflare set SSL/TLS to "Flexible" first to verify reachability, then back to "Full (Strict)" once Cloudflare issues the edge cert.

---

## 3. Wire in the optional services (when ready)

Edit `/opt/jdawil/car-wash-pwa/deploy/.env` and fill the optional sections:

### WhatsApp (Meta Cloud)
1. developers.facebook.com → create an app → add WhatsApp
2. Copy `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`
3. Verify your business (7-14 days) for higher rate limits

### Moyasar (payments)
1. moyasar.com → "حساب تاجر" → upload CR + bank info
2. After approval, copy `sk_live_...` into `MOYASAR_API_KEY`
3. Set a webhook secret in the Moyasar dashboard, paste into `MOYASAR_WEBHOOK_SECRET`
4. Webhook URL: `https://jdawil.sa/api/moyasar-webhook`

### Sentry (errors)
1. sentry.io → create project (Node + React → server + client)
2. Copy DSN into both `SENTRY_DSN` and `VITE_SENTRY_DSN`

### VAPID (web push)
```bash
cd /opt/jdawil/car-wash-pwa/server
npx web-push generate-vapid-keys
```
Paste the public key into `VAPID_PUBLIC_KEY` AND `VITE_VAPID_PUBLIC_KEY`,
private into `VAPID_PRIVATE_KEY`.

### Cloudflare R2 (uploads at scale — optional, switch when > 500 vendors)
1. Cloudflare dashboard → R2 → create bucket `jdawil-uploads`
2. Manage R2 API Tokens → create one with Read+Write on this bucket
3. In `.env`:
   ```
   STORAGE_PROVIDER=s3
   S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=jdawil-uploads
   S3_ACCESS_KEY=<from token>
   S3_SECRET_KEY=<from token>
   S3_PUBLIC_URL=https://cdn.jdawil.sa  # set up a CNAME with R2
   ```

After editing `.env`:
```bash
cd /opt/jdawil/car-wash-pwa/deploy
bash scripts/deploy.sh
```

---

## 4. Day-to-day operations

### Update to latest code
```bash
cd /opt/jdawil/car-wash-pwa/deploy
bash scripts/deploy.sh
```
This pulls from git, rebuilds only what changed, runs DB migrations,
restarts with zero downtime, smoke-tests, and auto-rolls-back on failure.

### View logs
```bash
docker compose logs -f api          # just the API
docker compose logs -f api web      # API + Nginx
docker compose logs --tail=100      # last 100 lines, all services
```

### Manual backup (the cron runs daily at 02:00 KSA)
```bash
bash scripts/backup.sh
ls -la data/backups/                # see the dumps
```

### Restore from a backup
```bash
gunzip -c data/backups/jdawil-2026-05-08-0200.dump | \
  docker compose exec -T db pg_restore --clean --if-exists \
    -U jdawil -d jdawil
```

### Put the platform into maintenance mode (writes blocked, reads OK)
```bash
echo "MAINTENANCE_MODE=1" >> .env
docker compose up -d api
# ...do the risky thing...
sed -i '/^MAINTENANCE_MODE=/d' .env
docker compose up -d api
```

### Create another super-admin
```bash
docker compose exec api node scripts/create-super-admin.js
```
(The script refuses if a super-admin already exists. To bootstrap a
second admin, log in as the first and create it from the super-admin UI.)

### Add an extra vendor manually (e.g. concierge onboarding)
Easier from the super-admin UI at `https://jdawil.sa/super-admin/vendors/new`.

---

## 5. Scaling — when to upgrade what

The current stack on a 4 vCPU / 8GB VPS comfortably handles ~2,000-4,000
active vendors. Beyond that, in order:

| Symptom | Action |
|---------|--------|
| `eventLoopLagMs` > 100ms in /api/metrics | Upgrade VPS to 8 vCPU |
| `dbLatencyMs` > 200ms | Move Postgres to a managed service, set `DATABASE_REPLICA_URL` |
| Local `data/uploads` directory > 10GB | Switch `STORAGE_PROVIDER=s3` (R2 recommended) |
| WhatsApp queue > 1000 pending | Raise `WHATSAPP_QUEUE_CONCURRENT` to 16 |
| > 100K storefront views/day | Cloudflare Pro ($25/mo) + tune the CDN cache rules |
| > 10K active vendors | Split: API on Kubernetes, Postgres+Redis as managed |

---

## 6. Troubleshooting

### "Postgres won't start"
```bash
docker compose logs db | tail -50
# Common: data dir owned by wrong uid after host filesystem changes
sudo chown -R 70:70 data/postgres
docker compose up -d db
```

### "API keeps restarting"
```bash
docker compose logs --tail=200 api
# Look for: env validation errors, missing JWT_SECRET, DB connection refused
```

### "Smoke test passes but the UI is blank"
- Hard refresh (Ctrl-Shift-R) — service worker may be serving stale assets
- Check `docker compose logs web` for Nginx errors
- Verify `VITE_API_URL` in `.env` is `/api` (same-origin) — wrong value bundles the wrong URL into the JS

### "Sentry shows errors but I can't reproduce"
- Errors are tagged with `vendor.id` and `user.role` — filter by those in Sentry's UI
- Check the slow-request log: `docker compose logs api | grep '\[slow\]'`

### "Postgres connection limit exceeded"
- Raise `DB_POOL_MAX` in `.env` (default 100)
- Or tune Postgres `max_connections` in `docker-compose.yml` (default 200)
- Or move to a managed Postgres with a real pgbouncer in front

---

## 7. Security checklist before going live

The platform passed Wave-5 security audit (see `SECURITY-AUDIT.md`).
A few host-level reminders:

- [ ] SSH key-only auth, password auth disabled in `/etc/ssh/sshd_config`
- [ ] `ufw allow 22,80,443/tcp && ufw enable` — block everything else
- [ ] Cloudflare proxy ON for all DNS records (hides your origin IP)
- [ ] Cloudflare → Security → "Bot Fight Mode" enabled
- [ ] Cloudflare → WAF → enable OWASP rules
- [ ] Automatic security upgrades: `apt install -y unattended-upgrades`
- [ ] Backup S3 bucket has lifecycle: keep 30 daily + 12 monthly
- [ ] Sentry alert rule on any error tagged `super_admin` (these matter most)

---

## 8. Cost reality (1-vendor → 5,000-vendor)

| Vendors | Hosting | Cloudflare | Sentry | DB managed | Total monthly |
|---------|---------|-----------|--------|------------|----|
| 0-500 | ~200 ر.س (2 vCPU VPS) | Free | Free | (on same VPS) | **~200 ر.س** |
| 500-2K | ~400 ر.س (4 vCPU) | Free | Free | (on same VPS) | **~400 ر.س** |
| 2K-5K | ~700 ر.س (8 vCPU) | $25 ($95 ر.س) | Free | (on same VPS) | **~800 ر.س** |
| 5K-10K | ~1500 ر.س (16 vCPU + replica) | $25 | $26 | ~600 ر.س | **~2,300 ر.س** |

The platform's clever cache + queue architecture lets you postpone
managed-service upgrades much longer than a naive setup would.

---

## Need help?

- Operations runbook: [OPERATIONS.md](../OPERATIONS.md)
- Security audit: [SECURITY-AUDIT.md](../SECURITY-AUDIT.md)
- Validation report: [VALIDATION-REPORT.md](../VALIDATION-REPORT.md)
