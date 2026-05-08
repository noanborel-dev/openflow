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
  // Persistent audio pipeline — set up once at mount, kept warm for the
  // lifetime of the indicator window. Spinning up getUserMedia +
  // AudioContext per recording cost ~50–200ms and cut off the first
  // word of dictation. With the warm pipeline, recorder.start() begins
  // capturing within ~5ms of the hotkey press.
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false

    async function prewarm() {
      try {
        const settings = await window.openflow.getSettings()
        const constraints = micConstraints(settings.inputDeviceId)
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        const ctx = new AudioContext()
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 64
        source.connect(analyser)
        streamRef.current = stream
        audioContextRef.current = ctx
        analyserRef.current = analyser
      } catch (err) {
        // Permission not yet granted, or mic unavailable. startRecording
        // will retry on demand.
        console.warn('[Indicator] Mic prewarm deferred:', err)
      }
    }
    prewarm()

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

    return () => {
      cancelled = true
      unsub()
      cancelAnimationFrame(animFrameRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioContextRef.current?.close()
      streamRef.current = null
      audioContextRef.current = null
      analyserRef.current = null
    }
  }, [])

  async function ensurePipeline(): Promise<{ stream: MediaStream; analyser: AnalyserNode } | null> {
    if (streamRef.current && analyserRef.current && audioContextRef.current) {
      return { stream: streamRef.current, analyser: analyserRef.current }
    }
    try {
      const settings = await window.openflow.getSettings()
      const constraints = micConstraints(settings.inputDeviceId)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      streamRef.current = stream
      audioContextRef.current = ctx
      analyserRef.current = analyser
      return { stream, analyser }
    } catch (err) {
      console.error('[Indicator] Mic error:', err)
      return null
    }
  }

  function micConstraints(deviceId: string | null): MediaStreamConstraints {
    // exact deviceId fails loudly if the device is missing (e.g. user
    // unplugged it). That's fine — surfaces an error instead of silently
    // falling back to a different mic. null = system default.
    return {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    }
  }

  async function startRecording() {
    const pipeline = await ensurePipeline()
    if (!pipeline) return
    const { stream, analyser } = pipeline

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = recorder

    // One self-contained WebM blob emitted on stop. Streaming chunks
    // (timeslice=100ms) produced corrupted containers because only the
    // first chunk had the EBML header.
    const blobs: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) blobs.push(e.data)
    }
    recorder.onstop = async () => {
      const full = new Blob(blobs, { type: mimeType })
      const buf = await full.arrayBuffer()
      window.indicator.sendAudioChunk(buf)
      window.indicator.sendAudioDone()
      // Intentionally NOT tearing down the stream/context — kept warm
      // for the next session.
    }
    recorder.start()

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

  // Liquid Glass pill: dark-tinted gradient over the blur for readability
  // on any desktop. Drop-shadow on the parent (not box-shadow) follows
  // the rounded outline — box-shadow on a rounded element inside an
  // Electron transparent window leaves a rectangular halo on macOS.
  // Liquid Glass: more saturated and slightly more opaque than before,
  // so the dark base stays consistent and lifts the foreground text.
  // The blur dial is high (32px) for a strong depth-of-field feel
  // without going opaque.
  const pillStyle = {
    background:
      'linear-gradient(180deg, rgba(20,22,30,0.68) 0%, rgba(20,22,30,0.58) 100%)',
    backdropFilter: 'blur(32px) saturate(200%)',
    WebkitBackdropFilter: 'blur(32px) saturate(200%)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.36), ' +
      'inset 0 -1px 0 rgba(255,255,255,0.06)',
  }

  // Refined cobalt — sits between iOS system blue and lavender, reads
  // premium against the cool dark glass. A touch brighter than before
  // for legibility.
  const accent = '#8BB4F2'
  const accentGlow = 'rgba(139,180,242,0.6)'

  // Shared text style for italic state labels — semi-bold weight + a
  // soft text-shadow so the serif glyphs don't get lost against the
  // glass at small size.
  const labelStyle = {
    fontStyle: 'italic',
    fontFamily: '"Cormorant Garamond", Georgia, serif',
    fontWeight: 600,
    textShadow: '0 1px 2px rgba(0,0,0,0.35)',
  } as const

  return (
    <div
      className="flex items-center justify-center w-full h-full font-sans"
      style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.35))' }}
    >
      <div
        className="inline-flex items-center gap-2.5 px-4 py-2 rounded-pill text-white"
        style={pillStyle}
      >
        {(state === 'recording' || state === 'stopping') && (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0"
              style={{ boxShadow: '0 0 6px rgba(232,74,58,0.7)' }}
            />
            <div className="flex items-end gap-[2px] h-[14px]">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-[2px] transition-all duration-75"
                  style={{
                    height: `${Math.max(3, v * 0.14)}px`,
                    background: accent,
                    boxShadow: `0 0 5px ${accentGlow}`,
                  }}
                />
              ))}
            </div>
            <span
              className="text-[12px] ml-1 tracking-tight text-white/85"
              style={labelStyle}
            >
              listening
            </span>
          </>
        )}
        {state === 'processing' && (
          <>
            <span
              className="w-3 h-3 rounded-full border-[1.5px] border-white/20 animate-spin shrink-0"
              style={{
                borderTopColor: accent,
                filter: `drop-shadow(0 0 3px ${accentGlow})`,
              }}
            />
            <span className="text-[13px] tracking-tight text-white" style={labelStyle}>
              transcribing
            </span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <>
            <svg width="12" height="12" viewBox="0 0 11 11" fill="none" style={{ filter: `drop-shadow(0 0 3px ${accentGlow})` }}>
              <path
                d="M2 5.5 L4.5 8 L9 3"
                stroke={accent}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <span
              className="text-[13px] tracking-tight"
              style={{ ...labelStyle, color: accent }}
            >
              {state === 'clipboard' ? 'copied — ⌘V to paste' : 'pasted'}
            </span>
          </>
        )}
        {state === 'error' && (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-danger shrink-0"
              style={{ boxShadow: '0 0 6px rgba(232,74,58,0.7)' }}
            />
            <span className="text-[13px] tracking-tight text-white" style={labelStyle}>
              {errorMsg || 'transcription failed'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
