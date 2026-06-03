import { describe, it, expect } from 'vitest'
import { detectAiAddressing, classifyCodeSurface } from './ai-intent'

describe('detectAiAddressing', () => {
  it('flags an explicit AI name as a STRONG cue', () => {
    expect(detectAiAddressing('hey claude can you add a test')).toBe('strong')
  })

  it('flags a misheard AI name (cloud) next to a tech word as STRONG', () => {
    expect(detectAiAddressing('ask cloud to refactor the auth module')).toBe('strong')
  })

  it('flags a bare coding-request verb as a WEAK cue', () => {
    expect(detectAiAddressing('refactor this and add a test')).toBe('weak')
  })

  it('returns none for a plain shell command', () => {
    expect(detectAiAddressing('git rebase -i main then force push')).toBe('none')
  })

  it('returns none for a generic "add" with no coding context', () => {
    expect(detectAiAddressing('add the numbers and divide by two')).toBe('none')
  })

  it('returns none for a generic "fix" with no coding context', () => {
    expect(detectAiAddressing('fix the leak under the sink')).toBe('none')
  })

  it('does NOT escalate an AI name quoted as a string literal (FP1 guard)', () => {
    expect(detectAiAddressing('const prompt quote hey claude refactor this unquote')).toBe('none')
  })
})

describe('classifyCodeSurface', () => {
  const base = { category: 'code' as const, transcript: '', isAxReadable: false }

  it('routes a primary AI app to reformat', () => {
    expect(classifyCodeSurface({ ...base, isPrimaryAiBundle: true }).register).toBe('reformat')
  })

  it('routes a readable multi-line AXTextArea chat box in a code app to reformat', () => {
    expect(
      classifyCodeSurface({ ...base, axRole: 'AXTextArea', isAxReadable: true }).register
    ).toBe('reformat')
  })

  it('FP1: AI CLI + strong spoken cue caps at faithful_ai, NEVER the destructive reformat', () => {
    const r = classifyCodeSurface({
      ...base,
      terminalAiCli: { isAiCli: true, cli: 'claude' },
      transcript: 'hey claude rename getCwd',
    })
    expect(r.register).toBe('faithful_ai')
  })

  it('FP3: AI CLI present but NO spoken cue stays code (verbatim skip)', () => {
    const r = classifyCodeSurface({
      ...base,
      terminalAiCli: { isAiCli: true },
      transcript: 'git rebase -i main',
    })
    expect(r.register).toBe('code')
  })

  it('AI CLI + strong cue → faithful_ai', () => {
    const r = classifyCodeSurface({
      ...base,
      terminalAiCli: { isAiCli: true },
      transcript: 'ask claude to fix the flaky test',
    })
    expect(r.register).toBe('faithful_ai')
  })

  it('FP2: no CLI, generic transcript, weak-cue setting off → code', () => {
    const r = classifyCodeSurface({
      ...base,
      terminalAiCli: { isAiCli: false },
      transcript: 'fix the off by one',
      weakCueSettingOn: false,
    })
    expect(r.register).toBe('code')
  })

  it('FN rescue: a strong cue in a non-code app → faithful_ai (regardless of category)', () => {
    const r = classifyCodeSurface({
      category: 'other',
      transcript: 'hey claude summarize what changed',
      isAxReadable: false,
    })
    expect(r.register).toBe('faithful_ai')
  })

  it('FP6: a single-line AXTextField is NEVER reformat', () => {
    const r = classifyCodeSurface({
      ...base,
      axRole: 'AXTextField',
      isAxReadable: true,
      transcript: 'find all usages of getCwd',
    })
    expect(r.register).not.toBe('reformat')
  })
})
