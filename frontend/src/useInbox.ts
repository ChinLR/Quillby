import { useCallback, useEffect, useState } from 'react'
import { getInbox } from './api'
import type { Inbox } from './api'

// Polls the human-agent inbox every second while `active`.
export function useInbox(active: boolean) {
  const [inbox, setInbox] = useState<Inbox | null>(null)

  const refresh = useCallback(async () => {
    try {
      setInbox(await getInbox())
    } catch {
      setInbox(null)
    }
  }, [])

  useEffect(() => {
    if (!active) return
    let stopped = false
    let timer: number | undefined
    const tick = async () => {
      await refresh()
      if (!stopped) timer = window.setTimeout(tick, 1000)
    }
    tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [active, refresh])

  return { inbox: active ? inbox : null, refresh }
}
