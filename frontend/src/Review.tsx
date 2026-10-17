import { useEffect, useState } from 'react'
import { useAssistantLine } from './assistant'
import { DocWalk, walkDuration } from './DocWalk'
import type { CheckIns, Claim } from './Landing'

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
const delay = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`

// Page two: walks through the case while "reading" it, then says what the customer is likely owed.
// Figures come from the intake result (case, goal, floor) and the policy summary the backend holds.
export function Review({ claim, onStart, onBack }: { claim: Claim; onStart: (checkIns: CheckIns, amounts: { goal: number; floor: number }) => void; onBack: () => void }) {
  const [checkIns, setCheckIns] = useState<CheckIns>({ voucher: true, belowFloor: true })
  const c = claim.result.case
  // The policy suggests a goal and floor; the customer can change both after reading it.
  const [goal, setGoal] = useState(String(c.goal_gbp))
  const [floor, setFloor] = useState(String(c.floor_gbp))
  const goalN = Number(goal)
  const floorN = Number(floor)
  const amountError =
    goal === '' || floor === '' || !Number.isInteger(goalN) || !Number.isInteger(floorN)
      ? 'Enter whole pounds for both.'
      : floorN < 0 || goalN <= 0
        ? 'Amounts must be above zero.'
        : floorN > goalN
          ? 'The lowest you will accept cannot be more than what you ask for.'
          : ''
  const changed = goalN !== c.goal_gbp || floorN !== c.floor_gbp
  const docs = claim.files.length
  const steps = [
    docs > 0 ? `Reading your ${docs} document${docs === 1 ? '' : 's'}` : 'Reading what you told us',
    `Matching it to booking ${c.booking_ref}, flight ${c.flight_number}`,
    `Checking the arrival time against the schedule`,
    `Looking up ${c.airline}'s delay policy`,
    'Checking the flight delay compensation rules',
    'Working out what you are owed',
  ]
  // Quillby catches each document as it flies in. The checklist is paced to finish with it.
  const docNames = docs > 0 ? claim.files.map((f) => f.name) : ['Your description', `Booking ${c.booking_ref}`, `Flight ${c.flight_number} record`]
  const stepMs = Math.max(1100, Math.round(walkDuration(docNames.length) / steps.length))
  const [done, setDone] = useState(0)
  const [walkDone, setWalkDone] = useState(false)
  const ready = done >= steps.length && walkDone

  useEffect(() => {
    if (done >= steps.length) return
    const t = window.setTimeout(() => setDone((d) => d + 1), stepMs)
    return () => window.clearTimeout(t)
  }, [done, steps.length, stepMs])

  useAssistantLine(
    ready ? `Found something! You may be owed £${c.goal_gbp}. Set your goal below.` : 'Reading your documents…',
    ready ? 'happy' : 'think',
    { place: 'right', hidden: !walkDone },
  )

  return (
    <div className="min-h-screen text-slate-900">
      <header className="flex items-center gap-3 border-b-4 border-[#1f4a45] bg-[#2f6f66] px-6 py-3 text-white">
        <h1 className="font-serif text-2xl font-semibold tracking-tight">
          Counterbot
        </h1>
        <button onClick={onBack} className="ml-auto text-xs font-medium text-slate-400 hover:text-white">
          ← Change my details
        </button>
      </header>

      {!walkDone && <DocWalk docs={docNames} onDone={() => setWalkDone(true)} />}
      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-4 md:p-8">
        {!ready ? (
          <section className="flex flex-col gap-5 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
            <div>
              <h2 className="font-serif text-3xl font-medium tracking-tight">Taking a look at your case…</h2>
              <p className="mt-1 text-sm text-slate-500">This only takes a moment.</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-500 transition-[width] duration-1000 ease-out" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <ol className="flex flex-col gap-3">
              {steps.map((label, i) => {
                const state = i < done ? 'done' : i === done ? 'active' : 'todo'
                return (
                  <li key={label} className={`flex items-center gap-3 text-sm transition-opacity duration-500 ${state === 'todo' ? 'opacity-30' : ''}`}>
                    {state === 'done' ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">✓</span>
                    ) : state === 'active' ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                    ) : (
                      <span className="size-5 rounded-full border-2 border-slate-200" />
                    )}
                    <span className={state === 'active' ? 'font-medium text-slate-900' : 'text-slate-600'}>{label}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : (
          <>
            <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 ring-2 ring-emerald-500">
              <div>
                <p className="text-sm font-medium text-emerald-700">Good news, {c.passenger_name.split(' ')[0]}</p>
                <h2 className="font-serif text-4xl leading-tight font-medium tracking-tight">We found that your flight really was delayed.</h2>
              </div>
              <p className="leading-relaxed text-slate-700">
                Your {c.airline} flight {c.flight_number} from {c.origin} to {c.destination} was due at {time(c.scheduled_arrival)} and landed at{' '}
                {time(c.actual_arrival)}. That is <b>{delay(c.delay_minutes)} late</b>, and {c.airline} blamed “{c.airline_reason}”.
              </p>
              <p className="leading-relaxed text-slate-700">
                Based on the policy, you may be owed about <b>£{c.goal_gbp}</b>. Read what the policy says below, then you decide what Quillby asks for.
              </p>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <h3 className="text-sm font-semibold">What the policy says</h3>
              <ul className="flex flex-col gap-2 text-sm text-slate-600">
                {c.legal.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400">{c.legal.disclaimer}</p>
            </section>

            <section className="flex flex-col gap-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <div>
                <h3 className="text-sm font-semibold">Now set your goal</h3>
                <p className="text-sm text-slate-500">Choose what Quillby asks for, and the lowest you would accept. We start from what the policy suggests.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ['What to ask for', goal, setGoal, `Policy suggests £${c.goal_gbp}`, 'bg-emerald-50 ring-emerald-200 text-emerald-700 text-emerald-900'],
                    ['Lowest I would accept', floor, setFloor, `Policy suggests £${c.floor_gbp}`, 'bg-slate-50 ring-slate-300 text-slate-600 text-slate-800'],
                  ] as const
                ).map(([label, value, set, hint, tone]) => {
                  const [bg, ring, labelTone, numTone] = tone.split(' ')
                  return (
                    <label key={label} className={`flex flex-col items-center rounded-xl p-4 text-center ring-1 ${bg} ${ring}`}>
                      <span className={`text-xs font-medium ${labelTone}`}>{label}</span>
                      <span className="mt-1 flex items-center justify-center gap-1">
                        <span className={`font-serif text-4xl font-medium ${numTone}`}>£</span>
                        <input
                          value={value}
                          onChange={(e) => set(e.target.value.replace(/\D/g, '').slice(0, 5))}
                          inputMode="numeric"
                          aria-label={label}
                          className={`w-28 border-b-4 border-slate-900 bg-transparent text-center font-serif text-5xl font-medium tabular-nums outline-none focus:border-indigo-600 ${numTone}`}
                        />
                      </span>
                      <span className="mt-2 text-[11px] text-slate-500">{hint}</span>
                    </label>
                  )
                })}
              </div>
              {amountError ? (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 ring-1 ring-rose-200">
                  {amountError}
                </p>
              ) : (
                changed && (
                  <p className="text-sm text-slate-500">
                    You changed the suggestion.{' '}
                    <button
                      onClick={() => {
                        setGoal(String(c.goal_gbp))
                        setFloor(String(c.floor_gbp))
                      }}
                      className="font-semibold text-indigo-700 underline"
                    >
                      Use the policy's figures
                    </button>
                  </p>
                )
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
              <div>
                <h3 className="text-sm font-semibold">You stay informed</h3>
                <p className="text-sm text-slate-500">Quillby keeps fighting for you the whole way. It will tell you straight away if any of these happen, and you can step in whenever you like.</p>
              </div>
              {(
                [
                  ['voucher', `${c.airline} offers a voucher instead of money`],
                  ['belowFloor', `${c.airline} offers less than £${amountError ? c.floor_gbp : floorN}`],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={checkIns[key]}
                    onChange={(e) => setCheckIns({ ...checkIns, [key]: e.target.checked })}
                    className="size-4 accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
              <p className="text-xs text-slate-400">
                If {c.airline} asks to phone, or the talks end without a deal, we'll always tell you straight away.
              </p>
            </section>

            {!claim.result.supported && claim.result.note && (
              <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200">{claim.result.note}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  // Open the airline's (fake) site in its own tab; its support chat fills in as Quillby talks.
                  window.open('/northwind/', 'northwind-airline')
                  onStart(checkIns, { goal: goalN, floor: floorN })
                }}
                disabled={!claim.result.supported || !!amountError}
                className="px-btn font-pixel bg-amber-300 px-6 py-3 text-sm text-slate-900 uppercase disabled:cursor-not-allowed disabled:opacity-40"
              >
                Let Quillby fight for this
              </button>
              <p className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200">
                It will deal with their bot and a person on your behalf.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
