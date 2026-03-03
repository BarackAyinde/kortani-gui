import type { PanelType } from '../types'

// Partial definition — component field is added in S-12 when panels exist
export interface PanelDefinition {
  label: string
  icon: string
  defaultSize: { w: number; h: number }
}

export const PANEL_REGISTRY: Record<PanelType, PanelDefinition> = {
  context:  { label: 'Context Graph',    icon: '◈', defaultSize: { w: 600, h: 400 } },
  map:      { label: 'Intelligence Map', icon: '◉', defaultSize: { w: 800, h: 500 } },
  chat:     { label: 'Chat',             icon: '◎', defaultSize: { w: 400, h: 500 } },
  log:      { label: 'Log Stream',       icon: '▣', defaultSize: { w: 700, h: 300 } },
  markdown: { label: 'Markdown',         icon: '▤', defaultSize: { w: 500, h: 400 } },
  trading:  { label: 'Trading',          icon: '▲', defaultSize: { w: 900, h: 500 } },
  comms:    { label: 'Comms',            icon: '⬡', defaultSize: { w: 500, h: 400 } },
}
