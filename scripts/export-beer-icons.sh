#!/bin/bash
# Export hand-drawn beer icons to mobile-ready PNGs (+ pure SVGs).
# No dev server, no browser needed.
#
# 1. esbuild bundles scripts/make-wall.ts (BEER_WALL is the single source of
#    truth) and node renders, per icon: exported/beer-icons/svg/<slug>.svg
#    plus a 4x PNG via resvg (filters + Caveat/system fonts, light tokens baked).
#    (esbuild, not tsx: the sandbox forbids tsx's IPC socket.
#     resvg, not headless Chrome: Chrome screenshots SIGABRT in the sandbox,
#     and node-spawned Chrome is killed outright.)
# 2. sips downscales each 4x PNG to iOS (@1x/@2x/@3x) + Android (mdpi->xxxhdpi).
#
# Usage: npm run export:icons
# Output: exported/beer-icons/{svg,ios,android,manifest.json} (.raw = 4x masters)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/Users/yuki/.nvm/versions/node/v22.22.0/bin:$PATH"
OUT="$ROOT/exported/beer-icons"
RAW="$OUT/.raw"

"$ROOT/node_modules/.bin/esbuild" "$ROOT/scripts/make-wall.ts" \
  --bundle --platform=node --format=esm \
  --outfile="$ROOT/scripts/.cache/make-wall.bundle.mjs" \
  --external:react --external:react-dom --external:react-dom/server \
  --external:@resvg/resvg-js \
  --log-level=error
node "$ROOT/scripts/.cache/make-wall.bundle.mjs"

mkdir -p "$OUT/ios"
for dpi in mdpi hdpi xhdpi xxhdpi xxxhdpi; do mkdir -p "$OUT/android/drawable-$dpi"; done

# 4x base 432x576 -> ios @1x 108x144, @2x 216x288, @3x 324x432
#                 -> mdpi 108x144, hdpi 162x216, xhdpi 216x288, xxhdpi 324x432, xxxhdpi 432x576
count=0
for raw in "$RAW"/*@4x.png; do
  slug="$(basename "$raw" @4x.png)"
  sips -z 144 108 "$raw" --out "$OUT/ios/$slug@1x.png" >/dev/null
  sips -z 288 216 "$raw" --out "$OUT/ios/$slug@2x.png" >/dev/null
  sips -z 432 324 "$raw" --out "$OUT/ios/$slug@3x.png" >/dev/null
  sips -z 144 108 "$raw" --out "$OUT/android/drawable-mdpi/$slug.png" >/dev/null
  sips -z 216 162 "$raw" --out "$OUT/android/drawable-hdpi/$slug.png" >/dev/null
  sips -z 288 216 "$raw" --out "$OUT/android/drawable-xhdpi/$slug.png" >/dev/null
  sips -z 432 324 "$raw" --out "$OUT/android/drawable-xxhdpi/$slug.png" >/dev/null
  cp "$raw" "$OUT/android/drawable-xxxhdpi/$slug.png"
  count=$((count + 1))
done

echo "exported $count icons -> $OUT"
