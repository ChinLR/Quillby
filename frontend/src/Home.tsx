import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAssistantLine } from './assistant'
import { CounterbotSprite, Icon, NovaSprite, SamSprite } from './Sprite'

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

type Line = { side: 'them' | 'us' | 'note'; who: string; text: string; stage: number; resist: number }
const SCRIPT: Line[] = [
  { side: 'them', who: 'Nova', text: "Hi! I'm Nova. What can I help you with today?", stage: 1, resist: 100 },
  { side: 'us', who: 'Counterbot', text: 'Flight NW182 landed 3h 55m late. £350 is due under UK261.', stage: 2, resist: 90 },
  { side: 'them', who: 'Nova', text: 'Sorry to hear that. Did that help? Yes / No', stage: 3, resist: 75 },
  { side: 'us', who: 'Counterbot', text: "That didn't help, and I won't accept the loop. Transfer me to a human.", stage: 3, resist: 55 },
  { side: 'us', who: 'Counterbot', text: "'Operational reasons' are not extraordinary circumstances. Escalate.", stage: 4, resist: 30 },
  { side: 'note', who: '', text: 'A human agent has joined', stage: 6, resist: 100 },
  { side: 'them', who: 'Sam', text: 'As a goodwill gesture, I can offer a £75 voucher.', stage: 6, resist: 80 },
  { side: 'us', who: 'Counterbot', text: 'No vouchers, thank you. UK261 compensation is paid in money: £350.', stage: 6, resist: 40 },
  { side: 'note', who: '', text: 'Quest complete: £350 recovered', stage: 6, resist: 0 },
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

function HeroDemo() {
  const [shown, setShown] = useState(1)
  const [typing, setTyping] = useState(false)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (reduced) {
      setShown(SCRIPT.length)
      return
    }
    let t: number
    if (shown >= SCRIPT.length) {
      t = window.setTimeout(() => setShown(1), 4200)
    } else if (typing) {
      t = window.setTimeout(() => {
        setTyping(false)
        setShown((s) => s + 1)
      }, 1200)
    } else {
      t = window.setTimeout(() => setTyping(true), 1000)
    }
    return () => window.clearTimeout(t)
  }, [shown, typing, reduced])

  const visible = SCRIPT.slice(0, shown)
  const cur = visible.at(-1) ?? SCRIPT[0]
  const next = SCRIPT[shown]
  const won = shown >= SCRIPT.length
  const human = cur.stage === 6
  const lastUs = visible.at(-1)?.side === 'us'

  return (
    <div className="px-panel overflow-hidden">
      <div className="flex items-center justify-between border-b-4 border-slate-900 bg-slate-900 px-4 py-2">
        <span className="font-pixel text-xs text-amber-300 uppercase">Battle · Northwind Air support</span>
        <span className={`font-pixel text-xs uppercase ${won ? 'text-emerald-200' : 'text-amber-300'}`}>{won ? 'Victory!' : `Level ${cur.stage}/6`}</span>
      </div>

      <div className="relative bg-[#ecd9b0] px-4 pt-4 pb-0">
        <div className="grid grid-cols-2 gap-4">
          <Bar value={cur.resist} tone="bg-rose-500" label={human ? 'Sam · will to resist' : 'Nova · bot wall'} />
          <Bar value={100} tone="bg-emerald-500" label="Counterbot · you" />
        </div>
        <div className="mt-3 flex h-36 items-end justify-between px-2 sm:px-6">
          <div className={`${lastUs ? 'translate-x-1' : ''} transition-transform duration-200`}>{human ? <SamSprite scale={7} /> : <NovaSprite scale={7} />}</div>
          <div className={`${lastUs ? '-translate-x-2' : ''} transition-transform duration-200`}>
            <CounterbotSprite mood={won ? 'happy' : 'fight'} scale={7} />
          </div>
        </div>
        <div className={`-mx-4 h-4 border-t-4 border-slate-900 ${GRASS}`} />
      </div>

      <div className="flex h-44 flex-col justify-end gap-2 overflow-hidden border-t-4 border-slate-900 bg-slate-900 p-3">
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

function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 md:pt-28">
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Reveal>
            <div className="flex flex-wrap gap-2">
              <Tag tone="dark">1 player</Tag>
              <Tag tone="gold">★ Insert claim</Tag>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="scene-text mt-6 text-4xl leading-[1.08] font-extrabold sm:text-5xl lg:text-6xl">
              Companies automated customer service.
              <span className="scene-accent mt-2 block">We automated you.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="scene-text-sm mt-6 max-w-xl text-lg leading-relaxed font-semibold">
              Meet Counterbot, the assistant that stays with you the whole way. It reads the small print, fights the company's bot, brings a real person to the table and
              negotiates until you are paid.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={startClaim} className="px-btn font-pixel bg-amber-300 px-6 py-4 text-base text-slate-900 uppercase">
                ▶ Start your claim
              </button>
              <button onClick={() => scrollTo('how')} className="px-btn font-pixel bg-white px-5 py-4 text-base text-slate-900 uppercase">
                How to play
              </button>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
              {[
                ['£350', 'loot in our demo case'],
                ['6', 'levels to climb'],
                ['~1 min', 'of bot time per run'],
              ].map(([n, l]) => (
                <div key={l} className="border-[3px] border-slate-900 bg-white px-3 py-2">
                  <dt className="text-2xl font-extrabold text-slate-900 tabular-nums">{n}</dt>
                  <dd className="mt-0.5 text-xs leading-tight font-semibold text-slate-600">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
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
        <Reveal className="max-w-3xl">
          <Tag tone="gold">The problem</Tag>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">They put a bot between you and a human, on purpose.</h2>
          <p className="scene-text-sm mt-4 text-lg font-semibold">Most players quit long before the company has to pay. Counterbot is built not to.</p>
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
        <Reveal className="max-w-3xl">
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
        <Reveal className="max-w-3xl">
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
          <h2 className="mt-4 text-3xl leading-tight font-extrabold scene-text sm:text-4xl">Firm with companies. Straight with you.</h2>
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

function FinalCta() {
  return (
    <section className="px-5 pt-4 pb-20 md:pb-24">
      <Reveal>
        <div className="px-panel mx-auto flex max-w-4xl flex-col items-center gap-5 bg-amber-100 px-6 py-12 text-center">
          <CounterbotSprite mood="happy" scale={8} />
          <h2 className="max-w-2xl text-3xl leading-tight font-extrabold text-slate-900 sm:text-4xl">Had a flight delayed? Find out what you are owed.</h2>
          <p className="max-w-xl text-lg font-medium text-slate-700">Tell Counterbot what happened. It will read the policy, show you the numbers and fight for them.</p>
          <button onClick={startClaim} className="px-btn font-pixel mt-2 bg-amber-300 px-8 py-4 text-base text-slate-900 uppercase">
            ▶ Press start
          </button>
        </div>
      </Reveal>
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
        <FinalCta />
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
