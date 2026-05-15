#!/usr/bin/env bash
# Swap the bundled Electron.app icon (used in `npm run dev`) for the
# OpenFlow icon so the dock / app switcher / window menu all show our
# brand instead of the default Electron logo in development.
#
# Packaged builds use assets/icon.icns via electron-builder.yml, so this
# script is purely for dev quality-of-life. Runs on `npm install` via
# the postinstall hook.

set -euo pipefail

SRC="assets/icon.icns"
DEST="node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns"

if [[ ! -f "$SRC" ]]; then
  echo "swap-dev-icon: $SRC not present, skipping."
  exit 0
fi

if [[ ! -f "$DEST" ]]; then
  echo "swap-dev-icon: $DEST not present (electron not installed yet?), skipping."
  exit 0
fi

cp "$SRC" "$DEST"

# Touching the .app bundle nudges macOS to re-read its icon next time
# the process launches.
touch "node_modules/electron/dist/Electron.app"

echo "✓ swapped Electron.app dev icon to OpenFlow"
