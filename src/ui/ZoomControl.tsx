import { useUIStore, ZOOM_LEVELS } from '../store/uiStore'

export default function ZoomControl() {
  const { zoom, zoomIn, zoomOut } = useUIStore()

  const idx = ZOOM_LEVELS.indexOf(zoom)
  const pct = Math.round(zoom * 100)

  return (
    <div className="zoom-control" title="Text zoom">
      <button
        className="icon-btn zoom-control__btn"
        onClick={zoomOut}
        disabled={idx <= 0}
        aria-label="Zoom out"
      >
        A−
      </button>
      <span className="zoom-control__label">{pct}%</span>
      <button
        className="icon-btn zoom-control__btn"
        onClick={zoomIn}
        disabled={idx >= ZOOM_LEVELS.length - 1}
        aria-label="Zoom in"
      >
        A+
      </button>
    </div>
  )
}
