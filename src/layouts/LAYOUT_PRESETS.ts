import type { LayoutPreset } from '../types'

// ─── INTELLIGENCE ─────────────────────────────────────────────────────────────
// Context graph (60%) | Map (40%) — single row
// ┌────────────────────┬─────────────┐
// │  context           │  map        │
// └────────────────────┴─────────────┘

// ─── MONITOR ──────────────────────────────────────────────────────────────────
// Context (top-left) | Markdown (top-right) | Log strip (bottom full)
// ┌──────────┬──────────┐
// │ context  │ markdown │
// ├──────────┴──────────┤
// │       log           │
// └─────────────────────┘

// ─── ANALYSIS ─────────────────────────────────────────────────────────────────
// Context (left, full height) | Markdown (top-right) | Log (bottom-right)
// ┌──────────┬──────────┐
// │          │ markdown │
// │ context  ├──────────┤
// │          │   log    │
// └──────────┴──────────┘

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'intelligence',
    label: 'INTELLIGENCE',
    gridTemplate: '"context map"',
    gridCols: '3fr 2fr',
    gridRows: '1fr',
    slots: [
      { area: 'context', panelType: 'context' },
      { area: 'map',     panelType: 'map' },
    ],
  },
  {
    id: 'monitor',
    label: 'MONITOR',
    gridTemplate: '"context markdown" "log log"',
    gridCols: '1fr 1fr',
    gridRows: '3fr 1fr',
    slots: [
      { area: 'context',  panelType: 'context' },
      { area: 'markdown', panelType: 'markdown' },
      { area: 'log',      panelType: 'log' },
    ],
  },
  {
    id: 'analysis',
    label: 'ANALYSIS',
    gridTemplate: '"context markdown" "context log"',
    gridCols: '2fr 1fr',
    gridRows: '1fr 1fr',
    slots: [
      { area: 'context',  panelType: 'context' },
      { area: 'markdown', panelType: 'markdown' },
      { area: 'log',      panelType: 'log' },
    ],
  },
  // ─── TRADING ────────────────────────────────────────────────────────────────
  // Trading (left, large) | Comms (top-right) | Log (bottom-right)
  {
    id: 'trading',
    label: 'TRADING',
    gridTemplate: '"trading comms" "trading log"',
    gridCols: '3fr 2fr',
    gridRows: '3fr 1fr',
    slots: [
      { area: 'trading', panelType: 'trading' },
      { area: 'comms',   panelType: 'comms' },
      { area: 'log',     panelType: 'log' },
    ],
  },
]
