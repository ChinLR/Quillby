import { useEffect, useState } from 'react'
import {
  getCase,
  getReport,
  pauseNegotiation,
  resetDemo,
  resumeNegotiation,
  sendTakeover,
  startNegotiation,
} from './api'
import type { Case, Report } from './api'
import { Chat } from './Chat'
import { ReportCard } from './ReportCard'
import { TacticBoard } from './TacticBoard'
import { useNegotiation } from './useNegotiation'

const ID_KEY = 'counterbot.negotiation'
const store = {
  get: () => {
    try {
      return localStorage.getItem(ID_KEY)
    } catch {
      return null
    }
  },
  set: (v: string | null) => {
    try {
      if (v) localStorage.setItem(ID_KEY, v)
      else localStorage.removeItem(ID_KEY)
    } catch {
      /* ignore */
    }
  },
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const delay = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

function CaseSummary({ c }: { c: Case }) {
  return (
    <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-slate-500">
          {c.passenger_name} · Booking {c.booking_ref} · {c.airline} {c.flight_number}
        </p>
        <p className="text-xl font-semibold text-slate-900">
          {c.origin} → {c.destination}
        </p>
        <p className="text-sm text-slate-600">
          Due {time(c.scheduled_arrival)}, landed {time(c.actual_arrival)}:{' '}
          <b className="text-rose-600">{delay(c.delay_minutes)} late</b>. Airline says “{c.airline_reason}”.
        </p>
        <details className="mt-1 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">{c.legal.title}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {c.legal.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">{c.legal.disclaimer}</p>
        </details>
      </div>
      <div className="flex gap-3 self-start">
        <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center">
          <p className="text-xs font-medium text-indigo-700">Goal</p>
          <p className="text-2xl font-bold text-indigo-900 tabular-nums">£{c.goal_gbp}</p>
        </div>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-600">Floor</p>
          <p className="text-2xl font-bold text-slate-800 tabular-nums">£{c.floor_gbp}</p>
        </div>
      </div>
    </section>
  )
}

export function Dashboard() {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [id, setId] = useState<string | null>(store.get)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [draft, setDraft] = useState('')
  const n = useNegotiation(id)

  const status = n.status?.status ?? (id ? 'running' : null)
  const finished = status === 'won' || status === 'walked_away' || status === 'failed'

  useEffect(() => {
    getCase().then(setCaseData).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    setReport(null)
    if (id && finished) getReport(id).then(setReport).catch((e) => setError(e.message))
  }, [id, finished])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const start = () =>
    run(async () => {
      const s = await startNegotiation({ speed })
      store.set(s.id)
      setId(s.id)
    })
  const reset = () =>
    run(async () => {
      await resetDemo()
      store.set(null)
      setId(null)
    })
  const takeover = () =>
    run(async () => {
      if (!id || !draft.trim()) return
      await sendTakeover(id, draft.trim())
      setDraft('')
    })

  // A stored id can be stale after a backend restart; drop it.
  useEffect(() => {
    if (id && n.connection === 'polling' && !n.status) {
      const t = setTimeout(() => {
        store.set(null)
        setId(null)
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [id, n.connection, n.status])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center gap-3 bg-slate-900 px-6 py-3 text-white">
        <h1 className="text-lg font-bold tracking-tight">
          Counter<span className="text-indigo-400">bot</span>
        </h1>
        <p className="hidden text-sm text-slate-400 sm:block">Their bot kept you out. Yours gets you in.</p>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {id && (
            <>
              <span className={`size-2 rounded-full ${n.connection === 'live' ? 'bg-emerald-400' : n.connection === 'polling' ? 'bg-amber-400' : 'bg-slate-500'}`} />
              {n.connection === 'live' ? 'Live' : n.connection === 'polling' ? 'Polling' : 'Connecting'}
            </>
          )}
        </span>
        <a href="#/agent" target="_blank" rel="noreferrer" className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20">
          Open agent window ↗
        </a>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
        {caseData ? (
          <CaseSummary c={caseData} />
        ) : (
          !error && <div className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!id || finished ? (
            <>
              <button onClick={start} disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                {finished ? 'Run again' : 'Start Counterbot'}
              </button>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-sm" aria-label="Speed">
                <option value={1}>1× speed</option>
                <option value={2}>2× speed</option>
                <option value={3}>3× speed</option>
              </select>
            </>
          ) : status === 'paused' ? (
            <button onClick={() => run(() => resumeNegotiation(id))} disabled={busy} className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
              Resume autopilot
            </button>
          ) : (
            <button onClick={() => run(() => pauseNegotiation(id))} disabled={busy} className="rounded-lg bg-white px-5 py-2.5 font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
              Pause / take over
            </button>
          )}
          {id && (
            <button onClick={reset} disabled={busy} className="ml-auto rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50">
              Reset demo
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

        {report && <ReportCard report={report} />}
        {finished && !report && !error && <div className="h-28 animate-pulse rounded-2xl bg-emerald-100" />}

        {n.humanReached && !finished && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-white shadow-lg shadow-emerald-600/20">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-white" />
            </span>
            <p className="font-semibold">Human reached.</p>
            <p className="text-sm text-emerald-50">The bot wall is down. Counterbot is now negotiating with a person.</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section className={`flex h-[600px] flex-col overflow-hidden rounded-2xl bg-white ring-1 ${n.humanReached ? 'ring-2 ring-emerald-500' : 'ring-slate-200'}`}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold">{caseData?.airline ?? 'Airline'} support chat</h2>
              {status && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${status === 'paused' ? 'bg-amber-100 text-amber-800' : status === 'won' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {status.replace('_', ' ')}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <Chat
                messages={n.messages}
                mine={['customer_bot', 'customer']}
                typing={status === 'running' || n.catchingUp}
                empty={id ? 'Connecting…' : 'Press Start and Counterbot takes it from here.'}
              />
            </div>
            {status === 'paused' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  takeover()
                }}
                className="flex gap-2 border-t border-slate-200 p-3"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="You have the wheel. Type as Alex…"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button disabled={busy || !draft.trim()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
                  Send
                </button>
              </form>
            )}
          </section>

          <section className="h-fit rounded-2xl bg-white ring-1 ring-slate-200 lg:max-h-[600px] lg:overflow-y-auto">
            <div className="border-b border-slate-200 px-5 py-2.5">
              <h2 className="text-sm font-semibold">Tactic board</h2>
            </div>
            <TacticBoard
              tactics={n.tactics}
              tactic={n.tactic}
              pressure={n.pressure}
              detection={n.detection}
              offers={n.offers}
              humanReached={n.humanReached}
              floor={caseData?.floor_gbp ?? 0}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
