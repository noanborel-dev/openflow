#!/usr/bin/env bash
# Build whisper-cli for the current platform/arch and drop it into
# bin/<platform>-<arch>/ so electron-builder can pick it up.
#
# Pinned to a known-good whisper.cpp commit so a release-day upstream
# break doesn't surprise us. Bump this manually when we want a newer
# version + test before releasing.
#
# Usage:
#   scripts/build-whisper-cli.sh                  # auto-detect
#   PLATFORM=darwin ARCH=arm64 ./build-whisper-cli.sh
#
# Requires: git, cmake, a working C++ compiler.

set -euo pipefail

WHISPER_CPP_REPO="${WHISPER_CPP_REPO:-https://github.com/ggml-org/whisper.cpp.git}"
WHISPER_CPP_REF="${WHISPER_CPP_REF:-v1.8.4}"

PLATFORM="${PLATFORM:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
case "$PLATFORM" in
  darwin) PLATFORM_NAME="darwin" ;;
  linux)  PLATFORM_NAME="linux" ;;
  mingw*|msys*|cygwin*) PLATFORM_NAME="win32" ;;
  *) PLATFORM_NAME="$PLATFORM" ;;
esac

ARCH="${ARCH:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64) ARCH_NAME="arm64" ;;
  x86_64|amd64) ARCH_NAME="x64" ;;
  *) ARCH_NAME="$ARCH" ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/bin/${PLATFORM_NAME}-${ARCH_NAME}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Building whisper-cli for ${PLATFORM_NAME}-${ARCH_NAME} (ref: ${WHISPER_CPP_REF})"
echo "  → $OUT_DIR"

git clone --depth 1 --branch "$WHISPER_CPP_REF" "$WHISPER_CPP_REPO" "$WORK_DIR/whisper.cpp"
cd "$WORK_DIR/whisper.cpp"

# Configure: Metal on macOS for Apple Silicon (no-op on x64 / Linux /
# Windows). -mmacosx-version-min=11.0 ensures the binary launches on
# Big Sur and later — matches Electron's own minimum.
CMAKE_FLAGS=(
  -DBUILD_SHARED_LIBS=OFF
  -DGGML_NATIVE=OFF
  -DCMAKE_BUILD_TYPE=Release
)
if [[ "$PLATFORM_NAME" == "darwin" ]]; then
  CMAKE_FLAGS+=(
    -DGGML_METAL=ON
    -DGGML_METAL_EMBED_LIBRARY=ON   # Bundle Metal shader source in-binary
    -DCMAKE_OSX_DEPLOYMENT_TARGET=11.0
  )
  if [[ "$ARCH_NAME" == "arm64" ]]; then
    CMAKE_FLAGS+=(-DCMAKE_OSX_ARCHITECTURES=arm64)
  else
    CMAKE_FLAGS+=(-DCMAKE_OSX_ARCHITECTURES=x86_64 -DGGML_METAL=OFF)
  fi
fi

cmake -B build "${CMAKE_FLAGS[@]}"
cmake --build build -j --config Release --target whisper-cli

BIN_NAME="whisper-cli"
if [[ "$PLATFORM_NAME" == "win32" ]]; then
  BIN_NAME="whisper-cli.exe"
fi

BUILT_PATH=""
for candidate in "build/bin/$BIN_NAME" "build/$BIN_NAME" "build/bin/Release/$BIN_NAME"; do
  if [[ -f "$candidate" ]]; then
    BUILT_PATH="$candidate"
    break
  fi
done

if [[ -z "$BUILT_PATH" ]]; then
  echo "Failed to locate built whisper-cli — searched build/bin, build/, build/bin/Release" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$BUILT_PATH" "$OUT_DIR/$BIN_NAME"
chmod +x "$OUT_DIR/$BIN_NAME"

echo "Wrote $OUT_DIR/$BIN_NAME"
"$OUT_DIR/$BIN_NAME" --help 2>&1 | head -1 || true
