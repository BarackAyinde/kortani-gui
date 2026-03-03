import { useEffect, useRef, useState } from 'react'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import type { PanelInstance } from '../types'

interface CanvasWindowProps {
  panel: PanelInstance
  focused: boolean
  children: React.ReactNode
}

const MIN_W = 220
const MIN_H = 120
const TITLE_H = 32

export default function CanvasWindow({ panel, focused, children }: CanvasWindowProps) {
  const { focusPanel, closePanel, movePanel, resizePanel, minimizePanel } =
    useWindowManagerStore()

  // Spawn / close animation state
  const [phase, setPhase] = useState<'spawning' | 'open' | 'closing'>('spawning')
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Spawn: two rAF frames so the browser renders the initial state before transitioning
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase('open')),
    )
    return () => {
      cancelAnimationFrame(id)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const handleClose = () => {
    setPhase('closing')
    closeTimerRef.current = setTimeout(() => closePanel(panel.id), 80)
  }

  // Drag
  const dragOffset = useRef({ x: 0, y: 0 })

  const onTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.canvas-window__btn')) return
    e.preventDefault()
    focusPanel(panel.id)
    dragOffset.current = { x: e.clientX - panel.x, y: e.clientY - panel.y }

    const onMove = (ev: MouseEvent) => {
      movePanel(panel.id, ev.clientX - dragOffset.current.x, ev.clientY - dragOffset.current.y)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Resize
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0 })

  const onResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      w: panel.width,
      h: panel.height,
    }

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(MIN_W, resizeStart.current.w + ev.clientX - resizeStart.current.mouseX)
      const h = Math.max(MIN_H, resizeStart.current.h + ev.clientY - resizeStart.current.mouseY)
      resizePanel(panel.id, w, h)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const def = PANEL_REGISTRY[panel.type]
  const contentH = panel.minimized ? 0 : panel.height - TITLE_H

  return (
    <div
      className={`canvas-window canvas-window--${phase}`}
      data-focused={focused}
      style={{
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: panel.minimized ? TITLE_H : panel.height,
        zIndex: panel.zIndex,
      }}
      onMouseDown={() => focusPanel(panel.id)}
    >
      {/* Title bar */}
      <div className="canvas-window__titlebar" onMouseDown={onTitleMouseDown}>
        <div className="canvas-window__title-left">
          <span className="canvas-window__icon">{def.icon}</span>
          <span className="canvas-window__label">{def.label}</span>
        </div>
        <div className="canvas-window__title-right">
          <button
            className="canvas-window__btn"
            onClick={() => minimizePanel(panel.id)}
            title={panel.minimized ? 'Restore' : 'Minimize'}
          >
            {panel.minimized ? '+' : '–'}
          </button>
          <button
            className="canvas-window__btn canvas-window__btn--close"
            onClick={handleClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="canvas-window__content" style={{ height: contentH }}>
        {children}
      </div>

      {/* Resize handle — hidden when minimized */}
      {!panel.minimized && (
        <div className="canvas-window__resize" onMouseDown={onResizeMouseDown} />
      )}
    </div>
  )
}
