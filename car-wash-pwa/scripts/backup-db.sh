#!/usr/bin/env bash
# backup-db.sh — nightly Postgres snapshot.
#
# Pipes pg_dump through gzip to a timestamped file, then prunes backups
# older than BACKUP_RETENTION_DAYS (default 14). Intended to be scheduled
# via cron:
#
#   0 3 * * *  /opt/jdawil/scripts/backup-db.sh >> /var/log/jdawil-backup.log 2>&1
#
# Env:
#   DATABASE_URL             — required
#   BACKUP_DIR               — defaults to /var/backups/jdawil
#   BACKUP_RETENTION_DAYS    — defaults to 14
#
# Exit codes:
#   0 success
#   1 missing DATABASE_URL
#   2 pg_dump failed
#   3 prune failed

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/jdawil}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/jdawil-$STAMP.sql.gz"

echo "▶ Dumping to $OUT"
if ! pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$OUT.tmp"; then
  echo "❌ pg_dump failed" >&2
  rm -f "$OUT.tmp"
  exit 2
fi
mv "$OUT.tmp" "$OUT"
echo "✓ Backup complete ($(du -h "$OUT" | cut -f1))"

echo "▶ Pruning backups older than $RETENTION days"
if ! find "$BACKUP_DIR" -name 'jdawil-*.sql.gz' -type f -mtime +"$RETENTION" -print -delete; then
  echo "⚠ Prune step failed — continuing" >&2
  exit 3
fi

echo "✓ Done"
