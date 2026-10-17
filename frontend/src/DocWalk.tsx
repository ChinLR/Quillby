import { useEffect, useMemo, useState } from 'react'
import { CounterbotSprite, DocSprite } from './Sprite'

// Where each document starts, just outside the screen edges (percent of the viewport).
const EDGES: [number, number][] = [
  [-8, 30],
  [30, -10],
  [108, 24],
  [-8, 66],
  [68, -10],
]
const FIRST_MS = 500
const GAP_MS = 1300 // one document launched per wave of the wand
const FLY_MS = 1100
const TAIL_MS = 800
export const walkDuration = (n: number) => FIRST_MS + (Math.min(n, EDGES.length) - 1) * GAP_MS + FLY_MS + TAIL_MS

const short = (s: string) => (s.length > 24 ? s.slice(0, 21) + '…' : s)
type Phase = 'wait' | 'fly' | 'gone'

// While Counterbot checks the documents he stays in his corner and waves his wand; each document
// flies in from the edge of the screen, spinning, and he catches it in a burst of sparkles.
export function DocWalk({ docs, onDone }: { docs: string[]; onDone: () => void }) {
  const shown = docs.slice(0, EDGES.length)
  const [phase, setPhase] = useState<Phase[]>(() => shown.map(() => 'wait'))
  const [collected, setCollected] = useState(0)
  const [wave, setWave] = useState(0)
  const [burst, setBurst] = useState(0)
  const [last, setLast] = useState('')

  // Pixel positions fixed at mount: where each document starts, and where Counterbot stands.
  const geo = useMemo(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    return {
      starts: EDGES.map(([x, y]) => [(x / 100) * vw, (y / 100) * vh] as [number, number]),
      target: [vw - 56, vh - 64] as [number, number], // centre of the wizard in his bottom-right corner
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCollected(shown.length)
      onDone()
      return
    }
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    shown.forEach((name, i) => {
      const launch = FIRST_MS + i * GAP_MS
      at(launch, () => {
        setPhase((p) => p.map((v, k) => (k === i ? 'fly' : v)))
        setWave((n) => n + 1)
      })
      at(launch + FLY_MS, () => {
        setPhase((p) => p.map((v, k) => (k === i ? 'gone' : v)))
        setCollected((c) => c + 1)
        setLast(name)
        setBurst((b) => b + 1)
      })
    })
    at(walkDuration(shown.length), onDone)
    return () => timers.forEach((id) => window.clearTimeout(id))
    // run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {shown.map((name, i) => {
        if (phase[i] === 'gone') return null
        const [sx, sy] = geo.starts[i]
        const [tx, ty] = geo.target
        const flying = phase[i] === 'fly'
        const dir = i % 2 ? -1 : 1
        return (
          <div
            key={name + i}
            className="absolute flex flex-col items-center gap-1"
            style={{
              left: (flying ? tx : sx) - 28,
              top: (flying ? ty : sy) - 36,
              opacity: flying ? 1 : 0,
              transition: `left ${FLY_MS}ms cubic-bezier(0.25, 0.6, 0.3, 1), top ${FLY_MS}ms cubic-bezier(0.55, 0, 0.8, 0.5), opacity 200ms`,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: flying ? `rotate(${dir * 540}deg) scale(0.4)` : 'rotate(0deg) scale(1.1)',
                transition: `transform ${FLY_MS}ms ease-in`,
              }}
            >
              <DocSprite scale={5} />
            </span>
            <span className="border-2 border-slate-900 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-900" style={{ opacity: flying ? 0 : 1, transition: `opacity ${FLY_MS}ms ease-in` }}>
              {short(name)}
            </span>
          </div>
        )
      })}

      {/* Counterbot, in his corner, waving his wand for each document */}
      <div className="fixed right-4 bottom-4 h-24 w-20">
        {last && (
          <span key={burst} className="px-panel animate-pop-in absolute right-0 bottom-full mb-3 w-max max-w-[14rem] px-2.5 py-1.5 text-center text-xs font-bold text-slate-900">
            Got it: {short(last)} ✓
          </span>
        )}
        <CounterbotSprite scale={4} mood="think" waveSignal={wave} />
        {burst > 0 &&
          [0, 1, 2, 3, 4, 5].map((k) => {
            const a = (k / 6) * Math.PI * 2
            return (
              <span
                key={burst + '-' + k}
                className="px-spark absolute top-1/2 left-1/2 text-lg font-black text-amber-400"
                style={{ ['--dx' as string]: `${Math.cos(a) * 54}px`, ['--dy' as string]: `${Math.sin(a) * 54}px` }}
              >
                ✦
              </span>
            )
          })}
      </div>

      <div className="px-panel fixed bottom-4 left-1/2 hidden -translate-x-1/2 px-3 py-2 text-xs font-bold text-slate-900 sm:block" style={{ opacity: collected > 0 ? 1 : 0 }}>
        Collected {collected}/{shown.length}
      </div>
    </div>
  )
}
