import { useEffect, useMemo, useState } from 'react'
import { eventsUrl, getHistory } from './api'
import type { Detection, EventEnvelope, Message, Offer, StatusUpdate, Tactic } from './api'

export type Connection = 'idle' | 'live' | 'polling'

// Streams events over SSE; falls back to polling /history if the stream errors.
export function useNegotiation(id: string | null) {
  const [events, setEvents] = useState<EventEnvelope[]>([])
  const [connection, setConnection] = useState<Connection>('idle')

  useEffect(() => {
    setEvents([])
    setConnection('idle')
    if (!id) return
    let lastSeq = 0
    let timer: number | undefined
    let stopped = false

    const add = (incoming: EventEnvelope[]) => {
      const fresh = [...incoming].sort((a, b) => a.seq - b.seq).filter((e) => e.seq > lastSeq)
      if (!fresh.length) return
      lastSeq = fresh[fresh.length - 1].seq
      setEvents((prev) => [...prev, ...fresh])
    }

    const poll = () => {
      setConnection('polling')
      const tick = async () => {
        try {
          add((await getHistory(id, lastSeq)).events)
        } catch {
          /* keep polling */
        }
        if (!stopped) timer = window.setTimeout(tick, 1000)
      }
      tick()
    }

    const es = new EventSource(eventsUrl(id))
    es.onopen = () => setConnection('live')
    es.onmessage = (e) => add([JSON.parse(e.data) as EventEnvelope])
    es.onerror = () => {
      es.close()
      if (!stopped) poll()
    }

    return () => {
      stopped = true
      es.close()
      window.clearTimeout(timer)
    }
  }, [id])

  const derived = useMemo(() => {
    const messages: Message[] = []
    const tactics: Tactic[] = []
    const offers: Offer[] = []
    let detection: Detection | null = null
    let status: StatusUpdate | null = null
    for (const e of events) {
      if (e.message) messages.push(e.message)
      if (e.tactic) tactics.push(e.tactic)
      if (e.offer) offers.push(e.offer)
      if (e.detection) detection = e.detection
      if (e.status) status = e.status
    }
    const tactic = tactics.at(-1) ?? null
    return {
      messages,
      tactics,
      tactic,
      offers,
      detection,
      status,
      pressure: tactic?.pressure ?? 0,
      humanReached: status?.human_reached ?? false,
    }
  }, [events])

  return { ...derived, connection }
}
