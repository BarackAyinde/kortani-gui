// Chatterbox TTS via Modal deployment (resonance/chatterbox_tts.py)
// Requires:
//   VITE_CHATTERBOX_URL  — the Modal endpoint, e.g. https://<app>.modal.run
//   VITE_CHATTERBOX_KEY  — the API key (x-api-key header)
// Voice key is stored in voiceStore.chatterboxVoiceKey (R2 path, e.g. voices/system/default.wav)

interface SpeakOptions {
  text: string
  voiceKey: string
  speakerId: string | null  // HTMLMediaElement.setSinkId — null = default speaker
}

export async function speakText({ text, voiceKey, speakerId }: SpeakOptions): Promise<void> {
  const url = import.meta.env.VITE_CHATTERBOX_URL
  const key = import.meta.env.VITE_CHATTERBOX_KEY

  if (!url || !key) {
    throw new Error('VITE_CHATTERBOX_URL and VITE_CHATTERBOX_KEY must be set in .env.local')
  }

  const res = await fetch(`${url}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({ prompt: text, voice_key: voiceKey }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Chatterbox TTS ${res.status}: ${body}`)
  }

  const audioBlob = await res.blob()
  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)

  // Route to selected speaker if supported and a device is chosen
  if (speakerId && typeof (audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function') {
    await (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(speakerId)
  }

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve() }
    audio.onerror = () => { URL.revokeObjectURL(audioUrl); reject(new Error('Audio playback failed')) }
    void audio.play()
  })
}
