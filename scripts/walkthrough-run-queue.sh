#!/usr/bin/env bash
# Help Centre walkthrough queue runner.
#
# Captures every flow in scripts/walkthrough-flows/ against the LIVE app using the
# dedicated demo capture accounts, then renders an English and an Urdu MP4 from the
# real captured frames.
#
# Requirements (fails closed if missing):
#   - dev server running on http://localhost:8080
#   - .env with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
#   - CAPTURE_ACCOUNT_PASSWORD in the environment (Project Settings, Secrets)
#
# Usage:
#   bash scripts/walkthrough-run-queue.sh                # all flows
#   bash scripts/walkthrough-run-queue.sh dashboard payments
#
# Output: /tmp/walkthrough/<slug>/manifest.json, /tmp/walkthrough/<slug>.mp4 and
# <slug>-ur.mp4. Nothing is uploaded or published automatically — review the
# manifests first, then publish the assets to the tutorial-videos bucket.
set -uo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] && { set -a; . ./.env; set +a; }

if [ -z "${CAPTURE_ACCOUNT_PASSWORD:-}" ]; then
  echo "ABORT: CAPTURE_ACCOUNT_PASSWORD is not set. Add it in Project Settings, Secrets." >&2
  exit 2
fi
if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  echo "ABORT: Supabase env vars missing." >&2
  exit 2
fi
if ! curl -sf -o /dev/null http://localhost:8080/; then
  echo "ABORT: dev server is not answering on http://localhost:8080" >&2
  exit 2
fi

# Urdu captions need Arabic shaping + bidi reordering for Pillow.
python3 -c "import arabic_reshaper, bidi" 2>/dev/null || pip install --quiet arabic-reshaper python-bidi

OUT=/tmp/walkthrough
mkdir -p "$OUT"

if [ "$#" -gt 0 ]; then
  FLOWS=()
  for s in "$@"; do FLOWS+=("scripts/walkthrough-flows/$s.json"); done
else
  FLOWS=(scripts/walkthrough-flows/*.json)
fi

fail=0
for flow in "${FLOWS[@]}"; do
  slug="$(basename "$flow" .json)"
  echo "=============================== $slug"
  if ! python3 scripts/walkthrough-capture.py "$flow" --out "$OUT"; then
    echo "!! $slug capture needs review — see $OUT/$slug/manifest.json"
    fail=1
    continue
  fi
  title="$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('title') or d['slug'])" "$flow")"
  title_ur="$(python3 -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('title_ur') or d.get('title') or d['slug'])" "$flow")"
  python3 scripts/walkthrough-render.py "$OUT/$slug/manifest.json" --title "$title" --out "$OUT/$slug.mp4" || fail=1
  python3 scripts/walkthrough-render.py "$OUT/$slug/manifest.json" --title "$title_ur" --lang ur --out "$OUT/$slug-ur.mp4" || fail=1
done

echo
echo "Artifacts in $OUT"
ls -1 "$OUT"/*.mp4 2>/dev/null || true
exit $fail
