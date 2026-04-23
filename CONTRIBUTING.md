# Contributing to OpenFlow

## Getting started

```bash
git clone https://github.com/YOUR_USERNAME/openflow
cd openflow
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

## Adding an AI provider

1. Create `src/main/providers/yourprovider.ts` implementing `TranscriptionProvider` and/or `CleanupProvider` from `./types`
2. Export factory functions (`createYourProviderCleanupProvider`) and a `testYourProviderKey` function
3. Wire into `buildProviders()` in `src/main/pipeline.ts`
4. Add the option to `src/renderer/settings/tabs/AIProviderTab.tsx`

## Pull request guidelines

- One feature or fix per PR
- Run `npm run typecheck` before opening
- Brief description of what changed and why

## Privacy commitment

OpenFlow never captures screenshots, never sends audio to any server we control, and has zero telemetry. Please do not add any of these in PRs.
