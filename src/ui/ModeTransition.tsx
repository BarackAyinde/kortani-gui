import { useEffect, useRef, useState } from 'react'
import { useWindowManagerStore } from '../store/windowManagerStore'
import type { CanvasMode } from '../types'

interface FlashState {
  text: string
  color: string
  key: number   // changing key forces React to remount → restarts animation
}

export default function ModeTransition() {
  const canvasMode = useWindowManagerStore((s) => s.canvasMode)
  const prevMode = useRef<CanvasMode>(canvasMode)
  const [flash, setFlash] = useState<FlashState | null>(null)

  useEffect(() => {
    if (prevMode.current === canvasMode) return
    prevMode.current = canvasMode

    setFlash({
      text: canvasMode === 'dashboard' ? 'DASHBOARD' : 'FREE MODE',
      color: canvasMode === 'dashboard' ? 'var(--accent-blue)' : 'var(--text-dim)',
      key: Date.now(),
    })
  }, [canvasMode])

  if (!flash) return null

  return (
    <div
      key={flash.key}
      className="mode-flash"
      onAnimationEnd={() => setFlash(null)}
    >
      <span className="mode-flash__label" style={{ color: flash.color }}>
        {flash.text}
      </span>
    </div>
  )
}
