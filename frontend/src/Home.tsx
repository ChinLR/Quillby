import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAssistantLine } from './assistant'
import { Cloud, WizardSprite, Icon, NovaSprite, SamSprite } from './Sprite'

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

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
const startClaim = () => {
  window.location.hash = '#/start'
}

const Tag = ({ children, tone = 'white' }: { children: ReactNode; tone?: 'white' | 'gold' | 'dark' }) => (
  <span
    className={`font-pixel inline-block border-[3px] border-slate-900 px-2.5 py-1 text-xs tracking-wider uppercase ${
      tone === 'gold' ? 'bg-amber-300 text-slate-900' : tone === 'dark' ? 'bg-slate-900 text-amber-300' : 'bg-white text-slate-900'
    }`}
  >
    {children}
  </span>
)

/* ---------- character cards: one shape (5:7), three characters ---------- */

type Card = {
  name: string
  kind: string
  stage: string
  hp: number
  ribbon: string
  sky: string // art window background
  ground: string // strip under the character's feet
  character: ReactNode
  moves: [string, string, string][]
  weakness: string
  resistance: string
  retreat: string
}

const GRASS = 'bg-[repeating-linear-gradient(90deg,#86a049_0_16px,#6b8a37_16px_32px)]'
const STONE = 'bg-[repeating-linear-gradient(90deg,#8d97a1_0_20px,#7a858f_20px_40px)]'
const WOOD = 'bg-[repeating-linear-gradient(90deg,#b98a56_0_18px,#a8794a_18px_36px)]'

const CARDS: Card[] = [
  {
    name: 'Nova',
    kind: 'Menu Bot',
    stage: 'Guardian',
    hp: 80,
    ribbon: 'Keeper of the endless menu · Lv 3',
    sky: 'bg-[linear-gradient(to_bottom,#7f93a6_0_30%,#a2b2c0_30%_58%,#c6d2da_58%_100%)]',
    ground: STONE,
    character: <NovaSprite scale={5} />,
    moves: [
      ['Menu Charm!', 'Shows you a menu. Again.', '10'],
      ['Sorry-Sorry Hex!', 'Apologises. Changes nothing.', '20'],
    ],
    weakness: 'Rule citations ×2',
    resistance: 'Politeness −10',
    retreat: 'Loops',
  },
  {
    name: 'Quillby',
    kind: 'Wizard',
    stage: 'Basic',
    hp: 120,
    ribbon: 'Wizard of the small print · Lv 6',
    sky: 'bg-[linear-gradient(to_bottom,#4c9aa6_0_30%,#66b0b5_30%_55%,#83c5c3_55%_100%)]',
    ground: GRASS,
    character: <WizardSprite mood="idle" scale={5} idleWave />,
    moves: [
      ['Claimus!', 'Reads the small print.', '30'],
      ['Cashus Maxima!', 'Holds out for real money.', '120+'],
    ],
    weakness: 'Loops ×2',
    resistance: 'Vouchers −30',
    retreat: 'Never',
  },
  {
    name: 'Sam',
    kind: 'Human Agent',
    stage: 'Elite',
    hp: 60,
    ribbon: 'Keeper of the voucher · Lv 5',
    sky: 'bg-[linear-gradient(to_bottom,#e3a468_0_30%,#efbd88_30%_58%,#f6d9a8_58%_100%)]',
    ground: WOOD,
    character: <SamSprite scale={5} />,
    moves: [
      ['Voucher Charm!', 'Offers a voucher instead.', '15'],
      ['Final Offer!', 'Says that is the most they can do.', '40'],
    ],
    weakness: 'Cash demands ×2',
    resistance: 'Persistence −20',
    retreat: 'Eventually',
  },
]

function CharacterCard({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <div className={`tcard aspect-[5/7] w-[16.5rem] shrink-0 transition-transform duration-200 ${className}`}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-lg border-[3px] border-slate-900 bg-[#f6edd2] p-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-pixel text-[10px] text-slate-600 uppercase">
              <span className="mr-1 bg-slate-900 px-1 py-0.5 text-amber-300">{card.stage}</span>
              {card.kind}
            </p>
            <p className={`truncate leading-none font-black text-slate-900 ${card.name.length > 10 ? 'text-xl' : 'text-2xl'}`}>{card.name}</p>
          </div>
          <p className="flex shrink-0 items-center gap-1 text-rose-700">
            <span className="font-pixel text-[10px]">HP</span>
            <span className="text-2xl leading-none font-black">{card.hp}</span>
          </p>
        </div>

        <div className={`relative mt-2 min-h-0 flex-1 overflow-hidden border-[3px] border-[#b9983c] ${card.sky}`}>
          <Cloud className="absolute top-2 left-1 opacity-90" scale={3} light="#f4f8e8" shade="#cfe3d0" />
          <div className={`absolute inset-x-0 bottom-0 h-5 border-t-[3px] border-slate-900 ${card.ground}`} />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">{card.character}</div>
          <span className="px-sheen pointer-events-none absolute inset-0" />
        </div>

        <p className="font-pixel mt-2 border-y-2 border-slate-900 bg-[#e8d9a8] px-1 py-0.5 text-center text-[9px] tracking-wider text-slate-800 uppercase">{card.ribbon}</p>

        <ul className="mt-1 divide-y-2 divide-dotted divide-slate-400">
          {card.moves.map(([name, text, dmg]) => (
            <li key={name} className="flex items-center gap-2 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-tight font-extrabold text-slate-900">{name}</span>
                <span className="block truncate text-[11px] leading-tight font-semibold text-slate-600">{text}</span>
              </span>
              <span className="text-xl font-black text-slate-900 tabular-nums">{dmg}</span>
            </li>
          ))}
        </ul>

        <dl className="grid grid-cols-3 gap-1 border-t-2 border-slate-900 pt-1.5 text-center">
          {[
            ['Weakness', card.weakness],
            ['Resist', card.resistance],
            ['Retreat', card.retreat],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="font-pixel text-[9px] text-slate-500 uppercase">{k}</dt>
              <dd className="text-[10px] leading-tight font-extrabold text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

/* ---------- page ---------- */

function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b-4 border-[#1f4a45] bg-[#2f6f66] text-slate-50">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2" aria-label="Counterbot, back to top">
          <WizardSprite scale={2} bob={false} />
          <span className="font-pixel text-lg text-slate-50 uppercase">Counterbot</span>
        </button>
        <nav className="font-pixel ml-4 hidden gap-6 text-sm text-amber-200 uppercase md:flex">
          <button onClick={() => scrollTo('how')} className="hover:text-white">
            How it works
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
    <section className="relative overflow-hidden px-5 pt-28 pb-16 md:pt-32">
      <div className="mx-auto flex max-w-6xl flex-col items-center">
        <Reveal className="scene-card w-full max-w-3xl text-center">
          <div className="flex flex-wrap justify-center gap-2">
            <Tag tone="dark">Wizard on call</Tag>
            <Tag tone="gold">★ Available 24/7</Tag>
          </div>
          <h1 className="mt-5 text-5xl leading-[1.02] font-black tracking-tight text-slate-900 sm:text-7xl">
            Press 1 to fight.
            <span className="mt-1 block text-[#7a2a14]">Press 0 for a human.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-snug font-bold text-slate-700 sm:text-xl">
            Companies hide behind bots. <span className="text-[#7a2a14]">Quillby fights them for you.</span>
          </p>
          <button onClick={startClaim} className="px-btn font-pixel mt-6 bg-amber-300 px-8 py-4 text-base text-slate-900 uppercase">
            ▶ Start your claim
          </button>
        </Reveal>

        <Reveal delay={150} className="mt-14 flex w-full flex-wrap items-end justify-center gap-6 lg:gap-8">
          <CharacterCard card={CARDS[0]} className="hover:z-20 hover:-translate-y-2 lg:-rotate-5 lg:translate-y-5 lg:hover:rotate-0" />
          <CharacterCard card={CARDS[1]} className="z-10 order-first hover:-translate-y-2 lg:order-none lg:scale-105 lg:hover:scale-[1.08]" />
          <CharacterCard card={CARDS[2]} className="hover:z-20 hover:-translate-y-2 lg:rotate-5 lg:translate-y-5 lg:hover:rotate-0" />
        </Reveal>
      </div>
    </section>
  )
}

const STEPS: [string, string, 'book' | 'compass' | 'shield'][] = [
  ['Tell us what happened', 'In your own words. Add any receipts.', 'book'],
  ['Quillby reads the policy', 'He works out what you are owed, and shows you.', 'compass'],
  ['He fights for you.', 'Their bot first, then their human, until you are satisfied.', 'shield'],
]

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 px-5 py-16">
      <div className="mx-auto max-w-5xl">
        <Reveal className="scene-card mx-auto mb-8 w-fit text-center">
          <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">How it works</h2>
        </Reveal>
        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map(([t, d, icon], i) => (
            <li key={t}>
              <Reveal delay={i * 120} className="h-full">
                <div className="px-panel flex h-full items-start gap-4 p-5">
                  <span className="flex size-14 shrink-0 items-center justify-center border-[3px] border-slate-900 bg-amber-100">
                    <Icon name={icon} scale={5} />
                  </span>
                  <div>
                    <p className="font-pixel text-[11px] text-slate-500 uppercase">Step {i + 1}</p>
                    <h3 className="text-lg leading-snug font-extrabold text-slate-900">{t}</h3>
                    <p className="mt-1 text-sm leading-snug font-medium text-slate-700">{d}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function Home() {
  useAssistantLine("Hi! I'm Quillby, your assistant. Press start and tell me what happened.", 'idle')
  return (
    <div>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
      </main>
      <footer className="border-t-4 border-slate-900 bg-slate-900 py-6 pb-24 text-slate-300 sm:pb-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs font-medium">
          <p>
            <span className="font-pixel text-sm text-slate-50 uppercase">Counterbot</span>
          </p>
          <p>Not legal advice. Please check policy summaries against the official text.</p>
        </div>
      </footer>
    </div>
  )
}
