import { useEffect, useRef, useState } from 'react'

// 'stopping' is an internal transition: keep recording UI visible while
// we wait for MediaRecorder to flush its final chunk before sending AUDIO_DONE.
// 'downloading:N' means the local Whisper model is being downloaded (N = % complete).
type IndicatorState = 'idle' | 'recording' | 'stopping' | 'processing' | 'done' | 'error' | 'clipboard' | `downloading:${number}`

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
  const [downloadPct, setDownloadPct] = useState(0)
  const [waveform, setWaveform] = useState<number[]>(Array(20).fill(0))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)

  useEffect(() => {
    const unsub = window.indicator.onStateChange((s) => {
      if (s.startsWith('downloading:')) {
        setDownloadPct(parseInt(s.split(':')[1], 10))
        setState('downloading:0') // use a stable key for the state type
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          e.data.arrayBuffer().then((buf) => window.indicator.sendAudioChunk(buf))
        }
      }

      // AUDIO_DONE is sent from onstop, which fires after the final ondataavailable.
      // This guarantees all audio chunks reach main before the pipeline starts.
      recorder.onstop = () => {
        window.indicator.sendAudioDone()
        stream.getTracks().forEach((t) => t.stop())
        audioContextRef.current?.close()
        audioContextRef.current = null
      }

      recorder.start(100)

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const bars = Array.from({ length: 20 }, (_, i) => {
          const idx = Math.floor((i / 20) * data.length)
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
    setWaveform(Array(20).fill(0))
    if (mediaRecorderRef.current?.state !== 'inactive') {
      // onstop handler will send AUDIO_DONE after final ondataavailable
      mediaRecorderRef.current?.stop()
    }
    mediaRecorderRef.current = null
  }

  if (state === 'idle') return null

  const isDownloading = state.toString().startsWith('downloading')

  const bgClass =
    (state === 'recording' || state === 'stopping') ? 'bg-red-500/90' :
    isDownloading ? 'bg-purple-600/90' :
    state === 'processing' ? 'bg-blue-500/90' :
    state === 'done' ? 'bg-green-500/90' :
    state === 'error' ? 'bg-red-800/90' :
    state === 'clipboard' ? 'bg-yellow-500/90' : 'bg-gray-700/90'

  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md shadow-xl ${bgClass}`}>
        {(state === 'recording' || state === 'stopping') && (
          <>
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shrink-0" />
            <div className="flex items-end gap-px h-5">
              {waveform.map((v, i) => (
                <div
                  key={i}
                  className="w-1 bg-white/80 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, v * 0.18)}px` }}
                />
              ))}
            </div>
          </>
        )}
        {isDownloading && (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xs font-medium">
              Downloading model… {downloadPct}%
            </span>
          </>
        )}
        {state === 'processing' && (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-xs font-medium">Processing…</span>
          </>
        )}
        {state === 'done' && <span className="text-white text-xs font-medium">✓ Done</span>}
        {state === 'error' && <span className="text-white text-xs font-medium">✗ Error — check API key</span>}
        {state === 'clipboard' && <span className="text-white text-xs font-medium">Copied — press ⌘V to paste</span>}
      </div>
    </div>
  )
}
