# Yappr

**Voice dictation for macOS. Bring your own API key.**

> Press and hold a hotkey, speak, release — your cleaned-up text appears wherever your cursor is. No subscription. No account. No screenshots.

---

## Features

- **Push-to-talk** — hold Right Option (⌥) anywhere in the OS, speak, release. Done.
- **Context-aware cleanup** — detects Slack, Gmail, VS Code, Notion and adjusts tone automatically
- **Command mode** — highlight text, hold ⌘⇧Space, dictate an edit ("make this a bullet list")
- **Dev mode** — preserves camelCase, snake_case, file paths, jargon in coding apps
- **BYOK** — bring your own Groq, OpenAI, or Anthropic key. Groq is free and blazing fast.
- **Local mode** — run whisper.cpp on-device. No network call required.
- **Clipboard fallback** — if auto-paste isn't available, text is copied with a ⌘V reminder

## How it works

Your audio goes: **mic → your API key → your cursor**. Yappr servers are not in the path.

## Quick start

1. Download the latest build from [yappr.app/download](https://yappr.app/download)
2. Open Yappr — the setup wizard appears
3. Paste your [Groq API key](https://console.groq.com) (free, takes 30 seconds) — or pick local whisper.cpp
4. Hold **Right Option (⌥)** anywhere and speak

## FAQ

**How much does BYOK actually cost?**
Groq's `whisper-large-v3-turbo` costs roughly $0.04/hour of audio. At 10 minutes of dictation a day, that's about $0.007/day — under $3/year. Local whisper.cpp is free after a one-time model download.

**Does Yappr see my screen?**
No. This is an explicit anti-feature. We don't capture screenshots, and we never will.

**Does it work offline?**
Yes — switch to the bundled local whisper.cpp provider. No network call required.

## Legal

Yappr is a proprietary commercial product. See [LICENSE](LICENSE) for terms and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) for the open-source components incorporated under their respective licenses.

Built with Llama. Llama 3 is licensed under the Llama 3 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.

Slack, Gmail, iMessage, Notion, Cursor, ChatGPT, Claude, Groq, Llama, and Whisper are trademarks of their respective owners. Yappr is not affiliated with or endorsed by these companies.
