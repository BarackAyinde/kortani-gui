import type { ConnectionStatus } from '../store/connectionStore'

const TITLES: Record<ConnectionStatus, string> = {
  connected: 'Context store: online',
  file:      'Context: CONTEXT.md (file fallback)',
  offline:   'Context store: offline',
}

interface StatusDotProps {
  status: ConnectionStatus
}

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={`status-dot status-dot--${status}`}
      title={TITLES[status]}
    />
  )
}
