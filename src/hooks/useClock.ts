import { useEffect, useState } from 'react'

/**
 * Returns a Date that updates every whole second, aligned to the system clock.
 * Multiple call-sites will tick in sync because they all align to the same
 * second boundary on mount.
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>

    // Delay until the next whole second so the tick is wall-clock aligned
    const msToNext = 1000 - (Date.now() % 1000)
    const timeoutId = setTimeout(() => {
      setNow(new Date())
      intervalId = setInterval(() => setNow(new Date()), 1000)
    }, msToNext)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(intervalId)
    }
  }, [])

  return now
}
