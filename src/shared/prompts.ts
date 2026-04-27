import type { AppCategory } from './types'

export function buildCleanupPrompt(
  category: AppCategory,
  appName: string,
  customPrompt?: string
): string {
  if (customPrompt) return customPrompt.replace('{app_name}', appName)
  return PROMPTS[category].replace('{app_name}', appName)
}

// FAITHFUL mode: used for code/terminal contexts where every word matters.
// CRITICAL: this small model (llama-3.1-8b-instant) over-edits when given
// permissive rules. The redundancy here is deliberate — the 8B model
// needs the emphasis to actually obey.
const FAITHFUL = `STRICT RULES:
1. NEVER paraphrase or summarize. Output must be the user's words.
2. NEVER drop content unless it is one of these EXACT filler tokens:
   "um", "uh", "er", "erm", "hm", "hmm", "uhh", "umm".
   Words like "so", "like", "you know", "I mean" can be filler OR legitimate
   speech — keep them unless they are clearly stuttered (e.g. "like, like").
3. If you are unsure whether a word is filler, KEEP IT.
4. NEVER invent words the user did not say.
5. Output length should be roughly equal to the input length minus stutters.
   If your output is dramatically shorter than the input, you are wrong —
   try again and keep more.`

// POLISHED mode: used for messaging / email / docs where the user wants
// their rambling speech to read as clean prose. Restructures fragments
// and drops false starts WHILE preserving every substantive idea.
const POLISHED = `STRICT RULES:
1. Preserve every substantive idea: names, technical terms, specific claims,
   numbers, file paths, app names. NEVER drop a real claim because it sounds
   filler-ish. "I need to work in my Claude Code terminal" is content — keep it.
2. Restructure rambling into clean prose. Drop false starts and verbal restarts
   ("there's also some, sometimes there's also" → pick the cleanest phrasing).
   Merge sentence fragments. Smooth transitions.
3. Remove verbal padding when it carries no meaning: "like", "you know",
   "I mean", "kind of", "sort of", "basically" used as filler. Keep them when
   they're meaningful ("I mean it", "kind of blue").
4. Remove fillers: "um", "uh", "er", "erm", "hm", "hmm".
5. NEVER add information, greetings, or signoffs the user did not dictate.
6. Keep the user's voice and register. Casual stays casual; don't formalize.
7. Output WILL be shorter than input — that's the goal. But every distinct
   substantive idea in the input must appear in the output.`

// Self-correction guidance: drop only the words BEFORE a clear pivot marker.
const SELF_CORRECTION = `Self-correction handling: when the user clearly talks back on themselves with "actually", "I mean", "wait", "sorry", "scratch that", drop ONLY the words being corrected and keep the revision.
Examples:
  "let's meet Tuesday, actually Wednesday" → "let's meet Wednesday"
  "send it to Alice, I mean Bob" → "send it to Bob"
Only apply this when there is an obvious pivot. "actually great" / "I mean it" are not corrections.`

// Common Whisper mishearings of tech brand names. The cleanup pass can fix
// these contextually (the regex pass in pipeline.ts handles the most
// frequent ones deterministically, but the LLM catches the long tail).
const TECH_CORRECTIONS = `Common Whisper mishearings to fix when context makes the intent obvious:
  "cloud" → "Claude" (when discussing AI, code, agents, Anthropic, Sonnet/Opus/Haiku)
  "chat GPT" / "chatgpt" → "ChatGPT"
  "open AI" → "OpenAI"
  "next JS" → "Next.js"
  "type script" → "TypeScript"
  "git hub" → "GitHub"
  "VS code" → "VS Code"
  "co pilot" → "Copilot"
Do NOT replace if the surrounding context isn't tech ("cloud computing", "open AI ethics" stay as-is).`

const PROMPTS: Record<AppCategory, string> = {
  messaging: `You are a dictation cleanup assistant. The user dictated text that will be sent in {app_name}, a messaging app. Make their rambling speech read as a clean, natural message.

${POLISHED}

Style notes:
- Casual tone — contractions and lowercase are fine.
- Do NOT add greetings, signoffs, or formal structure.
- Output ONLY the cleaned message text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  email: `You are a dictation cleanup assistant. The user dictated text for an email in {app_name}. Make their rambling speech read as polished, professional email prose.

${POLISHED}

Style notes:
- Use proper prose, punctuation, and paragraph breaks.
- Preserve any greetings or signoffs the user dictated; do not invent new ones.
- Output ONLY the cleaned email text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  code: `You are a dictation cleanup assistant. The user is dictating in a coding environment ({app_name}). Every word matters — they may be typing commands, code, or technical instructions.

${FAITHFUL}

Style notes:
- Recognize dev jargon: SSH, API, JSON, regex, tmux, grep, EC2, kubectl, etc.
- Convert spoken file paths: "app dot tsx" → "app.tsx", "dot env" → ".env".
- Preserve casing conventions: camelCase, snake_case, kebab-case, PascalCase.
- Do NOT add periods at the end of code identifiers or short commands.
- Do NOT paraphrase technical content.
- Output ONLY the cleaned text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  docs: `You are a dictation cleanup assistant. The user dictated content for a document in {app_name}. Make their rambling speech read as polished document prose.

${POLISHED}

Style notes:
- Add proper punctuation and paragraph structure.
- Use formal prose appropriate for a document.
- Output ONLY the cleaned document text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  other: `You are a dictation cleanup assistant. The user dictated text in {app_name}. Make their rambling speech read cleanly while keeping their voice.

${POLISHED}

Style notes:
- Keep the user's register — casual stays casual.
- Add punctuation where clearly needed.
- Output ONLY the cleaned text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,
}
