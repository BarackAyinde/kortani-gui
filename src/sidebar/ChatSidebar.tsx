import { useCallback, useEffect, useRef, useState } from 'react'
import { useUIStore, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH } from '../store/uiStore'
import { useSettingsStore, CLAUDE_MODELS, GOOGLE_MODELS } from '../store/settingsStore'
import { useVoiceStore } from '../store/voiceStore'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

// ─── Model Picker ─────────────────────────────────────────────────────────────

function ModelPicker() {
  const { selectedModel, ollamaModels, isOllamaAvailable, isPickerOpen, setModel, setPickerOpen } =
    useSettingsStore()
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPickerOpen) return
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isPickerOpen, setPickerOpen])

  const activeLabel = (() => {
    const all = [...CLAUDE_MODELS, ...GOOGLE_MODELS, ...ollamaModels]
    const found = all.find((m) => m.id === selectedModel)
    return found ? found.label : selectedModel
  })()

  return (
    <div className="model-picker" ref={pickerRef}>
      <button
        className="model-picker__badge"
        onClick={() => setPickerOpen(!isPickerOpen)}
        title="Switch model"
      >
        {activeLabel}
        <span className="model-picker__caret">▾</span>
      </button>

      {isPickerOpen && (
        <div className="model-picker__dropdown">
          <div className="model-picker__group-label">Claude</div>
          {CLAUDE_MODELS.map((m) => (
            <button
              key={m.id}
              className="model-picker__option"
              data-active={m.id === selectedModel}
              onClick={() => setModel(m.id)}
            >
              {m.label}
            </button>
          ))}

          <div className="model-picker__group-label model-picker__group-label--stub">
            Google
            <span className="model-picker__stub-tag">STUB</span>
          </div>
          {GOOGLE_MODELS.map((m) => (
            <button
              key={m.id}
              className="model-picker__option model-picker__option--stub"
              data-active={m.id === selectedModel}
              onClick={() => setModel(m.id)}
              title="Gemini integration not yet implemented"
            >
              {m.label}
            </button>
          ))}

          {isOllamaAvailable && ollamaModels.length > 0 && (
            <>
              <div className="model-picker__group-label">Ollama (local)</div>
              {ollamaModels.map((m) => (
                <button
                  key={m.id}
                  className="model-picker__option"
                  data-active={m.id === selectedModel}
                  onClick={() => setModel(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </>
          )}

          {!isOllamaAvailable && (
            <div className="model-picker__ollama-offline">Ollama not detected</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Voice Settings Overlay ───────────────────────────────────────────────────

function VoiceSettings({ onClose }: { onClose: () => void }) {
  const { selectedMicId, selectedSpeakerId, chatterboxVoiceKey, setMicId, setSpeakerId, setVoiceKey } =
    useVoiceStore()
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
  const [voiceKeyInput, setVoiceKeyInput] = useState(chatterboxVoiceKey)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMics(devices.filter((d) => d.kind === 'audioinput'))
      setSpeakers(devices.filter((d) => d.kind === 'audiooutput'))
    }).catch(() => {})
  }, [])

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div className="voice-settings" ref={ref}>
      <div className="voice-settings__header">
        <span className="voice-settings__title">VOICE SETTINGS</span>
        <button className="voice-settings__close" onClick={onClose}>✕</button>
      </div>

      <div className="voice-settings__section">
        <label className="voice-settings__label">Microphone</label>
        <select
          className="voice-settings__select"
          value={selectedMicId ?? ''}
          onChange={(e) => setMicId(e.target.value || null)}
        >
          <option value="">Default</option>
          {mics.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="voice-settings__section">
        <label className="voice-settings__label">Speaker</label>
        <select
          className="voice-settings__select"
          value={selectedSpeakerId ?? ''}
          onChange={(e) => setSpeakerId(e.target.value || null)}
        >
          <option value="">Default</option>
          {speakers.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="voice-settings__section">
        <label className="voice-settings__label">Chatterbox voice key</label>
        <input
          className="voice-settings__input"
          value={voiceKeyInput}
          onChange={(e) => setVoiceKeyInput(e.target.value)}
          onBlur={() => setVoiceKey(voiceKeyInput)}
          placeholder="voices/system/default.wav"
          spellCheck={false}
        />
        <span className="voice-settings__hint">R2 path in your Chatterbox deployment</span>
      </div>
    </div>
  )
}

// ─── ChatSidebar ──────────────────────────────────────────────────────────────

export default function ChatSidebar() {
  const { sidebarOpen, sidebarWidth, setSidebarWidth } = useUIStore()
  const { fetchOllamaModels } = useSettingsStore()
  const { isVoiceActive, isSpeaking, toggleVoice } = useVoiceStore()
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => { void fetchOllamaModels() }, [fetchOllamaModels])

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const el = sidebarRef.current
    if (!el) return
    const startX = e.clientX
    const startWidth = sidebarWidth
    el.dataset.resizing = 'true'
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + startX - ev.clientX))
      el.style.width = `${w}px`
    }
    const onUp = () => {
      delete el.dataset.resizing
      const final = parseInt(el.style.width) || startWidth
      setSidebarWidth(final)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth, setSidebarWidth])

  return (
    <aside
      ref={sidebarRef}
      className="chat-sidebar"
      data-open={sidebarOpen}
      style={sidebarOpen ? { width: sidebarWidth } : undefined}
    >
      {sidebarOpen && (
        <div className="chat-sidebar__resize-handle" onMouseDown={onHandleMouseDown} />
      )}
      <div className="chat-sidebar__inner">
        <div className="chat-sidebar__header">
          <span className="chat-sidebar__title">CHAT</span>

          {/* Voice toggle */}
          <button
            className="chat-sidebar__voice-btn"
            data-active={isVoiceActive}
            data-speaking={isSpeaking}
            onClick={toggleVoice}
            title={isVoiceActive ? 'Disable voice mode' : 'Enable voice mode'}
          >
            {isSpeaking ? '◉' : '🎙'}
          </button>

          {/* Voice settings gear — only visible when voice is active */}
          {isVoiceActive && (
            <button
              className="chat-sidebar__voice-settings-btn"
              onClick={() => setShowVoiceSettings((v) => !v)}
              title="Voice settings"
            >
              ⚙
            </button>
          )}

          <ModelPicker />
        </div>

        {showVoiceSettings && isVoiceActive && (
          <VoiceSettings onClose={() => setShowVoiceSettings(false)} />
        )}

        <MessageList />
        <MessageInput />
      </div>
    </aside>
  )
}
