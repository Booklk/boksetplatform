#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  Jdawil — backup wrapper. Runs pg_dump via the api container and (if
#  S3_BACKUP_BUCKET is set) uploads to object storage. Schedule daily
#  at 02:00 KSA — install.sh adds the cron for you.
# ────────────────────────────────────────────────────────────────────────

set -euo pipefail
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

# Source .env so we know whether S3 upload is configured.
set -a; source .env; set +a

FLAGS=""
if [[ -n "${S3_BACKUP_BUCKET:-}" && -n "${S3_ACCESS_KEY:-}" ]]; then
  FLAGS="-- --upload"
fi

docker compose exec -T api npm run --silent backup:prod $FLAGS
