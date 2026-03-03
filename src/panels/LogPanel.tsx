import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const WS_URL = 'ws://localhost:4000'

type Level = 'sys' | 'event' | 'err'

interface LogEntry {
  id: string
  ts: Date
  level: Level
  text: string
}

let entrySeq = 0
function makeEntry(level: Level, text: string): LogEntry {
  return { id: String(++entrySeq), ts: new Date(), level, text }
}

function fmtTime(d: Date): string {
  return d.toTimeString().slice(0, 8)
}

const ALL_LEVELS: Level[] = ['sys', 'event', 'err']
const LEVEL_LABELS: Record<Level, string> = { sys: 'SYS', event: 'EVT', err: 'ERR' }

export default function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([
    makeEntry('sys', 'log stream initialising…'),
  ])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [filter, setFilter] = useState('')
  const [levels, setLevels] = useState<Set<Level>>(new Set(ALL_LEVELS))
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const push = (entry: LogEntry) =>
    setEntries((prev) => [...prev.slice(-199), entry])

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus('live')
        push(makeEntry('sys', `connected → ${WS_URL}`))
      }

      ws.onmessage = (e: MessageEvent) => {
        let text = e.data as string
        try {
          const obj = JSON.parse(text) as Record<string, unknown>
          const type = (obj.type as string) ?? 'event'
          const label =
            typeof obj.node === 'object' && obj.node !== null
              ? ((obj.node as Record<string, unknown>).label as string | undefined)
              : typeof obj.edge === 'object' && obj.edge !== null
                ? `${(obj.edge as Record<string, unknown>).from_id} → ${(obj.edge as Record<string, unknown>).to_id}`
                : undefined
          text = label ? `${type}  ${label}` : type
        } catch {
          // use raw text
        }
        push(makeEntry('event', text))
      }

      ws.onerror = () => {
        push(makeEntry('err', 'websocket error'))
      }

      ws.onclose = () => {
        setStatus('offline')
        push(makeEntry('sys', 'disconnected'))
        wsRef.current = null
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [])

  const toggleLevel = useCallback((level: Level) => {
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }, [])

  const visible = useMemo(() => {
    const q = filter.toLowerCase()
    return entries.filter(
      (e) => levels.has(e.level) && (q === '' || e.text.toLowerCase().includes(q)),
    )
  }, [entries, filter, levels])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [visible])

  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value)
  }, [])

  const countLabel =
    filter !== '' || levels.size < ALL_LEVELS.length
      ? `${visible.length}/${entries.length}`
      : String(entries.length)

  return (
    <div className="log-panel">
      <div className="log-panel__status">
        <span className={`log-status log-status--${status}`}>
          {status === 'live' ? '● LIVE' : status === 'connecting' ? '○ CONNECTING' : '○ OFFLINE'}
        </span>
        <span className="log-panel__count">{countLabel} lines</span>
      </div>

      <div className="log-panel__filter">
        {ALL_LEVELS.map((lvl) => (
          <button
            key={lvl}
            className={`log-level-btn log-level-btn--${lvl}${levels.has(lvl) ? ' log-level-btn--active' : ''}`}
            onClick={() => toggleLevel(lvl)}
          >
            {LEVEL_LABELS[lvl]}
          </button>
        ))}
        <input
          className="log-filter-input"
          type="text"
          placeholder="filter…"
          value={filter}
          onChange={handleFilterChange}
          spellCheck={false}
        />
      </div>

      <div className="log-panel__body">
        {visible.map((e) => (
          <div key={e.id} className={`log-entry log-entry--${e.level}`}>
            <span className="log-entry__ts">{fmtTime(e.ts)}</span>
            <span className="log-entry__text">{e.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
