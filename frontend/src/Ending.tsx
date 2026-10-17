import type { Report } from './api'
import { PixelSprite, WizardSprite } from './Sprite'

type Verdict = 'full' | 'good' | 'partial' | 'none'

// Decide how the negotiation went from the final report: cash at or above the goal is a full win,
// cash above the floor is a good deal, a voucher or sub-floor result is only partial, otherwise no deal.
function judge(r: Report): Verdict {
  if (r.outcome !== 'won') return 'none'
  if (r.offer_type === 'cash' && r.amount_gbp >= r.goal_gbp) return 'full'
  if (r.offer_type === 'cash' && r.amount_gbp >= r.floor_gbp) return 'good'
  return 'partial'
}

// An open treasure chest heaped with gold coins, for a win.
const CHEST = [
  '..kkkkkkkkkkkk..',
  '.kbbbbbbbbbbbbk.',
  '.kbddddddddddbk.',
  '.kbbbbbbbbbbbbk.',
  '..kkohggghgokk..',
  '.kogghgogghggok.',
  'kogghgggoghgggok',
  'kkkkkkkkkkkkkkkk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kbbbbbkggkbbbbbk',
  'kbbbbbkgokbbbbbk',
  'kbbbbbbbbbbbbbbk',
  'kddddddddddddddk',
  'kkkkkkkkkkkkkkkk',
]
const CHEST_COLORS = { k: '#3a2a1c', b: '#8a5a3b', d: '#6a4228', g: '#f4c93f', h: '#fff1a8', o: '#c9921f' }

function Treasure() {
  return (
    <div className="relative px-8 py-3">
      <div className="px-bob">
        <PixelSprite rows={CHEST} colors={CHEST_COLORS} scale={8} label="A treasure chest full of gold coins" />
      </div>
      {[
        'left-2 top-2',
        'right-3 top-0',
        'left-6 bottom-6',
        'right-1 bottom-10',
      ].map((pos, i) => (
        <span key={pos} className={`absolute ${pos} animate-pulse text-xl font-black text-amber-400`} style={{ animationDelay: `${i * 0.3}s` }} aria-hidden>
          ✦
        </span>
      ))}
    </div>
  )
}

const COPY: Record<Verdict, { tag: string; title: string; line: string }> = {
  full: { tag: '★ Claim won', title: 'Victory!', line: 'You got everything you asked for. Quillby never blinked.' },
  good: { tag: '★ Deal reached', title: 'A good deal!', line: 'Above your minimum, and settled without you lifting a finger.' },
  partial: { tag: 'Settled', title: 'Something, at least.', line: 'It was not quite what you wanted, but it was agreed and nothing is left hanging.' },
  none: { tag: 'No deal', title: 'No deal this time.', line: 'Nothing was accepted on your behalf. You can try again or take it further yourself.' },
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`)

export function Ending({ report, onReview, onAgain, onNew }: { report: Report; onReview: () => void; onAgain: () => void; onNew: () => void }) {
  const v = judge(report)
  const c = COPY[v]
  const ok = v !== 'none'
  const stats: [string, string][] = [
    ['Your goal', `£${report.goal_gbp}`],
    ['Your minimum', `£${report.floor_gbp}`],
    ['Settled on', report.resolved_on === 'none' ? 'n/a' : report.resolved_on === 'call' ? 'the phone call' : 'the chat'],
    ['Time saved', `~${report.estimated_minutes_saved} min`],
    ['Talking time', fmt(report.duration_seconds + (report.call_duration_seconds || 0))],
  ]

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[#2b2118]/70 p-4 backdrop-blur-sm" role="dialog" aria-label="Result">
      <div className="px-panel animate-pop-in mx-auto mt-6 max-w-xl overflow-hidden text-center sm:mt-12">
        <div className={`px-6 pt-6 pb-4 ${ok ? 'bg-[#e8d9a6]' : 'bg-[#e3d2bd]'}`}>
          <p className="font-pixel text-xs text-slate-700 uppercase">{c.tag}</p>
          <div className="mt-3 flex justify-center">
            {v === 'full' || v === 'good' ? <Treasure /> : <WizardSprite scale={6} mood={ok ? 'happy' : 'sad'} />}
          </div>
          <h2 className="mt-3 text-4xl font-black text-black sm:text-5xl">{c.title}</h2>
          {ok && (
            <p className="mt-2 text-6xl font-black text-slate-900 tabular-nums">
              £{report.amount_gbp}
              {report.offer_type === 'voucher' && <span className="ml-2 text-lg font-bold text-slate-600">voucher</span>}
            </p>
          )}
          <p className="mx-auto mt-3 max-w-sm text-sm font-semibold text-slate-700">{c.line}</p>
        </div>

        <dl className="grid grid-cols-2 gap-px border-y-4 border-slate-900 bg-slate-900 sm:grid-cols-5">
          {stats.map(([k, val]) => (
            <div key={k} className="bg-white px-2 py-3">
              <dt className="text-[11px] font-bold text-slate-500 uppercase">{k}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-slate-900">{val}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center justify-center gap-3 bg-white px-6 py-5">
          <button onClick={onAgain} className="px-btn px-5 py-2.5 text-sm font-extrabold">
            {ok ? 'Run it again' : 'Try again'}
          </button>
          <button onClick={onReview} className="rounded border-2 border-slate-900 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-[#f6edd2]">
            See the transcript
          </button>
          <button onClick={onNew} className="px-2 py-2 text-sm font-bold text-slate-600 underline">
            New claim
          </button>
        </div>
      </div>
    </div>
  )
}
