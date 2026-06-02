# Yappr — Simplification & Electric Paper Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the broken local-Whisper path, replace the toggle hotkey with hold-to-talk + double-tap-to-lock on Ctrl, and redesign all three renderer windows in a single "Electric Paper" visual language (paper `#FAFAF5`, ink `#0A0A0A`, volt `#D4FF3D`).

**Architecture:** Same Electron main/renderer/preload split. The `hotkeys.ts` module is rewritten to use `node-global-key-listener` (already a dep) for keydown/keyup tracking since `globalShortcut` is press-only. The pipeline, error handling, and UI primitives get new small focused modules (`errors.ts`, `theme.ts`, shared `ui/` components under each renderer). Local-Whisper code and IPC states are deleted outright — no compatibility shims.

**Tech Stack:** Electron 29 · electron-vite 2 · TypeScript 5 · React 18 · Tailwind 3 · `node-global-key-listener` · `electron-store` 8 · Groq SDK / OpenAI SDK / Anthropic SDK.

---

## File Structure

**New files:**
- `src/main/errors.ts` — `toUserError(err)` helper.
- `src/shared/theme.ts` — color tokens shared with Tailwind.
- `src/renderer/shared/ui/Pill.tsx` — one primitive used by all three windows.
- `src/renderer/shared/ui/Card.tsx`
- `src/renderer/shared/ui/Toggle.tsx`

**Rewritten in-place:**
- `src/main/hotkeys.ts` — new hold/dbltap implementation.
- `src/main/index.ts` — wiring for onStart/onStop, remove local-whisper branch, simpler error handling.
- `src/main/pipeline.ts` — remove local-whisper branch.
- `src/shared/types.ts` — narrow `Provider` union; drop `local`.
- `src/shared/constants.ts` — default hotkey; drop `local` entries.
- `src/main/store.ts` — default provider becomes `groq`.
- `src/renderer/indicator/Indicator.tsx` — redesigned with volt-green palette, new state set.
- `src/renderer/indicator/index.html` — paper background stays transparent (pill floats).
- `src/preload/indicator.ts` — unchanged (stays intact; states are string so no type break).
- `src/renderer/settings/SettingsApp.tsx` — Electric Paper shell.
- `src/renderer/settings/tabs/HotkeysTab.tsx` — single-key pill (no chord builder).
- `src/renderer/settings/tabs/AIProviderTab.tsx` — drop local; redesign.
- `src/renderer/settings/tabs/GeneralTab.tsx` — paper palette (only colors touched).
- `src/renderer/settings/tabs/AboutTab.tsx` — paper palette.
- `src/renderer/settings/tabs/PerAppRulesTab.tsx` — paper palette.
- `src/renderer/onboarding/OnboardingApp.tsx` — 3-step flow, redesign.
- `tailwind.config.js` — import tokens from `theme.ts`.
- `package.json` — remove `@xenova/transformers` and `ffmpeg-static` from runtime deps.

**Deleted:**
- `src/main/providers/local-whisper.ts`

---

## Task 1: Baseline & branch

**Files:**
- None (git only).

- [ ] **Step 1: Verify working tree is at a known-good commit**

Run: `git status && git log --oneline -3`
Expected: Shows the `docs: spec…` commit as HEAD and the modified `.gitignore` already committed. No uncommitted changes except possibly `.superpowers/brainstorm/` (which is gitignored).

- [ ] **Step 2: Create feature branch**

```bash
git checkout -b feat/simplify-redesign
```

Run: `git branch --show-current`
Expected output: `feat/simplify-redesign`

---

## Task 2: Define design tokens

**Files:**
- Create: `src/shared/theme.ts`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Create the token module**

Create `src/shared/theme.ts`:

```ts
// Single source of truth for Electric Paper palette.
// Consumed directly by renderer components AND by tailwind.config.js.
export const COLORS = {
  paper: '#FAFAF5',
  ink: '#0A0A0A',
  'ink-60': 'rgba(10,10,10,0.6)',
  'ink-45': 'rgba(10,10,10,0.45)',
  'ink-08': 'rgba(10,10,10,0.08)',
  card: '#FFFFFF',
  volt: '#D4FF3D',
  'volt-muted': 'rgba(212,255,61,0.25)',
  danger: '#E84A3A',
  ok: '#16A34A',
} as const

export const RADIUS = {
  input: '10px',
  card: '14px',
  pill: '999px',
} as const

export const FONT = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  display:
    '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  mono: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
} as const
```

- [ ] **Step 2: Wire tokens into Tailwind**

Replace `tailwind.config.js`:

```js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { COLORS, RADIUS, FONT } = require('./src/shared/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        paper: COLORS.paper,
        ink: COLORS.ink,
        'ink-60': COLORS['ink-60'],
        'ink-45': COLORS['ink-45'],
        'ink-08': COLORS['ink-08'],
        card: COLORS.card,
        volt: COLORS.volt,
        'volt-muted': COLORS['volt-muted'],
        danger: COLORS.danger,
        ok: COLORS.ok,
      },
      borderRadius: {
        input: RADIUS.input,
        card: RADIUS.card,
        pill: RADIUS.pill,
      },
      fontFamily: {
        sans: [FONT.sans],
        display: [FONT.display],
        mono: [FONT.mono],
      },
    },
  },
  plugins: [],
}
```

Note: `theme.ts` is TypeScript but Tailwind config is CommonJS. The import above works because `require()` of a `.ts` file fails in Node — so we need `theme.ts` to also emit a CommonJS shape at runtime via electron-vite's build. Simpler: duplicate the palette in JS for the tailwind config only. Replace the first two lines of `tailwind.config.js` with the inline version:

```js
const COLORS = {
  paper: '#FAFAF5',
  ink: '#0A0A0A',
  'ink-60': 'rgba(10,10,10,0.6)',
  'ink-45': 'rgba(10,10,10,0.45)',
  'ink-08': 'rgba(10,10,10,0.08)',
  card: '#FFFFFF',
  volt: '#D4FF3D',
  'volt-muted': 'rgba(212,255,61,0.25)',
  danger: '#E84A3A',
  ok: '#16A34A',
}
const RADIUS = { input: '10px', card: '14px', pill: '999px' }
const FONT = {
  sans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  display: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
  mono: '"SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace',
}
```

Then the rest of the config from above is fine. `src/shared/theme.ts` stays — it's for runtime TS use. We accept the minor duplication because tailwind.config.js must be JS-loadable.

- [ ] **Step 3: Verify typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. If `tailwind.config.js` triggers an ESLint rule about `require`, suppress with `/* eslint-disable @typescript-eslint/no-require-imports */` at top — but with inline JS we don't need `require` anymore.

- [ ] **Step 4: Commit**

```bash
git add src/shared/theme.ts tailwind.config.js
git commit -m "feat(theme): introduce Electric Paper tokens"
```

---

## Task 3: Shared UI primitives

**Files:**
- Create: `src/renderer/shared/ui/Pill.tsx`
- Create: `src/renderer/shared/ui/Card.tsx`
- Create: `src/renderer/shared/ui/Toggle.tsx`

These are tiny stateless components reused across windows. Each renderer window bundles them via electron-vite (React chunks are per-window, so duplication across chunks is fine; the source stays DRY).

- [ ] **Step 1: Create `Pill.tsx`**

Create `src/renderer/shared/ui/Pill.tsx`:

```tsx
import { CSSProperties, ReactNode, MouseEvent } from 'react'

type Variant = 'primary' | 'secondary' | 'dark' | 'volt'

interface Props {
  children: ReactNode
  variant?: Variant
  onClick?: (e: MouseEvent) => void
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:opacity-90',
  secondary: 'bg-card text-ink border border-ink-08 hover:bg-paper',
  dark: 'bg-ink text-paper',
  volt: 'bg-volt text-ink hover:brightness-95',
}

export function Pill({
  children,
  variant = 'primary',
  onClick,
  className = '',
  style,
  disabled,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-medium disabled:opacity-50 transition ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Create `Card.tsx`**

Create `src/renderer/shared/ui/Card.tsx`:

```tsx
import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: Props) {
  return (
    <div className={`bg-card border border-ink-08 rounded-card overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

export function Row({ children, className = '' }: Props) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-ink-08 last:border-b-0 ${className}`}>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Create `Toggle.tsx`**

Create `src/renderer/shared/ui/Toggle.tsx`:

```tsx
interface Props {
  on: boolean
  onChange: (v: boolean) => void
}

export function Toggle({ on, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-[34px] h-5 rounded-pill transition ${on ? 'bg-ink' : 'bg-ink-08'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-all ${on ? 'left-[16px]' : 'left-0.5'}`}
      />
    </button>
  )
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/shared/ui/
git commit -m "feat(ui): Pill, Card, Toggle primitives"
```

---

## Task 4: Central error helper

**Files:**
- Create: `src/main/errors.ts`

- [ ] **Step 1: Create `errors.ts`**

Create `src/main/errors.ts`:

```ts
export type UserError = {
  code: 'NO_KEY' | 'NETWORK' | 'AUTH' | 'TRANSCRIBE_FAILED'
  userMessage: string
}

const NETWORK_HINTS = ['fetch failed', 'ENOTFOUND', 'ECONNREFUSED', 'getaddrinfo', 'ETIMEDOUT']
const AUTH_HINTS = ['401', 'Invalid API Key', 'invalid_api_key', 'Incorrect API key']

export function toUserError(err: unknown): UserError {
  const raw = err instanceof Error ? err.message : String(err)

  if (!raw || raw.toLowerCase().includes('no api key')) {
    return { code: 'NO_KEY', userMessage: 'Add your Groq key in Settings.' }
  }
  if (NETWORK_HINTS.some(h => raw.includes(h))) {
    return { code: 'NETWORK', userMessage: "Couldn't reach Groq. Check your connection." }
  }
  if (AUTH_HINTS.some(h => raw.includes(h))) {
    return { code: 'AUTH', userMessage: 'Groq key rejected. Update it in Settings.' }
  }
  return { code: 'TRANSCRIBE_FAILED', userMessage: 'Transcription failed. Open Settings for logs.' }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/main/errors.ts
git commit -m "feat(errors): toUserError helper"
```

---

## Task 5: Narrow the Provider type and drop local from constants/store

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/constants.ts`
- Modify: `src/main/store.ts`

- [ ] **Step 1: Narrow the `Provider` union**

Replace line 5 of `src/shared/types.ts`:

```ts
export type Provider = 'groq' | 'openai' | 'anthropic'
```

Also change `HotkeySettings` (lines 16–20) to the simplified shape:

```ts
export interface HotkeySettings {
  pushToTalk: string   // single-key name matching node-global-key-listener (e.g. "LEFT CTRL")
}
```

- [ ] **Step 2: Update `constants.ts`**

Replace the entire file with:

```ts
import type { AppCategory, Provider } from './types'

// Default hotkey is any Ctrl key (LEFT or RIGHT). Matcher in hotkeys.ts accepts both.
export const DEFAULT_HOTKEYS = {
  pushToTalk: 'CTRL',
}

// Thresholds for hold-to-talk + double-tap-lock interaction.
export const HOTKEY_TIMING = {
  holdThresholdMs: 150,
  dblTapWindowMs: 350,
}

export const APP_CATEGORY_MAP: Record<string, AppCategory> = {
  'com.tinyspeck.slackmacgap': 'messaging',
  'com.discord': 'messaging',
  'com.apple.MobileSMS': 'messaging',
  'ru.keepcoder.Telegram': 'messaging',
  'com.apple.mail': 'email',
  'com.microsoft.Outlook': 'email',
  'com.readdle.smartemail': 'email',
  'com.todesktop.230313mzl4w4u92': 'code',
  'com.microsoft.VSCode': 'code',
  'dev.zed.zed': 'code',
  'com.apple.dt.Xcode': 'code',
  'com.apple.Terminal': 'code',
  'com.googlecode.iterm2': 'code',
  'notion.id': 'docs',
  'md.obsidian': 'docs',
  'com.microsoft.Word': 'docs',
  'com.apple.iWork.Pages': 'docs',
}

export const DEFAULT_DEV_MODE_APPS = [
  'com.todesktop.230313mzl4w4u92',
  'com.microsoft.VSCode',
  'dev.zed.zed',
  'com.apple.dt.Xcode',
  'com.apple.Terminal',
  'com.googlecode.iterm2',
]

export const MODELS: Record<Provider, { transcription: string; cleanup: string }> = {
  groq: {
    transcription: 'whisper-large-v3-turbo',
    cleanup: 'llama-3.3-70b-versatile',
  },
  openai: {
    transcription: 'whisper-1',
    cleanup: 'gpt-4o-mini',
  },
  anthropic: {
    // No Anthropic transcription model — callers use Groq for transcription
    transcription: 'whisper-large-v3-turbo',
    cleanup: 'claude-3-haiku-20240307',
  },
}

export const HISTORY_LIMIT = 10
```

- [ ] **Step 3: Update `store.ts` defaults**

Replace `src/main/store.ts`:

```ts
import ElectronStore from 'electron-store'
import type { Settings } from '../shared/types'
import { DEFAULT_HOTKEYS, DEFAULT_DEV_MODE_APPS, MODELS } from '../shared/constants'

const defaults: Settings = {
  firstRun: true,
  provider: {
    provider: 'groq',
    groqKey: '',
    openaiKey: '',
    anthropicKey: '',
    transcriptionModel: MODELS.groq.transcription,
    cleanupModel: MODELS.groq.cleanup,
  },
  hotkeys: DEFAULT_HOTKEYS,
  perAppRules: [],
  devModeApps: DEFAULT_DEV_MODE_APPS,
  indicatorPosition: null,
}

export const store = new ElectronStore<Settings>({ defaults, name: 'yappr-settings' })

export function getSettings(): Settings {
  return store.store as Settings
}

export function setSettings(partial: Partial<Settings>): void {
  for (const [key, value] of Object.entries(partial)) {
    store.set(key, value)
  }
}
```

- [ ] **Step 4: Typecheck (will fail — that's expected)**

Run: `npm run typecheck`
Expected: errors in `pipeline.ts` (still references `local`), `hotkeys.ts` (old shape), `AIProviderTab.tsx`, and anywhere else still mentioning `commandMode`/`pasteLast` or the `local` provider. These will be fixed in subsequent tasks.

- [ ] **Step 5: Commit with `--no-verify` NOT allowed — instead commit only the type/constants/store files**

```bash
git add src/shared/types.ts src/shared/constants.ts src/main/store.ts
git commit -m "refactor(types): drop local provider and chord hotkey fields"
```

Note: the repo has no pre-commit hook (package.json shows none), so this commits cleanly even with typecheck broken. The next tasks clear the type errors.

---

## Task 6: Rewrite `hotkeys.ts` (hold-to-talk + double-tap)

**Files:**
- Rewrite: `src/main/hotkeys.ts`

- [ ] **Step 1: Replace file contents**

Replace `src/main/hotkeys.ts` entirely:

```ts
import { GlobalKeyboardListener } from 'node-global-key-listener'
import { HOTKEY_TIMING } from '../shared/constants'

type Callbacks = {
  onStart: () => void
  onStop: () => void
}

// Module-level state. Only one hotkey active at a time.
let listener: GlobalKeyboardListener | null = null
let currentKey: string | null = null
let callbacks: Callbacks | null = null

// Interaction state machine state
let pressedAt = 0         // timestamp of current keydown, 0 if not pressed
let lastTapAt = 0         // timestamp of last short tap (for double-tap detection)
let locked = false        // true after a double-tap until next press releases it
let active = false        // true while a recording session is in progress (start fired, stop not yet)

// Map the user-facing key name to the set of node-global-key-listener key names
// that should match. "CTRL" matches either LEFT or RIGHT control.
function keyMatches(saved: string, eventName: string): boolean {
  if (!saved) return false
  const norm = saved.trim().toUpperCase()
  if (norm === 'CTRL') return eventName === 'LEFT CTRL' || eventName === 'RIGHT CTRL'
  if (norm === 'ALT' || norm === 'OPTION') return eventName === 'LEFT ALT' || eventName === 'RIGHT ALT'
  if (norm === 'SHIFT') return eventName === 'LEFT SHIFT' || eventName === 'RIGHT SHIFT'
  if (norm === 'META' || norm === 'COMMAND' || norm === 'CMD') return eventName === 'LEFT META' || eventName === 'RIGHT META'
  return eventName === norm
}

function fireStart(): void {
  if (active) return
  active = true
  callbacks?.onStart()
}

function fireStop(): void {
  if (!active) return
  active = false
  callbacks?.onStop()
}

export function registerHotkey(key: string, cbs: Callbacks): void {
  unregisterAll()
  currentKey = key
  callbacks = cbs

  listener = new GlobalKeyboardListener()

  listener.addListener((e) => {
    if (!currentKey || !callbacks) return
    if (!keyMatches(currentKey, e.name ?? '')) return

    const now = Date.now()

    if (e.state === 'DOWN') {
      // Ignore auto-repeat: OS fires DOWN repeatedly while held.
      if (pressedAt !== 0) return
      pressedAt = now

      // Locked mode: pressing while locked ends the session.
      if (locked) {
        locked = false
        fireStop()
        return
      }

      // Double-tap detection: two DOWN events within window => enter lock.
      if (lastTapAt !== 0 && now - lastTapAt <= HOTKEY_TIMING.dblTapWindowMs) {
        lastTapAt = 0
        locked = true
        // If we weren't already recording (tap was too short to cross holdThreshold), start now.
        fireStart()
        return
      }

      // Normal hold: start recording. (We start on DOWN immediately for
      // responsiveness; the holdThreshold gate only matters on UP.)
      fireStart()
    } else if (e.state === 'UP') {
      if (pressedAt === 0) return
      const held = now - pressedAt
      pressedAt = 0

      if (locked) {
        // Stay active. UP during a locked session is ignored.
        return
      }

      if (held < HOTKEY_TIMING.holdThresholdMs) {
        // Short press: discard this recording attempt and remember the tap
        // for possible double-tap.
        lastTapAt = now
        // Cancel the start we fired on DOWN by firing stop — but the pipeline
        // will naturally no-op on empty audio (main/index.ts already guards
        // `audioBuffer.length < 500`).
        fireStop()
        return
      }

      // Real hold: fire stop.
      lastTapAt = 0
      fireStop()
    }
  })
}

export function unregisterHotkey(): void {
  if (listener) {
    listener.kill()
    listener = null
  }
  currentKey = null
  callbacks = null
  pressedAt = 0
  lastTapAt = 0
  locked = false
  active = false
}

export function unregisterAll(): void {
  unregisterHotkey()
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: `hotkeys.ts` now passes. `pipeline.ts`, `main/index.ts`, renderer files still fail — fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/main/hotkeys.ts
git commit -m "feat(hotkeys): hold-to-talk + double-tap lock via key-listener"
```

---

## Task 7: Delete local Whisper provider and update pipeline

**Files:**
- Delete: `src/main/providers/local-whisper.ts`
- Modify: `src/main/pipeline.ts`

- [ ] **Step 1: Delete the file**

```bash
git rm src/main/providers/local-whisper.ts
```

- [ ] **Step 2: Rewrite `pipeline.ts`**

Replace `src/main/pipeline.ts`:

```ts
import { buildCleanupPrompt } from '../shared/prompts'
import { MODELS } from '../shared/constants'
import type { DictationResult, Settings } from '../shared/types'
import type { TranscriptionProvider, CleanupProvider } from './providers/types'
import {
  createGroqTranscriptionProvider,
  createGroqCleanupProvider,
} from './providers/groq'
import {
  createOpenAITranscriptionProvider,
  createOpenAICleanupProvider,
} from './providers/openai'
import { createAnthropicCleanupProvider } from './providers/anthropic'
import { getFocusedApp } from './focused-app'
import { pasteText } from './paste'

function buildProviders(
  settings: Settings
): { transcription: TranscriptionProvider; cleanup: CleanupProvider } {
  const { provider, groqKey, openaiKey, anthropicKey, transcriptionModel, cleanupModel } =
    settings.provider

  if (provider === 'groq') {
    return {
      transcription: createGroqTranscriptionProvider(groqKey, transcriptionModel),
      cleanup: createGroqCleanupProvider(groqKey, cleanupModel),
    }
  }

  if (provider === 'openai') {
    return {
      transcription: createOpenAITranscriptionProvider(openaiKey, transcriptionModel),
      cleanup: createOpenAICleanupProvider(openaiKey, cleanupModel),
    }
  }

  // anthropic: use Groq for transcription, Anthropic for cleanup
  return {
    transcription: createGroqTranscriptionProvider(groqKey, MODELS.groq.transcription),
    cleanup: createAnthropicCleanupProvider(anthropicKey, cleanupModel),
  }
}

export async function runDictationPipeline(
  audioBuffer: Buffer,
  settings: Settings,
  onState: (state: 'processing' | 'done' | 'error') => void
): Promise<DictationResult & { pasteMethod: 'paste' | 'clipboard' }> {
  onState('processing')

  const focusedApp = await getFocusedApp()
  const { transcription, cleanup } = buildProviders(settings)

  const category = settings.devModeApps.includes(focusedApp.bundleId)
    ? ('code' as const)
    : focusedApp.category

  const transcript = await transcription.transcribe(audioBuffer, { dictionary: [] })

  const rule = settings.perAppRules.find(r => r.bundleId === focusedApp.bundleId)
  const effectiveCategory = rule?.category ?? category
  const systemPrompt = buildCleanupPrompt(effectiveCategory, focusedApp.name, rule?.customPrompt)
    .replace('{text}', transcript)

  const cleaned = await cleanup.cleanup(transcript, {
    appName: focusedApp.name,
    appCategory: effectiveCategory,
    systemPrompt,
  })

  const { method: pasteMethod } = await pasteText(cleaned)

  onState('done')

  return {
    id: crypto.randomUUID(),
    transcript,
    cleaned,
    appName: focusedApp.name,
    appCategory: effectiveCategory,
    timestamp: Date.now(),
    pasteMethod,
  }
}

export async function runCommandPipeline(
  audioBuffer: Buffer,
  selectedText: string,
  settings: Settings
): Promise<string> {
  const { transcription, cleanup } = buildProviders(settings)
  const focusedApp = await getFocusedApp()

  const command = await transcription.transcribe(audioBuffer, { dictionary: [] })

  const systemPrompt = `You are a text editing assistant. The user has selected the following text and dictated an editing command.

Selected text:
${selectedText}

Editing command: ${command}

Apply the command to the selected text and return ONLY the modified text, nothing else.`

  const result = await cleanup.cleanup(command, {
    appName: focusedApp.name,
    appCategory: focusedApp.category,
    systemPrompt,
  })

  return result
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: `pipeline.ts` passes. `main/index.ts` + renderer files still fail.

- [ ] **Step 4: Commit**

```bash
git add src/main/pipeline.ts src/main/providers/local-whisper.ts
git commit -m "refactor(pipeline): drop local-whisper branch"
```

---

## Task 8: Rewire `main/index.ts` for hold-to-talk + user errors

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Replace the file**

Replace `src/main/index.ts`:

```ts
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} from 'electron'
import { join } from 'path'
import { registerIpcHandlers, addToHistory, getHistory } from './ipc'
import { registerHotkey, unregisterAll } from './hotkeys'
import { getSettings, setSettings } from './store'
import { runDictationPipeline } from './pipeline'
import { pasteText } from './paste'
import { toUserError } from './errors'
import { IPC } from '../shared/types'

let indicatorWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let onboardingWindow: BrowserWindow | null = null
let tray: Tray | null = null

const audioChunks: Buffer[] = []

function createIndicatorWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const savedPos = getSettings().indicatorPosition
  const x = savedPos?.x ?? Math.round(width / 2 - 140)
  const y = savedPos?.y ?? height - 100

  const win = new BrowserWindow({
    width: 280,
    height: 80,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/indicator.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setIgnoreMouseEvents(true, { forward: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/indicator/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/indicator/index.html'))
  }

  return win
}

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  const win = new BrowserWindow({
    width: 720,
    height: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAFAF5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => { settingsWindow = null })
  settingsWindow = win
  return win
}

function createOnboardingWindow(): BrowserWindow {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.focus()
    return onboardingWindow
  }

  const win = new BrowserWindow({
    width: 560,
    height: 540,
    resizable: false,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#FAFAF5',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/onboarding/index.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/onboarding/index.html'))
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    setSettings({ firstRun: false })
    onboardingWindow = null
  })
  onboardingWindow = win
  return win
}

function updateTrayMenu(): void {
  if (!tray) return

  const history = getHistory()
  const historyItems: Electron.MenuItemConstructorOptions[] = history.slice(0, 5).map(item => ({
    label: item.cleaned.length > 50 ? item.cleaned.slice(0, 50) + '…' : item.cleaned,
    click: () => pasteText(item.cleaned),
  }))

  const menu = Menu.buildFromTemplate([
    { label: 'Yappr', enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: () => createSettingsWindow() },
    { type: 'separator' },
    ...(historyItems.length > 0
      ? [{ label: 'Recent Dictations', enabled: false } as Electron.MenuItemConstructorOptions, ...historyItems]
      : [{ label: 'No dictations yet', enabled: false } as Electron.MenuItemConstructorOptions]),
    { type: 'separator' },
    { label: 'Quit Yappr', role: 'quit' },
  ])

  tray.setContextMenu(menu)
}

function setupTray(): void {
  const iconPath = join(__dirname, '../../assets/tray.png')
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Yappr')
  tray.on('click', () => createSettingsWindow())
  updateTrayMenu()
}

function broadcastState(state: string): void {
  indicatorWindow?.webContents.send(IPC.STATE_CHANGE, state)
}

function setupHotkeys(): void {
  const settings = getSettings()
  unregisterAll()

  registerHotkey(settings.hotkeys.pushToTalk, {
    onStart: () => {
      audioChunks.length = 0
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.showInactive()
      broadcastState('recording')
    },
    onStop: () => {
      // Renderer transitions recording → stopping → (flush) → sends AUDIO_DONE
      broadcastState('stopping')
    },
  })
}

function setupAudioIpc(): void {
  ipcMain.on(IPC.AUDIO_CHUNK, (_e, chunk: ArrayBuffer) => {
    audioChunks.push(Buffer.from(chunk))
  })

  ipcMain.on(IPC.AUDIO_DONE, async () => {
    const audioBuffer = Buffer.concat(audioChunks)
    audioChunks.length = 0

    if (audioBuffer.length < 500) {
      broadcastState('idle')
      indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
      indicatorWindow?.hide()
      return
    }

    try {
      const result = await runDictationPipeline(
        audioBuffer,
        getSettings(),
        (s) => broadcastState(s)
      )

      addToHistory(result)
      updateTrayMenu()

      broadcastState(result.pasteMethod === 'clipboard' ? 'clipboard' : 'done')

      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 1500)
    } catch (err) {
      const { userMessage } = toUserError(err)
      console.error('[Yappr] Pipeline error:', err)
      broadcastState(`error:${userMessage}`)
      setTimeout(() => {
        broadcastState('idle')
        indicatorWindow?.setIgnoreMouseEvents(true, { forward: true })
        indicatorWindow?.hide()
      }, 4000)
    }
  })
}

function setupIpcListeners(): void {
  ipcMain.on(IPC.OPEN_SETTINGS, () => createSettingsWindow())
  ipcMain.on(IPC.OPEN_ONBOARDING, () => createOnboardingWindow())
  ipcMain.on(IPC.HOTKEYS_RELOAD, () => setupHotkeys())
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide()
  }

  registerIpcHandlers()
  setupAudioIpc()
  setupIpcListeners()

  indicatorWindow = createIndicatorWindow()
  setupTray()
  setupHotkeys()

  const settings = getSettings()
  if (settings.firstRun) {
    createOnboardingWindow()
  }
})

app.on('window-all-closed', () => {
  // Intentionally empty — app lives in tray
})
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: `main/index.ts` now passes. Renderer files still fail.

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat(main): wire onStart/onStop hotkey + user errors"
```

---

## Task 9: Redesign the Indicator

**Files:**
- Modify: `src/renderer/indicator/Indicator.tsx`
- Modify: `src/renderer/indicator/index.html`

- [ ] **Step 1: Update `index.html`**

The body must stay transparent (the pill floats). No change needed except verifying:

Read the current file — if `background:transparent` is already set (it is), leave the file alone.

- [ ] **Step 2: Replace `Indicator.tsx`**

Replace `src/renderer/indicator/Indicator.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

type IndicatorState =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'processing'
  | 'done'
  | 'clipboard'
  | 'error'

declare global {
  interface Window {
    indicator: {
      onStateChange: (cb: (state: string) => void) => () => void
      sendAudioChunk: (chunk: ArrayBuffer) => void
      sendAudioDone: () => void
    }
  }
}

export default function Indicator() {
  const [state, setState] = useState<IndicatorState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [waveform, setWaveform] = useState<number[]>(Array(6).fill(0))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const unsub = window.indicator.onStateChange((s) => {
      if (s.startsWith('error:')) {
        setErrorMsg(s.slice(6))
        setState('error')
        return
      }
      const next = s as IndicatorState
      setState(next)
      if (next === 'recording') startRecording()
      else if (next === 'stopping') stopRecording()
    })
    return unsub
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      const pendingChunks: Promise<void>[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const p = e.data.arrayBuffer().then((buf) => window.indicator.sendAudioChunk(buf))
          pendingChunks.push(p)
        }
      }

      recorder.onstop = async () => {
        await Promise.all(pendingChunks)
        window.indicator.sendAudioDone()
        stream.getTracks().forEach((t) => t.stop())
        audioContextRef.current?.close()
        audioContextRef.current = null
      }

      recorder.start(100)

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const bars = Array.from({ length: 6 }, (_, i) => {
          const idx = Math.floor((i / 6) * data.length)
          return Math.round((data[idx] / 255) * 100)
        })
        setWaveform(bars)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (err) {
      console.error('[Indicator] Mic error:', err)
    }
  }

  function stopRecording() {
    cancelAnimationFrame(animFrameRef.current)
    setWaveform(Array(6).fill(0))
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    mediaRecorderRef.current = null
  }

  if (state === 'idle') return null

  return (
    <div className="flex items-center justify-center w-full h-full font-sans">
      <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-pill bg-ink text-paper shadow-2xl">
        {(state === 'recording' || state === 'stopping') && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0" />
            <div className="flex items-end gap-[2px] h-[14px]">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-volt rounded-[2px] transition-all duration-75"
                  style={{ height: `${Math.max(3, v * 0.14)}px` }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-widest text-paper/50 ml-1">HOLD</span>
          </>
        )}
        {state === 'processing' && (
          <>
            <span className="w-3 h-3 rounded-full border-[1.5px] border-paper/20 border-t-volt animate-spin shrink-0" />
            <span className="font-mono text-[10.5px] tracking-wide">Transcribing</span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <span className="font-mono text-[10.5px] text-volt font-medium">
            {state === 'clipboard' ? '✓ Copied — ⌘V to paste' : '✓ Pasted'}
          </span>
        )}
        {state === 'error' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
            <span className="font-mono text-[10.5px]">{errorMsg || 'Transcription failed'}</span>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: Indicator file passes.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/indicator/
git commit -m "feat(indicator): Electric Paper redesign + new state set"
```

---

## Task 10: Redesign Settings shell + HotkeysTab

**Files:**
- Modify: `src/renderer/settings/SettingsApp.tsx`
- Modify: `src/renderer/settings/tabs/HotkeysTab.tsx`

- [ ] **Step 1: Replace `SettingsApp.tsx`**

Replace the file:

```tsx
import { useState } from 'react'
import GeneralTab from './tabs/GeneralTab'
import HotkeysTab from './tabs/HotkeysTab'
import AIProviderTab from './tabs/AIProviderTab'
import PerAppRulesTab from './tabs/PerAppRulesTab'
import AboutTab from './tabs/AboutTab'

const TABS = ['General', 'Provider', 'Hotkey', 'Per-App Rules', 'About'] as const
type Tab = typeof TABS[number]

const TITLES: Record<Tab, { title: string; italic: string; sub: string }> = {
  General:        { title: 'Your',      italic: 'preferences.', sub: 'How Yappr should behave' },
  Provider:       { title: 'Your',      italic: 'provider.',    sub: 'Transcription + cleanup service' },
  Hotkey:         { title: 'Your',      italic: 'hotkey.',      sub: 'Hold to talk · double-tap to lock' },
  'Per-App Rules':{ title: 'App',       italic: 'rules.',       sub: 'Per-app cleanup overrides' },
  About:          { title: 'About',     italic: 'Yappr.',    sub: 'Version & diagnostics' },
}

export default function SettingsApp() {
  const [tab, setTab] = useState<Tab>('Provider')
  const titleInfo = TITLES[tab]

  return (
    <div className="flex h-screen bg-paper text-ink select-none font-sans">
      <aside className="w-[180px] bg-[#F2F0E8] border-r border-ink-08 pt-10 px-3 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-2 pb-4 mb-3 border-b border-ink-08">
          <div className="w-5 h-5 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[10px] font-bold">O</div>
          <span className="text-[13px] font-semibold tracking-tight">Yappr</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {TABS.map((t) => {
            const on = tab === t
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`text-left px-2.5 py-2 rounded-[8px] text-[12.5px] transition ${
                  on ? 'bg-ink text-paper' : 'text-ink-60 hover:bg-ink-08'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-volt' : 'bg-ink/30'}`} />
                  {t}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto px-7 py-7">
        <h1 className="text-[30px] leading-none tracking-tight">
          {titleInfo.title}{' '}
          <span className="font-display italic font-medium">{titleInfo.italic}</span>
        </h1>
        <p className="text-[11.5px] text-ink-45 mt-1 mb-5">{titleInfo.sub}</p>

        {tab === 'General' && <GeneralTab />}
        {tab === 'Hotkey' && <HotkeysTab />}
        {tab === 'Provider' && <AIProviderTab />}
        {tab === 'Per-App Rules' && <PerAppRulesTab />}
        {tab === 'About' && <AboutTab />}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Replace `HotkeysTab.tsx`**

Replace with the single-key version. `node-global-key-listener` key names are UPPERCASE strings like `LEFT CTRL`, `RIGHT ALT`. The tab listens for a raw browser keydown and translates to that shape.

```tsx
import { useEffect, useState } from 'react'
import type { Settings } from '../../../shared/types'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

// Map a browser KeyboardEvent.code to the node-global-key-listener canonical name.
// We only accept modifier keys or function/letter keys — NOT chords.
function eventToKeyName(e: KeyboardEvent): string | null {
  const code = e.code
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL'
  if (code === 'AltLeft' || code === 'AltRight') return 'ALT'
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT'
  if (code === 'MetaLeft' || code === 'MetaRight') return 'META'
  // Letters, digits, F-keys — use .key (uppercased)
  if (e.key.length === 1) return e.key.toUpperCase()
  if (/^F\d{1,2}$/.test(e.key)) return e.key.toUpperCase()
  return null
}

function prettify(name: string): string {
  if (name === 'CTRL') return '⌃ Ctrl'
  if (name === 'ALT') return '⌥ Option'
  if (name === 'SHIFT') return '⇧ Shift'
  if (name === 'META') return '⌘ Command'
  return name
}

export default function HotkeysTab() {
  const [hotkeys, setHotkeys] = useState<Settings['hotkeys'] | null>(null)
  const [listening, setListening] = useState(false)

  useEffect(() => {
    window.yappr.getSettings().then(s => setHotkeys(s.hotkeys))
  }, [])

  useEffect(() => {
    if (!listening) return
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault()
      const name = eventToKeyName(e)
      if (!name) return
      setHotkeys(prev => {
        if (!prev) return prev
        const updated = { ...prev, pushToTalk: name }
        window.yappr.setSettings({ hotkeys: updated }).then(() => {
          window.yappr.reloadHotkeys()
        })
        return updated
      })
      setListening(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [listening])

  if (!hotkeys) return <div className="text-ink-45 text-sm">Loading…</div>

  return (
    <div className="max-w-md space-y-3">
      <Card>
        <Row>
          <div className="flex-1">
            <div className="text-[12.5px] font-medium">Push-to-talk</div>
            <div className="text-[10.5px] text-ink-45 mt-0.5">
              Hold to talk. Double-tap to lock recording on.
            </div>
          </div>
          <Pill
            variant={listening ? 'volt' : 'secondary'}
            onClick={() => setListening(l => !l)}
          >
            <span className="font-mono text-[11px]">
              {listening ? 'Press any key…' : prettify(hotkeys.pushToTalk)}
            </span>
          </Pill>
        </Row>
      </Card>
      {listening && (
        <button
          onClick={() => setListening(false)}
          className="text-ink-45 text-xs hover:text-ink"
        >
          Cancel
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: Settings shell + HotkeysTab pass. AIProviderTab, GeneralTab, AboutTab, PerAppRulesTab likely still fail (old color classes reference `white/*`, and AIProviderTab still has `local`).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/settings/SettingsApp.tsx src/renderer/settings/tabs/HotkeysTab.tsx
git commit -m "feat(settings): Electric Paper shell + simplified hotkey picker"
```

---

## Task 11: Redesign AIProviderTab (drop local)

**Files:**
- Modify: `src/renderer/settings/tabs/AIProviderTab.tsx`

- [ ] **Step 1: Replace file**

Replace `src/renderer/settings/tabs/AIProviderTab.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Settings, Provider } from '../../../shared/types'
import { MODELS } from '../../../shared/constants'
import { Card, Row } from '../../shared/ui/Card'
import { Pill } from '../../shared/ui/Pill'

declare global {
  interface Window {
    yappr: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      openAccessibilitySettings: () => Promise<void>
      reloadHotkeys: () => void
      onStateChange: (cb: (state: string) => void) => () => void
    }
  }
}

const PROVIDER_OPTIONS: { value: Provider; label: string; hint: string }[] = [
  { value: 'groq',      label: 'Groq · Whisper',        hint: 'Recommended — fast & free tier' },
  { value: 'openai',    label: 'OpenAI',                hint: 'Whisper + GPT-4o-mini cleanup' },
  { value: 'anthropic', label: 'Anthropic (+ Groq key)',hint: 'Claude cleanup, Groq transcription' },
]

export default function AIProviderTab() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  useEffect(() => {
    window.yappr.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="text-ink-45 text-sm">Loading…</div>

  const { provider } = settings.provider

  async function save(partial: Partial<Settings['provider']>) {
    if (!settings) return
    const updated = { ...settings.provider, ...partial }
    await window.yappr.setSettings({ provider: updated })
    setSettings({ ...settings, provider: updated })
    setTestResult(null)
  }

  async function testKey() {
    if (!settings) return
    setTesting(true)
    setTestResult(null)
    const key =
      provider === 'groq' ? settings.provider.groqKey
      : provider === 'openai' ? settings.provider.openaiKey
      : settings.provider.anthropicKey
    const result = await window.yappr.testProvider(provider, key)
    setTestResult(result)
    setTesting(false)
  }

  const needsGroqKey = provider === 'groq' || provider === 'anthropic'

  return (
    <div className="max-w-md space-y-3">
      <Card>
        {PROVIDER_OPTIONS.map((opt, i) => {
          const on = opt.value === provider
          return (
            <Row key={opt.value} className={i === PROVIDER_OPTIONS.length - 1 ? '' : ''}>
              <button
                onClick={() => save({
                  provider: opt.value,
                  transcriptionModel: MODELS[opt.value].transcription,
                  cleanupModel: MODELS[opt.value].cleanup,
                })}
                className="flex items-center gap-3 w-full text-left"
              >
                <span className={`w-4 h-4 rounded-full border ${on ? 'border-ink bg-ink' : 'border-ink-08'} flex items-center justify-center`}>
                  {on && <span className="w-1.5 h-1.5 rounded-full bg-volt" />}
                </span>
                <span className="flex-1">
                  <div className="text-[12.5px] font-medium">{opt.label}</div>
                  <div className="text-[10.5px] text-ink-45 mt-0.5">{opt.hint}</div>
                </span>
              </button>
            </Row>
          )
        })}
      </Card>

      {needsGroqKey && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Groq API Key
              </div>
              <input
                type="password"
                value={settings.provider.groqKey}
                onChange={(e) => save({ groqKey: e.target.value })}
                placeholder="gsk_…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-ink"
              />
              <a
                onClick={() => window.open('https://console.groq.com', '_blank')}
                className="text-[11px] text-ink-45 hover:text-ink mt-2 inline-block cursor-pointer"
              >
                Get a free Groq key ↗
              </a>
            </div>
          </Row>
        </Card>
      )}

      {provider === 'openai' && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                OpenAI API Key
              </div>
              <input
                type="password"
                value={settings.provider.openaiKey}
                onChange={(e) => save({ openaiKey: e.target.value })}
                placeholder="sk-…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-ink"
              />
            </div>
          </Row>
        </Card>
      )}

      {provider === 'anthropic' && (
        <Card>
          <Row>
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Anthropic API Key
              </div>
              <input
                type="password"
                value={settings.provider.anthropicKey}
                onChange={(e) => save({ anthropicKey: e.target.value })}
                placeholder="sk-ant-…"
                className="w-full bg-paper border border-ink-08 rounded-input px-3 py-2 text-[12.5px] font-mono focus:outline-none focus:border-ink"
              />
            </div>
          </Row>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Pill variant="primary" onClick={testKey} disabled={testing}>
          {testing ? 'Testing…' : 'Test connection'}
        </Pill>
        {testResult && (
          <span className={`text-[12px] ${testResult.ok ? 'text-ok' : 'text-danger'}`}>
            {testResult.ok ? '✓ Connected' : `✗ ${testResult.error}`}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: this file passes. GeneralTab/AboutTab/PerAppRulesTab might still fail on old `white/*` Tailwind classes — those classes are still valid Tailwind utilities (they exist out of the box), so typecheck won't complain about colors. If anything fails, it's just the `Provider` union narrowing — fix by removing any `'local'` references.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/settings/tabs/AIProviderTab.tsx
git commit -m "feat(settings): AIProviderTab redesign, drop local provider"
```

---

## Task 12: Repaint remaining settings tabs to paper palette

**Files:**
- Modify: `src/renderer/settings/tabs/GeneralTab.tsx`
- Modify: `src/renderer/settings/tabs/AboutTab.tsx`
- Modify: `src/renderer/settings/tabs/PerAppRulesTab.tsx`

No functional change — swap the dark-mode color tokens for paper tokens so these tabs don't look like a different app. Read each file first, then do targeted edits.

- [ ] **Step 1: Read the three files to find color classes**

Run these to see what needs changing:
```bash
grep -n 'white/\|bg-\[#1c1c1e\]\|text-white\|border-white' src/renderer/settings/tabs/GeneralTab.tsx src/renderer/settings/tabs/AboutTab.tsx src/renderer/settings/tabs/PerAppRulesTab.tsx
```

- [ ] **Step 2: Apply substitutions in each file**

For each occurrence, apply these mappings (use the Edit tool per file, not global sed):

| Old class                    | New class                |
|------------------------------|---------------------------|
| `text-white`                 | `text-ink`                |
| `text-white/70`              | `text-ink-60`             |
| `text-white/60`              | `text-ink-60`             |
| `text-white/50`              | `text-ink-45`             |
| `text-white/40`              | `text-ink-45`             |
| `text-white/30`              | `text-ink-45`             |
| `bg-white/10`                | `bg-ink-08`               |
| `bg-white/20`                | `bg-ink-08`               |
| `border-white/10`            | `border-ink-08`           |
| `border-white/20`            | `border-ink-08`           |
| `bg-blue-600` / `bg-blue-500`| `bg-ink`                  |
| `bg-[#1c1c1e]`               | `bg-paper`                |

If any file has `hover:bg-white/20`, change to `hover:bg-ink-08` (already covered above, just noted for clarity).

- [ ] **Step 3: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass. If lint complains about unused imports (e.g. a removed helper), remove them.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/settings/tabs/GeneralTab.tsx src/renderer/settings/tabs/AboutTab.tsx src/renderer/settings/tabs/PerAppRulesTab.tsx
git commit -m "style(settings): repaint remaining tabs to paper palette"
```

---

## Task 13: Redesign Onboarding

**Files:**
- Modify: `src/renderer/onboarding/OnboardingApp.tsx`

- [ ] **Step 1: Replace file**

Replace `src/renderer/onboarding/OnboardingApp.tsx`:

```tsx
import { useState } from 'react'
import type { Settings } from '../../shared/types'
import { MODELS } from '../../shared/constants'
import { Pill } from '../shared/ui/Pill'

declare global {
  interface Window {
    yappr: {
      getSettings: () => Promise<Settings>
      setSettings: (p: Partial<Settings>) => Promise<void>
      testProvider: (provider: string, key: string) => Promise<{ ok: boolean; error?: string }>
      getHistory: () => Promise<unknown>
      requestMicPermission: () => Promise<boolean>
      openAccessibilitySettings: () => Promise<void>
      reloadHotkeys: () => void
      onStateChange: (cb: (state: string) => void) => () => void
    }
  }
}

type Step = 1 | 2 | 3

export default function OnboardingApp() {
  const [step, setStep] = useState<Step>(1)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleGrantPermissions() {
    await window.yappr.requestMicPermission()
    await window.yappr.openAccessibilitySettings()
    setStep(2)
  }

  async function handleSaveKey() {
    setSaving(true)
    await window.yappr.setSettings({
      provider: {
        provider: 'groq',
        groqKey: apiKey.trim(),
        openaiKey: '',
        anthropicKey: '',
        transcriptionModel: MODELS.groq.transcription,
        cleanupModel: MODELS.groq.cleanup,
      },
    })
    setSaving(false)
    setStep(3)
  }

  async function handleFinish() {
    await window.yappr.setSettings({ firstRun: false })
    window.close()
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col">
      <header className="px-5 pt-5">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-pill bg-card border border-ink-08 shadow-sm">
          <div className="w-5 h-5 rounded-[6px] bg-ink text-paper flex items-center justify-center text-[10px] font-bold">O</div>
          <span className="text-[13px] font-semibold tracking-tight">Yappr</span>
          <span className="font-mono text-[10.5px] text-ink-45 ml-2">0{step} / 03</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col justify-center px-10 pb-10">
        {step === 1 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Grant <span className="font-display italic font-medium">access.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[360px] mb-7">
              Yappr needs your microphone to hear you, and Accessibility so it can paste text into the focused app.
            </p>
            <div className="flex items-center gap-3">
              <Pill variant="primary" onClick={handleGrantPermissions}>
                Grant access <span>→</span>
              </Pill>
              <button onClick={() => setStep(2)} className="text-[12px] text-ink-45 hover:text-ink">
                Skip
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Connect your <span className="font-display italic font-medium">key.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[360px] mb-5">
              Paste your Groq key. Free tier works for most people — heavy use runs about $1–3/month.
            </p>
            <div className="max-w-[380px] mb-5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-45 mb-1.5">
                Groq API Key
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_…"
                className="w-full bg-card border border-ink-08 rounded-input px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-ink"
              />
              <a
                onClick={() => window.open('https://console.groq.com', '_blank')}
                className="text-[11px] text-ink-45 hover:text-ink mt-2 inline-block cursor-pointer"
              >
                Get a free key at console.groq.com ↗
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Pill
                variant="primary"
                onClick={handleSaveKey}
                disabled={saving || !apiKey.trim()}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </Pill>
              <button onClick={() => setStep(3)} className="text-[12px] text-ink-45 hover:text-ink">
                Skip for now
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-[42px] leading-[0.98] tracking-tight mb-4">
              Start <span className="font-display italic font-medium">speaking.</span>
            </h1>
            <p className="text-[13.5px] text-ink-60 leading-relaxed max-w-[380px] mb-7">
              Hold <kbd className="font-mono text-[12px] bg-card border border-ink-08 px-1.5 py-0.5 rounded">⌃ Ctrl</kbd> anywhere and speak. Release to paste. Double-tap to lock on.
            </p>
            <div>
              <Pill variant="primary" onClick={handleFinish}>
                Start using Yappr
              </Pill>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/onboarding/OnboardingApp.tsx
git commit -m "feat(onboarding): 3-step Electric Paper redesign"
```

---

## Task 14: Drop unused heavy deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove `@xenova/transformers` and `ffmpeg-static`**

Edit `package.json`'s `"dependencies"` block — delete these two lines:

```
"@xenova/transformers": "^2.17.2",
"ffmpeg-static": "^5.3.0",
```

- [ ] **Step 2: Reinstall**

Run: `npm install`
Expected: completes without error. `package-lock.json` updates.

- [ ] **Step 3: Confirm nothing imports them**

Run: `grep -rn '@xenova/transformers\|ffmpeg-static' src/`
Expected: no matches. (If any remain — unlikely since `local-whisper.ts` is deleted — remove those imports too.)

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both exit 0. `out/` populated.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop @xenova/transformers and ffmpeg-static"
```

---

## Task 15: Manual QA and final commit

No automated tests exist for this app; verification is a live run.

- [ ] **Step 1: Launch in dev mode**

Run: `npm run dev`
Expected: electron-vite starts, three renderer builds succeed, the indicator and onboarding windows appear (onboarding only on first run — use `~/Library/Application\ Support/yappr-settings/config.json` and set `firstRun: true` to retrigger if needed).

- [ ] **Step 2: Smoke-test the hotkey**

1. Open any text field (Notes, TextEdit).
2. Hold **Ctrl** for ~1 second while saying "hello world." Release.
3. Expected: indicator transitions `recording` → `stopping` → `processing` (Transcribing) → `done` (✓ Pasted), and "Hello, world." appears in the field.
4. Tap **Ctrl** twice within 350ms — indicator should show `recording` and *stay* (no UP transition).
5. Press **Ctrl** once more — indicator transitions to `processing` and pastes.

- [ ] **Step 3: Smoke-test error paths**

1. In Settings → Provider, clear the Groq key. Trigger a hold-to-talk.
2. Expected: indicator shows a red-accent pill with `"Add your Groq key in Settings."` — no stderr text, no stack trace.
3. Re-enter the key. Trigger again — works.

- [ ] **Step 4: Visual sanity check**

Verify all three windows render in paper palette: cream bg, black pills, volt-green accents. No leftover dark/blue tones.

- [ ] **Step 5: Final typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 6: Commit any cleanup from QA**

If QA surfaced small fixes, commit them with focused messages. Otherwise this step is a no-op.

---

## Self-review notes

- **Spec coverage:** All 4 scope sections from the spec are covered — §1 (drop local) by Tasks 5/7/11/14; §2 (hold-to-talk) by Tasks 5/6/8/10; §3 (redesign) by Tasks 2/3/9/10/11/12/13; §4 (errors) by Tasks 4/8.
- **No placeholders:** Every step has code or exact commands. No "TBD", "similar to", or "handle edge cases" without specifics.
- **Type consistency:** `registerHotkey(key, { onStart, onStop })` signature is consistent between Task 6 (definition) and Task 8 (call site). `HotkeySettings.pushToTalk` as a single string is consistent across Tasks 5, 6, 8, 10.
- **Order dependency:** Tasks 5/7 break typecheck mid-flight — this is noted explicitly in their "Expected" output and the next task restores the build. Each task's commit is small and focused even when the tree is briefly in a type-broken state.
