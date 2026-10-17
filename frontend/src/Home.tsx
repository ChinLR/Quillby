import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAssistantLine } from './assistant'
import { Cloud, CounterbotSprite, Icon, NovaSprite, SamSprite } from './Sprite'

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// True once the element has scrolled into view (and stays true).
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return { ref, seen }
}

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, seen } = useInView<HTMLDivElement>(0.12)
  return (
    <div ref={ref} className={`reveal ${seen ? 'is-visible' : ''} ${className}`} style={{ ['--reveal-delay' as string]: `${delay}ms` }}>
      {children}
    </div>
  )
}

function CountUp({ to, prefix = '' }: { to: number; prefix?: string }) {
  const { ref, seen } = useInView<HTMLSpanElement>(0.4)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!seen) return
    if (prefersReducedMotion()) {
      setV(to)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1400)
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, to])
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {v}
    </span>
  )
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const startClaim = () => {
  window.location.hash = '#/start'
}

const GRASS = 'bg-[repeating-linear-gradient(90deg,#86a049_0_16px,#6b8a37_16px_32px)]'

const Tag = ({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'gold' | 'dark' }) => (
  <span
    className={`font-pixel inline-block border-[3px] border-slate-900 px-2.5 py-1 text-xs tracking-wider uppercase ${
      tone === 'gold' ? 'bg-amber-300 text-slate-900' : tone === 'dark' ? 'bg-slate-900 text-amber-300' : 'bg-white text-slate-900'
    }`}
  >
    {children}
  </span>
)

/* ---------- hero: a looping battle that shows the product working ---------- */

type Line = { side: 'them' | 'us' | 'note'; who: string; text: string; stage: number; resist: number; spell?: string }
type Scenario = { company: string; bot: string; human: string; lines: Line[] }
// Other examples of what Counterbot can do (none of them is the flight-delay demo case).
const RESIST = [100, 90, 85, 62, 32, 100, 85, 40, 0]
const STAGE = [1, 2, 3, 3, 4, 6, 6, 6, 6]
const duel = (company: string, bot: string, human: string, rows: [Line['side'], string, string?][]): Scenario => ({
  company,
  bot,
  human,
  lines: rows.map(([side, text, spell], i) => ({
    side,
    who: side === 'us' ? 'Counterbot' : i < 5 ? bot : human,
    text,
    stage: STAGE[i],
    resist: RESIST[i],
    spell,
  })),
})
const SCENARIOS: Scenario[] = [
  duel('Zenfit Gym', 'Gigi', 'Priya', [
    ['them', "Hi! I'm Gigi from Zenfit. How can I help?", 'Menu Charm!'],
    ['us', "I'm cancelling Alex's membership. The 12-month minimum term ended in March.", 'Cancelus!'],
    ['them', "We'd hate to see you go! Would you like a free week instead?", 'Retention Hex!'],
    ['us', 'No, thank you. Please process the cancellation, not an offer.', 'Offerus Rejectus!'],
    ['us', 'Your own terms say it rolls monthly after the minimum term. Please bring in a person.', 'Termus Citatum!'],
    ['note', 'A human agent has joined'],
    ['them', 'I can pause the membership for two months, free of charge.', 'Pause Charm!'],
    ['us', "A pause isn't a cancellation. Please confirm it today, with no further charges.", 'Cancellus Maxima!'],
    ['note', 'Quest complete: membership cancelled'],
  ]),
  duel('Voltmart', 'Volt', 'Dan', [
    ['them', 'Welcome to Voltmart support! Please choose a topic.', 'Menu Charm!'],
    ['us', "Alex's laptop stopped working 12 days after delivery. Alex would like a full refund.", 'Refundus!'],
    ['them', 'Have you tried turning it off and on again?', 'Reboot Hex!'],
    ['us', "Yes. It's faulty and still within 30 days. I won't accept a troubleshooting loop.", 'Loopus Rejectus!'],
    ['us', 'Under the Consumer Rights Act, faulty goods can be rejected within 30 days. Please escalate.', 'Rightus Citatum!'],
    ['note', 'A human agent has joined'],
    ['them', 'I can offer a £50 store credit as a gesture of goodwill.', 'Credit Charm!'],
    ['us', "Store credit isn't a refund. Alex is entitled to the full price back.", 'Refundus Maxima!'],
    ['note', 'Quest complete: full refund issued'],
  ]),
  duel('BrightNet', 'Beam', 'Maya', [
    ['them', "Hi, I'm Beam! Have you restarted your router today?", 'Reboot Hex!'],
    ['us', "Alex's speeds are 12 Mbps, far below the minimum guaranteed in the contract.", 'Speedus!'],
    ['them', 'Speeds can vary. Is there anything else I can help with? Yes / No', 'Shrug Hex!'],
    ['us', "That didn't help, and I won't accept a loop. Please bring in a human.", 'Loopus Rejectus!'],
    ['us', "Ofcom's rules let Alex leave without penalty when speeds fall below that minimum. Escalate.", 'Rulus Citatum!'],
    ['note', 'A human agent has joined'],
    ['them', 'I can offer a £5 bill credit while we investigate.', 'Credit Charm!'],
    ['us', 'No, thank you. Alex would like to leave the contract with no early-exit fee.', 'Exitus Maxima!'],
    ['note', 'Quest complete: penalty-free exit'],
  ]),
]
const STAGES = ['Orient', 'State the claim', 'Reject the loop', 'Cite the rule', 'Pressure', 'Demand a human']

function Bar({ value, tone, label }: { value: number; tone: string; label: string }) {
  return (
    <div>
      <p className="font-pixel text-[11px] text-slate-900 uppercase">{label}</p>
      <div className="mt-1 h-3.5 border-[3px] border-slate-900 bg-slate-900">
        <div className={`h-full ${tone} transition-[width] duration-700 ease-linear`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

// A wand held out sideways. `points` is the direction the tip faces; it tilts up when casting.
function Wand({ points, casting, glow }: { points: 'left' | 'right'; casting: boolean; glow: string }) {
  const left = points === 'left'
  return (
    <span
      className="absolute"
      style={{
        [points]: -42,
        bottom: 50,
        width: 44,
        height: 8,
        transformOrigin: left ? '100% 50%' : '0% 50%',
        transform: `rotate(${left ? (casting ? 14 : -6) : casting ? -14 : 6}deg)`,
        transition: 'transform 0.15s steps(3)',
      }}
    >
      <span className="absolute inset-0 border-2 border-slate-900 bg-[#8a5a3b]" />
      <span
        className="absolute -top-1 size-4 border-2 border-slate-900"
        style={{ [points]: -6, background: glow, boxShadow: casting ? `0 0 0 5px ${glow}88` : 'none' }}
      />
    </span>
  )
}

// A beam of spell light: a flowing pixel stripe between two points of the arena.
function Beam({ style, core, glow, strong }: { style: React.CSSProperties; core: string; glow: string; strong: boolean }) {
  return (
    <span
      className="px-beam pointer-events-none absolute"
      style={{
        bottom: 64,
        height: strong ? 14 : 10,
        background: `repeating-linear-gradient(90deg, ${core} 0 10px, ${glow} 10px 20px)`,
        boxShadow: `0 0 0 3px ${glow}`,
        transition: 'left 0.7s steps(10), right 0.7s steps(10), height 0.2s steps(2)',
        ...style,
      }}
    />
  )
}

function HeroDemo() {
  const [scene, setScene] = useState(0)
  const [shown, setShown] = useState(1)
  const [typing, setTyping] = useState(false)
  const reduced = prefersReducedMotion()
  const sc = SCENARIOS[scene]
  const lines = sc.lines

  useEffect(() => {
    if (reduced) {
      setShown(lines.length)
      return
    }
    let t: number
    if (shown >= lines.length) {
      t = window.setTimeout(() => {
        setShown(1)
        setScene((i) => (i + 1) % SCENARIOS.length)
      }, 4200)
    } else if (typing) {
      t = window.setTimeout(() => {
        setTyping(false)
        setShown((s) => s + 1)
      }, 1200)
    } else {
      t = window.setTimeout(() => setTyping(true), 1000)
    }
    return () => window.clearTimeout(t)
  }, [shown, typing, reduced, lines.length])

  const visible = lines.slice(0, shown)
  const cur = visible.at(-1) ?? lines[0]
  const next = lines[shown]
  const won = shown >= lines.length
  const human = cur.stage === 6
  const casterUs = visible.at(-1)?.side === 'us'
  const casterThem = visible.at(-1)?.side === 'them'
  // where the two beams meet, between the opponent's wand tip and Counterbot's (0.08 = about to be hit)
  const clash = `calc(6% + 122px + ${(0.08 + 0.84 * (cur.resist / 100)).toFixed(3)} * (88% - 264px))`

  return (
    <div className="px-panel overflow-hidden">
      <div className="flex items-center justify-between border-b-4 border-slate-900 bg-slate-900 px-4 py-2">
        <span className="font-pixel text-xs text-amber-300 uppercase">Battle · {sc.company} support</span>
        <span className={`font-pixel text-xs uppercase ${won ? 'text-emerald-200' : 'text-amber-300'}`}>{won ? 'Victory!' : `Level ${cur.stage}/6`}</span>
      </div>

      <div className="relative h-56 overflow-hidden bg-[#ecd9b0]">
        <div className="absolute inset-x-0 top-3 grid grid-cols-2 gap-4 px-4">
          <Bar value={cur.resist} tone="bg-rose-500" label={human ? `${sc.human} · will to resist` : `${sc.bot} · bot wall`} />
          <Bar value={100} tone="bg-emerald-500" label="Counterbot · you" />
        </div>
        <div className={`absolute inset-x-0 bottom-0 h-4 border-t-4 border-slate-900 ${GRASS}`} />

        {/* the two spell beams meet at the clash point, which is shoved toward whoever is losing */}
        <Beam style={{ left: clash, right: 'calc(6% + 142px)' }} core="#fffbe6" glow="#f4c93f" strong={casterUs || won} />
        <Beam style={{ left: 'calc(6% + 122px)', right: `calc(100% - ${clash})` }} core="#ffe9e2" glow="#d9453a" strong={casterThem} />
        <span className="pointer-events-none absolute" style={{ left: clash, bottom: 56, transform: 'translate(-50%, 0)', transition: 'left 0.7s steps(10)' }}>
          <span key={shown} className="px-clash block size-11 bg-[#fff6c8]" />
          <span className="px-clash absolute inset-0 rotate-45 bg-[#f4c93f] [animation-delay:-0.2s]" />
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const ang = (k / 6) * Math.PI * 2
            return (
              <span
                key={shown + '-' + k}
                className="px-spark absolute top-1/2 left-1/2 text-base font-black text-amber-400"
                style={{ ['--dx' as string]: `${Math.cos(ang) * 34}px`, ['--dy' as string]: `${Math.sin(ang) * 34}px` }}
              >
                ✦
              </span>
            )
          })}
        </span>

        {/* opponent, left */}
        <div
          className={`absolute bottom-4 left-[6%] ${won ? 'animate-pulse' : ''}`}
          style={{ transform: won ? 'translateX(-14px)' : casterThem ? 'translateX(3px)' : undefined, transition: 'transform 0.2s steps(3)' }}
        >
          {casterThem && cur.spell && (
            <span key={shown} className="px-panel animate-pop-in absolute bottom-full left-0 mb-2 w-max px-2 py-1 text-xs font-extrabold text-slate-900">
              {cur.spell}
            </span>
          )}
          {human ? <SamSprite scale={5} /> : <NovaSprite scale={5} />}
          <Wand points="right" casting={casterThem} glow="#d9453a" />
        </div>

        {/* Counterbot, right */}
        <div className="absolute right-[6%] bottom-4" style={{ transform: casterUs ? 'translateX(-3px)' : undefined, transition: 'transform 0.2s steps(3)' }}>
          {casterUs && cur.spell && (
            <span key={shown} className="px-panel animate-pop-in absolute right-0 bottom-full mb-2 w-max px-2 py-1 text-xs font-extrabold text-slate-900">
              {cur.spell}
            </span>
          )}
          <CounterbotSprite mood={won ? 'happy' : 'duel'} scale={5} />
          {!won && <Wand points="left" casting={casterUs} glow="#f4c93f" />}
        </div>
      </div>

      <div className="flex h-36 flex-col justify-end gap-2 overflow-hidden border-t-4 border-slate-900 bg-slate-900 p-3">
        {visible.slice(-3).map((l, i) =>
          l.side === 'note' ? (
            <p key={shown + '-' + i} className={`animate-pop-in font-pixel text-center text-xs uppercase ${l.text.startsWith('Quest') ? 'text-emerald-200' : 'text-amber-300'}`}>
              ★ {l.text} ★
            </p>
          ) : (
            <p key={shown + '-' + i} className={`animate-pop-in text-sm leading-snug font-semibold ${l.side === 'us' ? 'text-sky-200' : 'text-slate-100'}`}>
              <span className="font-pixel text-[11px] uppercase">{l.who}: </span>
              {l.text}
            </p>
          ),
        )}
        {typing && next && next.side !== 'note' && (
          <p className="font-pixel text-xs text-slate-400 uppercase">
            {next.who} is typing<span className="animate-pulse"> ...</span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-6 gap-1 border-t-4 border-slate-900 bg-white px-3 py-2.5">
        {STAGES.map((s, i) => (
          <div key={s} title={s} className={`h-2.5 border-2 border-slate-900 ${i + 1 <= cur.stage ? 'bg-amber-400' : 'bg-white'}`} />
        ))}
      </div>
    </div>
  )
}

/* ---------- sections ---------- */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b-4 border-[#1f4a45] bg-[#2f6f66] text-slate-50">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2" aria-label="Counterbot, back to top">
          <CounterbotSprite scale={2} bob={false} />
          <span className="font-pixel text-lg text-slate-50 uppercase">Counterbot</span>
        </button>
        <nav className="font-pixel ml-4 hidden gap-6 text-sm text-amber-200 uppercase md:flex">
          <button onClick={() => scrollTo('how')} className="hover:text-white">
            How to play
          </button>
          <button onClick={() => scrollTo('features')} className="hover:text-white">
            Skills
          </button>
          <button onClick={() => scrollTo('trust')} className="hover:text-white">
            Code of honour
          </button>
        </nav>
        <button onClick={startClaim} className="px-btn font-pixel ml-auto bg-amber-300 px-3.5 py-1.5 text-sm text-slate-900 uppercase">
          ▶ Start
        </button>
      </div>
    </header>
  )
}

// A collectible trading card for Counterbot: name and HP, an art window with the wizard,
// attacks with damage, a weakness / resistance footer, and the call to action.
const MOVES: [string, string, string][] = [
  ['Claimus!', 'Reads the small print and states your claim.', '30'],
  ['Loopus Rejectus!', 'Spots menu loops and refuses to play along.', '60'],
  ['Cashus Maxima!', 'Holds out for money, never vouchers.', '120+'],
]

function TradingCard() {
  return (
    <div className="tcard relative mx-auto w-full max-w-[26rem] transition-transform duration-150 hover:-translate-y-1 hover:-rotate-1 lg:mx-0">
      <div className="relative overflow-hidden rounded-lg border-[3px] border-slate-900 bg-[#f6edd2] p-3">
        <div className="flex flex-wrap gap-2">
          <Tag tone="dark">1 player</Tag>
          <Tag tone="gold">★ Insert claim</Tag>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="font-pixel text-[11px] text-slate-600 uppercase">
              <span className="mr-1.5 bg-slate-900 px-1.5 py-0.5 text-amber-300">Basic</span>
              Wizard
            </p>
            <p className="text-3xl leading-none font-black text-slate-900">Counterbot</p>
          </div>
          <p className="flex items-center gap-1.5 text-rose-700">
            <span className="font-pixel text-xs">HP</span>
            <span className="text-3xl leading-none font-black">120</span>
            <span className="flex size-7 items-center justify-center border-2 border-slate-900 bg-amber-300 text-sm text-slate-900" aria-hidden>
              ★
            </span>
          </p>
        </div>

        {/* art window */}
        <div className="relative mt-3 h-52 overflow-hidden border-[4px] border-[#b9983c] bg-[linear-gradient(to_bottom,#4c9aa6_0_30%,#66b0b5_30%_55%,#83c5c3_55%_100%)]">
          <Cloud className="absolute top-3 left-2 opacity-90" scale={4} light="#f4f8e8" shade="#cfe3d0" />
          <Cloud className="absolute top-12 right-2 opacity-90" scale={3} light="#f4f8e8" shade="#cfe3d0" />
          <div className="absolute inset-x-0 bottom-0 h-8 border-t-4 border-slate-900 bg-[repeating-linear-gradient(90deg,#86a049_0_16px,#6b8a37_16px_32px)]" />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
            <CounterbotSprite mood="idle" scale={7} idleWave />
          </div>
          <span className="animate-pulse absolute top-8 left-[22%] text-xl font-black text-amber-300" aria-hidden>
            ✦
          </span>
          <span className="animate-pulse absolute top-20 right-[20%] text-base font-black text-amber-200 [animation-delay:-0.4s]" aria-hidden>
            ✦
          </span>
          <span className="animate-pulse absolute bottom-24 left-[12%] text-sm font-black text-white [animation-delay:-0.8s]" aria-hidden>
            ✦
          </span>
          <span className="px-sheen pointer-events-none absolute inset-0" />
        </div>
        <p className="font-pixel mt-2 border-y-2 border-slate-900 bg-[#e8d9a8] px-2 py-0.5 text-center text-[10px] tracking-wider text-slate-800 uppercase">
          Wizard of the small print · Lv 6
        </p>

        <h1 className="mt-3 text-3xl leading-[1.05] font-black tracking-tight text-slate-900 sm:text-4xl">
          Companies hide behind bots.
          <span className="mt-1 block text-[#7a2a14]">Counterbot fights them for you.</span>
        </h1>

        <ul className="mt-3 divide-y-2 divide-dotted divide-slate-400 border-t-2 border-slate-900">
          {MOVES.map(([name, text, dmg]) => (
            <li key={name} className="flex items-center gap-2.5 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center border-2 border-slate-900 bg-amber-300 text-xs text-slate-900" aria-hidden>
                ★
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-tight font-extrabold text-slate-900">{name}</span>
                <span className="block text-xs leading-snug font-semibold text-slate-600">{text}</span>
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{dmg}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-1 grid grid-cols-3 gap-2 border-t-2 border-slate-900 pt-2 text-center">
          {[
            ['Weakness', 'Loops ×2'],
            ['Resistance', 'Vouchers −30'],
            ['Retreat', 'Never'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-pixel text-[10px] text-slate-500 uppercase">{k}</dt>
              <dd className="text-xs font-extrabold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>

        <button onClick={startClaim} className="px-btn font-pixel mt-3 w-full bg-amber-300 px-6 py-3.5 text-base text-slate-900 uppercase">
          ▶ Start your claim
        </button>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 md:pt-28">
      <div className="relative mx-auto grid max-w-6xl items-start gap-12 px-5 pb-20 lg:grid-cols-[26rem_1fr]">
        <Reveal>
          <TradingCard />
        </Reveal>
        <Reveal delay={200}>
          <HeroDemo />
        </Reveal>
      </div>
    </section>
  )
}

function Problem() {
  const rows = [
    ['A chatbot that loops until you give up', 'Spots the loop and refuses to play along'],
    ['"Operational reasons" and a voucher', 'Cites the rule that says otherwise, holds out for money'],
    ['Hours on hold, repeating yourself', 'Does the waiting and the repeating, in about a minute'],
    ['No idea what you were entitled to', 'Reads the policy first and tells you what you are owed'],
  ]
  return (
    <section className="py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="scene-card max-w-3xl">
          <Tag tone="gold">The problem</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">They put a bot between you and a human, on purpose.</h2>
          <p className="scene-text-sm mt-4 text-lg font-semibold">Most players quit long before they get what they want. Counterbot is built not to.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="px-panel h-full p-5">
              <div className="flex items-center gap-3">
                <NovaSprite scale={3} />
                <p className="font-pixel text-sm text-slate-600 uppercase">Playing solo</p>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {rows.map(([a]) => (
                  <li key={a} className="flex gap-3 font-medium text-slate-700">
                    <span className="font-extrabold text-rose-500">✕</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="px-panel h-full bg-amber-100 p-5">
              <div className="flex items-center gap-3">
                <CounterbotSprite scale={3} />
                <p className="font-pixel text-sm text-indigo-800 uppercase">With Counterbot</p>
              </div>
              <ul className="mt-5 flex flex-col gap-3">
                {rows.map(([, b]) => (
                  <li key={b} className="flex gap-3 font-semibold text-slate-900">
                    <span className="font-extrabold text-emerald-600">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

const STEPS: [string, string, 'book' | 'compass' | 'loop' | 'shield'][] = [
  ['Tell us what happened', 'Describe the problem in your own words and share any receipts, bookings or emails. No forms to decode, no figures to guess.', 'book'],
  ['We read the policy', 'Counterbot checks your case against the rules that apply, works out what you are owed and shows its reasoning before anything begins.', 'compass'],
  ['It takes on their bot', 'It refuses the menu loops, states your claim, cites the rule and keeps up the pressure until the company brings in a real person.', 'loop'],
  ['It negotiates with the human', 'It declines vouchers and low offers, holds firm, and takes a phone call if the company asks. You are told straight away at the moments that matter.', 'shield'],
]

function HowItWorks() {
  const { ref, seen } = useInView<HTMLOListElement>(0.15)
  return (
    <section id="how" className="scroll-mt-16 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="scene-card max-w-3xl">
          <Tag>How to play</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">From “they ignored me” to “they paid me”, in four quests.</h2>
        </Reveal>
        <ol ref={ref} className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map(([t, d, icon], i) => (
            <li key={t} className={`reveal ${seen ? 'is-visible' : ''}`} style={{ ['--reveal-delay' as string]: `${i * 220}ms` }}>
              <div className="px-panel h-full p-5">
                <div className="flex items-center justify-between">
                  <span className="font-pixel bg-slate-900 px-2 py-1 text-xs text-amber-300 uppercase">Quest {i + 1}</span>
                  <Icon name={icon} scale={5} />
                </div>
                <h3 className="mt-4 text-lg leading-snug font-extrabold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed font-medium text-slate-700">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const FEATURES: [string, string, 'book' | 'loop' | 'compass' | 'eye' | 'phone' | 'shield'][] = [
  ['Reads the small print', 'It checks your situation against the real policy text, so the argument it makes rests on the rules, not on a guess.', 'book'],
  ['Sees through loops', 'Repeated menus, canned apologies and "Did that help?" traps are recognised and rejected, never answered the same way twice.', 'loop'],
  ['A reason for every move', 'Each step appears on a live board with a one-line explanation, so you can see what it is doing and why.', 'compass'],
  ['Knows when a human arrives', 'Reply speed, wording and handoff signals tell it when the bot has stepped aside, and it changes approach at once.', 'eye'],
  ['Takes the call as well', 'If the company wants to settle by phone, Counterbot answers with a voice agent and keeps negotiating, with a live transcript.', 'phone'],
  ['You stay informed', 'Counterbot keeps fighting on its own. A voucher or a low offer is flagged to you straight away, and you can step in whenever you like.', 'shield'],
]

function Features() {
  return (
    <section id="features" className="scroll-mt-16 py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="scene-card max-w-3xl">
          <Tag tone="gold">Skills</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">Everything a good advocate would do, unlocked from the start.</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d, icon], i) => (
            <Reveal key={t} delay={(i % 3) * 110}>
              <div className="px-panel h-full p-5 transition-transform duration-100 hover:-translate-y-1">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 items-center justify-center border-[3px] border-slate-900 bg-amber-100">
                    <Icon name={icon} scale={5} />
                  </span>
                  <p className="font-pixel text-xs text-slate-500 uppercase">Skill 0{i + 1}</p>
                </div>
                <h3 className="mt-4 text-lg font-extrabold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed font-medium text-slate-700">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Levels() {
  const { ref, seen } = useInView<HTMLDivElement>(0.3)
  return (
    <section className="border-y-4 border-slate-900 bg-slate-950/80 py-20 text-slate-50 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <Reveal>
          <Tag tone="dark">Method, not luck</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold sm:text-4xl">Six levels, climbed on purpose.</h2>
          <p className="mt-4 text-lg leading-relaxed font-medium text-slate-300">
            Counterbot never improvises its way into trouble. It escalates in a fixed order, from a courteous claim to a firm demand for a human, and the pressure builds as it goes.
            Every level is visible to you.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              [350, '£', 'loot in the demo case'],
              [6, '', 'levels of escalation'],
              [1, '', 'minute of bot time'],
            ].map(([n, p, l]) => (
              <div key={String(l)} className="border-[3px] border-amber-300 px-3 py-2">
                <p className="text-3xl font-extrabold text-amber-300">
                  <CountUp to={n as number} prefix={p as string} />
                </p>
                <p className="mt-1 text-xs leading-tight font-semibold text-slate-300">{l}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <div ref={ref} className="flex flex-col gap-2.5">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-4 border-[3px] border-amber-300 bg-slate-800 px-4 py-3 transition-all duration-500"
              style={{ transitionDelay: `${i * 200}ms`, opacity: seen ? 1 : 0.15, transform: seen ? 'none' : 'translateX(20px)' }}
            >
              <span className="font-pixel w-12 text-sm text-amber-300 uppercase">Lv {i + 1}</span>
              <span className="font-bold">{s}</span>
              {i === STAGES.length - 1 && <SamSprite scale={2} className="ml-auto" />}
              {i < STAGES.length - 1 && (
                <div className="ml-auto hidden h-3 w-24 border-2 border-slate-900 bg-slate-900 sm:block">
                  <div className="h-full bg-amber-300 transition-[width] duration-700" style={{ width: seen ? `${((i + 1) / 6) * 100}%` : '0%', transitionDelay: `${i * 200 + 250}ms` }} />
                </div>
              )}
            </div>
          ))}
          <p className="font-pixel mt-1 text-right text-xs text-amber-200 uppercase">Final boss: a real person</p>
        </div>
      </div>
    </section>
  )
}

function Trust() {
  const points = [
    ['It sticks to the facts', 'Counterbot is built to use only your case file and the policy text, and its messages are checked before they are sent.'],
    ['It never pretends to be a person', 'It says it is your assistant. No impersonation, and no tricks.'],
    ['Pressure stays truthful', 'It may mention a chargeback, a public review or a regulator complaint, but only as real next steps.'],
    ['Nothing is accepted against your rules', 'Counterbot holds out against vouchers and offers below your minimum, and you are told straight away.'],
  ]
  return (
    <section id="trust" className="scroll-mt-16 py-20 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <Tag>Code of honour</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">On your side, every step of the way.</h2>
          <p className="scene-text-sm mt-4 text-lg leading-relaxed font-semibold">A sidekick worth having never puts you in a position you did not agree to.</p>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2">
          {points.map(([t, d], i) => (
            <Reveal key={t} delay={i * 100}>
              <div className="px-panel h-full p-4">
                <p className="flex items-center gap-2 font-extrabold text-slate-900">
                  <Icon name="shield" scale={3} />
                  {t}
                </p>
                <p className="mt-2 text-sm leading-relaxed font-medium text-slate-700">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Home() {
  useAssistantLine("Hi! I'm Counterbot, your assistant. Press start and tell me what happened.", 'idle')
  return (
    <div>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Levels />
        <Trust />
      </main>
      <footer className="border-t-4 border-slate-900 bg-slate-900 py-6 pb-24 text-slate-300 sm:pb-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs font-medium sm:pl-72">
          <p>
            <span className="font-pixel text-sm text-slate-50 uppercase">Counterbot</span> · Built at the Edinburgh AI Hackathon
          </p>
          <p>Not legal advice. Policy summaries are for demonstration and should be checked against the official text.</p>
        </div>
      </footer>
    </div>
  )
}
