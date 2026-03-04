import { type ChangeEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'kortana.signals'
const MAX_SIGNALS = 50
const SIM_INTERVAL_MS = 45_000

type SignalType = 'alert' | 'note' | 'sys'

interface Signal {
  id: string
  ts: string   // ISO — JSON-serializable
  type: SignalType
  text: string
}

let seq = 0
function makeSignal(type: SignalType, text: string): Signal {
  return { id: String(++seq), ts: new Date().toISOString(), type, text }
}

const SIM_ALERTS = [
  'Context delta sync complete — 3 nodes updated',
  'Rackstack health check: all services nominal',
  'Graph edge density: 0.72 — within threshold',
  'Context store indexed — 16 nodes, 10 edges',
  'Delta API latency: 12ms avg',
  'WebSocket keepalive — connection stable',
  'Memory: 234 MB / 8 GB — nominal',
  'Session uptime exceeds 2h — checkpoint recommended',
]

let simIdx = 0

function loadSignals(): Signal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [makeSignal('sys', 'comms channel initialised')]
    return JSON.parse(raw) as Signal[]
  } catch {
    return [makeSignal('sys', 'comms channel initialised')]
  }
}

function saveSignals(signals: Signal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals.slice(-MAX_SIGNALS)))
  } catch { /* storage full */ }
}

function fmtTs(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 8)
}

export default function CommsPanel() {
  const [signals, setSignals] = useState<Signal[]>(loadSignals)
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const push = useCallback((sig: Signal) => {
    setSignals((prev) => {
      const next = [...prev, sig].slice(-MAX_SIGNALS)
      saveSignals(next)
      return next
    })
  }, [])

  // Simulated incoming alerts
  useEffect(() => {
    const id = setInterval(() => {
      const text = SIM_ALERTS[simIdx % SIM_ALERTS.length]!
      simIdx++
      push(makeSignal('alert', text))
    }, SIM_INTERVAL_MS)
    return () => clearInterval(id)
  }, [push])

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [signals])

  const send = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    push(makeSignal('note', text))
    setDraft('')
  }, [draft, push])

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send()
  }, [send])

  const onDraftChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
  }, [])

  const alertCount = signals.filter((s) => s.type === 'alert').length

  return (
    <div className="comms-panel">
      <div className="comms-panel__header">
        <span className="comms-panel__title">COMMS — AGENT NETWORK</span>
        {alertCount > 0 && (
          <span className="comms-panel__alert-count">{alertCount} alerts</span>
        )}
        <span className="comms-panel__total">{signals.length} entries</span>
      </div>

      {/* Agent roster */}
      <div className="comms-panel__roster">
        <div className="comms-agent">
          <span className="comms-agent__dot comms-agent__dot--offline" />
          <span className="comms-agent__name">JARVIS</span>
          <span className="comms-agent__status">OFFLINE — awaiting Rackstack</span>
        </div>
      </div>

      {/* Signals feed */}
      <div className="comms-panel__body">
        <div className="comms-panel__placeholder">
          Agent-to-agent communication requires the Rackstack comms layer.
          This panel will activate when Rackstack is running.
        </div>
        {signals.map((s) => (
          <div key={s.id} className={`signal signal--${s.type}`}>
            <span className="signal__ts">{fmtTs(s.ts)}</span>
            <span className="signal__type">{s.type.toUpperCase()}</span>
            <span className="signal__text">{s.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="comms-panel__footer">
        <input
          className="comms-compose__input"
          type="text"
          placeholder="operator note…"
          value={draft}
          onChange={onDraftChange}
          onKeyDown={onKeyDown}
          spellCheck={false}
          disabled
          title="Agent-to-agent comms not yet available"
        />
        <button
          className="comms-compose__send"
          disabled
          title="Agent-to-agent comms not yet available"
        >
          SEND
        </button>
      </div>
    </div>
  )
}
