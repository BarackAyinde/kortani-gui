import { useState, useEffect, useCallback } from 'react'

const TRADE_URL = 'http://localhost:4004/api'
const ML_URL    = 'http://localhost:4005'

const INSTRUMENTS = ['QQQ', 'SPY', 'IWM', 'GLD', 'TLT', 'BTC-USD', 'ETH-USD']
const TIMEFRAMES  = ['1d', '1wk']
const TC_PERIODS  = [14, 42, 126]
const STATUS_TABS = ['all', 'paper', 'open', 'closed', 'cancelled'] as const
const AUC_REQUIRED = 0.65

interface Settings { account_size: number; risk_per_trade_pct: number; currency: string }
interface SetupResult { size: number; rr_ratio: number; risk_amount: number; stop_distance: number; target_distance: number }

interface QueueItem {
  id: string; signal_event_id: string; instrument: string; timeframe: string
  tc_period: number | null; direction: string
  entry_price: number | null; stop_price: number | null; target_price: number | null
  size: number | null; rr_ratio: number | null; account_risk_pct: number | null
  regime_score: number | null; p_win: number | null
  status: string; override: number; reject_note: string | null
  trade_id: string | null; queued_at: string; resolved_at: string | null
}

interface ProvenanceSummary {
  regime_score: number | null; p_win: number | null; override: boolean
  ibkr_order_id: string | null; ibkr_status: string | null; regime_band: string | null
}
interface TCAlignment { current_trend: string; aligned: boolean; checked_at: string }
interface TradeOut {
  id: string; signal_event_id: string | null; instrument: string; timeframe: string
  tc_period: number | null; direction: string; entry_price: number; stop_price: number
  target_price: number; size: number; account_risk_pct: number; rr_ratio: number
  status: string; outcome_pct: number | null; opened_at: string; closed_at: string | null
  notes: string | null; created_at: string; updated_at: string
  override: number | null; ibkr_order_id: string | null; ibkr_status: string | null
  regime_score: number | null; p_win: number | null
}
interface TradeWithProvenance extends TradeOut {
  tc_alignment: TCAlignment | null
  provenance_summary: ProvenanceSummary | null
}

function computeSetup(entry: number, stop: number, target: number, settings: Settings): SetupResult {
  const stop_distance   = Math.abs(entry - stop)
  const target_distance = Math.abs(target - entry)
  const risk_amount     = settings.account_size * settings.risk_per_trade_pct / 100
  const size     = stop_distance > 0 ? risk_amount / stop_distance : 0
  const rr_ratio = stop_distance > 0 ? target_distance / stop_distance : 0
  return { size, rr_ratio, risk_amount, stop_distance, target_distance }
}

function dirClass(d: string) { return d === 'up' ? 'te-badge--up' : 'te-badge--dn' }
function statusClass(s: string) {
  if (s === 'closed')    return 'te-badge--closed'
  if (s === 'open')      return 'te-badge--open'
  if (s === 'cancelled') return 'te-badge--cancelled'
  return 'te-badge--paper'
}
function fmtPct(v: number | null) {
  if (v === null) return '—'
  return v > 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`
}
function fmtScore(v: number | null) { return v === null ? '—' : (v * 100).toFixed(0) + '%' }
function regimeBand(score: number | null): { label: string; cls: string } {
  if (score === null) return { label: '—', cls: '' }
  if (score >= 0.70) return { label: 'STRONG', cls: 'regime-band--strong' }
  if (score >= 0.50) return { label: 'FAIR',   cls: 'regime-band--fair'   }
  return              { label: 'WEAK',   cls: 'regime-band--weak'   }
}

export default function TradeEnginePanel() {
  const [view, setView] = useState<'queue' | 'setup' | 'journal'>('queue')

  // ── AUC gate state ────────────────────────────────────────────────────────────
  const [currentAuc, setCurrentAuc] = useState<number | null>(null)

  // ── queue state ───────────────────────────────────────────────────────────────
  const [queueItems,    setQueueItems]    = useState<QueueItem[]>([])
  const [queueTotal,    setQueueTotal]    = useState(0)
  const [queueLoading,  setQueueLoading]  = useState(false)
  const [queueError,    setQueueError]    = useState<string | null>(null)
  const [rejectId,      setRejectId]      = useState<string | null>(null)
  const [rejectNote,    setRejectNote]    = useState('')
  const [actionBusy,    setActionBusy]    = useState<string | null>(null)  // itemId during action

  // ── setup state ───────────────────────────────────────────────────────────────
  const [instrument, setInstrument] = useState('QQQ')
  const [timeframe,  setTimeframe]  = useState('1d')
  const [tcPeriod,   setTcPeriod]   = useState(42)
  const [direction,  setDirection]  = useState('up')
  const [entry,  setEntry]  = useState('')
  const [stop,   setStop]   = useState('')
  const [target, setTarget] = useState('')
  const [signalId, setSignalId] = useState('')
  const [notes,    setNotes]   = useState('')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null)
  const [setupError,  setSetupError]  = useState<string | null>(null)
  const [journaling, setJournaling]   = useState(false)

  // ── journal state ─────────────────────────────────────────────────────────────
  const [statusFilter,  setStatusFilter]  = useState<typeof STATUS_TABS[number]>('all')
  const [trades,        setTrades]        = useState<TradeOut[]>([])
  const [tradesTotal,   setTradesTotal]   = useState(0)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [tradesError,   setTradesError]   = useState<string | null>(null)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [provenance,    setProvenance]    = useState<Record<string, TradeWithProvenance | null>>({})
  const [closeForm,     setCloseForm]     = useState<Record<string, string>>({})
  const [kortanaMsg,    setKortanaMsg]    = useState<Record<string, string | null>>({})

  // ── fetch AUC ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${ML_URL}/ml/model/status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.auc_roc) setCurrentAuc(d.auc_roc) })
      .catch(() => {})
  }, [])

  const aucGateMet = currentAuc !== null && currentAuc >= AUC_REQUIRED

  // ── load queue ────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    setQueueLoading(true); setQueueError(null)
    try {
      const r = await fetch(`${TRADE_URL}/queue`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setQueueItems(d.items); setQueueTotal(d.total)
    } catch (e: unknown) {
      setQueueError(e instanceof Error ? e.message : 'fetch failed')
    } finally { setQueueLoading(false) }
  }, [])

  useEffect(() => { if (view === 'queue') loadQueue() }, [view, loadQueue])

  // ── approve / reject ──────────────────────────────────────────────────────────
  async function handleApprove(itemId: string) {
    setActionBusy(itemId)
    try {
      const r = await fetch(`${TRADE_URL}/queue/${itemId}/approve`, { method: 'POST' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      loadQueue()
    } catch (e: unknown) {
      setQueueError(e instanceof Error ? e.message : 'approve failed')
    } finally { setActionBusy(null) }
  }

  async function handleReject(itemId: string, note: string) {
    setActionBusy(itemId)
    try {
      const r = await fetch(`${TRADE_URL}/queue/${itemId}/reject`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setRejectId(null); setRejectNote('')
      loadQueue()
    } catch (e: unknown) {
      setQueueError(e instanceof Error ? e.message : 'reject failed')
    } finally { setActionBusy(null) }
  }

  // ── settings ──────────────────────────────────────────────────────────────────
  async function loadSettings(): Promise<Settings | null> {
    try {
      const r = await fetch(`${TRADE_URL}/settings`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json(); setSettings(d); return d
    } catch { return null }
  }

  // ── setup compute ─────────────────────────────────────────────────────────────
  async function handleCompute() {
    setSetupError(null)
    const e = parseFloat(entry), s = parseFloat(stop), t = parseFloat(target)
    if ([e, s, t].some(isNaN)) { setSetupError('entry, stop and target must be numbers'); return }
    const cfg = settings ?? await loadSettings()
    if (!cfg) { setSetupError('could not reach kortana-trade (port 4004)'); return }
    setSetupResult(computeSetup(e, s, t, cfg))
  }

  // ── journal trade ─────────────────────────────────────────────────────────────
  async function handleJournal() {
    if (!setupResult) return
    setJournaling(true)
    try {
      const r = await fetch(`${TRADE_URL}/market/trades`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signal_event_id: signalId || null,
          instrument, timeframe, tc_period: tcPeriod, direction,
          entry_price: parseFloat(entry), stop_price: parseFloat(stop), target_price: parseFloat(target),
          notes: notes || null,
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setView('journal')
    } catch (e: unknown) {
      setSetupError(e instanceof Error ? e.message : 'journal failed')
    } finally { setJournaling(false) }
  }

  // ── load trades ───────────────────────────────────────────────────────────────
  const loadTrades = useCallback(async () => {
    setTradesLoading(true); setTradesError(null)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const r = await fetch(`${TRADE_URL}/market/trades?${params}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setTrades(d.trades); setTradesTotal(d.total)
    } catch (e: unknown) {
      setTradesError(e instanceof Error ? e.message : 'fetch failed')
    } finally { setTradesLoading(false) }
  }, [statusFilter])

  useEffect(() => { if (view === 'journal') loadTrades() }, [view, loadTrades])

  // ── expand + fetch provenance ─────────────────────────────────────────────────
  async function toggleExpand(trade: TradeOut) {
    const id = trade.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (provenance[id] !== undefined) return
    try {
      const r = await fetch(`${TRADE_URL}/market/trades/${id}`)
      if (!r.ok) throw new Error()
      const d: TradeWithProvenance = await r.json()
      setProvenance(p => ({ ...p, [id]: d }))
    } catch {
      setProvenance(p => ({ ...p, [id]: null }))
    }
  }

  // ── Ask Kortana ───────────────────────────────────────────────────────────────
  async function handleAskKortana(trade: TradeOut) {
    const id = trade.id
    const prov = provenance[id]
    const summary = [
      `Trade: ${trade.direction.toUpperCase()} ${trade.instrument} ${trade.timeframe}`,
      `Entry: ${trade.entry_price} | Stop: ${trade.stop_price} | Target: ${trade.target_price}`,
      `R:R: ${trade.rr_ratio.toFixed(2)} | Size: ${trade.size.toFixed(4)}`,
      prov?.provenance_summary?.regime_score != null
        ? `Regime: ${(prov.provenance_summary.regime_score * 100).toFixed(0)}% (${prov.provenance_summary.regime_band})`
        : null,
      prov?.provenance_summary?.p_win != null
        ? `P(win): ${(prov.provenance_summary.p_win * 100).toFixed(0)}%`
        : null,
      prov?.provenance_summary?.override ? 'Approved under manual override (AUC gate not met)' : null,
      prov?.provenance_summary?.ibkr_order_id
        ? `IBKR order: ${prov.provenance_summary.ibkr_order_id} (${prov.provenance_summary.ibkr_status})`
        : null,
      trade.notes ?? null,
    ].filter(Boolean).join('\n')

    setKortanaMsg(p => ({ ...p, [id]: summary }))
  }

  // ── patch trade ───────────────────────────────────────────────────────────────
  async function patchTrade(id: string, body: object) {
    await fetch(`${TRADE_URL}/market/trades/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    loadTrades()
  }

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="trade-engine">

      {/* view tabs */}
      <div className="trade-engine__view-tabs">
        <button className={`trade-engine__view-tab${view === 'queue'   ? ' trade-engine__view-tab--active' : ''}`} onClick={() => setView('queue')}>
          QUEUE {queueTotal > 0 && <span className="trade-engine__count">{queueTotal}</span>}
        </button>
        <button className={`trade-engine__view-tab${view === 'setup'   ? ' trade-engine__view-tab--active' : ''}`} onClick={() => setView('setup')}>SETUP</button>
        <button className={`trade-engine__view-tab${view === 'journal' ? ' trade-engine__view-tab--active' : ''}`} onClick={() => setView('journal')}>
          JOURNAL {tradesTotal > 0 && <span className="trade-engine__count">{tradesTotal}</span>}
        </button>
      </div>

      {/* AUC banner — shown in queue + setup */}
      {(view === 'queue' || view === 'setup') && !aucGateMet && (
        <div className="te-auc-banner">
          Model gate not met — AUC {currentAuc !== null ? currentAuc.toFixed(4) : '…'} / {AUC_REQUIRED} required.
          Manual override active. Approvals logged with <code>override=true</code>.
        </div>
      )}

      {/* ── QUEUE VIEW ── */}
      {view === 'queue' && (
        <div className="te-queue">
          <div className="te-queue__toolbar">
            <span className="te-queue__label">PENDING APPROVALS</span>
            <button className="te-journal__refresh" onClick={loadQueue}>↺</button>
          </div>

          {queueError && (
            <div className="sig-intel__empty">
              <div className="sig-intel__empty-dot" style={{ background: 'var(--accent-red)' }} />
              {queueError}
            </div>
          )}

          {!queueLoading && queueItems.length === 0 && !queueError && (
            <div className="sig-intel__empty">
              <div className="sig-intel__empty-dot" />
              no pending signals — poller checks every 60s
            </div>
          )}

          {queueItems.map(item => {
            const { label: bandLabel, cls: bandCls } = regimeBand(item.regime_score)
            const busy = actionBusy === item.id
            const rejecting = rejectId === item.id

            return (
              <div key={item.id} className="te-queue-card">
                <div className="te-queue-card__header">
                  <span className={`te-badge ${dirClass(item.direction)}`}>{item.direction === 'up' ? 'UP' : 'DN'}</span>
                  <span className="te-queue-card__instrument">{item.instrument}</span>
                  <span className="te-queue-card__tf">{item.timeframe}</span>
                  {item.tc_period && <span className="te-queue-card__tc">TC-{item.tc_period}</span>}
                </div>

                <div className="te-queue-card__scores">
                  <div className="te-queue-card__score-cell">
                    <span className="te-queue-card__score-label">REGIME</span>
                    <span className={`te-queue-card__score-val regime-band ${bandCls}`}>
                      {fmtScore(item.regime_score)}
                      {bandLabel !== '—' && <span className="te-queue-card__band"> {bandLabel}</span>}
                    </span>
                  </div>
                  <div className="te-queue-card__score-cell">
                    <span className="te-queue-card__score-label">P(WIN)</span>
                    <span className="te-queue-card__score-val" style={{ color: (item.p_win ?? 0) >= 0.65 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {fmtScore(item.p_win)}
                    </span>
                  </div>
                  {item.rr_ratio != null && (
                    <div className="te-queue-card__score-cell">
                      <span className="te-queue-card__score-label">R:R</span>
                      <span className="te-queue-card__score-val">{item.rr_ratio.toFixed(2)}</span>
                    </div>
                  )}
                  {item.size != null && (
                    <div className="te-queue-card__score-cell">
                      <span className="te-queue-card__score-label">SIZE</span>
                      <span className="te-queue-card__score-val">{item.size.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {item.entry_price != null && (
                  <div className="te-queue-card__prices">
                    E {item.entry_price} · S {item.stop_price} · T {item.target_price}
                  </div>
                )}

                {!aucGateMet && (
                  <div className="te-queue-card__override-note">override mode</div>
                )}

                {!rejecting ? (
                  <div className="te-queue-card__actions">
                    <button
                      className="te-action-btn te-action-btn--approve"
                      disabled={busy}
                      onClick={() => handleApprove(item.id)}
                    >
                      {busy ? '…' : 'APPROVE'}
                    </button>
                    <button
                      className="te-action-btn te-action-btn--reject"
                      disabled={busy}
                      onClick={() => { setRejectId(item.id); setRejectNote('') }}
                    >
                      REJECT
                    </button>
                  </div>
                ) : (
                  <div className="te-close-form" onClick={e => e.stopPropagation()}>
                    <input
                      className="sig-intel__filter-input te-close-form__input"
                      placeholder="reason (optional)"
                      value={rejectNote}
                      onChange={e => setRejectNote(e.target.value)}
                    />
                    <button className="te-action-btn te-action-btn--reject" disabled={busy} onClick={() => handleReject(item.id, rejectNote)}>
                      {busy ? '…' : 'CONFIRM'}
                    </button>
                    <button className="te-action-btn" onClick={() => { setRejectId(null); setRejectNote('') }}>×</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SETUP VIEW ── */}
      {view === 'setup' && (
        <div className="te-setup">
          <div className="te-setup__grid">
            <label className="te-setup__field">
              <span className="te-setup__label">INSTRUMENT</span>
              <select className="sig-intel__filter-input" value={instrument} onChange={e => setInstrument(e.target.value)}>
                {INSTRUMENTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="te-setup__field">
              <span className="te-setup__label">TIMEFRAME</span>
              <select className="sig-intel__filter-input" value={timeframe} onChange={e => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="te-setup__field">
              <span className="te-setup__label">TC PERIOD</span>
              <select className="sig-intel__filter-input" value={tcPeriod} onChange={e => setTcPeriod(Number(e.target.value))}>
                {TC_PERIODS.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="te-setup__field">
              <span className="te-setup__label">DIRECTION</span>
              <select className="sig-intel__filter-input" value={direction} onChange={e => setDirection(e.target.value)}>
                <option value="up">UP</option>
                <option value="down">DOWN</option>
              </select>
            </label>
            <label className="te-setup__field te-setup__field--full">
              <span className="te-setup__label">SIGNAL ID (optional)</span>
              <input className="sig-intel__filter-input" value={signalId} onChange={e => setSignalId(e.target.value)} placeholder="paste signal_event_id" />
            </label>
            <label className="te-setup__field">
              <span className="te-setup__label">ENTRY</span>
              <input className="sig-intel__filter-input" type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} placeholder="0.00" />
            </label>
            <label className="te-setup__field">
              <span className="te-setup__label">STOP</span>
              <input className="sig-intel__filter-input" type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} placeholder="0.00" />
            </label>
            <label className="te-setup__field te-setup__field--full">
              <span className="te-setup__label">TARGET</span>
              <input className="sig-intel__filter-input" type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" />
            </label>
            <label className="te-setup__field te-setup__field--full">
              <span className="te-setup__label">NOTES</span>
              <input className="sig-intel__filter-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="optional" />
            </label>
          </div>

          <button className="strat-panel__run-btn te-setup__compute-btn" onClick={handleCompute}>COMPUTE</button>

          {setupError && <div className="te-setup__error">{setupError}</div>}

          {setupResult && (
            <div className="te-setup__result">
              <div className="strat-panel__stats">
                <div className="strat-stat">
                  <span className="strat-stat__label">SIZE</span>
                  <span className="strat-stat__value">{setupResult.size.toFixed(2)}</span>
                </div>
                <div className="strat-stat">
                  <span className="strat-stat__label">R:R</span>
                  <span className="strat-stat__value" style={{ color: setupResult.rr_ratio >= 2 ? 'var(--accent-green)' : setupResult.rr_ratio >= 1 ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                    {setupResult.rr_ratio.toFixed(2)}
                  </span>
                </div>
                <div className="strat-stat">
                  <span className="strat-stat__label">RISK</span>
                  <span className="strat-stat__value">{settings?.currency ?? ''}{setupResult.risk_amount.toFixed(0)}</span>
                </div>
                <div className="strat-stat">
                  <span className="strat-stat__label">STOP%</span>
                  <span className="strat-stat__value" style={{ color: 'var(--accent-red)' }}>
                    {entry ? `${(setupResult.stop_distance / parseFloat(entry) * 100).toFixed(2)}%` : '—'}
                  </span>
                </div>
                <div className="strat-stat">
                  <span className="strat-stat__label">TGT%</span>
                  <span className="strat-stat__value" style={{ color: 'var(--accent-green)' }}>
                    {entry ? `+${(setupResult.target_distance / parseFloat(entry) * 100).toFixed(2)}%` : '—'}
                  </span>
                </div>
              </div>
              <button className="te-setup__journal-btn" onClick={handleJournal} disabled={journaling}>
                {journaling ? '…' : '▶ JOURNAL IT'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── JOURNAL VIEW ── */}
      {view === 'journal' && (
        <div className="te-journal">
          <div className="te-journal__tabs">
            {STATUS_TABS.map(s => (
              <button key={s} className={`te-journal__tab${statusFilter === s ? ' te-journal__tab--active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s.toUpperCase()}
              </button>
            ))}
            <button className="te-journal__refresh" onClick={loadTrades}>↺</button>
          </div>

          <div className="strat-panel__feed">
            {tradesError && (
              <div className="sig-intel__empty">
                <div className="sig-intel__empty-dot" style={{ background: 'var(--accent-red)' }} />
                {tradesError}
              </div>
            )}
            {!tradesLoading && trades.length === 0 && !tradesError && (
              <div className="sig-intel__empty">
                <div className="sig-intel__empty-dot" />
                no trades — use Setup to journal one
              </div>
            )}

            {trades.map(t => {
              const isExpanded  = expandedId === t.id
              const prov        = provenance[t.id]
              const closingThis = closeForm[t.id] !== undefined
              const askMsg      = kortanaMsg[t.id]
              const band        = regimeBand(t.regime_score)

              return (
                <div key={t.id} className={`te-trade${isExpanded ? ' te-trade--expanded' : ''}`}>
                  <div className="te-trade__header" onClick={() => toggleExpand(t)}>
                    <span className={`te-badge ${dirClass(t.direction)}`}>{t.direction === 'up' ? 'UP' : 'DN'}</span>
                    <span className="te-trade__instrument">{t.instrument}</span>
                    <span className="te-trade__tf">{t.timeframe}</span>
                    <span className="te-trade__prices">{t.entry_price} → {t.stop_price} / {t.target_price}</span>
                    <span className="te-trade__rr">{t.rr_ratio.toFixed(1)}R</span>
                    <span className={`te-badge te-trade__outcome-cell ${t.outcome_pct !== null ? (t.outcome_pct > 0 ? 'te-badge--win' : 'te-badge--loss') : ''}`}>
                      {fmtPct(t.outcome_pct)}
                    </span>
                    <span className={`te-badge ${statusClass(t.status)}`}>{t.status.toUpperCase()}</span>
                    {t.override === 1 && <span className="te-badge te-badge--override" title="AUC gate override">OVR</span>}
                    {prov?.tc_alignment !== undefined && (
                      <span
                        className="te-trade__align-dot"
                        title={prov.tc_alignment ? `TC: ${prov.tc_alignment.current_trend} (${prov.tc_alignment.aligned ? 'aligned' : 'against'})` : 'alignment unavailable'}
                        style={{ background: prov.tc_alignment === null ? 'var(--text-ghost)' : prov.tc_alignment.aligned ? 'var(--accent-green)' : 'var(--accent-red)' }}
                      />
                    )}
                  </div>

                  {isExpanded && (
                    <div className="te-trade__detail">
                      <div className="te-trade__meta">
                        <span>size {t.size.toFixed(4)}</span>
                        <span>risk {t.account_risk_pct}%</span>
                        {t.tc_period && <span>TC-{t.tc_period}</span>}
                        <span>{t.opened_at.slice(0, 10)}</span>
                        {t.closed_at && <span>→ {t.closed_at.slice(0, 10)}</span>}
                      </div>
                      {t.signal_event_id && (
                        <div className="te-trade__sig-id">SIG {t.signal_event_id.slice(0, 16)}…</div>
                      )}
                      {t.notes && <div className="te-trade__notes">{t.notes}</div>}

                      {/* provenance summary */}
                      {(t.regime_score != null || t.ibkr_order_id != null) && (
                        <div className="te-provenance">
                          {t.regime_score != null && (
                            <span className={`te-provenance__item regime-band ${band.cls}`}>
                              REGIME {fmtScore(t.regime_score)} {band.label}
                            </span>
                          )}
                          {t.p_win != null && (
                            <span className="te-provenance__item">P(WIN) {fmtScore(t.p_win)}</span>
                          )}
                          {t.ibkr_order_id && (
                            <span className="te-provenance__item">IBKR #{t.ibkr_order_id}</span>
                          )}
                          {t.ibkr_status && (
                            <span className="te-provenance__item">{t.ibkr_status}</span>
                          )}
                          {t.override === 1 && (
                            <span className="te-provenance__item te-provenance__item--override">AUC OVERRIDE</span>
                          )}
                        </div>
                      )}

                      {prov?.tc_alignment && (
                        <div className="te-trade__align-info" style={{ color: prov.tc_alignment.aligned ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                          TC-{t.tc_period} now {prov.tc_alignment.current_trend.toUpperCase()} — {prov.tc_alignment.aligned ? 'ALIGNED' : 'AGAINST'}
                        </div>
                      )}

                      {/* Ask Kortana */}
                      <div className="te-trade__kortana">
                        <button
                          className="te-action-btn te-action-btn--kortana"
                          onClick={e => { e.stopPropagation(); handleAskKortana(t) }}
                        >
                          ASK KORTANA
                        </button>
                        {askMsg != null && (
                          <pre className="te-kortana-msg">{askMsg}</pre>
                        )}
                      </div>

                      {t.status !== 'closed' && t.status !== 'cancelled' && (
                        <div className="te-trade__actions">
                          {!closingThis ? (
                            <>
                              <button className="te-action-btn te-action-btn--close" onClick={e => { e.stopPropagation(); setCloseForm(p => ({ ...p, [t.id]: '' })) }}>CLOSE</button>
                              <button className="te-action-btn te-action-btn--cancel" onClick={e => { e.stopPropagation(); patchTrade(t.id, { status: 'cancelled' }) }}>CANCEL</button>
                              {t.status === 'paper' && <button className="te-action-btn" onClick={e => { e.stopPropagation(); patchTrade(t.id, { status: 'open' }) }}>MARK OPEN</button>}
                            </>
                          ) : (
                            <div className="te-close-form" onClick={e => e.stopPropagation()}>
                              <input
                                className="sig-intel__filter-input te-close-form__input"
                                type="number" step="0.01" placeholder="outcome %"
                                value={closeForm[t.id]}
                                onChange={e => setCloseForm(p => ({ ...p, [t.id]: e.target.value }))}
                              />
                              <button className="te-action-btn te-action-btn--close" onClick={() => {
                                patchTrade(t.id, { status: 'closed', outcome_pct: parseFloat(closeForm[t.id]) || null, closed_at: new Date().toISOString().slice(0, 19) })
                                setCloseForm(p => { const n = { ...p }; delete n[t.id]; return n })
                              }}>CONFIRM</button>
                              <button className="te-action-btn" onClick={() => setCloseForm(p => { const n = { ...p }; delete n[t.id]; return n })}>×</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
