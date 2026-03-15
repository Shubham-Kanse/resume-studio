#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is not installed or not in PATH." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Error: DATABASE_URL is not set." >&2
  echo "Set DATABASE_URL to your Supabase Postgres connection string and re-run." >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "Error: migrations directory not found at $MIGRATIONS_DIR" >&2
  exit 1
fi

mapfile -t migration_files < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ "${#migration_files[@]}" -eq 0 ]]; then
  echo "No migration files found in $MIGRATIONS_DIR"
  exit 0
fi

echo "Applying ${#migration_files[@]} migrations from $MIGRATIONS_DIR"

for migration in "${migration_files[@]}"; do
  echo "-> $(basename "$migration")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "All migrations applied successfully."
