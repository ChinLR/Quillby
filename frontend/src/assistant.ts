import { useEffect, useSyncExternalStore } from 'react'
import type { Mood } from './Sprite'

// What the on-screen companion is saying and where it stands. Pages set it; <Companion /> shows it.
export type Place = 'left' | 'right'
type State = { line: string; mood: Mood; place: Place; hidden: boolean }
let state: State = { line: '', mood: 'idle', place: 'left', hidden: false }
const listeners = new Set<() => void>()

const set = (next: State) => {
  if (state.line === next.line && state.mood === next.mood && state.place === next.place && state.hidden === next.hidden) return
  state = next
  listeners.forEach((f) => f())
}

// Idle on the left by default; pass place 'right' while it is working, hidden while a page draws it itself.
export function useAssistantLine(line: string, mood: Mood = 'idle', opts: { place?: Place; hidden?: boolean } = {}) {
  const place = opts.place ?? 'left'
  const hidden = opts.hidden ?? false
  useEffect(() => {
    set({ line, mood, place, hidden })
  }, [line, mood, place, hidden])
}

export function useAssistant(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}
