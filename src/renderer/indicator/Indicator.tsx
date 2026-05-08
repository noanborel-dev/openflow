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
      getInputDeviceId: () => Promise<string | null>
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
        const stream = await openMic()
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
      const stream = await openMic()
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

  // Open the user's selected mic. If the saved deviceId is invalid (mic
  // unplugged, deviceId stale across reboots) we fall back to system
  // default rather than throwing — losing audio entirely is worse than
  // using a different mic. Settings IPC access is wrapped defensively
  // because the preload bridge may not be ready on cold start.
  async function openMic(): Promise<MediaStream> {
    let deviceId: string | null = null
    try {
      deviceId = (await window.indicator.getInputDeviceId?.()) ?? null
    } catch {
      deviceId = null
    }
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        })
      } catch (err) {
        console.warn('[Indicator] Saved mic unavailable, using default:', err)
      }
    }
    return await navigator.mediaDevices.getUserMedia({ audio: true })
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

  // Liquid Glass pill, charcoal variant. The refractive top edge is the
  // signature detail — a near-white inner highlight and a near-black
  // bottom inset together give the pill a poured-resin feel against any
  // wallpaper. Drop-shadow lives on the parent (not box-shadow) so the
  // shadow follows the rounded outline and Electron's transparent
  // window doesn't leave a rectangular halo.
  const pillStyle = {
    background:
      'linear-gradient(180deg, rgba(18,20,26,0.82) 0%, rgba(14,16,22,0.74) 100%)',
    backdropFilter: 'blur(34px) saturate(180%)',
    WebkitBackdropFilter: 'blur(34px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow:
      'inset 0 1.2px 0 rgba(255,255,255,0.42), ' +
      'inset 0 -1px 0 rgba(0,0,0,0.45)',
  }

  // More saturated, slightly cooler blue than before — reads as proper
  // cobalt instead of lavender at this scale. Glow uses a wider falloff
  // so each bar feels like it's emitting light.
  const accent = '#5A8FE8'
  const accentGlow = 'rgba(90,143,232,0.65)'

  // Shared text style for italic state labels. Instrument Serif at a
  // medium weight reads more elegant than Cormorant at small size, with
  // a subtle text-shadow so the glyphs don't dissolve into the glass.
  const labelStyle = {
    fontStyle: 'italic',
    fontFamily: '"Instrument Serif", "Cormorant Garamond", Georgia, serif',
    fontWeight: 400,
    letterSpacing: '0.005em',
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
              className="w-[7px] h-[7px] rounded-full bg-danger animate-pulse shrink-0"
              style={{ boxShadow: '0 0 8px rgba(232,74,58,0.8)' }}
            />
            <div className="flex items-end gap-[2px] h-[15px]">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-[2px] rounded-[1px] transition-all duration-75"
                  style={{
                    height: `${Math.max(3, v * 0.15)}px`,
                    background: accent,
                    boxShadow: `0 0 6px ${accentGlow}`,
                  }}
                />
              ))}
            </div>
            <span
              className="text-[15px] ml-1 leading-none text-white/95"
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
            <span className="text-[15px] leading-none text-white/95" style={labelStyle}>
              polishing…
            </span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <>
            <svg width="13" height="13" viewBox="0 0 11 11" fill="none" style={{ filter: `drop-shadow(0 0 3px ${accentGlow})` }}>
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
              className="text-[15px] leading-none"
              style={{ ...labelStyle, color: accent }}
            >
              {state === 'clipboard' ? 'copied — ⌘V to paste' : 'pasted'}
            </span>
          </>
        )}
        {state === 'error' && (
          <>
            <span
              className="w-[7px] h-[7px] rounded-full bg-danger shrink-0"
              style={{ boxShadow: '0 0 8px rgba(232,74,58,0.8)' }}
            />
            <span className="text-[15px] leading-none text-white/95" style={labelStyle}>
              {errorMsg || 'transcription failed'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
