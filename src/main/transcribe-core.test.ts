import { describe, it, expect } from 'vitest'
import { buildDecodeOptions } from './transcribe-core'

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
