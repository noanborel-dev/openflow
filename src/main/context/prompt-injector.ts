// Emits the context block that gets injected into the cleanup system
// prompt. See:
//   docs/superpowers/plans/2026-05-18-feature-4-context-memory-plan.md
//
// Phase 1 emits only the "Who you are" layer (user overview). Phases 2
// and 3 will add the "Recent in {category}" layer.
//
// The block is framed as RESOLUTION CONTEXT, not passive background: the
// model is told to use the overview to resolve vague references in the
// dictation (names, places, projects) while strict anti-echo rules keep
// the 8B model from copying the overview into the output or addressing
// the user about it.

import { getUserOverview } from './store'

// Build the context block to splice into the cleanup system prompt.
// Returns an empty string when there's nothing to inject — caller can
// safely concat without any conditional wrapping.
//
// Hot-path cost: ~1ms total (one cached read + string ops).
export function buildContextBlock(opts: {
  enabled: boolean
}): string {
  if (!opts.enabled) return ''
  const overview = getUserOverview()
  if (!overview || overview.trim().length === 0) return ''

  // The wrapper frames the overview as RESOLUTION CONTEXT: the model
  // should actively use it to disambiguate vague references in the
  // dictation (e.g. "uni" → school name, "the internship" → company),
  // while strict anti-echo rules prevent the 8B model from copying the
  // overview into the output or addressing the user about it.
  return `

USER CONTEXT — read this to understand who is speaking. Use it to:
- Recognize and correctly spell names, places, projects, and people the user mentions ("uni" might mean their school; "my team" might mean a specific team named below).
- Quietly fill in or clarify vague references in the dictation when doing so makes the message more informative and stays true to the user's intent (e.g. if the user dictates "I'm doing an internship" and the overview says they're interning at Anthropic, you may write "I'm doing an internship at Anthropic" — but only if the original message clearly invites that detail; never invent context).
- Adjust register and tone to match the user's voice and domain.

About the user:
${overview.trim()}

Strict rules (violating these is a fatal error):
- Do NOT echo or summarize this context as a preamble or suffix.
- Do NOT address the user about this context ("As you mentioned...", "Based on your background...").
- Do NOT paraphrase the overview into the output.
- Do NOT ask clarifying questions about who the user is.
- This is a CLEANUP task: your output is ONLY the cleaned-up version of the user's dictation, written in the user's voice — not a summary of who they are.
`
}
