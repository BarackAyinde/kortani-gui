import type { ComponentType } from 'react'
import type { PanelType } from '../types'
import ContextPanel from './ContextPanel'
import MapPanel from './MapPanel'
import LogPanel from './LogPanel'
import MarkdownPanel from './MarkdownPanel'
import TradingPanel from './TradingPanel'
import CommsPanel from './CommsPanel'
import TerminalPanel from './TerminalPanel'

export interface PanelDefinition {
  label: string
  icon: string
  defaultSize: { w: number; h: number }
  component?: ComponentType
}

export const PANEL_REGISTRY: Record<PanelType, PanelDefinition> = {
  context:  { label: 'Context Graph',    icon: '◈', defaultSize: { w: 600, h: 400 }, component: ContextPanel },
  map:      { label: 'Intelligence Map', icon: '◉', defaultSize: { w: 800, h: 500 }, component: MapPanel },
  chat:     { label: 'Chat',             icon: '◎', defaultSize: { w: 400, h: 500 } },
  log:      { label: 'Log Stream',       icon: '▣', defaultSize: { w: 700, h: 300 }, component: LogPanel },
  markdown: { label: 'Markdown',         icon: '▤', defaultSize: { w: 500, h: 400 }, component: MarkdownPanel },
  trading:  { label: 'Trading',          icon: '▲', defaultSize: { w: 900, h: 500 }, component: TradingPanel },
  comms:    { label: 'Comms',            icon: '⬡', defaultSize: { w: 500, h: 400 }, component: CommsPanel },
  terminal: { label: 'Terminal',         icon: '▶', defaultSize: { w: 700, h: 400 }, component: TerminalPanel },
}
