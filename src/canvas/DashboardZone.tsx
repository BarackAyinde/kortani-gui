import { useWindowManagerStore } from '../store/windowManagerStore'
import { PANEL_REGISTRY } from '../panels/PANEL_REGISTRY'
import type { PanelType } from '../types'

function DashboardPanel({ panelType }: { panelType: PanelType }) {
  const def = PANEL_REGISTRY[panelType]
  const Component = def.component

  return (
    <div className="dash-panel">
      <div className="dash-panel__header">
        <span className="dash-panel__icon">{def.icon}</span>
        <span className="dash-panel__label">{def.label}</span>
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

export default function DashboardZone() {
  const activePreset = useWindowManagerStore((s) => s.activePreset)

  if (!activePreset) return null

  return (
    <div
      className="dashboard-zone"
      style={{
        gridTemplateAreas: activePreset.gridTemplate,
        gridTemplateColumns: activePreset.gridCols,
        gridTemplateRows: activePreset.gridRows,
      }}
    >
      {activePreset.slots.map((slot) => (
        <div
          key={slot.area}
          className="dash-slot"
          style={{ gridArea: slot.area }}
        >
          <DashboardPanel panelType={slot.panelType} />
        </div>
      ))}
    </div>
  )
}
