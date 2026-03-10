import { create } from 'zustand'

const SETTINGS_KEY = 'kortana.settings'

interface VoiceState {
  isVoiceActive: boolean
  isRecording: boolean
  isSpeaking: boolean
  selectedMicId: string | null      // MediaDevices deviceId
  selectedSpeakerId: string | null  // AudioOutput deviceId (setSinkId)
  chatterboxVoiceKey: string        // R2 path, e.g. 'voices/system/default.wav'

  toggleVoice: () => void
  setRecording: (recording: boolean) => void
  setSpeaking: (speaking: boolean) => void
  setMicId: (id: string | null) => void
  setSpeakerId: (id: string | null) => void
  setVoiceKey: (key: string) => void
}

function loadVoiceSettings(): Pick<VoiceState, 'selectedMicId' | 'selectedSpeakerId' | 'chatterboxVoiceKey'> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { selectedMicId: null, selectedSpeakerId: null, chatterboxVoiceKey: 'voices/system/default.wav' }
    const data = JSON.parse(raw) as {
      selectedMicId?: string | null
      selectedSpeakerId?: string | null
      chatterboxVoiceKey?: string
    }
    return {
      selectedMicId: data.selectedMicId ?? null,
      selectedSpeakerId: data.selectedSpeakerId ?? null,
      chatterboxVoiceKey: data.chatterboxVoiceKey ?? 'voices/system/default.wav',
    }
  } catch {
    return { selectedMicId: null, selectedSpeakerId: null, chatterboxVoiceKey: 'voices/system/default.wav' }
  }
}

function persistVoiceSettings(patch: Partial<Pick<VoiceState, 'selectedMicId' | 'selectedSpeakerId' | 'chatterboxVoiceKey'>>) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, ...patch }))
  } catch { /* storage full */ }
}

const persisted = loadVoiceSettings()

export const useVoiceStore = create<VoiceState>((set) => ({
  isVoiceActive: false,
  isRecording: false,
  isSpeaking: false,
  selectedMicId: persisted.selectedMicId,
  selectedSpeakerId: persisted.selectedSpeakerId,
  chatterboxVoiceKey: persisted.chatterboxVoiceKey,

  toggleVoice: () => set((s) => ({ isVoiceActive: !s.isVoiceActive, isRecording: false })),

  setRecording: (recording) => set({ isRecording: recording }),

  setSpeaking: (speaking) => set({ isSpeaking: speaking }),

  setMicId: (id) => {
    set({ selectedMicId: id })
    persistVoiceSettings({ selectedMicId: id })
  },

  setSpeakerId: (id) => {
    set({ selectedSpeakerId: id })
    persistVoiceSettings({ selectedSpeakerId: id })
  },

  setVoiceKey: (key) => {
    set({ chatterboxVoiceKey: key })
    persistVoiceSettings({ chatterboxVoiceKey: key })
  },
}))
