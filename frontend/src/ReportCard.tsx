import { useState } from 'react'
import type { Report } from './api'
import { Chat } from './Chat'

const fmtDuration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

export function ReportCard({ report }: { report: Report }) {
  const [open, setOpen] = useState(false)
  const won = report.outcome === 'won'
  const stats = [
    ['Goal', `£${report.goal_gbp}`],
    ['Floor', `£${report.floor_gbp}`],
    ['Bot run time', fmtDuration(report.duration_seconds)],
    ...(report.call_duration_seconds > 0 ? [['Call length', fmtDuration(report.call_duration_seconds)]] : []),
    ['Messages sent for you', String(report.bot_message_count)],
    ['Time saved (estimate)', `~${report.estimated_minutes_saved} min`],
  ]

  return (
    <section className={`overflow-hidden rounded-2xl ring-1 ${won ? 'bg-emerald-600 ring-emerald-700' : 'bg-slate-800 ring-slate-900'} text-white`}>
      <div className="flex flex-wrap items-end justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-medium opacity-80">
            {won ? 'Claim won' : report.outcome === 'walked_away' ? 'Walked away' : 'Run failed'}
            {report.resolved_on !== 'none' && ` · settled on the ${report.resolved_on}`}
          </p>
          <p className="font-serif text-6xl font-medium tabular-nums">
            £{report.amount_gbp}
            {report.offer_type !== 'none' && <span className="ml-2 text-xl font-medium opacity-80">{report.offer_type}</span>}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs opacity-70">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-black/15 px-6 py-3 text-xs">
        <span className="opacity-70">Stages reached:</span>
        {report.stages_reached.map((s) => (
          <span key={s} className="rounded-full bg-white/20 px-2 py-0.5">
            {s}
          </span>
        ))}
        <button onClick={() => setOpen(!open)} className="ml-auto rounded-md bg-white/20 px-3 py-1 font-medium hover:bg-white/30">
          {open ? 'Hide transcript' : `Full transcript (${report.transcript.length})`}
        </button>
      </div>
      {open && (
        <div className="h-96 text-slate-900">
          <Chat messages={report.transcript} mine={['customer_bot', 'customer']} empty="No messages." />
        </div>
      )}
    </section>
  )
}
