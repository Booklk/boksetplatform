#!/usr/bin/env bash
# dev-bootstrap.sh — fresh local setup for a new developer.
#
# Installs deps, pushes schema, seeds plans, seeds demo data (one demo
# vendor with sample services + inventory). Refuses to run against a
# non-local DATABASE_URL so it never wipes a production-looking host.
#
# Usage:
#   ./scripts/dev-bootstrap.sh          # first-time setup
#   ./scripts/dev-bootstrap.sh --skip-demo   # schema + plans only
#
# Exit codes:
#   0  success
#   1  sanity check failed (non-local DB URL)
#   2  install / push / seed failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
SERVER_DIR="$ROOT_DIR/server"
CLIENT_DIR="$ROOT_DIR/client"

SKIP_DEMO=0
for arg in "$@"; do
  case "$arg" in
    --skip-demo) SKIP_DEMO=1 ;;
  esac
done

# Safety: never run this against something that looks like production.
if [[ -n "${DATABASE_URL:-}" ]] \
  && ! echo "$DATABASE_URL" | grep -qE '(localhost|127\.0\.0\.1|@postgres:|@db:)'; then
  echo "❌ DATABASE_URL doesn't look local ($DATABASE_URL)."
  echo "   Set LOCAL_OK=1 if you really meant to bootstrap this DB."
  if [[ "${LOCAL_OK:-0}" != "1" ]]; then exit 1; fi
fi

echo "▶ Installing server dependencies…"
(cd "$SERVER_DIR" && npm install --silent) || { echo "❌ server install failed"; exit 2; }

echo "▶ Installing client dependencies…"
(cd "$CLIENT_DIR" && npm install --silent) || { echo "❌ client install failed"; exit 2; }

cd "$SERVER_DIR"

echo "▶ Applying schema (drizzle-kit push)…"
npm run db:migrate || { echo "❌ schema push failed"; exit 2; }

echo "▶ Seeding platform plans…"
npm run db:seed:plans || { echo "❌ plans seed failed"; exit 2; }

if [[ "$SKIP_DEMO" == "1" ]]; then
  echo "⏭  Skipping demo data (--skip-demo)."
else
  echo "▶ Seeding demo vendor + services…"
  npm run db:seed || { echo "⚠  demo seed reported an error (likely already seeded) — continuing"; }
fi

echo ""
echo "✓ Local DB is ready. Try:"
echo "    cd server && npm run dev    # API on :3001"
echo "    cd client && npm run dev    # Web on :5173"
