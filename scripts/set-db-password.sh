#!/bin/bash
#
# Sets DATABASE_URL in .env.local without the value being echoed to the screen,
# written to shell history, or passed as a command argument.
#
# Paste either:
#   - the whole connection string from Supabase, or
#   - just the database password
#
# Either way, characters like # @ / : in the password are percent-encoded for
# you, so the URL cannot end up malformed.
#
#   ./scripts/set-db-password.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "No .env.local here. Copy .env.example to .env.local first." >&2
  exit 1
fi

cat <<'PROMPT'
Paste your Supabase connection string (or just the password).
Nothing will appear as you type. Press Enter when done.

PROMPT
printf '> '
IFS= read -rs SECRET_INPUT
printf '\n\n'

if [ -z "$SECRET_INPUT" ]; then
  echo "Nothing entered. No changes made." >&2
  exit 1
fi

printf '%s' "$SECRET_INPUT" | python3 scripts/_set_db_url.py

unset SECRET_INPUT
echo
echo "Nothing was echoed and nothing went into your shell history."
