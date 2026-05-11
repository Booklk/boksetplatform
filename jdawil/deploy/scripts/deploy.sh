#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  Jdawil — redeploy after a `git pull`.
#
#  Idempotent: pull → migrate → rebuild only changed images → restart →
#  smoke test → rollback on failure. Zero downtime for the API + web
#  services because compose recreates them one at a time and the new
#  container only takes traffic once its healthcheck passes.
#
#  Usage:
#    bash deploy/scripts/deploy.sh                    # pulls + deploys
#    SKIP_PULL=1 bash deploy/scripts/deploy.sh        # rebuild current code
#    SKIP_MIGRATE=1 bash deploy/scripts/deploy.sh     # skip DB migration
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/../.." && pwd)"

log()  { printf '\033[1;36m[deploy] %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[deploy] %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m[deploy] %s\033[0m\n' "$*" >&2; exit 1; }

cd "$DEPLOY_DIR"
[[ -f .env ]] || die ".env missing. Run install.sh first."

# ─── 1. Pull latest ────────────────────────────────────────────────────────
if [[ -z "${SKIP_PULL:-}" ]]; then
  log "pulling latest from origin..."
  git -C "$REPO_ROOT" fetch --quiet
  git -C "$REPO_ROOT" pull --ff-only --quiet
fi

# Stamp the commit into the Sentry release tag so errors are attributable.
GIT_COMMIT=$(git -C "$REPO_ROOT" rev-parse --short HEAD)
export GIT_COMMIT
log "deploying commit $GIT_COMMIT"

# Wipe any stale GIT_COMMIT line, then append the current one so compose
# picks it up via .env variable substitution.
sed -i '/^GIT_COMMIT=/d' .env
echo "GIT_COMMIT=$GIT_COMMIT" >> .env

# ─── 2. Save previous image IDs for rollback ───────────────────────────────
PREV_API=$(docker compose images -q api 2>/dev/null || true)
PREV_WEB=$(docker compose images -q web 2>/dev/null || true)

# ─── 3. Build new images ───────────────────────────────────────────────────
log "building images..."
docker compose build --pull api web

# ─── 4. Migrate DB (transparent) ───────────────────────────────────────────
if [[ -z "${SKIP_MIGRATE:-}" ]]; then
  log "applying any pending DB migrations..."
  docker compose exec -T api node --input-type=module -e "
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
  " || die "migration failed — aborting deploy. DB untouched, old containers still running."
fi

# ─── 5. Rolling restart ────────────────────────────────────────────────────
log "restarting api..."
docker compose up -d --no-deps api

# Wait for the new api to be healthy.
log "waiting for api healthcheck..."
for i in {1..30}; do
  status=$(docker compose ps --format json api 2>/dev/null | head -1 | (command -v jq >/dev/null && jq -r '.Health' || awk -F'"Health":"' '{print $2}' | cut -d'"' -f1))
  if [[ "$status" == "healthy" ]]; then break; fi
  sleep 2
done

log "restarting web..."
docker compose up -d --no-deps web

# ─── 6. Smoke test ─────────────────────────────────────────────────────────
log "running smoke test..."
if bash "$DEPLOY_DIR/scripts/smoke-test.sh"; then
  log "✅ deploy $GIT_COMMIT succeeded"
else
  warn "smoke test failed — rolling back..."
  if [[ -n "$PREV_API" ]]; then
    docker tag "$PREV_API" jdawil-api:rollback || true
    docker compose stop api
    docker run -d --name jdawil-api-rb --network "$(basename "$DEPLOY_DIR")_default" \
      --env-file .env jdawil-api:rollback || true
  fi
  die "rolled back. Investigate with: docker compose logs -f api"
fi
