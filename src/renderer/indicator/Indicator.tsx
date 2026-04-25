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
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
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
    return unsub
  }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      // Collect every dataavailable blob locally and emit as a single WebM
      // on stop. Streaming chunks (timeslice=100ms) produced corrupted
      // containers ~80% of the time on Groq's side because only the first
      // chunk had the EBML header and races during teardown sometimes
      // dropped the trailing cluster — yielding "could not process file".
      const blobs: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) blobs.push(e.data)
      }

      recorder.onstop = async () => {
        const full = new Blob(blobs, { type: mimeType })
        const buf = await full.arrayBuffer()
        window.indicator.sendAudioChunk(buf)
        window.indicator.sendAudioDone()
        stream.getTracks().forEach((t) => t.stop())
        audioContextRef.current?.close()
        audioContextRef.current = null
      }

      // No timeslice — one complete, self-contained WebM blob on stop.
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
    } catch (err) {
      console.error('[Indicator] Mic error:', err)
    }
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

  // Liquid Glass pill: translucent frosted backdrop with enough opacity
  // to remain readable on light desktops. Layered with a subtle dark
  // tint (rgba 0,0,0,0.35) so text/icons stay legible regardless of the
  // surface beneath. Drop-shadow rather than box-shadow keeps the glow
  // tight to the pill's rounded shape — box-shadow on a rounded element
  // inside an Electron transparent window produces a rectangular halo
  // artifact on macOS.
  const pillStyle = {
    background:
      'linear-gradient(180deg, rgba(20,20,28,0.55) 0%, rgba(20,20,28,0.45) 100%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.35), ' +
      'inset 0 -1px 0 rgba(255,255,255,0.06)',
  }

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
              style={{ boxShadow: '0 0 8px rgba(232,74,58,0.8)' }}
            />
            <div className="flex items-end gap-[2px] h-[14px]">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-volt rounded-[2px] transition-all duration-75"
                  style={{
                    height: `${Math.max(3, v * 0.14)}px`,
                    boxShadow: '0 0 6px rgba(43,127,255,0.8)',
                  }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-widest text-white/60 ml-1">HOLD</span>
          </>
        )}
        {state === 'processing' && (
          <>
            <span
              className="w-3 h-3 rounded-full border-[1.5px] border-white/25 border-t-volt animate-spin shrink-0"
              style={{ filter: 'drop-shadow(0 0 4px rgba(43,127,255,0.6))' }}
            />
            <span className="font-mono text-[10.5px] tracking-wide">Transcribing</span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <span
            className="font-mono text-[10.5px] text-volt font-medium"
            style={{ textShadow: '0 0 6px rgba(43,127,255,0.6)' }}
          >
            {state === 'clipboard' ? '✓ Copied — ⌘V to paste' : '✓ Pasted'}
          </span>
        )}
        {state === 'error' && (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full bg-danger shrink-0"
              style={{ boxShadow: '0 0 8px rgba(232,74,58,0.8)' }}
            />
            <span className="font-mono text-[10.5px]">{errorMsg || 'Transcription failed'}</span>
          </>
        )}
      </div>
    </div>
  )
}
