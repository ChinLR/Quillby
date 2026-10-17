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

function CountUp({ to, prefix = '', suffix = '' }: { to: number; prefix?: string; suffix?: string }) {
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
      {suffix}
    </span>
  )
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const startClaim = () => {
  window.location.hash = '#/start'
}

/* ---------- hero demo: a looping chat that shows the product working ---------- */

type Line = { side: 'them' | 'us' | 'note'; who: string; text: string; stage: number }
const SCRIPT: Line[] = [
  { side: 'them', who: 'Nova · Northwind bot', text: "Hi! I'm Nova. What can I help you with today?", stage: 1 },
  { side: 'us', who: 'Counterbot', text: 'Flight NW182 landed 3h 55m late. £350 is due under UK261.', stage: 2 },
  { side: 'them', who: 'Nova · Northwind bot', text: 'Sorry to hear that. Did that help? Yes / No', stage: 3 },
  { side: 'us', who: 'Counterbot', text: "That didn't help, and it's not a loop I'll accept. Transfer me to a human.", stage: 3 },
  { side: 'us', who: 'Counterbot', text: "'Operational reasons' are not extraordinary circumstances. Please escalate.", stage: 4 },
  { side: 'note', who: '', text: 'Human agent connected', stage: 6 },
  { side: 'them', who: 'Sam · Northwind Support', text: 'As a goodwill gesture, I can offer a £75 voucher.', stage: 6 },
  { side: 'us', who: 'Counterbot', text: 'No vouchers, thanks. UK261 compensation is paid in money: £350.', stage: 6 },
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
      t = window.setTimeout(() => setShown(1), 3600)
    } else if (typing) {
      t = window.setTimeout(() => {
        setTyping(false)
        setShown((s) => s + 1)
      }, 1100)
    } else {
      t = window.setTimeout(() => setTyping(true), 900)
    }
    return () => window.clearTimeout(t)
  }, [shown, typing, reduced])

  const visible = SCRIPT.slice(0, shown)
  const stage = visible.at(-1)?.stage ?? 1
  const next = SCRIPT[shown]
  const won = shown >= SCRIPT.length

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-indigo-500/30 via-sky-400/20 to-emerald-400/30 blur-2xl" />
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl shadow-indigo-950/40 ring-1 ring-white/20">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs font-medium text-slate-500">Northwind Air support chat</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${won ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
            {won ? 'Won' : 'Counterbot is working'}
          </span>
        </div>

        <div className="flex h-[19rem] flex-col justify-end gap-2.5 overflow-hidden bg-slate-50 p-4">
          {visible.slice(-4).map((l, i) =>
            l.side === 'note' ? (
              <p key={shown + '-' + i} className={`animate-pop-in self-center rounded-full px-3 py-1 text-xs font-semibold ${l.text.startsWith('£') ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {l.text}
              </p>
            ) : (
              <div key={shown + '-' + i} className={`animate-pop-in flex max-w-[85%] flex-col gap-0.5 ${l.side === 'us' ? 'items-end self-end' : 'items-start'}`}>
                <span className="px-1 text-[11px] font-medium text-slate-400">{l.who}</span>
                <p className={`rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${l.side === 'us' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{l.text}</p>
              </div>
            ),
          )}
          {typing && next && next.side !== 'note' && (
            <div className={`flex gap-1 rounded-2xl px-3.5 py-3 ${next.side === 'us' ? 'self-end bg-indigo-600' : 'self-start bg-white ring-1 ring-slate-200'}`}>
              {[0, 150, 300].map((d) => (
                <span key={d} className={`size-1.5 animate-bounce rounded-full ${next.side === 'us' ? 'bg-indigo-200' : 'bg-slate-400'}`} style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="grid grid-cols-6 gap-1">
            {STAGES.map((s, i) => (
              <div key={s} title={s} className={`h-1.5 rounded-full transition-colors duration-500 ${i + 1 <= stage ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            <b className="text-slate-700">Stage {stage}:</b> {STAGES[stage - 1]}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------- sections ---------- */

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={`fixed inset-x-0 top-0 z-30 transition-all duration-300 ${scrolled ? 'bg-slate-950/85 shadow-lg shadow-black/20 backdrop-blur' : 'bg-transparent'}`}>
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-lg font-bold tracking-tight text-white">
          Counter<span className="text-indigo-400">bot</span>
        </button>
        <nav className="ml-4 hidden gap-6 text-sm font-medium text-slate-300 md:flex">
          <button onClick={() => scrollTo('how')} className="hover:text-white">
            How it works
          </button>
          <button onClick={() => scrollTo('features')} className="hover:text-white">
            What it does
          </button>
          <button onClick={() => scrollTo('trust')} className="hover:text-white">
            Why trust it
          </button>
        </nav>
        <button onClick={startClaim} className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-indigo-50">
          Start your claim
        </button>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pt-28 pb-20 text-white md:pt-36 md:pb-28">
      <div className="pointer-events-none absolute -top-40 -left-32 size-[34rem] animate-drift rounded-full bg-indigo-600/25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-40 size-[30rem] animate-float-slow rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:28px_28px]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-200 ring-1 ring-white/15">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Your claim, handled by someone who knows the rules
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 text-4xl leading-[1.08] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Companies automated customer service.{' '}
              <span className="text-shimmer bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">We automated you.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              Counterbot reads the small print, argues your case against the company's bot, gets a real person on the line and negotiates until you are paid. You
              describe what happened. It does the fighting.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={startClaim} className="rounded-xl bg-indigo-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-400">
                Start your claim
              </button>
              <button onClick={() => scrollTo('how')} className="rounded-xl px-5 py-3.5 font-semibold text-slate-200 ring-1 ring-white/20 transition hover:bg-white/10">
                See how it works
              </button>
            </div>
          </Reveal>
          <Reveal delay={320}>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-6">
              {[
                ['£350', 'recovered in our demo case'],
                ['6', 'escalation stages, each with a reason'],
                ['~1 min', 'of bot time in the demo run'],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="text-2xl font-bold tabular-nums">{n}</dt>
                  <dd className="text-xs text-slate-400">{l}</dd>
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
    ['A chatbot that loops until you give up', 'Counterbot spots the loop and refuses to play along'],
    ['"Operational reasons" and a voucher', 'It cites the rule that says otherwise, and holds out for money'],
    ['Hours on hold, repeating yourself', 'It does the waiting and the repeating, in about a minute'],
    ['You never know what you were entitled to', 'It reads the policy first and tells you what you are owed'],
  ]
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">The problem</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">They put a bot between you and a human on purpose.</h2>
          <p className="mt-4 text-lg text-slate-600">Most people give up long before the company has to pay. Counterbot is built not to.</p>
        </Reveal>
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-500">On your own</p>
              <ul className="mt-4 flex flex-col gap-3">
                {rows.map(([a]) => (
                  <li key={a} className="flex gap-3 text-slate-600">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">✕</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl bg-slate-900 p-6 text-white shadow-xl shadow-indigo-950/20">
              <p className="text-sm font-semibold text-indigo-300">With Counterbot</p>
              <ul className="mt-4 flex flex-col gap-3">
                {rows.map(([, b]) => (
                  <li key={b} className="flex gap-3 text-slate-200">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">✓</span>
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

const STEPS = [
  ['Tell us what happened', 'Describe the problem in your own words and share any receipts, bookings or emails. No forms to decode, and no figures to guess.'],
  ['We read the policy', 'Counterbot checks your case against the rules that apply, works out what you are owed and shows you the reasoning before anything starts.'],
  ['It takes on their bot', 'It refuses the menu loops, states your claim, cites the rule and keeps pressure on, until the company hands you to a real person.'],
  ['It negotiates with the human', 'It rejects vouchers and lowball offers, holds firm, and moves to a phone call when the company asks. You get paused and asked at the moments that matter.'],
]

function HowItWorks() {
  const { ref, seen } = useInView<HTMLOListElement>(0.15)
  return (
    <section id="how" className="scroll-mt-16 bg-slate-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">How it works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">From “they ignored me” to “they paid me”, in four steps.</h2>
        </Reveal>
        <ol ref={ref} className="relative mt-14 grid gap-6 md:grid-cols-4">
          <div className="absolute top-6 right-[12%] left-[12%] hidden h-0.5 bg-slate-200 md:block">
            <div className="h-full bg-indigo-500 transition-[width] duration-[1800ms] ease-out" style={{ width: seen ? '100%' : '0%' }} />
          </div>
          {STEPS.map(([t, d], i) => (
            <li key={t} className={`reveal ${seen ? 'is-visible' : ''} relative`} style={{ ['--reveal-delay' as string]: `${i * 180}ms` }}>
              <span className="relative z-10 flex size-12 items-center justify-center rounded-full bg-white text-lg font-bold text-indigo-600 shadow-md ring-2 ring-indigo-500">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const FEATURES: [string, string, string][] = [
  ['📖', 'Reads the small print', 'It checks your situation against the real policy text, so the argument it makes is grounded in the rules, not a guess.'],
  ['🔁', 'Sees through loops', 'Repeated menus, canned apologies and "Did that help?" traps are detected and rejected, never answered twice the same way.'],
  ['🧭', 'A reason for every move', 'Each step is shown on a live board with a one-line explanation, so you can see exactly what it is doing and why.'],
  ['🕵️', 'Knows when a human arrives', 'Reply speed, wording and handoff signals tell it when the bot has stepped aside, and it changes tactics at once.'],
  ['🎙️', 'Takes the call too', 'If the company wants to settle by phone, Counterbot answers with a voice agent and keeps negotiating, with a live transcript.'],
  ['🛡️', 'You stay in charge', 'Choose when it must stop and ask you. A voucher or a low offer pauses the run and alerts you straight away.'],
]

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">What it does</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Everything a good advocate would do, on tap.</h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 100}>
              <div className="group h-full rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/10 hover:ring-indigo-300">
                <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-50 text-xl transition group-hover:bg-indigo-100">{icon}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
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
    <section className="relative overflow-hidden bg-slate-950 py-20 text-white md:py-28">
      <div className="pointer-events-none absolute -right-32 -bottom-32 size-[30rem] animate-float-slow rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold tracking-wide text-indigo-300 uppercase">Method, not luck</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">A six-stage ladder, climbed on purpose.</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Counterbot never improvises its way into trouble. It escalates in a fixed order, from a polite claim to a firm demand for a human, and pressure builds
            as it goes. Every rung is visible to you.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-6">
            {[
              [350, '£', 'asked for in the demo case'],
              [6, '', 'stages of escalation'],
              [1, '', 'minute of bot time'],
            ].map(([n, p, l]) => (
              <div key={String(l)}>
                <p className="text-3xl font-bold">
                  <CountUp to={n as number} prefix={p as string} />
                </p>
                <p className="mt-1 text-xs text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <div ref={ref} className="flex flex-col gap-2.5">
          {STAGES.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-4 rounded-xl bg-white/5 px-4 py-3.5 ring-1 ring-white/10 transition-all duration-700"
              style={{
                transitionDelay: `${i * 260}ms`,
                opacity: seen ? 1 : 0.25,
                transform: seen ? 'none' : 'translateX(24px)',
                backgroundColor: seen && i === STAGES.length - 1 ? 'rgba(99,102,241,0.28)' : undefined,
              }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">{i + 1}</span>
              <span className="font-medium">{s}</span>
              <div className="ml-auto hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-[width] duration-1000" style={{ width: seen ? `${((i + 1) / 6) * 100}%` : '0%', transitionDelay: `${i * 260 + 300}ms` }} />
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
    ['It never pretends to be a person', 'It says it is your assistant. No impersonation, no tricks.'],
    ['Pressure stays truthful', 'It can mention a chargeback, a public review or a regulator complaint, but only as real next steps.'],
    ['Nothing is accepted without the rules you set', 'Vouchers and offers below your minimum stop the run and ask you first.'],
  ]
  return (
    <section id="trust" className="scroll-mt-16 bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <p className="text-sm font-semibold tracking-wide text-indigo-600 uppercase">Built honest</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tough on companies. Straight with you.</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">A negotiator you can trust is one that will never put you in a position you did not agree to.</p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {points.map(([t, d], i) => (
            <Reveal key={t} delay={i * 90}>
              <div className="h-full rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
                <span className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">✓</span>
                <h3 className="mt-3 font-semibold text-slate-900">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{d}</p>
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
    <section className="px-5 pb-20 md:pb-28">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 px-6 py-16 text-center text-white shadow-2xl shadow-indigo-900/30 md:py-20">
          <div className="pointer-events-none absolute -top-24 left-1/4 size-80 animate-drift rounded-full bg-sky-400/20 blur-3xl" />
          <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">Had a flight delayed? Find out what you are owed.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-indigo-100">Tell us what happened. We will read the policy, show you the numbers, and fight for them.</p>
          <button onClick={startClaim} className="relative mt-8 rounded-xl bg-white px-7 py-3.5 font-semibold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50">
            Start your claim
          </button>
        </div>
      </Reveal>
    </section>
  )
}

export function Home() {
  return (
    <div className="bg-white text-slate-900 antialiased">
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
      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-slate-500">
          <p>
            <b className="text-slate-700">Counterbot</b> · Built at the Edinburgh AI Hackathon
          </p>
          <p>Not legal advice. Policy summaries are for demonstration and should be checked against the official text.</p>
        </div>
      </footer>
    </div>
  )
}
