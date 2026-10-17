import { useEffect, useSyncExternalStore } from 'react'
import type { Mood } from './Sprite'

// What the companion is saying and doing. Pages set it; <Companion /> shows it.
//  working: there is a task on (documents, a negotiation). He docks at his post and works.
//           Otherwise he roams the screen freely. Clicking him toggles between the two.
export type Place = 'left' | 'right'
type State = { line: string; mood: Mood; place: Place; hidden: boolean; working: boolean }
let state: State = { line: '', mood: 'idle', place: 'left', hidden: false, working: false }
const listeners = new Set<() => void>()

const set = (next: State) => {
  if (
    state.line === next.line &&
    state.mood === next.mood &&
    state.place === next.place &&
    state.hidden === next.hidden &&
    state.working === next.working
  )
    return
  state = next
  listeners.forEach((f) => f())
}

export function useAssistantLine(line: string, mood: Mood = 'idle', opts: { place?: Place; hidden?: boolean; working?: boolean } = {}) {
  const place = opts.place ?? 'left'
  const hidden = opts.hidden ?? false
  const working = opts.working ?? false
  useEffect(() => {
    set({ line, mood, place, hidden, working })
  }, [line, mood, place, hidden, working])
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
