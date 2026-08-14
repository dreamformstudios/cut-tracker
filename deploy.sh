#!/usr/bin/env bash
# Publishes Cut Tracker to GitHub Pages. Run from inside the cut-tracker folder:
#   cd ~/git/cut-tracker && ./deploy.sh
set -euo pipefail

REPO="cut-tracker"
say(){ printf '\n\033[1;32m==>\033[0m %s\n' "$1"; }
die(){ printf '\n\033[1;31mx\033[0m %s\n' "$1" >&2; exit 1; }

[ -f index.html ] || die "Run this from inside the cut-tracker folder."

# ---------- 1. gh CLI ----------
if ! command -v gh >/dev/null 2>&1; then
  say "GitHub CLI (gh) is not installed."
  if command -v brew >/dev/null 2>&1; then
    read -r -p "Install it with Homebrew now? [Y/n] " a
    [[ "${a:-Y}" =~ ^[Nn] ]] && die "Then use the manual route in SETUP.md step 1." 
    brew install gh
  else
    die "Install it from https://cli.github.com then re-run, or use the manual route in SETUP.md step 1."
  fi
fi

if ! gh auth status >/dev/null 2>&1; then
  say "Signing you in to GitHub (a browser window will open)."
  gh auth login -h github.com -p https -w
fi

OWNER=$(gh api user --jq .login)
say "Signed in as $OWNER"

# ---------- 2. git repo ----------
if [ ! -d .git ]; then
  say "Creating a local git repository"
  git init -q
  git symbolic-ref HEAD refs/heads/main
fi
git add -A
git diff --cached --quiet 2>/dev/null || git -c user.email="${OWNER}@users.noreply.github.com" \
  -c user.name="$OWNER" commit -q -m "Cut Tracker"
say "Committed $(git ls-files | wc -l | tr -d ' ') files"

# ---------- 3. GitHub repo ----------
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  say "Repo $OWNER/$REPO already exists — pushing to it"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  git push -u origin main
else
  say "Creating github.com/$OWNER/$REPO (public — required for free GitHub Pages)"
  gh repo create "$REPO" --public --source=. --remote=origin --push
fi

# ---------- 4. GitHub Pages ----------
say "Turning on GitHub Pages"
if gh api "repos/$OWNER/$REPO/pages" >/dev/null 2>&1; then
  echo "   already enabled"
else
  printf '{"source":{"branch":"main","path":"/"}}' \
    | gh api -X POST "repos/$OWNER/$REPO/pages" --input - >/dev/null \
    && echo "   enabled" \
    || echo "   couldn't enable automatically — do it by hand: Settings > Pages > Branch: main / root"
fi

URL="https://$OWNER.github.io/$REPO/"

# ---------- 5. wait for it to go live ----------
say "Waiting for the first build (usually under 2 minutes)"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)
  if [ "$code" = "200" ]; then
    printf '\n\033[1;32m================================================\033[0m\n'
    printf '  Your tracker is live:\n\n  %s\n' "$URL"
    printf '\033[1;32m================================================\033[0m\n\n'
    command -v open >/dev/null && open "$URL"
    exit 0
  fi
  printf '.'
  sleep 6
done

printf '\n\nStill building. Give it a few more minutes, then open:\n  %s\n' "$URL"
