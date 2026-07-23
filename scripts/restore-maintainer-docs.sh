#!/usr/bin/env bash
# Restore maintainer-only docs locally (promo, roadmap, specs). Not tracked on main.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="${1:-0c77231}"

cd "$ROOT"
paths=(
  docs/DISTRIBUTION.md
  docs/FEATURE_GAP_AND_NETWORK.md
  docs/ROADMAP.md
  docs/images/README.md
  docs/promo/devto.md
  docs/promo/hackernews.md
  docs/promo/linkedin.md
  docs/promo/mastodon.md
  docs/promo/producthunt.md
  docs/promo/reddit.md
  docs/promo/twitter.md
  docs/promo/upstream-notification.md
  docs/superpowers/plans/2026-07-23-croc-gui-implementation.md
  docs/superpowers/specs/2026-07-23-croc-gui-design.md
  scripts/capture-one.sh
  scripts/capture-screenshots.sh
  gui/scripts/capture-web.mjs
)

for p in "${paths[@]}"; do
  mkdir -p "$(dirname "$p")"
  git show "${REF}:${p}" >"$p"
  echo "restored $p"
done

chmod +x scripts/capture-one.sh scripts/capture-screenshots.sh 2>/dev/null || true
echo "Done. Maintainer docs are gitignored — they stay local only."
