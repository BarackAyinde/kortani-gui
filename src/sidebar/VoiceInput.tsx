// VoiceInput — replaces the text textarea when voice mode is active.
// Push-and-hold the mic button (or click once to start/stop) to record.
// On release/stop: sends audio to Whisper → injects transcript as a message.

import { useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '../store/voiceStore'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  disabled: boolean
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { isRecording, setRecording, selectedMicId } = useVoiceStore()
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startRecording = async () => {
    if (isRecording || disabled) return
    setError(null)
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      chunksRef.current = []

      // Prefer webm/opus; fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        chunksRef.current = []

        // Lazy-import to avoid loading Whisper client until voice is used
        try {
          const { transcribeAudio } = await import('../lib/whisperApi')
          const text = await transcribeAudio(blob)
          if (text.trim()) onTranscript(text.trim())
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (!isRecording) return
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setRecording(false)
  }

  const handleClick = () => {
    if (isRecording) stopRecording()
    else void startRecording()
  }

  return (
    <div className="voice-input">
      <button
        className="voice-input__btn"
        data-recording={isRecording}
        onClick={handleClick}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <span className="voice-input__icon voice-input__icon--recording">■</span>
        ) : (
          <span className="voice-input__icon">🎙</span>
        )}
      </button>

      <span className="voice-input__status">
        {isRecording ? 'Recording… click to send' : 'Click to speak'}
      </span>

      {error && <span className="voice-input__error">{error}</span>}
    </div>
  )
}
