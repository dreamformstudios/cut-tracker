#!/usr/bin/env bash
# Writes config.js from values you type in. Nothing is echoed anywhere else.
#   ./configure.sh
set -euo pipefail
cd "$(dirname "$0")"

cur(){ grep -o "$1:[[:space:]]*\"[^\"]*\"" config.js 2>/dev/null | sed 's/.*"\(.*\)"/\1/' || true; }
ask(){ # ask <label> <current>
  local label="$1" current="${2:-}" val=""
  if [ -n "$current" ] && [[ "$current" != PASTE_* ]]; then
    printf '%s\n  current: %s…\n  new value (Enter to keep): ' "$label" "${current:0:28}" >&2
  else
    printf '%s\n  paste value (Enter to skip): ' "$label" >&2
  fi
  read -r val
  if [ -z "$val" ]; then printf '%s' "$current"; else printf '%s' "$val"; fi
}

echo
echo "Cut Tracker configuration"
echo "-------------------------"
echo
URL=$(ask  "1. Supabase Project URL   (Project Settings > API Keys)" "$(cur SUPABASE_URL)")
echo
KEY=$(ask  "2. Supabase anon/public key" "$(cur SUPABASE_ANON_KEY)")
echo
USDA=$(ask "3. USDA API key            (fdc.nal.usda.gov/api-key-signup, optional)" "$(cur USDA_API_KEY)")
echo

URL="${URL%/}"

cat > config.js <<EOF
/* ============================================================
   CONFIG — written by configure.sh. Safe to edit by hand.
   These values are designed to live in browser code. Your data
   is protected by row-level security, not by hiding this file.
   ============================================================ */

window.CONFIG = {
  SUPABASE_URL:      "${URL:-PASTE_SUPABASE_URL_HERE}",
  SUPABASE_ANON_KEY: "${KEY:-PASTE_SUPABASE_ANON_KEY_HERE}",
  USDA_API_KEY:      "${USDA:-PASTE_USDA_KEY_HERE}"
};
EOF

echo "Wrote config.js:"
sed -n 's/^  \([A-Z_]*\):[[:space:]]*"\(.\{0,30\}\).*/  \1 = \2…/p' config.js
echo
echo "Now run:  ./push.sh \"Configure sync\""
echo
