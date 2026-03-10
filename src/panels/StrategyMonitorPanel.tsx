import { useEffect, useRef, useState } from 'react'
import { useWindowManagerStore } from '../store/windowManagerStore'

const ML_URL    = 'http://localhost:4005/api'
const QUANT_URL = 'http://localhost:4003/api'

const VOLUME_FEATURES = new Set([
  'volume_ratio', 'effort_result_score', 'volume_divergence_flag', 'absorption_flag',
])

// ── Types ──────────────────────────────────────────────────────────────────────

interface ModelStatusData {
  active:              boolean
  version:             string | null
  model_type:          string | null
  trained_at:          string | null
  n_samples:           number | null
  auc_roc:             number | null
  cv_auc_mean:         number | null
  feature_importances: Record<string, number> | null
}

interface PredRow {
  id:              string
  signal_event_id: string
  predicted_prob:  number
  model_version:   string
  predicted_at:    string
  win:             boolean | null
  resolution:      string | null
}

interface HistEntry {
  version:       string
  model_type:    string
  trained_at:    string
  n_samples:     number
  auc_roc:       number | null
  feature_count: number | null
  is_active:     boolean
}

interface SignalEvent {
  id:              string
  instrument:      string
  trend_direction: string
}

interface RegimeEntry {
  instrument:   string
  timeframe:    string
  regime_score: number
  components: {
    alignment_score:  number
    volatility_score: number
    win_rate_score:   number
    frequency_score:  number
  }
  n_resolved: number
}

// ── Backtest types (unchanged) ─────────────────────────────────────────────────

interface FixedOutcome { bars: number; move_pct: number; win: boolean }
interface TradeOutcome {
  signal_id: string; signal_ts: string; source: string
  entry_price: number; worry_line: number | null; target: number
  threshold_pct: number; resolution: string; bars_to_resolution: number | null
  exit_price: number | null; actual_move_pct: number | null; mae_pct: number | null
  natural_outcome: { bars_held: number; final_move_pct: number; win: boolean } | null
  fixed_outcomes: Record<string, FixedOutcome | null>; win: boolean | null
}
interface BacktestResult {
  instrument: string; timeframe: string; tc_period: number; trend_direction: string
  threshold_pct: number; n_total: number; n_resolved: number; n_open: number
  n_expired: number; win_rate: number | null; avg_actual_move_pct: number | null
  avg_mae_pct: number | null; expectancy_pct: number | null; outcomes: TradeOutcome[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function regimeBand(score: number): { label: string; cls: string } {
  if (score >= 0.70) return { label: 'STRONG', cls: 'regime-band--strong' }
  if (score >= 0.50) return { label: 'FAIR',   cls: 'regime-band--fair'   }
  return                     { label: 'WEAK',   cls: 'regime-band--weak'   }
}

function aucLabel(auc: number): string {
  if (auc < 0.55) return 'Weak'
  if (auc < 0.65) return 'Fair'
  if (auc < 0.75) return 'Good'
  return 'Strong'
}

function aucColor(auc: number): string {
  if (auc < 0.55) return 'var(--accent-red)'
  if (auc < 0.65) return 'var(--accent-amber)'
  if (auc < 0.75) return 'var(--accent-green)'
  return 'var(--accent-blue)'
}

function fmt(v: number | null, digits = 2, suffix = '%'): string {
  if (v === null || v === undefined) return '—'
  const s = v.toFixed(digits)
  return v > 0 ? `+${s}${suffix}` : `${s}${suffix}`
}

// ── Section 0: Regime Quality ─────────────────────────────────────────────────

type SortKey = 'regime_score' | 'instrument' | 'timeframe'

function RegimeSection({ regimes }: { regimes: RegimeEntry[] }) {
  const spawnPanel    = useWindowManagerStore(s => s.spawnPanel)
  const [sortKey, setSortKey] = useState<SortKey>('regime_score')
  const [sortAsc, setSortAsc] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(key !== 'regime_score') }
  }

  const sorted = [...regimes].sort((a, b) => {
    const mul = sortAsc ? 1 : -1
    if (sortKey === 'regime_score') return mul * (a.regime_score - b.regime_score)
    if (sortKey === 'instrument')   return mul * a.instrument.localeCompare(b.instrument)
    return mul * a.timeframe.localeCompare(b.timeframe)
  })

  function SortHdr({ col, label }: { col: SortKey; label: string }) {
    const active = sortKey === col
    return (
      <span
        className={`regime-th ${active ? 'regime-th--active' : ''}`}
        onClick={() => toggleSort(col)}
        style={{ cursor: 'pointer' }}
      >
        {label}{active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </span>
    )
  }

  return (
    <div className="ml-section">
      <div className="ml-section__header">
        <span className="ml-section__title">REGIME QUALITY</span>
        <span className="ml-section__subtitle">{regimes.length} instruments · 30d window</span>
      </div>
      {regimes.length === 0 ? (
        <div className="ml-empty">no signal data</div>
      ) : (
        <div className="regime-table">
          <div className="regime-header">
            <SortHdr col="instrument" label="INSTRUMENT" />
            <SortHdr col="timeframe"  label="TF" />
            <SortHdr col="regime_score" label="SCORE" />
            <span className="regime-th">BAND</span>
            <span className="regime-th">ALIGN</span>
            <span className="regime-th">WIN%</span>
          </div>
          {sorted.map(r => {
            const band = regimeBand(r.regime_score)
            return (
              <div
                key={`${r.instrument}|${r.timeframe}`}
                className="regime-row"
                onClick={() => spawnPanel('trading')}
                title={`Open Market View — ${r.instrument}`}
              >
                <span className="regime-cell regime-cell--inst">{r.instrument}</span>
                <span className="regime-cell regime-cell--tf">{r.timeframe}</span>
                <span className="regime-cell regime-cell--score">
                  {r.regime_score.toFixed(3)}
                </span>
                <span className={`regime-cell regime-band ${band.cls}`}>{band.label}</span>
                <span className="regime-cell">
                  {(r.components.alignment_score * 100).toFixed(0)}%
                </span>
                <span className="regime-cell">
                  {r.n_resolved > 0
                    ? `${(r.components.win_rate_score * 100).toFixed(0)}%`
                    : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Section 1: Model Status ───────────────────────────────────────────────────

function ModelStatusSection({
  status, training, trainMsg, onRetrain,
}: {
  status: ModelStatusData | null
  training: boolean
  trainMsg: string | null
  onRetrain: () => void
}) {
  return (
    <div className="ml-section">
      <div className="ml-section__header">
        <span className="ml-section__title">MODEL STATUS</span>
        <button className="strat-panel__run-btn" onClick={onRetrain} disabled={training}>
          {training ? 'TRAINING…' : 'RETRAIN'}
        </button>
      </div>

      {!status || !status.active ? (
        <div className="ml-empty">{!status ? 'loading…' : 'no model trained'}</div>
      ) : (
        <div className="ml-status-grid">
          <div className="ml-stat">
            <span className="ml-stat__label">VERSION</span>
            <span className="ml-stat__value ml-stat__value--badge">{status.version}</span>
          </div>
          <div className="ml-stat">
            <span className="ml-stat__label">TYPE</span>
            <span className="ml-stat__value">{status.model_type?.replace(/_/g, ' ')}</span>
          </div>
          <div className="ml-stat">
            <span className="ml-stat__label">AUC-ROC</span>
            <span className="ml-stat__value" style={{ color: status.auc_roc != null ? aucColor(status.auc_roc) : undefined }}>
              {status.auc_roc != null
                ? <>{status.auc_roc.toFixed(3)}{' '}<span className="ml-stat__qual">{aucLabel(status.auc_roc)}</span></>
                : '—'}
            </span>
          </div>
          <div className="ml-stat">
            <span className="ml-stat__label">CV AUC</span>
            <span className="ml-stat__value">{status.cv_auc_mean?.toFixed(3) ?? '—'}</span>
          </div>
          <div className="ml-stat">
            <span className="ml-stat__label">SAMPLES</span>
            <span className="ml-stat__value">{status.n_samples?.toLocaleString()}</span>
          </div>
          <div className="ml-stat ml-stat--wide">
            <span className="ml-stat__label">TRAINED</span>
            <span className="ml-stat__value ml-stat__value--dim">
              {status.trained_at?.slice(0, 16).replace('T', ' ')}
            </span>
          </div>
        </div>
      )}
      {trainMsg && <div className="ml-train-msg">{trainMsg}</div>}
    </div>
  )
}

// ── Section 2: Feature Importance ─────────────────────────────────────────────

function FeatureImportanceSection({ status }: { status: ModelStatusData | null }) {
  if (!status) return <div className="ml-section"><div className="ml-empty">loading…</div></div>
  if (!status.active || !status.feature_importances) {
    return <div className="ml-section"><div className="ml-empty">no model trained</div></div>
  }

  const sorted = Object.entries(status.feature_importances).sort(([, a], [, b]) => b - a)
  const max = Math.max(...sorted.map(([, v]) => v), 1e-9)

  return (
    <div className="ml-section">
      <div className="ml-section__header">
        <span className="ml-section__title">FEATURE IMPORTANCE</span>
        <span className="ml-section__subtitle">amber = volume</span>
      </div>
      <div className="ml-feat-chart">
        {sorted.map(([name, val]) => {
          const isVol = VOLUME_FEATURES.has(name)
          const pct = (val / max) * 100
          return (
            <div key={name} className="ml-feat-row">
              <span className={`ml-feat-name ${isVol ? 'ml-feat-name--vol' : ''}`} title={name}>
                {name.replace(/_/g, ' ')}
              </span>
              <div className="ml-feat-bar-wrap">
                <div className={`ml-feat-bar ${isVol ? 'ml-feat-bar--vol' : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="ml-feat-val">{val.toFixed(3)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 3: Recent Predictions ─────────────────────────────────────────────

function PredictionsSection({
  preds, eventMap,
}: {
  preds: PredRow[]
  eventMap: Map<string, SignalEvent>
}) {
  if (preds.length === 0) {
    return (
      <div className="ml-section">
        <div className="ml-section__header">
          <span className="ml-section__title">RECENT PREDICTIONS</span>
        </div>
        <div className="ml-empty">no predictions yet</div>
      </div>
    )
  }

  function outcomeClass(row: PredRow): string {
    if (row.win === null) return 'ml-pred__out--pending'
    const predictedWin = row.predicted_prob >= 0.5
    return predictedWin === row.win ? 'ml-pred__out--correct' : 'ml-pred__out--wrong'
  }

  function outcomeLabel(row: PredRow): string {
    if (row.win === null) return 'PENDING'
    return row.win ? 'WIN' : 'LOSS'
  }

  return (
    <div className="ml-section">
      <div className="ml-section__header">
        <span className="ml-section__title">RECENT PREDICTIONS</span>
        <span className="ml-section__subtitle">last 20</span>
      </div>
      <div className="ml-pred-table">
        <div className="ml-pred-header">
          <span>ID</span>
          <span>SIGNAL</span>
          <span>P(WIN)</span>
          <span>OUTCOME</span>
          <span>DATE</span>
        </div>
        {preds.map(row => {
          const ev = eventMap.get(row.signal_event_id)
          const probCls = row.predicted_prob >= 0.7 ? 'ml-pred__prob--high'
            : row.predicted_prob >= 0.5 ? 'ml-pred__prob--mid' : 'ml-pred__prob--low'
          return (
            <div key={row.id} className="ml-pred-row">
              <span className="ml-pred__id" title={row.signal_event_id}>
                {row.signal_event_id.slice(0, 8)}
              </span>
              <span className="ml-pred__inst">
                {ev ? `${ev.instrument} ${ev.trend_direction === 'up' ? '▲' : '▼'}` : '—'}
              </span>
              <span className={`ml-pred__prob ${probCls}`}>
                {Math.round(row.predicted_prob * 100)}%
              </span>
              <span className={`ml-pred__out ${outcomeClass(row)}`}>
                {outcomeLabel(row)}
              </span>
              <span className="ml-pred__at">{row.predicted_at.slice(0, 10)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Section 4: Performance Chart ──────────────────────────────────────────────

const V1_BASELINE = 0.622
const Y_MIN = 0.5
const Y_MAX = 1.0

function PerformanceChartSection({ history }: { history: HistEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const withAuc = history.filter(v => v.auc_roc != null)

  return (
    <div className="ml-section">
      <div className="ml-section__header">
        <span className="ml-section__title">PERFORMANCE OVER TIME</span>
        <span className="ml-section__subtitle">AUC-ROC per version</span>
      </div>
      {withAuc.length < 2 ? (
        <div className="ml-empty">
          {withAuc.length === 0
            ? 'no models trained'
            : 'Train a new model to compare performance over versions.'}
        </div>
      ) : (
        <div className="ml-perf-chart" ref={containerRef}>
          <AucLineChart versions={withAuc} />
        </div>
      )}
    </div>
  )
}

function AucLineChart({ versions }: { versions: HistEntry[] }) {
  const W = 260
  const H = 90
  const pad = { t: 12, r: 26, b: 20, l: 10 }
  const iW = W - pad.l - pad.r
  const iH = H - pad.t - pad.b

  const yPx = (auc: number) => pad.t + iH - ((auc - Y_MIN) / (Y_MAX - Y_MIN)) * iH
  const xPx = (i: number) => pad.l + (versions.length === 1 ? iW / 2 : i * (iW / (versions.length - 1)))

  const pts = versions.map((v, i) => ({ x: xPx(i), y: yPx(v.auc_roc!), v }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  const yRef05  = yPx(0.5)
  const yRefV1  = yPx(V1_BASELINE)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ml-perf-svg" preserveAspectRatio="xMidYMid meet">
      {/* 0.5 reference */}
      <line x1={pad.l} y1={yRef05} x2={pad.l + iW} y2={yRef05}
        stroke="var(--text-ghost)" strokeWidth="0.6" strokeDasharray="2,3" />
      <text x={pad.l + iW + 2} y={yRef05 + 3} fill="var(--text-ghost)" fontSize="5.5">0.5</text>

      {/* v1 baseline */}
      <line x1={pad.l} y1={yRefV1} x2={pad.l + iW} y2={yRefV1}
        stroke="var(--accent-amber)" strokeWidth="0.6" strokeDasharray="2,3" />
      <text x={pad.l + iW + 2} y={yRefV1 + 3} fill="var(--accent-amber)" fontSize="5.5">v1</text>

      {/* Line */}
      <path d={linePath} fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Points + labels */}
      {pts.map(({ x, y, v }) => (
        <g key={v.version}>
          <circle cx={x} cy={y} r={v.is_active ? 3.5 : 2.5}
            fill={v.is_active ? 'var(--accent-blue)' : 'var(--bg-surface)'}
            stroke="var(--accent-blue)" strokeWidth="1.5" />
          <text x={x} y={H - 4} textAnchor="middle" fill="var(--text-ghost)" fontSize="6">
            {v.version}
          </text>
          <text x={x} y={y - 5} textAnchor="middle" fill="var(--text-dim)" fontSize="5.5">
            {v.auc_roc!.toFixed(3)}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Backtest (existing functionality, extracted as component) ─────────────────

const INSTRUMENTS = ['QQQ', 'SPY', 'IWM', 'GLD', 'TLT', 'BTC-USD', 'ETH-USD']
const TIMEFRAMES  = ['1d', '1wk']
const TC_PERIODS  = [14, 42, 126]

function resolutionClass(r: string): string {
  if (r === 'target_hit') return 'strat-outcome__res--win'
  if (r === 'stop_hit')   return 'strat-outcome__res--loss'
  if (r === 'expired')    return 'strat-outcome__res--exp'
  return 'strat-outcome__res--open'
}

function resolutionLabel(r: string): string {
  if (r === 'target_hit') return 'TARGET'
  if (r === 'stop_hit')   return 'STOP'
  if (r === 'expired')    return 'EXPRD'
  return 'OPEN'
}

function BacktestContent() {
  const [instrument, setInstrument] = useState('QQQ')
  const [timeframe, setTimeframe]   = useState('1d')
  const [tcPeriod, setTcPeriod]     = useState(42)
  const [direction, setDirection]   = useState('up')
  const [threshold, setThreshold]   = useState('1.0')
  const [sourceFilter, setSource]   = useState('all')
  const [result, setResult]         = useState<BacktestResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function runBacktest() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        instrument, timeframe, tc_period: String(tcPeriod),
        trend_direction: direction, threshold: threshold || '1.0', source_filter: sourceFilter,
      })
      const res = await fetch(`${QUANT_URL}/market/backtest?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `HTTP ${res.status}`)
      }
      setResult(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="strat-panel__filters">
        <select className="sig-intel__filter-input" value={instrument} onChange={e => setInstrument(e.target.value)}>
          {INSTRUMENTS.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="sig-intel__filter-input sig-intel__filter-input--narrow" value={timeframe} onChange={e => setTimeframe(e.target.value)}>
          {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="sig-intel__filter-input sig-intel__filter-input--narrow" value={tcPeriod} onChange={e => setTcPeriod(Number(e.target.value))}>
          {TC_PERIODS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="sig-intel__filter-input sig-intel__filter-input--narrow" value={direction} onChange={e => setDirection(e.target.value)}>
          <option value="up">UP</option>
          <option value="down">DN</option>
        </select>
        <input className="sig-intel__filter-input strat-panel__threshold" type="number" step="0.1" min="0.1"
          value={threshold} onChange={e => setThreshold(e.target.value)} title="Win threshold %" />
        <select className="sig-intel__filter-input sig-intel__filter-input--narrow" value={sourceFilter} onChange={e => setSource(e.target.value)}>
          <option value="all">ALL</option>
          <option value="live">LIVE</option>
          <option value="backfill">FILL</option>
        </select>
        <button className="strat-panel__run-btn" onClick={runBacktest} disabled={loading}>
          {loading ? '…' : 'RUN'}
        </button>
      </div>

      {result && (
        <div className="strat-panel__stats">
          {[
            { label: 'N', val: result.n_total, color: undefined },
            { label: 'WIN', val: result.win_rate !== null ? `${(result.win_rate * 100).toFixed(0)}%` : '—',
              color: result.win_rate !== null ? (result.win_rate >= 0.5 ? 'var(--accent-green)' : 'var(--accent-red)') : undefined },
            { label: 'EXP', val: fmt(result.expectancy_pct),
              color: result.expectancy_pct !== null ? (result.expectancy_pct > 0 ? 'var(--accent-green)' : 'var(--accent-red)') : undefined },
            { label: 'AVG', val: fmt(result.avg_actual_move_pct), color: undefined },
            { label: 'MAE', val: fmt(result.avg_mae_pct), color: undefined },
            { label: 'OPEN', val: result.n_open, color: undefined, dim: true },
            { label: 'EXPRD', val: result.n_expired, color: undefined, dim: true },
          ].map(s => (
            <div key={s.label} className={`strat-stat ${s.dim ? 'strat-stat--dim' : ''}`}>
              <span className="strat-stat__label">{s.label}</span>
              <span className="strat-stat__value" style={{ color: s.color }}>{String(s.val)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="strat-panel__feed">
        {error && (
          <div className="sig-intel__empty">
            <div className="sig-intel__empty-dot" style={{ background: 'var(--accent-red)' }} />
            {error}
          </div>
        )}
        {!result && !loading && !error && (
          <div className="sig-intel__empty"><div className="sig-intel__empty-dot" />set parameters and run backtest</div>
        )}
        {result && result.outcomes.length === 0 && (
          <div className="sig-intel__empty"><div className="sig-intel__empty-dot" />no signal events matched</div>
        )}
        {result && result.outcomes.map(o => (
          <div key={o.signal_id} className="strat-outcome">
            <span className="strat-outcome__date">{o.signal_ts.slice(0, 10)}</span>
            <span className="strat-outcome__source">{o.source === 'backfill' ? 'FILL' : 'LIVE'}</span>
            <span className={`strat-outcome__res ${resolutionClass(o.resolution)}`}>{resolutionLabel(o.resolution)}</span>
            <span className="strat-outcome__bars">{o.bars_to_resolution !== null ? `${o.bars_to_resolution}b` : '—'}</span>
            <span className="strat-outcome__move" style={{
              color: o.actual_move_pct !== null ? (o.actual_move_pct > 0 ? 'var(--accent-green)' : 'var(--accent-red)') : undefined,
            }}>{fmt(o.actual_move_pct)}</span>
            <span className="strat-outcome__mae">{fmt(o.mae_pct)}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

type MLSection = 'regime' | 'status' | 'features' | 'predictions' | 'performance'

const ML_SECTIONS: { value: MLSection; label: string }[] = [
  { value: 'regime',      label: 'Regime Quality'      },
  { value: 'status',      label: 'Model Status'        },
  { value: 'features',    label: 'Feature Importance'  },
  { value: 'predictions', label: 'Recent Predictions'  },
  { value: 'performance', label: 'Performance Chart'   },
]

export default function StrategyMonitorPanel() {
  const [tab, setTab]             = useState<'ml' | 'backtest'>('ml')
  const [mlSection, setMlSection] = useState<MLSection>('regime')
  const [status, setStatus]       = useState<ModelStatusData | null>(null)
  const [history, setHistory]     = useState<HistEntry[]>([])
  const [preds, setPreds]         = useState<PredRow[]>([])
  const [eventMap, setEventMap]   = useState<Map<string, SignalEvent>>(new Map())
  const [regimes, setRegimes]     = useState<RegimeEntry[]>([])
  const [mlLoading, setMlLoading] = useState(true)
  const [training, setTraining]   = useState(false)
  const [trainMsg, setTrainMsg]   = useState<string | null>(null)

  function loadML() {
    setMlLoading(true)
    Promise.all([
      fetch(`${ML_URL}/ml/model/status`).then(r => r.json()),
      fetch(`${ML_URL}/ml/model/history`).then(r => r.json()),
      fetch(`${ML_URL}/ml/predictions?limit=20`).then(r => r.json()),
      fetch(`${QUANT_URL}/market/events?limit=200`).then(r => r.json()),
      fetch(`${ML_URL}/ml/regimes`).then(r => r.json()),
    ])
      .then(([st, hist, ml, quant, reg]) => {
        setStatus(st)
        setHistory(hist.versions ?? [])
        setPreds(ml.predictions ?? [])
        const map = new Map<string, SignalEvent>()
        for (const e of (quant.events ?? [])) map.set(e.id, e)
        setEventMap(map)
        setRegimes(reg.regimes ?? [])
      })
      .catch(() => {})
      .finally(() => setMlLoading(false))
  }

  useEffect(() => { loadML() }, [])

  async function retrain() {
    setTraining(true)
    setTrainMsg(null)
    try {
      const r = await fetch(`${ML_URL}/ml/train`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setTrainMsg(d.detail ?? 'error'); return }
      setTrainMsg(`${d.version} trained — AUC ${d.auc_roc?.toFixed(3) ?? '—'}`)
      loadML()
    } catch (e: unknown) {
      setTrainMsg(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setTraining(false)
    }
  }

  return (
    <div className="strat-panel">
      {/* Tab bar */}
      <div className="strat-panel__tabs">
        <button className={`strat-tab ${tab === 'ml' ? 'strat-tab--active' : ''}`} onClick={() => setTab('ml')}>ML</button>
        <button className={`strat-tab ${tab === 'backtest' ? 'strat-tab--active' : ''}`} onClick={() => setTab('backtest')}>BACKTEST</button>
      </div>

      {tab === 'ml' ? (
        <>
          {/* Section picker */}
          <div className="ml-section-bar">
            <select
              className="ml-section-select"
              value={mlSection}
              onChange={e => setMlSection(e.target.value as MLSection)}
            >
              {ML_SECTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Active section — fills remaining space */}
          <div className="ml-view">
            {mlLoading ? (
              <div className="ml-empty" style={{ padding: '16px 0' }}>loading ML data…</div>
            ) : (
              <>
                {mlSection === 'regime'      && <RegimeSection regimes={regimes} />}
                {mlSection === 'status'      && <ModelStatusSection status={status} training={training} trainMsg={trainMsg} onRetrain={retrain} />}
                {mlSection === 'features'    && <FeatureImportanceSection status={status} />}
                {mlSection === 'predictions' && <PredictionsSection preds={preds} eventMap={eventMap} />}
                {mlSection === 'performance' && <PerformanceChartSection history={history} />}
              </>
            )}
          </div>
        </>
      ) : (
        <BacktestContent />
      )}
    </div>
  )
}
