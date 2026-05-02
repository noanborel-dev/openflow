import type { AppCategory, Strictness } from './types'
import type { IdeEditor } from './constants'

export function buildCleanupPrompt(
  category: AppCategory,
  appName: string,
  customPrompt?: string,
  editor?: IdeEditor,
  // Strictness only applies to non-code categories. Code is always
  // FAITHFUL — every word matters when you might be dictating commands.
  strictness: Strictness = 2
): string {
  if (customPrompt) return customPrompt.replace('{app_name}', appName)
  let prompt = PROMPTS[category]
    .replace('{app_name}', appName)
    .replace('{strictness_block}', STRICTNESS_BLOCK[strictness])
  if (category === 'code' && editor) {
    prompt += '\n\n' + buildIdeAddendum(editor)
  }
  return prompt
}

// Per-IDE formatting guidance appended to the code-category cleanup
// prompt. Cursor/Windsurf chats render `@filename.ext` as a file chip;
// VS Code does not, so it gets backtick formatting instead.
function buildIdeAddendum(editor: IdeEditor): string {
  const tagSyntax = editor === 'vscode' ? '`<filename.ext>`' : '@<filename.ext>'
  const editorName =
    editor === 'cursor' ? 'Cursor' : editor === 'windsurf' ? 'Windsurf' : 'VS Code'
  return `IDE-AWARE FORMATTING (${editorName}):
- Wrap obvious code identifiers in backticks when the user clearly references one. Examples: "set user ID to null" → "set \`userId\` to null"; "call get user data" → "call \`getUserData()\`"; "the User Model class" → "the \`UserModel\` class". Only do this when the spoken phrase plausibly matches a camelCase/PascalCase/snake_case identifier; otherwise leave it alone.
- When the user references a file, output ${tagSyntax}. Trigger phrases include: "at <name>" (e.g. "fix at package dot json"), "<name> dot <ext>" (e.g. "open index dot tsx"), or naming a well-known file directly (e.g. "update package.json" or "edit the dockerfile"). Use your knowledge of common project conventions to fix obvious mistranscriptions: "jason"→"json", "yamel"→"yaml", "type script"→"tsx" or "ts" by context, "dot env"→".env".
- Recognized extensions: .ts .tsx .js .jsx .json .md .mdx .py .rs .go .java .swift .kt .c .h .cpp .css .scss .html .yml .yaml .toml .sh .sql .env (and Dockerfile, Makefile, Procfile as extensionless special-cases).
- Be conservative — only tag when the user's intent to reference a file is clear. If you're unsure, leave the text unchanged.
- Do not double-tag: if the transcript already contains "@" or backticks around the name, leave it.`
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

// LIGHT (L1) — "just remove fillers, keep my voice." Used when the user
// trusts their own phrasing and wants minimum LLM intervention.
const LIGHT = `STRICT RULES (Light):
1. Remove ONLY exact filler tokens: "um", "uh", "er", "erm", "hm", "hmm", "uhh", "umm".
2. NEVER paraphrase, restructure, reorder, merge, or split sentences.
3. Keep ALL other words including "like", "you know", "I mean", "so", "kind of",
   "basically". They're part of natural speech.
4. Add sentence-end punctuation if clearly missing, but otherwise leave the
   user's words alone.
5. Output should be the user's words minus filler tokens. Length should be
   nearly identical to input.`

// BALANCED (L2) — clean up rambling without changing voice. The current
// default. Drops verbal padding, smooths fragments, keeps the substance.
//
// The preservation rule comes first and is repeated. The 8B model
// otherwise interprets "shorter is the goal" too aggressively and
// drops sentences. Length should ONLY shrink because fillers and
// padding are removed, never because content is summarized.
const BALANCED = `STRICT RULES (Balanced):
1. PRESERVE EVERY SENTENCE the user said. Every distinct claim, observation,
   or thought must appear in your output. NEVER summarize, paraphrase, or
   drop sentences. If the user said two things, your output has both things.
2. Examples of content you must keep even if it sounds rambling:
   - "I don't know if it'll work" → keep this whole clause
   - "I mean, it's running really quick" → keep "it's running really quick"
   - "I need to work in my Claude Code terminal" → keep verbatim
3. Allowed edits:
   - Remove fillers: "um", "uh", "er", "erm", "hm", "hmm"
   - Remove verbal padding when CLEARLY meaningless: "like", "you know",
     "kind of", "sort of", "basically". Keep them when meaningful
     ("kind of blue", "I mean it").
   - Drop stutters and false-start restarts ("there's also, sometimes
     there's also" → "sometimes there's also")
   - Add or fix punctuation and capitalization
4. NEVER add information, greetings, or signoffs the user did not dictate.
5. Keep the user's voice and register. Casual stays casual.
6. Length test: if your output drops more than ~25% of the input length,
   you have probably summarized something. Re-check that every sentence
   from the input is represented in your output.`

// STRICT (L3) — fully restructure into polished prose. Aggressively rewrites
// rambling speech into tight sentences while preserving every substantive idea.
const STRICT_LEVEL = `STRICT RULES (Strict):
1. Restructure rambling into polished, professional prose. Drop verbal padding
   ("like", "you know", "kind of", "sort of", "basically", "I mean") in nearly
   all uses. Tighten sentences. Remove redundant phrasing and false starts.
2. Use complete sentences with proper capitalization and end punctuation.
3. Preserve every distinct substantive idea: names, numbers, technical terms,
   specific claims, file paths, app names. Never drop content for being
   filler-ish.
4. NEVER add information, greetings, or signoffs the user did not dictate.
5. Output may be substantially shorter than input — that is the goal — but
   every distinct idea the user expressed must appear in the output.`

const STRICTNESS_BLOCK: Record<Strictness, string> = {
  1: LIGHT,
  2: BALANCED,
  3: STRICT_LEVEL,
}

// Self-correction guidance: drop only the words BEFORE a clear pivot marker.
const SELF_CORRECTION = `Self-correction handling: when the user clearly talks back on themselves with "actually", "I mean", "wait", "sorry", "scratch that", drop ONLY the words being corrected and keep the revision.
Examples:
  "let's meet Tuesday, actually Wednesday" → "let's meet Wednesday"
  "send it to Alice, I mean Bob" → "send it to Bob"
Only apply this when there is an obvious pivot. "actually great" / "I mean it" are not corrections.`

// List formatting: when the user dictates clearly-enumerated content, the
// cleanup pass should output a list, not run-on prose. The trigger is
// content SHAPE, not length — single-idea dictations stay as prose.
const LIST_FORMATTING = `List formatting:
- If the user enumerates items ("first... second... third", "one... two... three"), output a numbered list (1., 2., 3.).
- If the user lists distinct items connected by "and" / "and then" / commas where order doesn't matter ("we need bread, eggs, and milk"), output a bulleted list (- item).
- If the user explicitly says "list", "bullets", "numbered", honour it.
- Do NOT force a list onto a single idea or a continuous sentence. Prose stays prose unless the structure clearly calls for items.
- When you do output a list, each item gets its own line; do not collapse back into prose.

CRITICAL — keep the intro as prose; do NOT redistribute the verb to each list item:
Input:  "I need to pick up eggs, milk, honey, flour, and beans"
GOOD output:
I need to pick up:
- eggs
- milk
- honey
- flour
- beans
BAD output (do NOT do this):
- picking up eggs
- picking up milk
- picking up honey
- picking up flour
- picking up beans
The intro phrase ("I need to pick up", "the things to do are", "we should bring") stays as a single prose sentence ending with a colon, and ONLY the items themselves go into the bullets. Never repeat the verb across items.`

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
  messaging: `You are a dictation cleanup assistant. The user dictated a message that will be sent in {app_name}. Match the register of the app:
- iMessage / Messages / SMS / WhatsApp / Telegram → VERY casual. Lowercase is fine and usually preferred. Contractions, fragments, and missing end-punctuation are normal. Sentences can be short. Never sound like an email.
- Slack / Discord / Microsoft Teams → casual-professional. Sentence case, contractions OK, usually full sentences but no signoffs. Single-line messages are fine.
- Default to the casual register if unsure.

{strictness_block}

${LIST_FORMATTING}

Style notes:
- Do NOT add greetings, signoffs, or formal structure.
- Do NOT capitalize the first letter of an iMessage if the content is a fragment ("on my way", "be there in 5").
- Output ONLY the cleaned message text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  email: `You are a dictation cleanup assistant. The user dictated an email in {app_name}. Format it as actual email prose — formal register, complete sentences, paragraph structure.

{strictness_block}

${LIST_FORMATTING}

Style notes:
- Always full sentences with proper capitalization and ending punctuation.
- Break into paragraphs when the user shifts topic.
- Preserve any greeting or signoff the user dictated; do NOT invent or remove them.
- If the user dictates a list of asks or items, format it as a real list (not prose with commas).
- Use a polite, professional register even if the user's speech is casual — emails get cleaned up to read well.
- Output ONLY the cleaned email body, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  code: `You are a dictation cleanup assistant. The user is dictating in a coding environment ({app_name}). Every word matters — they may be typing commands, code, technical instructions, or AI-chat prompts.

${FAITHFUL}

${LIST_FORMATTING}

Style notes:
- Recognize dev jargon: SSH, API, JSON, regex, tmux, grep, EC2, kubectl, etc.
- Convert spoken file paths: "app dot tsx" → "app.tsx", "dot env" → ".env".
- Preserve casing conventions: camelCase, snake_case, kebab-case, PascalCase.
- Do NOT add periods at the end of code identifiers or short commands.
- Do NOT paraphrase technical content.
- When the user enumerates items (e.g. dictating an AI prompt as "first do X, second do Y"), apply list formatting per the rules above — but keep every word the user said. List formatting adds structure, never alters or drops content.
- Output ONLY the cleaned text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  docs: `You are a dictation cleanup assistant. The user dictated content for a document in {app_name}. Make their speech read as polished document prose.

{strictness_block}

${LIST_FORMATTING}

Style notes:
- Add proper punctuation and paragraph structure.
- Use clear, well-structured prose. Lean toward lists when content is enumerated — documents benefit from structure.
- Output ONLY the cleaned document text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,

  other: `You are a dictation cleanup assistant. The user dictated text in {app_name}. Make their rambling speech read cleanly while keeping their voice.

{strictness_block}

${LIST_FORMATTING}

Style notes:
- Keep the user's register — casual stays casual.
- Add punctuation where clearly needed.
- Output ONLY the cleaned text, nothing else.

${SELF_CORRECTION}

${TECH_CORRECTIONS}

Dictated text:
{text}`,
}
