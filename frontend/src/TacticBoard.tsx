import type { Detection, Offer, Tactic } from './api'

const STAGES = ['Orient', 'State the claim', 'Reject the loop', 'Cite the rule', 'Pressure', 'Demand a human']

const MOVES: Record<string, string> = {
  click_button: 'Click button',
  state_claim: 'State claim',
  reject_loop: 'Reject loop',
  cite_rule: 'Cite rule',
  pressure: 'Pressure',
  demand_human: 'Demand human',
  hold_firm: 'Hold firm',
  counter: 'Counter',
  accept_offer: 'Accept offer',
  walk_away: 'Walk away',
}
const moveLabel = (m: string) => MOVES[m] ?? m.replace(/_/g, ' ')

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Meter({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-[width] duration-700 ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function TacticBoard({
  tactics,
  tactic,
  pressure,
  detection,
  offers,
  humanReached,
  floor,
  ladder,
  started,
}: {
  started: boolean
  ladder?: React.ReactNode
  tactics: Tactic[]
  tactic: Tactic | null
  pressure: number
  detection: Detection | null
  offers: Offer[]
  humanReached: boolean
  floor: number
}) {
  const stage = tactic?.stage ?? (started ? 1 : 0)
  const pressureTone = pressure >= 85 ? 'bg-rose-500' : pressure >= 45 ? 'bg-amber-500' : 'bg-indigo-500'

  return (
    <div className="flex flex-col gap-5 p-5">
      <Section title="Current move">
        {tactic ? (
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white px-2 py-0.5 text-sm font-bold text-slate-900">{moveLabel(tactic.move)}</span>
              <span className="text-xs text-slate-400">
                Stage {tactic.stage} · {tactic.stage_name}
                {humanReached && ' · negotiating with a human'}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">{tactic.reason}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400">Waiting for the first move.</p>
        )}
      </Section>

      <Section title="Escalation ladder">
        <ol className="grid grid-cols-6 gap-1">
          {STAGES.map((name, i) => {
            const n = i + 1
            const done = n < stage
            const here = n === stage
            const look = here
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-300 ring-offset-1'
              : done
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-100 text-slate-400'
            return (
              <li key={name} className={`rounded-md px-1 py-2 text-center text-[11px] leading-tight font-medium transition-all duration-300 ${look}`} title={name} aria-current={here ? 'step' : undefined}>
                <div className="font-bold">{done ? '✓' : n}</div>
                {name}
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-slate-500">
          {stage > 0 ? (
            <>
              <b className="text-indigo-700">You are here:</b> stage {stage} of 6, {STAGES[stage - 1]}
            </>
          ) : (
            'Not started'
          )}
        </p>
      </Section>

      {ladder}

      <Section title={`Pressure · ${pressure}/100`}>
        <Meter value={pressure} tone={pressureTone} />
      </Section>

      <Section title={`Human detection · ${detection?.confidence ?? 0}%`}>
        <Meter value={detection?.confidence ?? 0} tone={detection?.is_human ? 'bg-emerald-500' : 'bg-slate-400'} />
        {detection && detection.signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {detection.signals.map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {s}
              </span>
            ))}
          </div>
        )}
      </Section>

      {offers.length > 0 && (
        <Section title="Offers">
          <ul className="flex flex-col gap-1.5">
            {offers.map((o, i) => {
              // The engine re-sends an offer with accepted: true when it takes it; show only that one.
              const next = offers[i + 1]
              if (next?.accepted && next.amount_gbp === o.amount_gbp && next.offer_type === o.offer_type) return null
              const verdict = o.accepted
                ? ['Accepted', 'bg-emerald-100 text-emerald-800']
                : o.offer_type === 'voucher'
                  ? ['Voucher refused', 'bg-rose-100 text-rose-800']
                  : o.amount_gbp < floor
                    ? ['Below floor', 'bg-rose-100 text-rose-800']
                    : ['Countered', 'bg-amber-100 text-amber-800']
              return (
                <li key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="text-sm">
                    <b className="tabular-nums">£{o.amount_gbp}</b> <span className="text-slate-500">{o.offer_type}</span>
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${verdict[1]}`}>{verdict[0]}</span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {tactics.length > 1 && (
        <Section title="Move log">
          <ol className="flex flex-col gap-2">
            {[...tactics].reverse().slice(1).map((t, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3 text-sm">
                <span className="font-medium text-slate-800">{moveLabel(t.move)}</span>
                <span className="text-slate-400"> · {t.stage_name}</span>
                <p className="text-slate-500">{t.reason}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  )
}
