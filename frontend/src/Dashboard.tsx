import { useEffect, useRef, useState } from 'react'
import {
  getCase,
  getNegotiation,
  getReport,
  pauseNegotiation,
  recordCallOutcome,
  resetDemo,
  resumeNegotiation,
  sendAgentReply,
  sendTakeover,
  startNegotiation,
} from './api'
import type { Case, Report } from './api'
import { CallPanel } from './CallPanel'
import { Chat } from './Chat'
import type { Claim } from './Landing'
import { ReportCard } from './ReportCard'
import { DuelScene } from './DuelScene'
import { useAssistantLine } from './assistant'
import type { Mood } from './Sprite'
import { useInbox } from './useInbox'
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
// Phrases from the human agent that mean they have no further room to move.
const NO_MORE_OPTIONS = /final offer|best (i|we) can (do|offer)|(can('|no)?t|cannot|unable to) (go|offer|do) (any )?(higher|more|better)|that('s| is) (all|the most|my limit|as high as)|no (more|further) (room|flexibility)|nothing (more|else) (i|we) can/i
const delay = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

function CaseSummary({ c, claim }: { c: Case; claim: Claim | null }) {
  return (
    <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 md:grid-cols-[1fr_auto]">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-slate-500">
          {c.passenger_name} · {c.airline} {c.flight_number}
        </p>
        <p className="text-xl font-semibold text-slate-900">
          {c.origin} → {c.destination}
        </p>
        <p className="text-sm text-slate-600">
          Due {time(c.scheduled_arrival)}, landed {time(c.actual_arrival)}:{' '}
          <b className="text-rose-600">{delay(c.delay_minutes)} late</b>. Airline says “{c.airline_reason}”.
        </p>
        <details className="mt-1 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">Flight delay compensation rules (UK law)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {c.legal.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-400">{c.legal.disclaimer}</p>
        </details>
        {claim && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Your account</p>
            <p className="mt-0.5">“{claim.description}”</p>
            {claim.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {claim.files.map((f) => (
                  <span key={f.name + f.size} className="rounded-full bg-white px-2.5 py-0.5 text-xs ring-1 ring-slate-200">
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-3 self-start">
        <div className="rounded-xl bg-indigo-50 px-4 py-3 text-center">
          <p className="text-xs font-medium text-indigo-700">Goal</p>
          <p className="font-serif text-3xl font-medium text-indigo-900 tabular-nums">£{c.goal_gbp}</p>
        </div>
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-center">
          <p className="text-xs font-medium text-slate-600">Floor</p>
          <p className="font-serif text-3xl font-medium text-slate-800 tabular-nums">£{c.floor_gbp}</p>
        </div>
      </div>
    </section>
  )
}

export function Dashboard({
  claim,
  autoStart,
  onStarted,
  onNewClaim,
}: {
  claim: Claim | null
  autoStart: boolean
  onStarted: () => void
  onNewClaim: () => void
}) {
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [id, setId] = useState<string | null>(store.get)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [agentDraft, setAgentDraft] = useState('')
  const n = useNegotiation(id)
  const { inbox, refresh } = useInbox(!!id)

  // Quillby keeps negotiating on its own. Two kinds of alert, both driven by the raw feed so the
  // customer hears before the chat catches up:
  //  - info: a voucher or low offer they asked to hear about (no pause, nothing to do)
  //  - handback: the company has run out of options ("final offer", or the same offer twice).
  //    The run pauses and the wheel goes to the customer.
  type Decision = { kind: 'info' | 'handback'; title: string; detail: string; amount?: number }
  const [decision, setDecision] = useState<Decision | null>(null)
  const seenOffers = useRef(0)
  const seenMessages = useRef(0)
  const airline = caseData?.airline ?? 'The airline'
  // The run itself is the source of truth for goal and floor (it survives a reload); before a run, what the
  // customer chose after reading the policy wins over the policy's suggestion.
  const [runAmounts, setRunAmounts] = useState<{ goal: number; floor: number } | null>(null)
  useEffect(() => {
    if (!id) {
      setRunAmounts(null)
      return
    }
    getNegotiation(id)
      .then((s) => setRunAmounts({ goal: s.goal_gbp, floor: s.floor_gbp }))
      .catch(() => {})
  }, [id])
  const floorGbp = runAmounts?.floor ?? claim?.floor ?? caseData?.floor_gbp ?? 0
  const goalGbp = runAmounts?.goal ?? claim?.goal ?? caseData?.goal_gbp ?? 0
  const check = claim?.checkIns
  useEffect(() => {
    seenOffers.current = 0
    seenMessages.current = 0
    setDecision(null)
  }, [id])
  useEffect(() => {
    if (!id) return
    const freshMsgs = n.rawMessages.slice(seenMessages.current)
    seenMessages.current = n.rawMessages.length
    const freshOffers = n.rawOffers.slice(seenOffers.current)
    const before = seenOffers.current
    seenOffers.current = n.rawOffers.length

    const lastCash = [...n.rawOffers].reverse().find((o) => o.offer_type === 'cash')
    const finalSaid = freshMsgs.find((m) => m.sender === 'human_agent' && NO_MORE_OPTIONS.test(m.text))
    const stalled = freshOffers.some((o, i) => {
      const prev = n.rawOffers[before + i - 1]
      return !o.accepted && o.offer_type === 'cash' && !!prev && !prev.accepted && prev.offer_type === 'cash' && prev.amount_gbp === o.amount_gbp
    })
    const stuckAt = finalSaid ? Number(finalSaid.text.match(/£\s?(\d+)/)?.[1] ?? lastCash?.amount_gbp ?? 0) : stalled ? lastCash?.amount_gbp ?? 0 : 0
    if ((finalSaid || stalled) && n.rawStatus?.status === 'running') {
      const amount = stuckAt > 0 ? stuckAt : undefined
      setDecision({
        kind: 'handback',
        amount,
        title: amount ? `${airline} says £${amount} is the most they can offer` : `${airline} says they have nothing more to offer`,
        detail: `Quillby has held out as far as it can. ${amount ? (amount >= goalGbp ? 'That meets your goal.' : amount >= floorGbp ? `That is above your £${floorGbp} minimum but below your £${goalGbp} goal.` : `That is below your £${floorGbp} minimum, so if Quillby pushes on, ${airline} will probably end the talks.`) : ''} The next move is yours.`.replace('  ', ' '),
      })
      pauseNegotiation(id).catch(() => {})
      return
    }
    for (const o of freshOffers) {
      if (o.accepted) continue
      const voucher = o.offer_type === 'voucher'
      const low = o.offer_type === 'cash' && o.amount_gbp < floorGbp
      if ((voucher && check?.voucher) || (low && check?.belowFloor)) {
        setDecision((d) =>
          d?.kind === 'handback'
            ? d
            : {
                kind: 'info',
                title: voucher ? `${airline} offered a £${o.amount_gbp} voucher instead of money` : `${airline} offered £${o.amount_gbp} cash`,
                detail: voucher
                  ? 'A voucher is not compensation. Quillby is pushing back and holding out for cash. No action needed.'
                  : `That is below your £${floorGbp} minimum. Quillby is pushing back and holding your line. No action needed.`,
              },
        )
        break
      }
    }
  }, [id, n.rawOffers, n.rawMessages, n.rawStatus, floorGbp, goalGbp, check, airline])
  const rawStatus = n.rawStatus?.status
  const notice =
    rawStatus === 'awaiting_call' || rawStatus === 'on_call'
      ? { tone: 'sky', text: `${caseData?.airline ?? 'The airline'} wants to settle this over the phone. Quillby will take the call, and you can follow it live below.` }
      : rawStatus === 'walked_away' || rawStatus === 'failed'
        ? { tone: 'rose', text: 'The talks ended without a deal. Nothing has been accepted on your behalf.' }
        : null
  useEffect(() => {
    document.title = decision?.kind === 'handback' ? '● Needs you · Counterbot' : decision || (notice && notice.tone === 'rose') ? '● Update · Counterbot' : 'Counterbot'
    return () => {
      document.title = 'Counterbot'
    }
  }, [decision, notice])

  const status = n.status?.status ?? (id ? 'running' : null)
  const finished = status === 'won' || status === 'walked_away' || status === 'failed'
  const callPhase = status === 'awaiting_call' || status === 'on_call'
  const chatMessages = n.messages.filter((m) => m.channel !== 'call')
  const callLines = n.messages.filter((m) => m.channel === 'call')
  // Three dots: the next queued message's sender, or (while the backend is still thinking)
  // the other side of the last message. No guess when a live human agent is the one to reply.
  const last = chatMessages.at(-1)
  const waitingOnHuman = !!inbox?.handed_off && !inbox.auto_agent
  const lastTheirs = [...chatMessages].reverse().find((m) => m.sender === 'company_bot' || m.sender === 'human_agent')
  const typing =
    n.pending ??
    (status === 'running' && last && !n.catchingUp
      ? last.sender === 'customer_bot' || last.sender === 'customer'
        ? waitingOnHuman
          ? null
          : { sender: lastTheirs?.sender ?? 'company_bot', sender_label: lastTheirs?.sender_label ?? 'Support' }
        : { sender: 'customer_bot' as const, sender_label: `Quillby (for ${caseData?.passenger_name ?? 'you'})` }
      : null)
  // The human-agent controls live here too, once the mock bot has handed the chat over.
  // The companion stands on the right while it is working, and says what it is doing.
  const lastOffer = n.offers.at(-1)
  let line = 'Ready when you are.'
  let mood: Mood = 'idle'
  if (id) {
    mood = 'fight'
    if (finished) {
      if (status === 'won') {
        line = `Won £${report?.amount_gbp ?? lastOffer?.amount_gbp ?? ''}! That is how it is done.`
        mood = 'happy'
      } else {
        line = 'No deal this time. Nothing was accepted on your behalf.'
        mood = 'sad'
      }
    } else if (decision?.kind === 'handback') {
      line = "Over to you. They say that's all they have."
      mood = 'think'
    } else if (callPhase) {
      line = 'They want a phone call. I will take it.'
    } else if (status === 'paused') {
      line = "You're stepping in. Say the word and I'll carry on."
      mood = 'idle'
    } else if (decision?.kind === 'info') {
      line = 'No vouchers from me. Holding out for cash.'
    } else if (n.humanReached) {
      line = 'A human at last. Time to negotiate.'
    } else {
      line = n.tactic ? `Fighting the bot. Level ${n.tactic.stage}: ${n.tactic.stage_name}.` : 'Starting the fight…'
    }
  }
  // The wand duel on this page shows Quillby fighting, so the corner companion stays out of the way.
  useAssistantLine(line, mood, { place: id ? 'right' : 'left', working: !!id && !finished, hidden: true })

  const agentLive = !!inbox?.handed_off && n.humanReached && !finished && !callPhase && !inbox.call_number

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
      const s = await startNegotiation({ speed: 1, goal_gbp: claim?.goal, floor_gbp: claim?.floor })
      setRunAmounts({ goal: s.goal_gbp, floor: s.floor_gbp })
      store.set(s.id)
      setId(s.id)
    })
  const reset = () =>
    run(async () => {
      await resetDemo()
      store.set(null)
      setId(null)
      onNewClaim()
    })
  const recordOutcome = (amount: number, type: 'cash' | 'none') =>
    run(async () => {
      if (id) await recordCallOutcome(id, amount, type)
    })
  const takeover = () =>
    run(async () => {
      if (!id || !draft.trim()) return
      await sendTakeover(id, draft.trim())
      setDraft('')
    })

  const agentReply = () =>
    run(async () => {
      if (!agentDraft.trim()) return
      await sendAgentReply(agentDraft.trim())
      setAgentDraft('')
      await refresh()
    })

  const started = useRef(false)
  useEffect(() => {
    if (!autoStart || started.current) return
    started.current = true
    onStarted()
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart])

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
    <div className="min-h-screen text-slate-900">
      <header className="flex flex-wrap items-center gap-3 border-b-4 border-[#1f4a45] bg-[#2f6f66] px-6 py-3 text-white">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Counterbot
        </h1>
        <p className="hidden text-sm font-semibold text-teal-50/80 sm:block">Quillby fights for you, so you don't have to.</p>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          {id && (
            <>
              <span className={`size-2 rounded-full ${n.connection === 'live' ? 'bg-emerald-400' : n.connection === 'polling' ? 'bg-amber-400' : 'bg-slate-500'}`} />
              {n.connection === 'live' ? 'Live' : n.connection === 'polling' ? 'Polling' : 'Connecting'}
            </>
          )}
        </span>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
        {caseData ? (
          <CaseSummary c={{ ...caseData, goal_gbp: goalGbp || caseData.goal_gbp, floor_gbp: floorGbp || caseData.floor_gbp }} claim={claim} />
        ) : (
          !error && <div className="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!id || finished ? (
            <button onClick={start} disabled={busy} className="px-btn font-pixel bg-amber-300 px-5 py-2.5 text-sm text-slate-900 uppercase disabled:opacity-50">
              {finished ? 'Run again' : 'Send in Quillby'}
            </button>
          ) : status === 'paused' ? (
            <button onClick={() => run(() => resumeNegotiation(id))} disabled={busy} className="px-btn font-pixel bg-amber-300 px-5 py-2.5 text-sm text-slate-900 uppercase disabled:opacity-50">
              Resume autopilot
            </button>
          ) : callPhase ? (
            <p className="scene-card px-3 py-2 text-sm font-semibold text-slate-900">On the phone: autopilot is handling the call.</p>
          ) : (
            <button onClick={() => run(() => pauseNegotiation(id))} disabled={busy} className="px-btn font-pixel bg-white px-5 py-2.5 text-sm text-slate-900 uppercase disabled:opacity-50">
              Step in
            </button>
          )}
          {id && (
            <button onClick={reset} disabled={busy} className="px-btn font-pixel ml-auto bg-white px-4 py-2 text-xs text-slate-900 uppercase disabled:opacity-50">
              Reset demo
            </button>
          )}
        </div>

        {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

        {report && <ReportCard report={report} />}
        {finished && !report && !error && <div className="h-28 animate-pulse rounded-2xl bg-emerald-100" />}

        {decision && (
          <div
            role={decision.kind === 'handback' ? 'alert' : 'status'}
            className={`flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 ${decision.kind === 'handback' ? 'bg-amber-500 text-amber-950' : 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'}`}
          >
            {decision.kind === 'handback' && (
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-950 opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-amber-950" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{decision.kind === 'handback' ? `Over to you: ${decision.title}` : decision.title}</p>
              <p className="text-sm">{decision.detail}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {decision.kind === 'handback' ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => run(async () => {
                      setDecision(null)
                      if (id) await resumeNegotiation(id)
                    })}
                    className="px-btn font-pixel bg-white px-4 py-2 text-sm text-slate-900 uppercase disabled:opacity-50"
                  >
                    Keep pushing
                  </button>
                  <button onClick={() => setDecision(null)} className="px-btn font-pixel bg-white px-4 py-2 text-sm text-slate-900 uppercase">
                    I'll reply myself
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setDecision(null)} className="px-btn font-pixel bg-slate-900 px-4 py-2 text-sm text-amber-100 uppercase">
                    Got it
                  </button>
                  {status === 'running' && (
                    <button
                      disabled={busy}
                      onClick={() => run(async () => {
                        setDecision(null)
                        if (id) await pauseNegotiation(id)
                      })}
                      className="px-btn font-pixel bg-white px-4 py-2 text-sm text-slate-900 uppercase disabled:opacity-50"
                    >
                      Step in myself
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {notice && !decision && (
          <p role="status" className={`rounded-2xl px-5 py-3 text-sm font-medium ring-1 ${notice.tone === 'rose' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-sky-50 text-sky-900 ring-sky-200'}`}>
            {notice.text}
          </p>
        )}

        {n.humanReached && !finished && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-white">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-white" />
            </span>
            <p className="font-semibold">Human reached.</p>
            <p className="text-sm text-emerald-50">The bot wall is down. Quillby is now negotiating with a person.</p>
          </div>
        )}

        {(callPhase || callLines.length > 0) && (
          <CallPanel
            call={n.call}
            lines={callLines}
            airline={caseData?.airline ?? 'The airline'}
            goal={goalGbp || 350}
            busy={busy}
            canRecord={callPhase}
            onRecord={recordOutcome}
          />
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
                messages={chatMessages}
                mine={['customer_bot', 'customer']}
                typing={typing}
                empty={id ? 'Connecting…' : 'Press Start and Quillby takes it from here.'}
              />
            </div>
            {agentLive && status !== 'paused' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  agentReply()
                }}
                className="flex gap-2 border-t border-emerald-200 bg-emerald-50 p-3"
              >
                <input
                  value={agentDraft}
                  onChange={(e) => setAgentDraft(e.target.value)}
                  placeholder="Reply as the airline agent…"
                  className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                />
                <button disabled={busy || !agentDraft.trim()} className="px-btn font-pixel bg-amber-300 px-4 py-2 text-sm text-slate-900 uppercase disabled:opacity-40">
                  Send as agent
                </button>
              </form>
            )}
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
                  placeholder={`You are stepping in. Type as ${caseData?.passenger_name.split(' ')[0] ?? 'the customer'}…`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button disabled={busy || !draft.trim()} className="px-btn font-pixel bg-amber-300 px-4 py-2 text-sm text-slate-900 uppercase disabled:opacity-40">
                  Send
                </button>
              </form>
            )}
          </section>

          <DuelScene
            started={!!id}
            company={caseData?.airline ?? 'The airline'}
            tactic={n.tactic}
            pressure={n.pressure}
            humanReached={n.humanReached}
            offers={n.offers}
            messages={n.messages}
            status={status}
            floor={floorGbp}
          />
        </div>
      </main>
    </div>
  )
}
