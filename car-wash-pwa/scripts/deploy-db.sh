#!/usr/bin/env bash
# deploy-db.sh — database setup for production deployments.
#
# Runs schema migrations + seeds the canonical plan catalogue. Idempotent
# — safe to rerun on every deploy. Does NOT touch vendor or customer data.
#
# Usage:
#   ./scripts/deploy-db.sh
#
# Requires:
#   DATABASE_URL env var
#   node_modules installed in server/
#
# Exit codes:
#   0  success
#   1  schema push failed
#   2  plans seed failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set."
  exit 1
fi

cd "$SERVER_DIR"

echo "▶ Applying schema migrations (drizzle-kit push)…"
npm run db:migrate || { echo "❌ schema push failed"; exit 1; }

echo "▶ Seeding platform plans (idempotent upsert)…"
npm run db:seed:plans || { echo "❌ plans seed failed"; exit 2; }

echo "✓ Database is ready."
