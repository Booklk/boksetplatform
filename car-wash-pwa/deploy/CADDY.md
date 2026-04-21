# Caddy + Custom Domains for Jadawel

This directory contains the deployment wiring that lets any vendor point
their own domain (`crystalwash.sa`, `najahwash.com`, …) at Jadawel and
get a signed HTTPS certificate automatically.

Caddy is the reverse proxy. It:
1. Serves the platform itself (`jadawel.sa`, `app.jadawel.sa`) with a
   regular Let's Encrypt cert.
2. Issues Let's Encrypt certificates **on demand** for any custom host
   pointed at the server — but only after asking the Node app whether
   the domain actually belongs to one of our vendors.

All vendor-facing routes (`/store/:slug`, booking, queue, gallery…) live
on Node. Caddy just terminates TLS and proxies.

---

## 1. Infrastructure checklist

| Item | Required |
|---|---|
| Public IPv4 | ✓ (e.g. `203.0.113.40`) |
| Ports 80 + 443 open | ✓ |
| `jadawel.sa` A record → server IP | ✓ |
| `app.jadawel.sa` A record → server IP | ✓ |
| Caddy installed | ✓ |

Set these env vars on the Node app:

```bash
# Comma-separated list of platform-owned hosts. Caddy refuses to issue
# certs for these through on-demand; they're handled by their own site
# blocks.
PLATFORM_DOMAINS=jadawel.sa,app.jadawel.sa

# IP (or comma-separated IPs) that vendor domains must resolve to for
# /api/domain/check to report "OK" in the Branding UI.
PLATFORM_IPS=203.0.113.40
```

## 2. Deployment (bare metal / VPS)

```bash
# 1. Install Caddy (Debian / Ubuntu example)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# 2. Drop the Caddyfile in place
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile

# 3. Start the Node app on 127.0.0.1:3001 as usual
#    (pm2, systemd, docker — whatever you already use)

# 4. Reload Caddy
sudo systemctl reload caddy

# 5. Watch the logs on first cert request
sudo journalctl -u caddy -f
```

The first time any vendor domain is visited, Caddy will:
1. See the hostname is unknown.
2. Call `GET /api/internal/domain/ask?domain=<host>`.
3. If the Node app responds `200 ok`, Caddy requests an ACME certificate
   from Let's Encrypt using `tls-alpn-01` or `http-01`.
4. Subsequent requests for that host are served with the cached cert
   (renewed automatically ~30 days before expiry).

## 3. Deployment (docker-compose)

A minimal compose overlay is included in `docker-compose.yml`. If you
already use the repo's compose stack, add the `caddy` service below and
switch the `app` service to expose only internally:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"    # HTTP/3
    volumes:
      - ./deploy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
    networks: [default]

  app:
    # drop the `ports: ["3001:3001"]` line — Caddy reaches it over the
    # internal network. Change `reverse_proxy 127.0.0.1:3001` to
    # `reverse_proxy app:3001` inside deploy/Caddyfile when using docker.

volumes:
  caddy_data:
  caddy_config:
```

## 4. Vendor flow

1. Vendor buys `crystalwash.sa` from any registrar.
2. In their registrar's DNS panel, they add:

   ```
   Type   Name    Value
   A      @       203.0.113.40     ← your PLATFORM_IPS
   A      www     203.0.113.40
   ```

   (Or a `CNAME @ app.jadawel.sa` if their registrar supports apex CNAMEs.)
3. In Jadawel → Branding → tab "الدومين الخاص", they paste
   `crystalwash.sa` and save.
4. They click **"اختبر DNS"** — the UI hits `/api/domain/check` which
   performs a live lookup and confirms the records match `PLATFORM_IPS`.
5. On first visit, Caddy issues a cert (takes ~10 seconds) and the
   storefront is live at `https://crystalwash.sa`.

## 5. Security notes

- `/api/internal/domain/ask` is **only** meant to be reached from
  `127.0.0.1` (Caddy on the same box). If you run Caddy on a different
  host, either firewall the endpoint or add a shared-secret header check
  in `server/index.ts`.
- On-demand TLS in Caddy is rate-limited to `100 requests / minute`
  (configurable in the Caddyfile). Above that, attackers can't exhaust
  your Let's Encrypt quota.
- Never point wildcards (`*.example.sa`) at Caddy's on-demand block; use
  dedicated site blocks for those.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Caddy logs `too many certificates already issued` | Hit Let's Encrypt weekly cap for a domain. | Wait 7 days or use `staging` ACME during testing. |
| `ask` returns 404 for a domain you just saved | Vendor record saved with trailing whitespace or uppercase. | The endpoint normalises to lowercase already; re-save and confirm via `/api/domain/check`. |
| Certificate issued but site still shows "Not Secure" | Browser cached the pre-issuance error. | Hard-reload or incognito. |
| `dig crystalwash.sa` doesn't match PLATFORM_IPS | DNS still propagating. | Wait up to 24h; retry `/api/domain/check`. |
