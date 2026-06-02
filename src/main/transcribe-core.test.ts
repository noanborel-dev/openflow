import { describe, it, expect } from 'vitest'
import { buildDecodeOptions, isLikelyHallucination, isChunkArtifact } from './transcribe-core'

describe('buildDecodeOptions', () => {
  it('uses deterministic greedy decode params', () => {
    const o = buildDecodeOptions()
    expect(o.beamSize).toBe(1)
    expect(o.bestOf).toBe(1)
    expect(o.temperature).toBe(0)
    expect(o.maxThreads).toBe(4)
  })

  it("defaults language to 'auto'", () => {
    expect(buildDecodeOptions().language).toBe('auto')
    expect(buildDecodeOptions({ language: undefined }).language).toBe('auto')
  })

  it('honors a forced language', () => {
    expect(buildDecodeOptions({ language: 'fr' }).language).toBe('fr')
  })

  it('joins the dictionary into the bias prompt', () => {
    expect(buildDecodeOptions({ dictionary: ['Yappr', 'tRPC'] }).prompt).toBe('Yappr, tRPC')
  })

  it('omits prompt entirely when the dictionary is empty', () => {
    expect('prompt' in buildDecodeOptions()).toBe(false)
    expect('prompt' in buildDecodeOptions({ dictionary: [] })).toBe(false)
  })
})

describe('isLikelyHallucination (whole-utterance, permissive)', () => {
  it('flags empty / pure-punctuation / known artifacts', () => {
    expect(isLikelyHallucination('')).toBe(true)
    expect(isLikelyHallucination('...')).toBe(true)
    expect(isLikelyHallucination('[blank_audio]')).toBe(true)
    expect(isLikelyHallucination('Thanks for watching!')).toBe(true)
  })

  it('flags bare real-word artifacts as a WHOLE utterance', () => {
    expect(isLikelyHallucination('you')).toBe(true)
    expect(isLikelyHallucination('thanks')).toBe(true)
  })

  it('flags sub-2-char output', () => {
    expect(isLikelyHallucination('a')).toBe(true)
  })

  it('passes real speech', () => {
    expect(isLikelyHallucination('ship the pricing tomorrow')).toBe(false)
  })
})

describe('isChunkArtifact (per-chunk, strict)', () => {
  it('flags only true artifact tokens', () => {
    expect(isChunkArtifact('')).toBe(true)
    expect(isChunkArtifact('[silence]')).toBe(true)
    expect(isChunkArtifact('(soft music)')).toBe(true)
  })

  it('does NOT drop real words that the whole-utterance set rejects', () => {
    // Mid-stream, "thanks" / "you" can be real speech — never drop them.
    expect(isChunkArtifact('thanks')).toBe(false)
    expect(isChunkArtifact('you')).toBe(false)
  })

  it('does NOT reject on length (a short chunk can be real)', () => {
    expect(isChunkArtifact('a')).toBe(false)
  })
})
