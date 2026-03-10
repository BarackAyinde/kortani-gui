// Whisper STT via OpenAI API
// Requires VITE_OPENAI_KEY in .env.local
// Accepts a Blob of recorded audio (webm/ogg/mp4) and returns the transcribed text.

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions'

export async function transcribeAudio(blob: Blob): Promise<string> {
  const key = import.meta.env.VITE_OPENAI_KEY
  if (!key) throw new Error('VITE_OPENAI_KEY is not set in .env.local')

  const form = new FormData()
  // OpenAI requires the file to have a name with a recognised extension
  form.append('file', blob, 'recording.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'en')

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Whisper API ${res.status}: ${body}`)
  }

  const data = await res.json() as { text?: string }
  return (data.text ?? '').trim()
}
