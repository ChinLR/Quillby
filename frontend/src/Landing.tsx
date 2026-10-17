import { useRef, useState } from 'react'
import { useAssistantLine } from './assistant'
import { submitIntake } from './api'
import type { IntakeResult } from './api'

export type Claim = {
  result: IntakeResult
  description: string
  files: File[]
  // When Counterbot should stop and ask the customer (set on the findings page).
  checkIns?: CheckIns
}

export type CheckIns = { voucher: boolean; belowFloor: boolean }

const PREFILL =
  'My Northwind flight from Edinburgh to Faro landed almost 4 hours late and they blamed operational reasons. I want my compensation.'

const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`)

export function Landing({ onReview }: { onReview: (claim: Claim) => void }) {
  const [description, setDescription] = useState(PREFILL)
  const [files, setFiles] = useState<File[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list).filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))])
  }

  const analyse = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await submitIntake({ description: description.trim() })
      onReview({ result, description: description.trim(), files })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const tooShort = description.trim().length < 10
  useAssistantLine(busy ? 'Reading what you wrote…' : 'Tell me what happened. Take your time, and add anything you have.', busy ? 'think' : 'idle')

  return (
    <div className="min-h-screen text-slate-900">
      <header className="flex items-center gap-3 border-b-4 border-[#1f4a45] bg-[#2f6f66] px-6 py-3 text-white">
        <a href="#/" className="font-serif text-2xl font-semibold tracking-tight">
          Counterbot
        </a>
        <p className="hidden text-sm font-semibold text-teal-50/80 sm:block">We fight the bots, so you don't have to.</p>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-6 p-4 md:p-8">
        <div className="scene-card">
          <h2 className="font-serif text-5xl leading-[1.05] font-extrabold tracking-tight scene-text">How can we help?</h2>
          <p className="scene-text-sm mt-2 font-semibold">
            Tell us what happened, in your own words, and share anything you have. We'll look through it with you and see what you may be owed.
          </p>
        </div>

        <section className="flex flex-col gap-5 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">What happened?</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Take your time. What went wrong, when, and what did the company tell you?"
              className="resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">Dates, booking references and anything they said to you all help.</span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Anything to share with us?</span>
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
              <p className="text-slate-600">Booking confirmations, receipts, emails or screenshots</p>
              <button type="button" onClick={() => picker.current?.click()} className="font-medium text-indigo-600 hover:underline">
                Choose files, or drop them here
              </button>
              <input
                ref={picker}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
              />
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
          </div>

          {error && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}

          <button
            onClick={analyse}
            disabled={busy || tooShort}
            className="px-btn font-pixel self-start bg-amber-300 px-6 py-3 text-sm text-slate-900 uppercase disabled:opacity-50"
          >
            {busy ? 'One moment…' : 'Take a look at my case'}
          </button>
        </section>
      </main>
    </div>
  )
}
