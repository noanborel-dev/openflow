# bin/

Per-platform whisper-cli binaries shipped inside the packaged `.app`.

Each subdirectory is consumed by `electron-builder.yml`'s `extraResources`
glob, which writes the binary into `Resources/bin/whisper-cli` of the
final `.app` / `.exe` bundle. The Electron main process resolves the
runtime path via `src/main/local-binaries.ts`.

Layout:

    bin/darwin-arm64/whisper-cli      # macOS Apple Silicon
    bin/darwin-x64/whisper-cli        # macOS Intel
    bin/win32-x64/whisper-cli.exe     # Windows

These binaries are produced in CI by `scripts/build-whisper-cli.sh`
during the GitHub Actions release workflow (`.github/workflows/release.yml`).
They are **not** committed to git — the directories are kept tracked so
electron-builder's glob doesn't fail when iterating an empty parent.

For local development, `src/main/local-binaries.ts` falls back to a
Homebrew-installed `whisper-cli` at `/opt/homebrew/bin/whisper-cli`
(or `/usr/local/bin/` on Intel). Install with:

    brew install whisper-cpp

Then `npm run dev` will pick it up automatically.
