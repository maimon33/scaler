#!/usr/bin/env bash
# Restores a backup produced by scripts/db-backup.sh into the local Docker
# Compose Postgres database. Destructive: existing rows and objects covered
# by the dump are dropped and replaced (pg_restore --clean --if-exists).
#
# For minimum risk this script, by default:
#   - refuses to run without an explicit confirmation (or --yes);
#   - takes a fresh safety backup of the current database before restoring,
#     so a bad restore is itself one command away from undo.
#
# Usage: scripts/db-restore.sh <dump-file> [--yes] [--no-safety-backup]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

dump_file=""
assume_yes=false
safety_backup=true

for arg in "$@"; do
  case "$arg" in
    --yes|-y) assume_yes=true ;;
    --no-safety-backup) safety_backup=false ;;
    -*) echo "Unknown option: $arg" >&2; exit 1 ;;
    *) dump_file="$arg" ;;
  esac
done

if [[ -z "$dump_file" ]]; then
  echo "Usage: scripts/db-restore.sh <dump-file> [--yes] [--no-safety-backup]" >&2
  echo "Available backups:" >&2
  ls -1t backups/*.dump 2>/dev/null | sed 's/^/  /' >&2 || echo "  (none in backups/)" >&2
  exit 1
fi

if [[ ! -f "$dump_file" ]]; then
  echo "No such file: $dump_file" >&2
  exit 1
fi

if ! docker compose ps --status running --services 2>/dev/null | grep -qx postgres; then
  echo "postgres service is not running. Start it first: docker compose up -d postgres" >&2
  exit 1
fi

echo "This will REPLACE the contents of the local scaler database with:"
echo "  $dump_file"
if [[ "$assume_yes" != true ]]; then
  read -r -p "Continue? [y/N] " reply
  case "$reply" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

if [[ "$safety_backup" == true ]]; then
  echo "Taking a safety backup of the current database first..."
  "$(dirname "${BASH_SOURCE[0]}")/db-backup.sh" before-restore
fi

echo "Restoring..."
docker compose exec -T postgres pg_restore \
  -U scaler -d scaler \
  --clean --if-exists --no-owner --no-privileges \
  < "$dump_file"

echo "Restore complete."
