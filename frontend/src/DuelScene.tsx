import type { CSSProperties } from 'react'
import type { Message, Offer, Tactic } from './api'
import { NovaSprite, SamSprite, WizardSprite } from './Sprite'

// A wand duel that plays out the live negotiation: Quillby (right) against the company's bot, then its
// human agent (left). Each side casts a beam from its wand; the clash point is shoved toward whoever
// is losing, driven by how much pressure Quillby has built up.

const MOVES: Record<string, string> = {
  click_button: 'Click a button',
  state_claim: 'State the claim',
  reject_loop: 'Reject the loop',
  cite_rule: 'Cite the rule',
  pressure: 'Apply pressure',
  demand_human: 'Demand a human',
  hold_firm: 'Hold firm',
  counter: 'Counter-offer',
  accept_offer: 'Accept the offer',
  walk_away: 'Walk away',
  accept_call: 'Take the call',
}
const SPELLS: Record<string, string> = {
  click_button: 'Menu-Dodge!',
  state_claim: 'Claimus!',
  reject_loop: 'Loopus Rejectus!',
  cite_rule: 'Rulus Citatum!',
  pressure: 'Pressurus!',
  demand_human: 'Humanus Summonus!',
  hold_firm: 'Firmus Maxima!',
  counter: 'Counterus!',
  accept_offer: 'Acceptus!',
  walk_away: 'Departus!',
  accept_call: 'Callus Acceptus!',
}

// The backend still says "Counterbot"; on screen the wizard is Quillby.
const wizard = (text: string) => text.replace(/Counterbot/g, 'Quillby')

// What the other side is "casting", read from what they just said.
function theirSpell(m: Message | undefined, human: boolean): string {
  if (!m) return 'Stalling Spell!'
  if (m.buttons.length > 0) return 'Menu Charm!'
  if (!human) return /sorry|apolog/i.test(m.text) ? 'Sorry-Sorry Hex!' : 'Loop Hex!'
  if (/voucher/i.test(m.text)) return 'Voucher Charm!'
  if (/final|most i can|best i can/i.test(m.text)) return 'Final Offer!'
  if (/£\s?\d/.test(m.text)) return 'Offer Charm!'
  return 'Stalling Spell!'
}

const GRASS = 'bg-[repeating-linear-gradient(90deg,#86a049_0_16px,#6b8a37_16px_32px)]'

// Sprites are 64px (bot / human) and 80px (wizard) wide at scale 4; wands stick out 34px.
const OPP_TIP = 'calc(5% + 98px)'
const WIZ_TIP = 'calc(5% + 114px)'

function Wand({ points, casting, glow }: { points: 'left' | 'right'; casting: boolean; glow: string }) {
  const left = points === 'left'
  return (
    <span
      className="absolute"
      style={{
        [points]: -34,
        bottom: 34,
        width: 36,
        height: 7,
        transformOrigin: left ? '100% 50%' : '0% 50%',
        transform: `rotate(${left ? (casting ? 14 : -6) : casting ? -14 : 6}deg)`,
        transition: 'transform 0.15s steps(3)',
      }}
    >
      <span className="absolute inset-0 border-2 border-slate-900 bg-[#8a5a3b]" />
      <span className="absolute -top-1 size-3.5 border-2 border-slate-900" style={{ [points]: -5, background: glow, boxShadow: casting ? `0 0 0 4px ${glow}88` : 'none' }} />
    </span>
  )
}

function Beam({ style, core, glow, strong }: { style: CSSProperties; core: string; glow: string; strong: boolean }) {
  return (
    <span
      className="px-beam pointer-events-none absolute"
      style={{
        bottom: 54,
        height: strong ? 13 : 9,
        background: `repeating-linear-gradient(90deg, ${core} 0 10px, ${glow} 10px 20px)`,
        boxShadow: `0 0 0 3px ${glow}`,
        transition: 'left 0.7s steps(10), right 0.7s steps(10), height 0.2s steps(2)',
        ...style,
      }}
    />
  )
}

function Bar({ value, tone, label }: { value: number; tone: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="font-pixel truncate text-[11px] text-slate-900 uppercase">{label}</p>
      <div className="mt-1 h-3 border-[3px] border-slate-900 bg-slate-900">
        <div className={`h-full ${tone} transition-[width] duration-700 ease-linear`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export function DuelScene({
  started,
  company,
  tactic,
  pressure,
  humanReached,
  offers,
  messages,
  status,
  floor,
}: {
  started: boolean
  company: string
  tactic: Tactic | null
  pressure: number
  humanReached: boolean
  offers: Offer[]
  messages: Message[]
  status: string | null
  floor: number
}) {
  const won = status === 'won'
  const lost = status === 'walked_away' || status === 'failed'
  const last = messages.filter((m) => m.channel !== 'call').at(-1)
  const casterUs = started && !!last && (last.sender === 'customer_bot' || last.sender === 'customer')
  const casterThem = started && !!last && (last.sender === 'company_bot' || last.sender === 'human_agent')
  const theirs = [...messages].reverse().find((m) => m.sender === 'company_bot' || m.sender === 'human_agent')
  const oppName = (theirs?.sender_label ?? (humanReached ? 'Sam' : 'Nova')).split('(')[0].trim().split(' ')[0]
  const resist = !started ? 100 : won ? 0 : Math.min(100, Math.max(4, 100 - pressure))
  const t = (0.08 + 0.84 * (resist / 100)).toFixed(3)
  const clash = `calc(5% + 98px + ${t} * (90% - 212px))`
  const stage = tactic?.stage ?? (started ? 1 : 0)
  const lastOffer = offers.at(-1)
  const verdict = lastOffer
    ? lastOffer.accepted
      ? 'accepted'
      : lastOffer.offer_type === 'voucher'
        ? 'refused'
        : lastOffer.amount_gbp < floor
          ? 'below your minimum'
          : 'countered'
    : ''

  return (
    <div className="px-panel overflow-hidden">
      <div className="flex items-center justify-between border-b-4 border-slate-900 bg-slate-900 px-4 py-2">
        <span className="font-pixel truncate text-xs text-amber-300 uppercase">Wand duel · {company}</span>
        <span className={`font-pixel shrink-0 pl-2 text-xs uppercase ${won ? 'text-emerald-200' : lost ? 'text-rose-300' : 'text-amber-300'}`}>
          {won ? 'Victory!' : lost ? 'No deal' : stage ? `Level ${stage}/6` : 'Ready'}
        </span>
      </div>

      <div className="relative h-52 overflow-hidden bg-[#ecd9b0]">
        <div className="absolute inset-x-0 top-3 grid grid-cols-2 gap-3 px-3">
          <Bar value={resist} tone="bg-rose-500" label={`${oppName} · ${humanReached ? 'will to resist' : 'bot wall'}`} />
          <Bar value={lost ? 40 : 100} tone="bg-emerald-500" label="Quillby · you" />
        </div>
        <div className={`absolute inset-x-0 bottom-0 h-4 border-t-4 border-slate-900 ${GRASS}`} />

        {started && (
          <>
            <Beam style={{ left: clash, right: WIZ_TIP }} core="#fffbe6" glow="#f4c93f" strong={casterUs || won} />
            <Beam style={{ left: OPP_TIP, right: `calc(100% - ${clash})` }} core="#ffe9e2" glow="#d9453a" strong={casterThem} />
            <span className="pointer-events-none absolute" style={{ left: clash, bottom: 46, transform: 'translate(-50%, 0)', transition: 'left 0.7s steps(10)' }}>
              <span key={messages.length} className="px-clash block size-10 bg-[#fff6c8]" />
              <span className="px-clash absolute inset-0 rotate-45 bg-[#f4c93f] [animation-delay:-0.2s]" />
              {[0, 1, 2, 3, 4, 5].map((k) => {
                const ang = (k / 6) * Math.PI * 2
                return (
                  <span
                    key={messages.length + '-' + k}
                    className="px-spark absolute top-1/2 left-1/2 text-base font-black text-amber-400"
                    style={{ ['--dx' as string]: `${Math.cos(ang) * 30}px`, ['--dy' as string]: `${Math.sin(ang) * 30}px` }}
                  >
                    ✦
                  </span>
                )
              })}
            </span>
          </>
        )}

        {/* the company's side, left */}
        <div
          className={`absolute bottom-4 left-[5%] ${won ? 'animate-pulse' : ''}`}
          style={{ transform: won ? 'translateX(-12px)' : casterThem ? 'translateX(3px)' : undefined, transition: 'transform 0.2s steps(3)' }}
        >
          {casterThem && (
            <span key={messages.length} className="px-panel animate-pop-in absolute bottom-full left-0 mb-2 w-max px-2 py-1 text-xs font-extrabold text-slate-900">
              {theirSpell(last, humanReached)}
            </span>
          )}
          {humanReached ? <SamSprite scale={4} /> : <NovaSprite scale={4} />}
          {started && <Wand points="right" casting={casterThem} glow="#d9453a" />}
        </div>

        {/* Quillby, right */}
        <div className="absolute right-[5%] bottom-4" style={{ transform: casterUs ? 'translateX(-3px)' : undefined, transition: 'transform 0.2s steps(3)' }}>
          {casterUs && tactic && (
            <span key={messages.length} className="px-panel animate-pop-in absolute right-0 bottom-full mb-2 w-max px-2 py-1 text-xs font-extrabold text-slate-900">
              {SPELLS[tactic.move] ?? 'Spellus!'}
            </span>
          )}
          <WizardSprite mood={won ? 'happy' : lost ? 'sad' : started ? 'duel' : 'idle'} scale={4} />
          {started && !won && !lost && <Wand points="left" casting={casterUs} glow="#f4c93f" />}
        </div>
      </div>

      <div className="border-t-4 border-slate-900 bg-white px-4 py-3">
        {tactic ? (
          <p className="text-sm leading-snug text-slate-800">
            <b className="font-extrabold">{MOVES[tactic.move] ?? tactic.move.replace(/_/g, ' ')}.</b> {wizard(tactic.reason)}
          </p>
        ) : (
          <p className="text-sm text-slate-500">{started ? 'Quillby is sizing up the bot…' : 'Press “Send in Quillby” and the duel begins.'}</p>
        )}
        {lastOffer && (
          <p className="mt-1.5 text-xs font-semibold text-slate-600">
            Latest offer: <b className="text-slate-900">£{lastOffer.amount_gbp}</b> {lastOffer.offer_type}, {verdict}.
          </p>
        )}
      </div>
      <div className="grid grid-cols-6 gap-1 border-t-4 border-slate-900 bg-[#f6edd2] px-3 py-2.5" aria-label={`Level ${stage} of 6`}>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className={`h-2.5 border-2 border-slate-900 ${n <= stage ? 'bg-amber-400' : 'bg-white'}`} />
        ))}
      </div>
    </div>
  )
}
