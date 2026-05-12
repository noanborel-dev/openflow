#!/usr/bin/env bash
# Convert assets/icon.png (1024×1024) into a macOS .icns iconset and
# bundle. Pure built-in macOS tooling — no Homebrew dep.
#
# Usage: scripts/png-to-icns.sh
# Output: assets/icon.icns

set -euo pipefail

SRC="${1:-assets/icon.png}"
DEST_ICNS="${2:-assets/icon.icns}"

if [[ ! -f "$SRC" ]]; then
  echo "error: $SRC not found. Open scripts/generate-icon.html, download icon-1024.png, save it to $SRC, then re-run." >&2
  exit 1
fi

TMP="$(mktemp -d)/icon.iconset"
mkdir -p "$TMP"

# Apple's required sizes for a complete iconset. sips ships with macOS.
declare -a SIZES=( "16" "32" "64" "128" "256" "512" "1024" )
for s in "${SIZES[@]}"; do
  sips -z "$s" "$s" "$SRC" --out "$TMP/icon_${s}x${s}.png" >/dev/null
done

# Retina @2x variants.
cp "$TMP/icon_32x32.png"     "$TMP/icon_16x16@2x.png"
cp "$TMP/icon_64x64.png"     "$TMP/icon_32x32@2x.png"
cp "$TMP/icon_256x256.png"   "$TMP/icon_128x128@2x.png"
cp "$TMP/icon_512x512.png"   "$TMP/icon_256x256@2x.png"
cp "$TMP/icon_1024x1024.png" "$TMP/icon_512x512@2x.png"

# Non-@2x copies aren't needed at 64 or 1024; iconutil wants the @1x
# files only for 16/32/128/256/512.
rm -f "$TMP/icon_64x64.png" "$TMP/icon_1024x1024.png"

iconutil -c icns "$TMP" -o "$DEST_ICNS"
echo "✓ wrote $DEST_ICNS"
