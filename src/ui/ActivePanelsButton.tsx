import { useEffect, useRef, useState } from 'react'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'

export default function ActivePanelsButton() {
  const [open, setOpen] = useState(false)
  const { panels, focusPanel, canvasMode, applyLayoutDirective } = useWindowManagerStore()
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // CMD+\ shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSelect = (panelId: string, panelType: string) => {
    if (canvasMode === 'dashboard') {
      // Bring to focus slot in dashboard mode
      applyLayoutDirective({
        focus: panelType as never,
        support: panels.filter((p) => p.id !== panelId).slice(0, 3).map((p) => p.type),
        reason: 'manual focus via active panels list',
      })
    } else {
      focusPanel(panelId)
    }
    setOpen(false)
  }

  if (panels.length === 0) return null

  return (
    <div className="active-panels" ref={ref}>
      <button
        className="active-panels__btn"
        onClick={() => setOpen((v) => !v)}
        title="Active panels (⌘\\)"
        aria-label="Show active panels"
      >
        ◫
      </button>

      {open && (
        <div className="active-panels__overlay">
          <div className="active-panels__header">OPEN PANELS</div>
          <ul className="active-panels__list">
            {panels.map((panel) => {
              const def = PANEL_REGISTRY[panel.type]
              return (
                <li
                  key={panel.id}
                  className="active-panels__item"
                  onClick={() => handleSelect(panel.id, panel.type)}
                >
                  <span className="active-panels__icon">{def?.icon ?? '◻'}</span>
                  <span className="active-panels__label">{def?.label ?? panel.type}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
