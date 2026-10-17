import { useEffect, useMemo, useRef, useState } from 'react'
import { eventsUrl, getHistory, getNegotiation } from './api'
import type { CallState, Detection, EventEnvelope, Message, Offer, StatusUpdate, Tactic } from './api'

export type Connection = 'idle' | 'live' | 'polling'

const FINAL = ['won', 'walked_away', 'failed']

// How long the three dots show before a message lands, so the chat reads at human pace.
// Contract v2: show messages one at a time; never dump history while a run is live.
function thinkMs(m: Message, speed: number): number {
  if (m.sender === 'customer') return 0
  if (m.sender === 'system') return 400 / speed
  if (m.channel === 'call') return 900 / speed // call lines already arrive paced by the call
  if (m.clicked_button) return 900 / speed
  const reading = Math.min(m.text.length, 160) * 9
  const base = m.sender === 'customer_bot' ? 1400 : m.sender === 'human_agent' ? 1300 : 1100
  return Math.min(Math.max(base + reading, m.typing_ms), 3000) / speed
}

// Streams events over SSE (falls back to polling /history), then reveals them at a
// readable pace. Everything derived (chat, board, offers, status) comes from the
// revealed events only, so the board never spoils what the chat has not said yet.
export function useNegotiation(id: string | null, speed = 1) {
  const [events, setEvents] = useState<EventEnvelope[]>([])
  const [shownCount, setShownCount] = useState(0)
  const [instant, setInstant] = useState(false)
  const [connection, setConnection] = useState<Connection>('idle')
  const speedRef = useRef(speed)
  speedRef.current = speed

  useEffect(() => {
    setEvents([])
    setShownCount(0)
    setInstant(false)
    setConnection('idle')
    if (!id) return
    let lastSeq = 0
    let timer: number | undefined
    let stopped = false

    // A run that already finished (page reload) is shown straight away.
    getNegotiation(id)
      .then((s) => !stopped && setInstant(FINAL.includes(s.status)))
      .catch(() => {})

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

  // Reveal queue: non-message events pass straight through; a message waits its think time.
  useEffect(() => {
    if (shownCount >= events.length) return
    if (instant) {
      setShownCount(events.length)
      return
    }
    const next = events[shownCount]
    const wait = next.message ? thinkMs(next.message, speedRef.current) : 0
    const t = window.setTimeout(() => setShownCount((c) => Math.min(c + 1, events.length)), wait)
    return () => window.clearTimeout(t)
  }, [shownCount, events, instant])

  const shown = useMemo(() => events.slice(0, shownCount), [events, shownCount])

  const derived = useMemo(() => {
    const messages: Message[] = []
    const tactics: Tactic[] = []
    const offers: Offer[] = []
    let detection: Detection | null = null
    let status: StatusUpdate | null = null
    let call: CallState | null = null
    for (const e of shown) {
      if (e.message) messages.push(e.message)
      if (e.tactic) tactics.push(e.tactic)
      if (e.offer) offers.push(e.offer)
      if (e.detection) detection = e.detection
      if (e.status) status = e.status
      if (e.call) call = e.call
    }
    const tactic = tactics.at(-1) ?? null
    return {
      messages,
      tactics,
      tactic,
      offers,
      detection,
      status,
      call,
      pressure: tactic?.pressure ?? 0,
      humanReached: status?.human_reached ?? false,
    }
  }, [shown])

  // The next message still to land; its sender decides which side shows the dots.
  const pending = useMemo(() => {
    for (let i = shownCount; i < events.length; i++) if (events[i].message) return events[i].message ?? null
    return null
  }, [events, shownCount])

  // Raw (not yet revealed) feed, so the page can react the moment something happens,
  // even while the chat is still catching up at reading pace.
  const raw = useMemo(() => {
    const offers: Offer[] = []
    const messages: Message[] = []
    let status: StatusUpdate | null = null
    for (const e of events) {
      if (e.offer) offers.push(e.offer)
      if (e.message) messages.push(e.message)
      if (e.status) status = e.status
    }
    return { rawOffers: offers, rawMessages: messages, rawStatus: status }
  }, [events])

  return { ...derived, ...raw, pending, catchingUp: shownCount < events.length, connection }
}
