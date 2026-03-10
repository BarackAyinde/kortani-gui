export interface KortanaTool {
  id: string
  label: string
  icon: string
  description: string
  status: 'live' | 'stub'
}

// Single source of truth for tools available to Kortana.
// Add new tools here and they'll appear in the input dropdown automatically.
export const KORTANA_TOOLS: KortanaTool[] = [
  {
    id: 'context',
    label: 'Context Graph',
    icon: '◈',
    description: 'Live knowledge graph injected into every message',
    status: 'live',
  },
  {
    id: 'browser',
    label: 'Browser',
    icon: '⬚',
    description: 'Web browsing and scraping via Firecrawl',
    status: 'live',
  },
  {
    id: 'map',
    label: 'Intelligence Map',
    icon: '◉',
    description: 'Geospatial and intelligence mapping',
    status: 'live',
  },
  {
    id: 'voice',
    label: 'Voice',
    icon: '◎',
    description: 'Speech input via Whisper, TTS via Chatterbox',
    status: 'live',
  },
  {
    id: 'log',
    label: 'Log Stream',
    icon: '▣',
    description: 'Real-time system and event log',
    status: 'live',
  },
  {
    id: 'delta',
    label: 'Code Delta',
    icon: '◫',
    description: 'File diff and code change viewer',
    status: 'live',
  },
  {
    id: 'trading',
    label: 'Trade Engine',
    icon: '▲',
    description: 'Quantitative trading and execution engine',
    status: 'live',
  },
  {
    id: 'comms',
    label: 'Comms',
    icon: '⬡',
    description: 'Communications and signal monitoring',
    status: 'live',
  },
  {
    id: 'terminal',
    label: 'Terminal',
    icon: '▶',
    description: 'Integrated shell terminal',
    status: 'live',
  },
]
