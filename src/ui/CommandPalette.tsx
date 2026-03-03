import { useEffect, useRef, useState } from 'react'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import { useUIStore } from '../store/uiStore'
import { useWindowManagerStore } from '../store/windowManagerStore'
import type { PanelType } from '../types'

const PANEL_TYPES = Object.keys(PANEL_REGISTRY) as PanelType[]

export default function CommandPalette() {
  const { setPaletteOpen } = useUIStore()
  const { spawnPanel } = useWindowManagerStore()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = PANEL_TYPES.filter((t) => {
    const q = query.toLowerCase()
    return (
      PANEL_REGISTRY[t].label.toLowerCase().includes(q) ||
      t.toLowerCase().includes(q)
    )
  })

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlighted(0)
  }, [query])

  // Auto-focus on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const select = (type: PanelType) => {
    spawnPanel(type)
    setPaletteOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (filtered[highlighted]) select(filtered[highlighted])
    } else if (e.key === 'Escape') {
      setPaletteOpen(false)
    }
  }

  return (
    <div className="palette-backdrop" onClick={() => setPaletteOpen(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette__input"
          placeholder="spawn panel…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="palette__list">
          {filtered.map((type, i) => {
            const def = PANEL_REGISTRY[type]
            return (
              <li
                key={type}
                className={`palette__item${i === highlighted ? ' palette__item--active' : ''}`}
                onClick={() => select(type)}
                onMouseEnter={() => setHighlighted(i)}
              >
                <span className="palette__icon">{def.icon}</span>
                <span className="palette__label">{def.label}</span>
                {!def.component && (
                  <span className="palette__badge">soon</span>
                )}
              </li>
            )
          })}
          {filtered.length === 0 && (
            <li className="palette__empty">no match</li>
          )}
        </ul>
      </div>
    </div>
  )
}
