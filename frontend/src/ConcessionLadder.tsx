import type { ConcessionStep, Offer } from './api'

// The agent's hidden concession ladder. Steps light up once the agent has made that offer.
export function ConcessionLadder({ steps, offers }: { steps: ConcessionStep[]; offers: Offer[] }) {
  if (steps.length === 0) return null
  const made = (s: ConcessionStep) => offers.some((o) => o.amount_gbp === s.amount_gbp && o.offer_type === s.offer_type)
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((s) => (
        <li
          key={s.step}
          className={`rounded-lg p-3 ring-1 ${made(s) ? 'bg-amber-100 ring-amber-300' : 'bg-white ring-amber-200'}`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-amber-700">
              Step {s.step}
              {made(s) && ' · offered'}
            </span>
            <span className="font-bold tabular-nums">
              £{s.amount_gbp} <span className="text-xs font-medium text-zinc-500">{s.offer_type}</span>
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">{s.condition}</p>
        </li>
      ))}
    </ol>
  )
}
