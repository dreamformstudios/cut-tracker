#!/usr/bin/env bash
# Ships whatever changed in this folder to the live site.
#   ./push.sh "what I changed"
set -euo pipefail
cd "$(dirname "$0")"
[ -f index.html ] || { echo "Run this from inside the cut-tracker folder."; exit 1; }

# Clear an empty leftover lock (harmless; happens when a tool touched the repo read-only)
if [ -f .git/index.lock ] && [ ! -s .git/index.lock ]; then rm -f .git/index.lock; fi

MSG="${1:-Update}"
git add -A
if git diff --cached --quiet; then echo "Nothing changed."; exit 0; fi
echo "Changed:"; git diff --cached --name-only | sed 's/^/  /'
git commit -q -m "$MSG"
git push -q origin main
OWNER=$(git remote get-url origin | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#')
REPO=$(basename "$(git remote get-url origin)" .git)
printf '\nPushed. GitHub Pages rebuilds in about a minute:\n  https://%s.github.io/%s/\n\n' "$OWNER" "$REPO"
