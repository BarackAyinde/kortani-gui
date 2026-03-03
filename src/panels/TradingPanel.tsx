import { useEffect, useState } from 'react'

const ASSETS = ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK'] as const
type Asset = (typeof ASSETS)[number]

const BASE: Record<Asset, number> = {
  BTC: 95000, ETH: 3500, SOL: 180, AVAX: 35, LINK: 20,
}

const VOL: Record<Asset, number> = {
  BTC: 0.0008, ETH: 0.001, SOL: 0.0015, AVAX: 0.0015, LINK: 0.002,
}

function walk(price: number, vol: number): number {
  return price * (1 + (Math.random() - 0.5) * vol)
}

function initHistory(base: number, vol: number, n = 60): number[] {
  const history: number[] = [base]
  for (let i = 1; i < n; i++) {
    history.push(walk(history[i - 1]!, vol))
  }
  return history
}

interface AssetState {
  price: number
  open: number
  history: number[]
}

function initState(): Record<Asset, AssetState> {
  return Object.fromEntries(
    ASSETS.map((a) => {
      const history = initHistory(BASE[a], VOL[a])
      return [a, { price: history.at(-1)!, open: history[0]!, history }]
    }),
  ) as Record<Asset, AssetState>
}

function fmt(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 10) return price.toFixed(2)
  return price.toFixed(4)
}

function pct(price: number, open: number): number {
  return ((price - open) / open) * 100
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 300
  const H = 50
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 2) + 1}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="trading-sparkline">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? 'var(--accent-green)' : 'var(--accent-red)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function TradingPanel() {
  const [assets, setAssets] = useState<Record<Asset, AssetState>>(initState)
  const [selected, setSelected] = useState<Asset>('BTC')

  useEffect(() => {
    const id = setInterval(() => {
      setAssets((prev) => {
        const next = { ...prev }
        for (const a of ASSETS) {
          const newPrice = walk(prev[a].price, VOL[a])
          next[a] = {
            ...prev[a],
            price: newPrice,
            history: [...prev[a].history.slice(-119), newPrice],
          }
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const selIdx = ASSETS.indexOf(selected)
  const sel = assets[selected]
  const selPct = pct(sel.price, sel.open)
  const selUp = selPct >= 0
  const others = ASSETS.filter((a) => a !== selected)

  return (
    <div className="trading-panel">
      {/* Header — asset selector */}
      <div className="trading-panel__header">
        <button
          className="icon-btn"
          disabled={selIdx <= 0}
          onClick={() => setSelected(ASSETS[selIdx - 1]!)}
        >
          ◂
        </button>
        <span className="trading-panel__pair">{selected}/USD</span>
        <button
          className="icon-btn"
          disabled={selIdx >= ASSETS.length - 1}
          onClick={() => setSelected(ASSETS[selIdx + 1]!)}
        >
          ▸
        </button>
        <span className="trading-panel__sim">SIMULATED</span>
      </div>

      {/* Main — focused price + sparkline */}
      <div className="trading-panel__main">
        <div className="trading-panel__price">${fmt(sel.price)}</div>
        <div className={`trading-panel__change trading-panel__change--${selUp ? 'up' : 'dn'}`}>
          {selUp ? '+' : ''}{selPct.toFixed(2)}%
        </div>
        <Sparkline data={sel.history} up={selUp} />
      </div>

      {/* Footer — other assets */}
      <div className="trading-panel__footer">
        {others.map((a) => {
          const d = assets[a]
          const p = pct(d.price, d.open)
          const up = p >= 0
          return (
            <button
              key={a}
              className="trading-mini"
              onClick={() => setSelected(a)}
            >
              <span className="trading-mini__sym">{a}</span>
              <span className="trading-mini__price">${fmt(d.price)}</span>
              <span className={`trading-mini__pct trading-mini__pct--${up ? 'up' : 'dn'}`}>
                {up ? '+' : ''}{p.toFixed(2)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
