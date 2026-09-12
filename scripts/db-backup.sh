#!/usr/bin/env bash
# Backs up the local Docker Compose Postgres database to a timestamped
# compressed dump under backups/ (gitignored). Safe to run any time; it only
# reads from the database.
#
# Usage: scripts/db-backup.sh [label]
#   label   optional suffix, e.g. "before-migration-004" -> included in the filename.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

label="${1:-}"
timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
out="backups/scaler-${timestamp}${label:+-$label}.dump"

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "postgres service is not running. Start it first: docker compose up -d postgres" >&2
  exit 1
fi

echo "Backing up scaler database -> ${out}"
docker compose exec -T postgres pg_dump \
  -U scaler -d scaler \
  --format=custom --no-owner --no-privileges \
  > "${out}"

size="$(du -h "${out}" | cut -f1)"
echo "Done: ${out} (${size})"
echo "Restore with: scripts/db-restore.sh ${out}"
