import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '../store/chatStore'

const QUANT_URL = 'http://localhost:4003/api'
const ML_URL    = 'http://localhost:4005/api'

interface SignalEvent {
  id: string
  timestamp: string
  instrument: string
  timeframe: string
  tc_period: number
  trend_direction: string
  channel_upper: number | null
  channel_lower: number | null
  worry_line: number | null
  close_price: number | null
  crossed_worry_line: boolean
  is_reversal: boolean
  human_summary: string | null
}

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function fetchProbMap(): Promise<Map<string, number>> {
  try {
    const r = await fetch(`${ML_URL}/ml/predictions?limit=200`)
    if (!r.ok) return new Map()
    const d = await r.json()
    const map = new Map<string, number>()
    for (const p of d.predictions ?? []) map.set(p.signal_event_id, p.predicted_prob)
    return map
  } catch {
    return new Map()
  }
}

function ProbBadge({ prob }: { prob: number | undefined }) {
  if (prob === undefined) return <span className="sig-prob sig-prob--none">—</span>
  const cls = prob >= 0.70 ? 'sig-prob--high' : prob >= 0.50 ? 'sig-prob--mid' : 'sig-prob--low'
  return <span className={`sig-prob ${cls}`}>{Math.round(prob * 100)}%</span>
}

async function fetchEvents(params: Record<string, string>): Promise<SignalEvent[]> {
  try {
    const qs = new URLSearchParams(params).toString()
    const r = await fetch(`${QUANT_URL}/market/events?limit=50${qs ? `&${qs}` : ''}`)
    if (!r.ok) return []
    const d = await r.json()
    return d.events ?? []
  } catch {
    return []
  }
}

export default function SignalIntelligencePanel() {
  const [events, setEvents]                         = useState<SignalEvent[]>([])
  const [probMap, setProbMap]                       = useState<Map<string, number>>(new Map())
  const [filterInstrument, setFilterInstrument]     = useState('')
  const [filterTimeframe, setFilterTimeframe]       = useState('')
  const [filterPeriod, setFilterPeriod]             = useState('')
  const setDraftInput = useChatStore(s => s.setDraftInput)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function load() {
    const params: Record<string, string> = {}
    if (filterInstrument) params.instrument = filterInstrument.toUpperCase()
    if (filterTimeframe)  params.timeframe  = filterTimeframe
    if (filterPeriod)     params.tc_period  = filterPeriod
    fetchEvents(params).then(setEvents)
    fetchProbMap().then(setProbMap)
  }

  useEffect(() => {
    load()
    intervalRef.current = setInterval(load, 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInstrument, filterTimeframe, filterPeriod])

  function handleEventClick(ev: SignalEvent) {
    const summary = ev.human_summary ?? `${ev.instrument} ${ev.trend_direction} on TC-${ev.tc_period} ${ev.timeframe}`
    setDraftInput(`Kortana, explain this signal: ${summary}`)
  }

  return (
    <div className="sig-intel-panel">
      <div className="sig-intel__filters">
        <span className="sig-intel__live-dot" title="Live — polling every 10s" />
        <input
          className="sig-intel__filter-input"
          placeholder="instrument…"
          value={filterInstrument}
          onChange={e => setFilterInstrument(e.target.value)}
          spellCheck={false}
        />
        <input
          className="sig-intel__filter-input"
          placeholder="timeframe…"
          value={filterTimeframe}
          onChange={e => setFilterTimeframe(e.target.value)}
          spellCheck={false}
        />
        <input
          className="sig-intel__filter-input sig-intel__filter-input--narrow"
          placeholder="period…"
          value={filterPeriod}
          onChange={e => setFilterPeriod(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="sig-intel__feed">
        {events.length === 0 ? (
          <div className="sig-intel__empty">
            <span className="sig-intel__empty-dot" />
            Waiting for signal events…
          </div>
        ) : (
          events.map(ev => (
            <button
              key={ev.id}
              className="sig-event"
              onClick={() => handleEventClick(ev)}
              title="Click to ask Kortana about this signal"
            >
              <div className="sig-event__meta">
                <span className="sig-event__instrument">{ev.instrument}</span>
                <span className="sig-event__timeframe">{ev.timeframe}</span>
                <span className="sig-event__period">TC-{ev.tc_period}</span>
                <span
                  className="sig-event__dir"
                  style={{ color: ev.trend_direction === 'up' ? 'var(--accent-green)' : 'var(--accent-red)' }}
                >
                  {ev.trend_direction === 'up' ? '▲' : '▼'} {ev.trend_direction.toUpperCase()}
                </span>
                <span className="sig-event__time">{relTime(ev.timestamp)}</span>
                <ProbBadge prob={probMap.get(ev.id)} />
              </div>
              <div className="sig-event__summary">{ev.human_summary}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
