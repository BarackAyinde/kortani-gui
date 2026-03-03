import { useEffect } from 'react'
import { useUIStore } from '../store/uiStore'
import { useWindowManagerStore } from '../store/windowManagerStore'
import { useConnectionStore } from '../store/connectionStore'
import { useConnection } from '../hooks/useConnection'
import { LAYOUT_PRESETS } from '../layouts/LAYOUT_PRESETS'
import StatusDot from '../ui/StatusDot'
import Badge from '../ui/Badge'

// Session start time — captured once at module load, never changes
const SESSION_START = new Date().toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
})

export default function TopBar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { canvasMode, activePreset, setActivePreset } = useWindowManagerStore()
  const status = useConnectionStore((s) => s.status)

  // Start polling the context store
  useConnection()

  // Cmd+Shift+K → toggle canvas mode (getState avoids stale closure)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        useWindowManagerStore.getState().toggleCanvasMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const presetIdx = LAYOUT_PRESETS.findIndex((p) => p.id === activePreset?.id)

  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <span className="top-bar__wordmark">KORTANA</span>
        <Badge
          label={canvasMode === 'free' ? 'FREE' : 'DASHBOARD'}
          variant={canvasMode === 'dashboard' ? 'active' : 'dim'}
        />
        {canvasMode === 'dashboard' && activePreset && (
          <>
            <button
              className="icon-btn"
              onClick={() => setActivePreset(LAYOUT_PRESETS[presetIdx - 1])}
              disabled={presetIdx <= 0}
              title="Previous layout"
            >
              ◂
            </button>
            <span key={activePreset.id} className="top-bar__layout-name">{activePreset.label}</span>
            <button
              className="icon-btn"
              onClick={() => setActivePreset(LAYOUT_PRESETS[presetIdx + 1])}
              disabled={presetIdx >= LAYOUT_PRESETS.length - 1}
              title="Next layout"
            >
              ▸
            </button>
          </>
        )}
      </div>

      <div className="top-bar__right">
        <StatusDot status={status} />
        <span className="top-bar__timestamp">{SESSION_START}</span>
        <button
          className="icon-btn"
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '›' : '‹'}
        </button>
      </div>
    </header>
  )
}
