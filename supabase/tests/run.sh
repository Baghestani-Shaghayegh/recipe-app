#!/usr/bin/env bash
# Runs the database tests on a throwaway database of a local Postgres (16+). Stops at the first
# failure. Usage: supabase/tests/run.sh [psql connection options]
#   e.g. supabase/tests/run.sh -h /path/to/socket-dir -p 55432 -U postgres
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
db="recipe_box_test_$$"
psql "$@" -q -d postgres -c "create database $db"
trap 'psql "$@" -q -d postgres -c "drop database if exists $db" >/dev/null' EXIT
for file in "$dir/stub_supabase.sql" "$dir"/../migrations/*.sql "$dir/recipe_feed_test.sql"; do
  echo "== $(basename "$file")"
  psql "$@" -q -At -v ON_ERROR_STOP=1 -d "$db" -f "$file" | sed '/^$/d'
done
