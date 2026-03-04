import { useEffect } from 'react'
import { useConnectionStore } from '../store/connectionStore'

const HEALTH_URL = 'http://localhost:4000/health'
const FILE_URL = '/api/context'
const INTERVAL_MS = 10_000

export function useConnection() {
  const setStatus = useConnectionStore((s) => s.setStatus)

  useEffect(() => {
    const ping = async () => {
      // Tier 1: try context store API
      try {
        const res = await fetch(HEALTH_URL)
        if (res.ok) {
          setStatus('connected')
          return
        }
      } catch { /* fall through to tier 2 */ }

      // Tier 2: try local CONTEXT.md file endpoint
      try {
        const res = await fetch(FILE_URL)
        if (res.ok) {
          setStatus('file')
          return
        }
      } catch { /* fall through */ }

      setStatus('offline')
    }

    ping()
    const id = setInterval(ping, INTERVAL_MS)
    return () => clearInterval(id)
  }, [setStatus])
}
