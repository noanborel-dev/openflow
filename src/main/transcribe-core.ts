import type { TranscribeOptions } from '@fugood/whisper.node'

export interface DecodeParams {
  // Whisper bias dictionary → initial prompt (biases toward known spellings).
  dictionary?: string[]
  // Forced language code, or undefined to auto-detect. Defaults to 'auto'.
  language?: string
}

// The canonical decode options shared by EVERY local transcribe — the
// one-shot provider, command mode, and (soon) streaming chunks — so
// decode params and the bias prompt never drift between paths. Drift is
// the concrete code-switch divergence hazard the spec calls out.
export function buildDecodeOptions(params: DecodeParams = {}): TranscribeOptions {
  const dict = params.dictionary ?? []
  const prompt = dict.length > 0 ? dict.join(', ') : undefined
  return {
    // Greedy decoding (beam=1, best_of=1, temp=0): faster AND
    // deterministic. Dictation values "same audio -> same transcript".
    beamSize: 1,
    bestOf: 1,
    temperature: 0,
    // M-series has ~6 perf cores; >4 threads spills onto E-cores
    // (3-4x slower per thread).
    maxThreads: 4,
    // All local models are multilingual; 'auto' lets users code-switch
    // without rebinding the setting.
    language: params.language ?? 'auto',
    ...(prompt ? { prompt } : {}),
  }
}
