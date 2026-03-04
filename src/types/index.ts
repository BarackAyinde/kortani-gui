export type PanelType =
  | 'context'
  | 'map'
  | 'chat'
  | 'log'
  | 'delta'
  | 'trading'
  | 'comms'
  | 'terminal'
  | 'browser'

export interface PanelInstance {
  id: string
  type: PanelType
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  minimized: boolean
  props: Record<string, unknown>
}

export type CanvasMode = 'free' | 'dashboard'

export interface LayoutPreset {
  id: string
  label: string
  gridTemplate: string
  gridCols: string
  gridRows: string
  slots: {
    area: string
    panelType: PanelType
    defaultProps?: Record<string, unknown>
  }[]
}

export interface LayoutDirective {
  focus: PanelType
  support: PanelType[]
  reason?: string
}

export interface GraphNode {
  id: string
  type: string
  label: string
  status: string
  confidence?: number
  source?: string
  session_id?: string
  created_at: string
  updated_at: string
}

export interface GraphEdge {
  id: string
  from_id: string
  to_id: string
  type: string
  created_at: string
}
