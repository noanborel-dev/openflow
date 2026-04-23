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

      const pendingChunks: Promise<void>[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const p = e.data.arrayBuffer().then((buf) => window.indicator.sendAudioChunk(buf))
          pendingChunks.push(p)
        }
      }

      recorder.onstop = async () => {
        await Promise.all(pendingChunks)
        window.indicator.sendAudioDone()
        stream.getTracks().forEach((t) => t.stop())
        audioContextRef.current?.close()
        audioContextRef.current = null
      }

      recorder.start(100)

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

  return (
    <div className="flex items-center justify-center w-full h-full font-sans">
      <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-pill bg-ink text-paper shadow-2xl">
        {(state === 'recording' || state === 'stopping') && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse shrink-0" />
            <div className="flex items-end gap-[2px] h-[14px]">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-volt rounded-[2px] transition-all duration-75"
                  style={{ height: `${Math.max(3, v * 0.14)}px` }}
                />
              ))}
            </div>
            <span className="font-mono text-[9px] tracking-widest text-paper/50 ml-1">HOLD</span>
          </>
        )}
        {state === 'processing' && (
          <>
            <span className="w-3 h-3 rounded-full border-[1.5px] border-paper/20 border-t-volt animate-spin shrink-0" />
            <span className="font-mono text-[10.5px] tracking-wide">Transcribing</span>
          </>
        )}
        {(state === 'done' || state === 'clipboard') && (
          <span className="font-mono text-[10.5px] text-volt font-medium">
            {state === 'clipboard' ? '✓ Copied — ⌘V to paste' : '✓ Pasted'}
          </span>
        )}
        {state === 'error' && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
            <span className="font-mono text-[10.5px]">{errorMsg || 'Transcription failed'}</span>
          </>
        )}
      </div>
    </div>
  )
}
