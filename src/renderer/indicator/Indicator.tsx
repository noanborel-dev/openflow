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

  // Liquid Glass pill: dark-tinted gradient over the blur for readability
  // on any desktop. Drop-shadow on the parent (not box-shadow) follows
  // the rounded outline — box-shadow on a rounded element inside an
  // Electron transparent window leaves a rectangular halo on macOS.
  const pillStyle = {
    background:
      'linear-gradient(180deg, rgba(22,24,32,0.6) 0%, rgba(22,24,32,0.5) 100%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.16)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.32), ' +
      'inset 0 -1px 0 rgba(255,255,255,0.05)',
  }

  // Refined cobalt that reads premium against the cool dark glass —
  // the brighter electric blue used elsewhere in the app feels neon
  // here. This sits closer to iOS system blue.
  const accent = '#7BA3F0'
  const accentGlow = 'rgba(123,163,240,0.55)'

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
              className="text-[11px] text-white/55 ml-1 tracking-tight"
              style={{ fontStyle: 'italic', fontFamily: '"Cormorant Garamond", Georgia, serif' }}
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
            <span
              className="text-[12px] tracking-tight"
              style={{ fontStyle: 'italic', fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              transcribing
            </span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ filter: `drop-shadow(0 0 3px ${accentGlow})` }}>
              <path
                d="M2 5.5 L4.5 8 L9 3"
                stroke={accent}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
            <span
              className="text-[12px] tracking-tight"
              style={{
                color: accent,
                fontStyle: 'italic',
                fontFamily: '"Cormorant Garamond", Georgia, serif',
              }}
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
            <span
              className="text-[12px] tracking-tight"
              style={{ fontStyle: 'italic', fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              {errorMsg || 'transcription failed'}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
