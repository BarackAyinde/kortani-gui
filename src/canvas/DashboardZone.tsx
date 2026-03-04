import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import type { LayoutDirective, LayoutPreset, PanelType } from '../types'

// Fallback AI layout when no directive has been received
const FALLBACK_LAYOUT: LayoutDirective = {
  focus: 'map',
  support: ['context', 'log', 'delta'],
  reason: 'default',
}

function DashboardPanel({ panelType, slot }: { panelType: PanelType; slot: string }) {
  const def = PANEL_REGISTRY[panelType]
  const Component = def?.component

  return (
    <div className="dash-panel" data-slot={slot}>
      <div className="dash-panel__header">
        <span className="dash-panel__icon">{def?.icon ?? '◻'}</span>
        <span className="dash-panel__label">{def?.label ?? panelType}</span>
        {slot === 'focus' && (
          <span className="dash-panel__focus-badge">FOCUS</span>
        )}
      </div>
      <div className="dash-panel__content">
        {Component ? (
          <Component />
        ) : (
          <div className="canvas-panel-placeholder">
            <span>{panelType}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Preset mode: renders the preset's original CSS grid layout exactly as defined
function PresetDashboard({ preset }: { preset: LayoutPreset }) {
  return (
    <div
      className="dashboard-zone dashboard-zone--preset"
      style={{
        display: 'grid',
        gridTemplateAreas: preset.gridTemplate,
        gridTemplateColumns: preset.gridCols,
        gridTemplateRows: preset.gridRows,
      }}
    >
      {preset.slots.map(({ area, panelType }) => (
        <div key={area} style={{ gridArea: area, minWidth: 0, minHeight: 0 }}>
          <DashboardPanel panelType={panelType} slot={area} />
        </div>
      ))}
    </div>
  )
}

// AI directive mode: 60/40 top/bottom flex layout driven by Kortana
function AIDashboard({ layout }: { layout: LayoutDirective }) {
  const supportPanels = layout.support.slice(0, 3)

  return (
    <div className="dashboard-zone dashboard-zone--ai">
      <div className="dash-slot dash-slot--focus">
        <DashboardPanel panelType={layout.focus} slot="focus" />
      </div>
      <div className="dash-slot dash-slot--support-row">
        {supportPanels.map((type) => (
          <div key={type} className="dash-slot--support">
            <DashboardPanel panelType={type} slot="support" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardZone() {
  const activePreset = useWindowManagerStore((s) => s.activePreset)
  const currentLayout = useWindowManagerStore((s) => s.currentLayout)

  if (activePreset) {
    return <PresetDashboard preset={activePreset} />
  }

  return <AIDashboard layout={currentLayout ?? FALLBACK_LAYOUT} />
}
