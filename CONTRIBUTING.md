# Internal Development Notes

Yappr is a proprietary commercial product. This file is internal-only and
does not solicit external contributions. The repository is not licensed for
public modification or redistribution. See `LICENSE`.

## Local setup

```bash
npm install
npm run dev
```

## Architecture

| Directory | Process | Responsibility |
|---|---|---|
| `src/main/` | Node.js (Electron main) | Hotkeys, audio assembly, pipeline, paste, IPC, tray |
| `src/renderer/indicator/` | Chromium renderer | Floating pill UI, MediaRecorder, waveform |
| `src/renderer/settings/` | Chromium renderer | Settings window |
| `src/renderer/onboarding/` | Chromium renderer | First-run wizard |
| `src/preload/` | Preload scripts | contextBridge API between main ↔ renderer |
| `src/shared/` | Both | Types, constants, prompts |

## Privacy invariants — do not regress

- No screenshots, ever (no `desktopCapturer`, no `getDisplayMedia`).
- No telemetry, analytics, or crash reporting.
- No network calls to any Yappr-controlled domain from the desktop app.
- Audio is sent only to the user's chosen provider, using the user's key.
- API keys are stored locally via `electron-store`; never transmitted off-device.

## Adding an AI provider

1. Create `src/main/providers/yourprovider.ts` implementing `TranscriptionProvider` and/or `CleanupProvider`.
2. Export factory functions and a `testYourProviderKey` function.
3. Wire into `buildProviders()` in `src/main/pipeline.ts`.
4. Add the option to `src/renderer/settings/tabs/AIProviderTab.tsx`.

## Pre-PR checklist (internal)

- `npm run typecheck` passes.
- `npm run lint` passes with zero warnings.
- Privacy invariants above are not regressed.
