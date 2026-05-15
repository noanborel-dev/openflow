#!/usr/bin/env bash
# Generates the OpenFlow menubar (tray) icon directly via SVG → sips.
#
# Output: assets/tray.png (1x) + assets/tray@2x.png (2x).
#
# Full-color design: charcoal pill, red recording dot, cobalt waveform
# bars. Maxed out at the menubar's 22px tall cap (44px @2x); pill is
# full-bleed (no shadow padding) and aspect-stretched to be wider for
# more presence on screen.

set -euo pipefail

TMP="$(mktemp -d)"
DEST_1X="assets/tray.png"
DEST_2X="assets/tray@2x.png"

# Design space is 54×22 — pill aspect ~2.45:1, full-bleed, no padding.
# sips -Z constrains the longest dim, so when we ask for 44, we get
# 44×17 (loses height). Instead we render at @2x explicit dimensions
# and let sips downscale proportionally.
cat > "$TMP/tray.svg" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 22" width="108" height="44">
  <defs>
    <linearGradient id="pillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#12141a"/>
      <stop offset="100%" stop-color="#0e1016"/>
    </linearGradient>
    <linearGradient id="hiGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="dotGlow" cx="11" cy="11" r="7" gradientUnits="userSpaceOnUse">
      <stop offset="0%"  stop-color="#e84a3a" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#e84a3a" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="pillClip">
      <rect x="0" y="0" width="54" height="22" rx="11"/>
    </clipPath>
  </defs>

  <!-- Pill body — full-bleed -->
  <rect x="0" y="0" width="54" height="22" rx="11" fill="url(#pillGrad)"/>

  <!-- Top refractive highlight, clipped to pill -->
  <g clip-path="url(#pillClip)">
    <rect x="0" y="0" width="54" height="12" fill="url(#hiGrad)"/>
  </g>

  <!-- Hairline inner border -->
  <rect x="0.3" y="0.3" width="53.4" height="21.4" rx="10.7"
        fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.4"/>

  <!-- Red recording dot — left side, vertically centered -->
  <circle cx="11" cy="11" r="7" fill="url(#dotGlow)"/>
  <circle cx="11" cy="11" r="3.0" fill="#e84a3a"/>

  <!-- Five cobalt waveform bars, frozen mid-animation. Spread across
       the right ~30 design units. -->
  <rect x="22"   y="7"  width="1.8" height="8"  rx="0.9" fill="#5a8fe8"/>
  <rect x="26.5" y="3"  width="1.8" height="16" rx="0.9" fill="#5a8fe8"/>
  <rect x="31"   y="9"  width="1.8" height="4"  rx="0.9" fill="#5a8fe8"/>
  <rect x="35.5" y="5"  width="1.8" height="12" rx="0.9" fill="#5a8fe8"/>
  <rect x="40"   y="7"  width="1.8" height="8"  rx="0.9" fill="#5a8fe8"/>
  <rect x="44.5" y="8.5" width="1.8" height="5"  rx="0.9" fill="#5a8fe8"/>
</svg>
SVG

# Render at @2x explicit size (108×44) then derive @1x (54×22).
# sips' -Z constrains the longest dimension — here the SVG itself
# declares width/height so sips will rasterize at that size when -Z
# matches or exceeds the declared dim.
sips -s format png -z 44 108 "$TMP/tray.svg" --out "$TMP/tray@2x.png" >/dev/null
sips -s format png -z 22 54  "$TMP/tray.svg" --out "$TMP/tray.png"    >/dev/null

cp "$TMP/tray.png"    "$DEST_1X"
cp "$TMP/tray@2x.png" "$DEST_2X"

echo "✓ wrote $DEST_1X"
sips -g pixelWidth -g pixelHeight "$DEST_1X" | tail -2
echo "✓ wrote $DEST_2X"
sips -g pixelWidth -g pixelHeight "$DEST_2X" | tail -2
