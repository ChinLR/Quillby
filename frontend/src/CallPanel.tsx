import { useEffect, useState } from 'react'
import type { CallState, Message } from './api'
import { Chat } from './Chat'

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

// The phone phase: Northwind rings Counterbot's voice agent, the call transcript lands line by line.
export function CallPanel({
  call,
  lines,
  airline,
  goal,
  busy,
  canRecord,
  onRecord,
}: {
  call: CallState | null
  lines: Message[]
  airline: string
  goal: number
  busy: boolean
  canRecord: boolean
  onRecord: (amount: number, type: 'cash' | 'none') => void
}) {
  const live = call?.status === 'in_progress'
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!live) return
    setElapsed(0)
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [live])

  const seconds = Math.max(call?.duration_seconds ?? 0, live ? elapsed : 0)
  const waiting = !call || call.status === 'waiting'
  const title = waiting
    ? 'Waiting for the call'
    : live
      ? 'On the phone'
      : call.status === 'processing'
        ? 'Call ended, reading the transcript'
        : call.status === 'failed'
          ? 'Call failed'
          : 'Call finished'

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-900 text-white ring-1 ring-slate-800">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <span className="relative flex size-12 items-center justify-center rounded-full bg-emerald-500 text-2xl">
                    <span className="relative text-[11px] font-semibold tracking-[0.12em] uppercase" aria-hidden>
            Call
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{title}</p>
          {waiting && call?.phone_number ? (
            <p className="text-sm text-slate-300">
              {airline} is calling Counterbot on <b className="text-xl tracking-wide text-white tabular-nums">{call.phone_number}</b>
            </p>
          ) : waiting ? (
            <p className="text-sm text-slate-300">{airline} is about to call Counterbot.</p>
          ) : (
            <p className="text-sm text-slate-300">Counterbot's voice agent is negotiating live with {airline}.</p>
          )}
          {call?.detail && <p className="mt-1 text-xs text-amber-300">{call.detail}</p>}
        </div>
        {(live || seconds > 0) && <span className="rounded-lg bg-white/10 px-3 py-1.5 text-2xl font-semibold tabular-nums">{clock(seconds)}</span>}
      </div>

      {lines.length > 0 && (
        <div className="h-72 text-slate-900">
          <Chat messages={lines} mine={['customer_bot', 'customer']} empty="" />
        </div>
      )}

      {canRecord && (
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3">
          <span className="text-xs text-slate-400">If the call can't be read, record the result yourself:</span>
          <button disabled={busy} onClick={() => onRecord(goal, 'cash')} className="px-btn font-pixel bg-amber-300 px-3 py-1.5 text-xs text-slate-900 uppercase disabled:opacity-50">
            Record result: £{goal} cash
          </button>
          <button disabled={busy} onClick={() => onRecord(0, 'none')} className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 disabled:opacity-50">
            No deal
          </button>
        </div>
      )}
    </section>
  )
}
