import { useWindowManagerStore } from '../store/windowManagerStore'
import CanvasWindow from './CanvasWindow'

export default function CanvasZone() {
  const { panels, spawnPanel } = useWindowManagerStore()
  const maxZ = panels.reduce((m, p) => Math.max(m, p.zIndex), 0)

  return (
    <div className="canvas-zone" style={{ position: 'relative' }}>
      {panels.length === 0 && (
        <span className="canvas-zone__label">CANVAS</span>
      )}

      {panels.map((panel) => (
        <CanvasWindow key={panel.id} panel={panel} focused={panel.zIndex === maxZ}>
          {/* Panel content mounts in S-11/S-12 */}
          <div className="canvas-panel-placeholder">
            <span>{panel.type}</span>
          </div>
        </CanvasWindow>
      ))}

      {/* Temporary spawn button — replaced by Cmd+K in S-12 */}
      <button
        className="canvas-spawn-btn"
        onClick={() => spawnPanel('context')}
      >
        + panel
      </button>
    </div>
  )
}
