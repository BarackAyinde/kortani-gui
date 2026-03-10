import { create } from 'zustand'

// ─── Model definitions ────────────────────────────────────────────────────────

export interface ModelOption {
  id: string
  label: string
  provider: 'anthropic' | 'ollama' | 'google'
  stub?: boolean
}

export const CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6',  provider: 'anthropic' },
  { id: 'claude-opus-4-6',           label: 'Opus 4.6',    provider: 'anthropic' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',   provider: 'anthropic' },
]

// Stubs — wired up when Google key is added
export const GOOGLE_MODELS: ModelOption[] = [
  { id: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash', provider: 'google', stub: true },
  { id: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',   provider: 'google', stub: true },
]

export const DEFAULT_MODEL = 'claude-sonnet-4-6'
const SETTINGS_KEY = 'kortana.settings'

// ─── Store ────────────────────────────────────────────────────────────────────

interface SettingsState {
  selectedModel: string
  ollamaModels: ModelOption[]
  isOllamaAvailable: boolean
  isPickerOpen: boolean

  setModel: (id: string) => void
  setPickerOpen: (open: boolean) => void
  fetchOllamaModels: () => Promise<void>
  allModels: () => ModelOption[]
}

function loadPersistedModel(): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_MODEL
    const data = JSON.parse(raw) as { selectedModel?: string }
    return data.selectedModel ?? DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

function persistModel(id: string) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const existing = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...existing, selectedModel: id }))
  } catch { /* storage full */ }
}

async function syncModelToContextStore(model: string) {
  const body = {
    id: 'settings-model-001',
    type: 'Implementation',
    label: `Active model: ${model}`,
    status: 'accepted',
    source: 'agent-kortana',
    confidence: 1.0,
  }
  try {
    // Try PATCH first, fall back to POST if the node doesn't exist
    const patch = await fetch('http://localhost:4000/nodes/settings-model-001', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: body.label }),
    })
    if (!patch.ok) {
      await fetch('http://localhost:4000/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
  } catch {
    // Context store offline — settings still work locally
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  selectedModel: loadPersistedModel(),
  ollamaModels: [],
  isOllamaAvailable: false,
  isPickerOpen: false,

  setModel: (id) => {
    set({ selectedModel: id, isPickerOpen: false })
    persistModel(id)
    void syncModelToContextStore(id)
  },

  setPickerOpen: (open) => set({ isPickerOpen: open }),

  fetchOllamaModels: async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) })
      if (!res.ok) { set({ isOllamaAvailable: false }); return }
      const data = await res.json() as { models?: { name: string }[] }
      const models: ModelOption[] = (data.models ?? []).map((m) => ({
        id: m.name,
        label: m.name,
        provider: 'ollama' as const,
      }))
      set({ ollamaModels: models, isOllamaAvailable: true })
    } catch {
      set({ isOllamaAvailable: false })
    }
  },

  allModels: () => {
    const { ollamaModels } = get()
    return [...CLAUDE_MODELS, ...GOOGLE_MODELS, ...ollamaModels]
  },
}))
