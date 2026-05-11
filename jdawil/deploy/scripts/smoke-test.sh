#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
#  Jdawil — post-deploy smoke test.
#
#  Hits the critical endpoints in sequence. Fast-fails on anything that's
#  obviously broken. Non-zero exit signals the deploy script to roll back.
# ────────────────────────────────────────────────────────────────────────

set -uo pipefail

BASE="${BASE:-http://127.0.0.1}"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

pass=0
fail=0

# Pull HEALTH_CHECK_TOKEN from .env so we can hit the gated endpoints.
HEALTH_TOKEN=""
if [[ -f "$DEPLOY_DIR/.env" ]]; then
  HEALTH_TOKEN=$(grep -E '^HEALTH_CHECK_TOKEN=' "$DEPLOY_DIR/.env" | cut -d= -f2- || true)
fi

check() {
  local name="$1" expected="$2" url="$3" header="${4:-}"
  local actual
  if [[ -n "$header" ]]; then
    actual=$(curl -fsS -o /dev/null -w '%{http_code}' -H "$header" "$url" 2>/dev/null || echo "000")
  else
    actual=$(curl -fsS -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  fi
  if [[ "$actual" == "$expected" ]]; then
    printf '  \033[1;32m✓\033[0m %s (%s)\n' "$name" "$actual"
    pass=$((pass + 1))
  else
    printf '  \033[1;31m✗\033[0m %s — expected %s, got %s\n' "$name" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

echo
echo "  Jdawil smoke test ─ $BASE"
echo

check "Nginx healthz"           "200" "$BASE:8080/healthz"
check "API liveness"            "200" "$BASE/api/health/live"
check "API health (gated)"      "200" "$BASE/api/health" "x-health-token: $HEALTH_TOKEN"
check "API metrics (gated)"     "200" "$BASE/api/metrics" "x-health-token: $HEALTH_TOKEN"
check "Public system-status"    "200" "$BASE/api/system-status/health"
check "Onboard templates"       "200" "$BASE/api/onboarding-templates"
check "SEO sitemap"             "200" "$BASE/sitemap.xml"
check "robots.txt"              "200" "$BASE/robots.txt"
check "SPA root"                "200" "$BASE/"
check "Auth requires login"     "401" "$BASE/api/bookings"
check "Unknown API returns 404" "404" "$BASE/api/does-not-exist"
check "Onboard rate-limited?"   "201" "$BASE/api/onboarding-templates"  # just shouldn't be 429

echo
echo "  $pass passed · $fail failed"
echo

[[ $fail -eq 0 ]] || exit 1
