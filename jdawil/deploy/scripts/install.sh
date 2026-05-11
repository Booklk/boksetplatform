#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  Jdawil — first-run installer for a fresh Ubuntu/Debian VPS.
#
#  Run as root or with sudo. Idempotent — safe to re-run.
#
#  What it does:
#    1. Installs Docker + Docker Compose plugin + git + curl
#    2. Creates a non-root `jdawil` system user and adds to the docker group
#    3. Clones the repo (or pulls if it already exists)
#    4. Walks you through generating the secrets if .env is missing
#    5. Creates the data directories with the right ownership
#    6. Builds the images and starts the stack
#    7. Runs the DB migration
#    8. Prompts for a super-admin account and creates it
#    9. Prints the URLs + smoke-test result
#
#  Reference architecture:
#    - Single VPS (4 vCPU / 8GB RAM minimum for production)
#    - Cloudflare in front (point A record to this VPS IP, proxy ON, SSL=Full)
#    - Daily backup cron (set up at the end)
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/booklk/boksetplatform.git}"
BRANCH="${BRANCH:-main}"
# Where the git repo lives on the host. The repo contains a `jdawil/`
# subfolder which is the actual project — so deploy paths look like
# $INSTALL_DIR/jdawil/deploy. Override INSTALL_DIR to relocate.
INSTALL_DIR="${INSTALL_DIR:-/opt/jdawil-repo}"

log()  { printf '\033[1;36m[jdawil] %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[jdawil] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[jdawil] %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (or with sudo)."

# ─── 1. Packages ───────────────────────────────────────────────────────────
log "installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates jq tzdata cron > /dev/null

if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "docker compose plugin missing"

# Saudi timezone everywhere.
timedatectl set-timezone Asia/Riyadh || true

# ─── 2. System user ────────────────────────────────────────────────────────
if ! id jdawil >/dev/null 2>&1; then
  log "creating system user 'jdawil'..."
  useradd -r -m -d /home/jdawil -s /bin/bash jdawil
fi
usermod -aG docker jdawil

# ─── 3. Repo ───────────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "repo already in $INSTALL_DIR — pulling latest from $BRANCH..."
  git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
  git -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
  git -C "$INSTALL_DIR" reset --quiet --hard "origin/$BRANCH"
else
  log "cloning repo to $INSTALL_DIR..."
  mkdir -p "$INSTALL_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
chown -R jdawil:jdawil "$INSTALL_DIR"

DEPLOY_DIR="$INSTALL_DIR/jdawil/deploy"
[[ -f "$DEPLOY_DIR/docker-compose.yml" ]] || die "deploy/docker-compose.yml not found in $DEPLOY_DIR"

# ─── 4. .env ───────────────────────────────────────────────────────────────
if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
  log ".env not found — generating one with random secrets..."
  cp "$DEPLOY_DIR/.env.example" "$DEPLOY_DIR/.env"

  GEN_LONG=$(openssl rand -base64 48 | tr -d '=+/' | head -c 48)
  GEN_HEX=$(openssl rand -hex 32)
  GEN_HEALTH=$(openssl rand -base64 32 | tr -d '=+/' | head -c 32)
  GEN_PG=$(openssl rand -base64 36 | tr -d '=+/' | head -c 36)

  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$GEN_PG|"      "$DEPLOY_DIR/.env"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$GEN_LONG|"                  "$DEPLOY_DIR/.env"
  sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$GEN_HEX|"           "$DEPLOY_DIR/.env"
  sed -i "s|^HEALTH_CHECK_TOKEN=.*|HEALTH_CHECK_TOKEN=$GEN_HEALTH|" "$DEPLOY_DIR/.env"

  chmod 600 "$DEPLOY_DIR/.env"
  chown jdawil:jdawil "$DEPLOY_DIR/.env"

  warn "Random secrets generated. You still need to fill the OPTIONAL vars"
  warn "(WhatsApp / Moyasar / Sentry / VAPID / Firebase / S3) before"
  warn "those features will work. Edit:  $DEPLOY_DIR/.env"
else
  log ".env already present — reusing"
fi

# ─── 5. Data dirs ──────────────────────────────────────────────────────────
mkdir -p "$DEPLOY_DIR/data/postgres" "$DEPLOY_DIR/data/redis" \
         "$DEPLOY_DIR/data/uploads"  "$DEPLOY_DIR/data/backups"
# Postgres image runs as uid 70 (alpine) — but our chown to jdawil works
# because docker doesn't actually need host-uid match when the container
# manages its own user. Redis + Nginx similar.
chown -R jdawil:jdawil "$DEPLOY_DIR/data"

# ─── 6. Build + start ──────────────────────────────────────────────────────
log "building images (first time can take 3-5 minutes)..."
( cd "$DEPLOY_DIR" && docker compose build --pull )

log "starting the stack..."
( cd "$DEPLOY_DIR" && docker compose up -d )

# ─── 7. Wait for DB + run migrations ───────────────────────────────────────
log "waiting for Postgres to be ready..."
for i in {1..30}; do
  if ( cd "$DEPLOY_DIR" && docker compose exec -T db pg_isready -U "$(grep -E '^POSTGRES_USER' .env | cut -d= -f2 || echo jdawil)" >/dev/null 2>&1 ); then
    break
  fi
  sleep 2
done

log "applying database migrations..."
( cd "$DEPLOY_DIR" && docker compose exec -T api node --input-type=module -e "
  import { drizzle } from 'drizzle-orm/postgres-js';
  import { migrate } from 'drizzle-orm/postgres-js/migrator';
  import postgres from 'postgres';
  const c = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(c), { migrationsFolder: './drizzle' });
    console.log('migrations applied');
  } finally {
    await c.end();
  }
" ) || warn "migration step failed — check 'docker compose logs api'"

# ─── 8. Super-admin ────────────────────────────────────────────────────────
if [[ -z "${SKIP_SUPER_ADMIN:-}" ]]; then
  log "creating initial super-admin (skip with SKIP_SUPER_ADMIN=1)..."
  ( cd "$DEPLOY_DIR" && docker compose exec -T api npm run create-super-admin ) || \
    warn "super-admin creation skipped — run later: cd $DEPLOY_DIR && docker compose exec -it api npm run create-super-admin"
fi

# ─── 9. Smoke test ─────────────────────────────────────────────────────────
log "running smoke test..."
sleep 3
bash "$DEPLOY_DIR/scripts/smoke-test.sh" || warn "smoke test had failures — check logs"

# ─── 10. Backup cron ───────────────────────────────────────────────────────
log "installing daily backup cron (02:00 KSA)..."
CRON_LINE="0 2 * * * cd $DEPLOY_DIR && /usr/bin/docker compose exec -T api npm run --silent backup:prod -- --upload >> $DEPLOY_DIR/data/backups/cron.log 2>&1"
( crontab -u jdawil -l 2>/dev/null | grep -v "$DEPLOY_DIR.*backup"; echo "$CRON_LINE" ) | crontab -u jdawil -

# ─── Done ──────────────────────────────────────────────────────────────────
cat <<EOF

────────────────────────────────────────────────
 ✅  Jdawil is up.

 Local probe:       curl http://127.0.0.1/api/health/live
 Logs:              cd $DEPLOY_DIR && docker compose logs -f
 Stop:              cd $DEPLOY_DIR && docker compose down
 Update + redeploy: bash $DEPLOY_DIR/scripts/deploy.sh

 Next:
   1. Point your DNS A record (jdawil.sa) at this server's IP
   2. Enable Cloudflare proxy (orange cloud) + SSL=Full (Strict)
   3. Fill the optional env vars in $DEPLOY_DIR/.env then re-run deploy.sh
   4. Test signup: https://jdawil.sa/onboard
────────────────────────────────────────────────
EOF
