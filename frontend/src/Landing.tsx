import { useRef, useState } from 'react'
import { submitIntake } from './api'
import type { IntakeResult } from './api'

export type Claim = {
  result: IntakeResult
  description: string
  goal: number | null
  floor: number | null
  files: File[]
}

const PREFILL =
  'My Northwind flight from Edinburgh to Faro landed almost 4 hours late and they blamed operational reasons. I want my compensation.'

const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)
const num = (v: string) => (v.trim() === '' ? null : Number(v))
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export function Landing({ onStart }: { onStart: (claim: Claim) => void }) {
  const [description, setDescription] = useState(PREFILL)
  const [goal, setGoal] = useState('')
  const [floor, setFloor] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<IntakeResult | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list).filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))])
    setResult(null)
  }

  const analyse = async () => {
    setBusy(true)
    setError('')
    try {
      setResult(await submitIntake({ description: description.trim(), goal_gbp: num(goal), floor_gbp: num(floor) }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const tooShort = description.trim().length < 10
  const c = result?.case

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex items-center gap-3 bg-slate-900 px-6 py-3 text-white">
        <h1 className="text-lg font-bold tracking-tight">
          Counter<span className="text-indigo-400">bot</span>
        </h1>
        <p className="hidden text-sm text-slate-400 sm:block">Their bot kept you out. Yours gets you in.</p>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tell us what the company did.</h2>
          <p className="mt-2 text-slate-600">
            Describe the problem in your own words and attach anything that backs it up. Counterbot fights their bot, forces a human onto
            the chat, then negotiates for you.
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">What went wrong?</span>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setResult(null)
              }}
              rows={6}
              placeholder="Which company, what happened, when, what they said, what you want…"
              className="resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">Include dates, booking references, what the company told you and what you were promised.</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">What do you want? (£)</span>
              <input
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value.replace(/\D/g, ''))
                  setResult(null)
                }}
                inputMode="numeric"
                placeholder="350"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Lowest you'd accept (£)</span>
              <input
                value={floor}
                onChange={(e) => {
                  setFloor(e.target.value.replace(/\D/g, ''))
                  setResult(null)
                }}
                inputMode="numeric"
                placeholder="300"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Receipts and documents</span>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                addFiles(e.dataTransfer.files)
              }}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
            >
              <p className="text-slate-600">Drop booking confirmations, receipts, emails or screenshots here</p>
              <button type="button" onClick={() => picker.current?.click()} className="font-medium text-indigo-600 hover:underline">
                or choose files
              </button>
              <input ref={picker} type="file" multiple className="hidden" onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }} />
            </div>
            {files.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {files.map((f) => (
                  <li key={f.name + f.size} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                    <span className="truncate">
                      {f.name} <span className="text-slate-400">· {kb(f.size)}</span>
                    </span>
                    <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} className="ml-3 text-xs font-medium text-slate-500 hover:text-rose-600">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-400">Documents stay in this browser for now. Counterbot negotiates from your description.</p>
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

          <button
            onClick={analyse}
            disabled={busy || tooShort}
            className="self-start rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Reading your case…' : result ? 'Update my case' : 'Build my case'}
          </button>
        </section>

        {busy && !result && <div className="h-40 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />}

        {result && c && (
          <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 ring-2 ring-indigo-500">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">
                  {c.passenger_name} · Booking {c.booking_ref} · {c.airline} {c.flight_number}
                </p>
                <p className="text-xl font-semibold">
                  {c.origin} → {c.destination}
                </p>
                <p className="text-sm text-slate-600">
                  Due {time(c.scheduled_arrival)}, landed {time(c.actual_arrival)}:{' '}
                  <b className="text-rose-600">{Math.floor(c.delay_minutes / 60)}h {c.delay_minutes % 60}m late</b>. Airline says “{c.airline_reason}”.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="rounded-xl bg-indigo-50 px-4 py-2 text-center">
                  <p className="text-xs font-medium text-indigo-700">Goal</p>
                  <p className="text-xl font-bold text-indigo-900 tabular-nums">£{c.goal_gbp}</p>
                </div>
                <div className="rounded-xl bg-slate-100 px-4 py-2 text-center">
                  <p className="text-xs font-medium text-slate-600">Floor</p>
                  <p className="text-xl font-bold text-slate-800 tabular-nums">£{c.floor_gbp}</p>
                </div>
              </div>
            </div>
            {c.summary && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">“{c.summary}”</p>}
            {result.note && (
              <p className={`rounded-lg px-3 py-2 text-sm ring-1 ${result.supported ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-300'}`}>
                {result.note}
              </p>
            )}
            <button
              onClick={() => onStart({ result, description: description.trim(), goal: num(goal), floor: num(floor), files })}
              disabled={!result.supported}
              className="self-start rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Counterbot
            </button>
          </section>
        )}
      </main>
    </div>
  )
}
