import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

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
  const { ref, seen } = useInView<HTMLDivElement>(0.15)
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
      const p = Math.min(1, (now - start) / 1600)
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

const Eyebrow = ({ children, dark = false }: { children: ReactNode; dark?: boolean }) => (
  <p className={`text-xs font-semibold tracking-[0.24em] uppercase ${dark ? 'text-indigo-300' : 'text-indigo-700'}`}>{children}</p>
)

/* ---------- hero demo: a looping chat that shows the product working ---------- */

type Line = { side: 'them' | 'us' | 'note'; who: string; text: string; stage: number }
const SCRIPT: Line[] = [
  { side: 'them', who: 'Nova, Northwind assistant', text: "Hi! I'm Nova. What can I help you with today?", stage: 1 },
  { side: 'us', who: 'Counterbot', text: 'Flight NW182 landed 3h 55m late. £350 is due under UK261.', stage: 2 },
  { side: 'them', who: 'Nova, Northwind assistant', text: 'Sorry to hear that. Did that help? Yes / No', stage: 3 },
  { side: 'us', who: 'Counterbot', text: "That didn't help, and I won't accept the loop. Please transfer me to a human.", stage: 3 },
  { side: 'us', who: 'Counterbot', text: "'Operational reasons' are not extraordinary circumstances. Please escalate.", stage: 4 },
  { side: 'note', who: '', text: 'A human agent has joined', stage: 6 },
  { side: 'them', who: 'Sam, Northwind Support', text: 'As a goodwill gesture, I can offer a £75 voucher.', stage: 6 },
  { side: 'us', who: 'Counterbot', text: 'No vouchers, thank you. UK261 compensation is paid in money: £350.', stage: 6 },
  { side: 'note', who: '', text: '£350 recovered', stage: 6 },
]
const STAGES = ['Orient', 'State the claim', 'Reject the loop', 'Cite the rule', 'Pressure', 'Demand a human']

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
  const stage = visible.at(-1)?.stage ?? 1
  const next = SCRIPT[shown]
  const won = shown >= SCRIPT.length

  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">Northwind Air · Support</span>
        <span className={`text-[11px] font-semibold tracking-[0.18em] uppercase transition-colors ${won ? 'text-emerald-700' : 'text-indigo-700'}`}>{won ? 'Resolved' : 'In progress'}</span>
      </div>

      <div className="flex h-[19.5rem] flex-col justify-end gap-3 overflow-hidden bg-slate-50 p-5">
        {visible.slice(-4).map((l, i) =>
          l.side === 'note' ? (
            <p key={shown + '-' + i} className={`animate-pop-in self-center px-1 text-[11px] font-semibold tracking-[0.16em] uppercase ${l.text.startsWith('£') ? 'text-emerald-700' : 'text-slate-500'}`}>
              — {l.text} —
            </p>
          ) : (
            <div key={shown + '-' + i} className={`animate-pop-in flex max-w-[86%] flex-col gap-1 ${l.side === 'us' ? 'items-end self-end' : 'items-start'}`}>
              <span className="px-0.5 text-[11px] text-slate-400">{l.who}</span>
              <p className={`rounded-lg px-3.5 py-2.5 text-[13px] leading-snug ${l.side === 'us' ? 'bg-slate-900 text-slate-50' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{l.text}</p>
            </div>
          ),
        )}
        {typing && next && next.side !== 'note' && (
          <div className={`flex gap-1 rounded-lg px-3.5 py-3 ${next.side === 'us' ? 'self-end bg-slate-900' : 'self-start bg-white ring-1 ring-slate-200'}`}>
            {[0, 150, 300].map((d) => (
              <span key={d} className={`size-1.5 animate-bounce rounded-full ${next.side === 'us' ? 'bg-slate-400' : 'bg-slate-400'}`} style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-3.5">
        <div className="grid grid-cols-6 gap-1">
          {STAGES.map((s, i) => (
            <div key={s} title={s} className={`h-0.5 transition-colors duration-700 ${i + 1 <= stage ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
        </div>
        <p className="mt-2.5 text-xs text-slate-500">
          Stage {stage} of 6 · <span className="text-slate-800">{STAGES[stage - 1]}</span>
        </p>
      </div>
    </div>
  )
}

/* ---------- sections ---------- */

const Wordmark = () => (
  <span className="font-serif text-[1.7rem] leading-none font-semibold tracking-tight">
    Counter<span className="text-indigo-300">bot</span>
  </span>
)

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`fixed inset-x-0 top-0 z-30 text-slate-50 transition-all duration-500 ${scrolled ? 'border-b border-white/10 bg-slate-950/95 backdrop-blur' : 'border-b border-transparent bg-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Counterbot, back to top">
          <Wordmark />
        </button>
        <nav className="ml-6 hidden gap-8 text-sm text-slate-300 md:flex">
          <button onClick={() => scrollTo('how')} className="transition hover:text-white">
            How it works
          </button>
          <button onClick={() => scrollTo('features')} className="transition hover:text-white">
            What it does
          </button>
          <button onClick={() => scrollTo('trust')} className="transition hover:text-white">
            Our principles
          </button>
        </nav>
        <button onClick={startClaim} className="ml-auto border border-indigo-300/60 px-5 py-2 text-sm font-medium text-indigo-100 transition hover:bg-indigo-300 hover:text-slate-950">
          Start your claim
        </button>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative bg-slate-950 pt-32 pb-24 text-slate-50 md:pt-44 md:pb-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Reveal>
            <Eyebrow dark>Consumer rights, represented</Eyebrow>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="mt-6 font-serif text-5xl leading-[1.02] font-medium tracking-tight sm:text-6xl lg:text-[4.5rem]">
              Companies automated customer service.
              <span className="mt-1 block text-indigo-300 italic">We automated you.</span>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-300">
              Counterbot reads the small print, argues your case against the company's bot, brings a real person to the table and negotiates until you are paid. You
              describe what happened. It does the rest.
            </p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button onClick={startClaim} className="bg-indigo-300 px-8 py-4 text-sm font-semibold tracking-wide text-slate-950 transition hover:bg-indigo-200">
                Start your claim
              </button>
              <button onClick={() => scrollTo('how')} className="px-2 py-4 text-sm font-medium tracking-wide text-slate-200 underline decoration-white/30 underline-offset-8 transition hover:decoration-indigo-300">
                See how it works
              </button>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <dl className="mt-14 grid max-w-xl grid-cols-3 border-t border-white/15">
              {[
                ['£350', 'recovered in our demo case'],
                ['6', 'escalation stages, each explained'],
                ['~1 min', 'of bot time in the demo run'],
              ].map(([n, l], i) => (
                <div key={l} className={`pt-6 ${i > 0 ? 'border-l border-white/15 pl-6' : 'pr-6'}`}>
                  <dt className="font-serif text-3xl font-medium tabular-nums">{n}</dt>
                  <dd className="mt-1 text-xs leading-snug text-slate-400">{l}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
        <Reveal delay={240}>
          <HeroDemo />
        </Reveal>
      </div>
    </section>
  )
}

function Problem() {
  const rows = [
    ['A chatbot that loops until you give up', 'Spots the loop and refuses to play along'],
    ['"Operational reasons" and a voucher', 'Cites the rule that says otherwise and holds out for money'],
    ['Hours on hold, repeating yourself', 'Does the waiting and the repeating, in about a minute'],
    ['No idea what you were entitled to', 'Reads the policy first and tells you what you are owed'],
  ]
  return (
    <section className="bg-slate-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-3xl">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-[1.08] font-medium tracking-tight text-slate-900 sm:text-5xl">
            They put a bot between you and a human, on purpose.
          </h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">Most people give up long before the company has to pay. Counterbot is built not to.</p>
        </Reveal>
        <Reveal className="mt-16" delay={120}>
          <div className="grid grid-cols-2 gap-8 border-b border-slate-300 pb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            <p className="text-slate-500">On your own</p>
            <p className="text-indigo-700">With Counterbot</p>
          </div>
          {rows.map(([a, b]) => (
            <div key={a} className="grid grid-cols-2 gap-8 border-b border-slate-200 py-6 text-[15px] leading-relaxed">
              <p className="text-slate-500">{a}</p>
              <p className="text-slate-900">{b}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

const STEPS = [
  ['Tell us what happened', 'Describe the problem in your own words and share any receipts, bookings or emails. There are no forms to decode and no figures to guess.'],
  ['We read the policy', 'Counterbot checks your case against the rules that apply, works out what you are owed and shows you the reasoning before anything begins.'],
  ['It takes on their bot', 'It refuses the menu loops, states your claim, cites the rule and keeps up the pressure until the company hands you to a real person.'],
  ['It negotiates with the human', 'It declines vouchers and low offers, holds firm, and moves to a phone call when the company asks. At the moments that matter, it stops and asks you.'],
]

function HowItWorks() {
  const { ref, seen } = useInView<HTMLOListElement>(0.15)
  return (
    <section id="how" className="scroll-mt-16 bg-slate-100 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-3xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-[1.08] font-medium tracking-tight text-slate-900 sm:text-5xl">
            From “they ignored me” to “they paid me”, in four steps.
          </h2>
        </Reveal>
        <ol ref={ref} className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t}>
              <div className="h-px bg-slate-300">
                <div className="h-full bg-indigo-600 transition-[width] duration-[1400ms] ease-out" style={{ width: seen ? '100%' : '0%', transitionDelay: `${i * 350}ms` }} />
              </div>
              <div className={`reveal ${seen ? 'is-visible' : ''}`} style={{ ['--reveal-delay' as string]: `${i * 350 + 200}ms` }}>
                <p className="mt-6 font-serif text-5xl font-medium text-indigo-600">0{i + 1}</p>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const FEATURES: [string, string][] = [
  ['Reads the small print', 'It checks your situation against the real policy text, so the argument it makes rests on the rules, not on a guess.'],
  ['Sees through loops', 'Repeated menus, canned apologies and "Did that help?" traps are recognised and rejected, never answered the same way twice.'],
  ['A reason for every move', 'Each step appears on a live board with a one-line explanation, so you can see what it is doing and why.'],
  ['Knows when a human arrives', 'Reply speed, wording and handoff signals tell it when the bot has stepped aside, and it changes approach at once.'],
  ['Takes the call as well', 'If the company wants to settle by phone, Counterbot answers with a voice agent and keeps negotiating, with a live transcript.'],
  ['You stay in charge', 'Choose when it must stop and ask you. A voucher or a low offer pauses the run and alerts you straight away.'],
]

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-slate-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-3xl">
          <Eyebrow>What it does</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-[1.08] font-medium tracking-tight text-slate-900 sm:text-5xl">Everything a good advocate would do, on tap.</h2>
        </Reveal>
        <div className="mt-16 grid border-t border-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 110}>
              <div className="group h-full border-b border-slate-300 py-9 transition-colors sm:px-8 sm:odd:pl-0 lg:px-8 lg:[&:nth-child(3n+1)]:pl-0 lg:[&:nth-child(3n)]:pr-0">
                <p className="font-serif text-2xl text-indigo-600 italic">{['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.'][i]}</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{t}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Ladder() {
  const { ref, seen } = useInView<HTMLDivElement>(0.3)
  return (
    <section className="bg-slate-950 py-24 text-slate-50 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 lg:grid-cols-2">
        <Reveal>
          <Eyebrow dark>Method, not luck</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl">A six-stage ladder, climbed on purpose.</h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-300">
            Counterbot never improvises its way into trouble. It escalates in a fixed order, from a courteous claim to a firm demand for a human, and the pressure builds
            as it goes. Every rung is visible to you.
          </p>
          <div className="mt-10 grid grid-cols-3 border-t border-white/15">
            {[
              [350, '£', 'asked for in the demo case'],
              [6, '', 'stages of escalation'],
              [1, '', 'minute of bot time'],
            ].map(([n, p, l], i) => (
              <div key={String(l)} className={`pt-6 ${i > 0 ? 'border-l border-white/15 pl-6' : 'pr-6'}`}>
                <p className="font-serif text-4xl font-medium">
                  <CountUp to={n as number} prefix={p as string} />
                </p>
                <p className="mt-1 text-xs leading-snug text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <div ref={ref} className="flex flex-col">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-5 border-b border-white/15 py-4 transition-all duration-700 first:border-t"
              style={{ transitionDelay: `${i * 240}ms`, opacity: seen ? 1 : 0.2, transform: seen ? 'none' : 'translateX(18px)' }}
            >
              <span className="w-8 font-serif text-2xl text-indigo-300 italic">{i + 1}</span>
              <span className="text-[15px] font-medium">{s}</span>
              <div className="ml-auto hidden h-px w-28 bg-white/15 sm:block">
                <div className="h-full bg-indigo-300 transition-[width] duration-1000" style={{ width: seen ? `${((i + 1) / 6) * 100}%` : '0%', transitionDelay: `${i * 240 + 300}ms` }} />
              </div>
            </div>
          ))}
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
    ['Nothing is accepted against your rules', 'Vouchers and offers below your minimum stop the run and ask you first.'],
  ]
  return (
    <section id="trust" className="scroll-mt-16 bg-slate-100 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <Eyebrow>Our principles</Eyebrow>
          <h2 className="mt-4 font-serif text-4xl leading-[1.08] font-medium tracking-tight text-slate-900 sm:text-5xl">Firm with companies. Straight with you.</h2>
          <p className="mt-6 text-lg leading-relaxed text-slate-600">A negotiator worth trusting never puts you in a position you did not agree to.</p>
        </Reveal>
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {points.map(([t, d], i) => (
            <Reveal key={t} delay={i * 100}>
              <div className="border-l-2 border-indigo-600 pl-5">
                <h3 className="font-semibold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
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
    <section className="bg-slate-50 px-6 py-24 md:py-32">
      <Reveal>
        <div className="mx-auto max-w-4xl bg-slate-950 px-8 py-20 text-center text-slate-50 md:py-24">
          <Eyebrow dark>Begin</Eyebrow>
          <h2 className="mx-auto mt-5 max-w-2xl font-serif text-4xl leading-[1.08] font-medium tracking-tight sm:text-5xl">
            Had a flight delayed? <span className="text-indigo-300 italic">Find out what you are owed.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-300">Tell us what happened. We will read the policy, show you the numbers and fight for them.</p>
          <button onClick={startClaim} className="mt-10 bg-indigo-300 px-9 py-4 text-sm font-semibold tracking-wide text-slate-950 transition hover:bg-indigo-200">
            Start your claim
          </button>
        </div>
      </Reveal>
    </section>
  )
}

export function Home() {
  return (
    <div className="bg-slate-50 text-slate-900">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Ladder />
        <Trust />
        <FinalCta />
      </main>
      <footer className="border-t border-slate-300 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-slate-500">
          <p>
            <span className="font-serif text-base font-semibold text-slate-800">Counterbot</span> · Built at the Edinburgh AI Hackathon
          </p>
          <p>Not legal advice. Policy summaries are for demonstration and should be checked against the official text.</p>
        </div>
      </footer>
    </div>
  )
}
