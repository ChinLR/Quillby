import { useEffect, useState } from 'react'
import { CounterbotSprite, DocSprite } from './Sprite'

// Where the documents lie on screen (percent of the viewport) and where Counterbot starts and ends.
const SPOTS: [number, number][] = [
  [9, 30],
  [91, 24],
  [8, 62],
  [92, 58],
  [24, 84],
]
// Counterbot stands beside a document, on the side facing the middle of the screen.
const standBeside = ([x, y]: [number, number]): [number, number] => [x > 50 ? x - 9 : x + 9, y + 5]
// Counterbot's home: exactly where the companion stands, bottom-right (sprite 80px wide, 16px margin).
const home = (): [number, number] => [((window.innerWidth - 56) / window.innerWidth) * 100, ((window.innerHeight - 16) / window.innerHeight) * 100]
export const TRAVEL_MS = 1300
export const READ_MS = 1100
export const walkDuration = (n: number) => Math.min(n, SPOTS.length) * (TRAVEL_MS + READ_MS) + TRAVEL_MS

const short = (s: string) => (s.length > 24 ? s.slice(0, 21) + '…' : s)

// Counterbot walks around the screen, reads each document and collects it.
export function DocWalk({ docs, onDone }: { docs: string[]; onDone: () => void }) {
  const shown = docs.slice(0, SPOTS.length)
  const [pos, setPos] = useState<[number, number]>(home)
  const [face, setFace] = useState(1)
  const [walking, setWalking] = useState(false)
  const [reading, setReading] = useState(-1)
  const [collected, setCollected] = useState(0)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCollected(shown.length)
      onDone()
      return
    }
    const timers: number[] = []
    let t = 300
    let at: [number, number] = home()
    const go = (to: [number, number]) => {
      timers.push(
        window.setTimeout(() => {
          setFace(to[0] < at[0] ? -1 : 1)
          setWalking(true)
          setPos(to)
          at = to
        }, t),
      )
      t += TRAVEL_MS
      timers.push(window.setTimeout(() => setWalking(false), t))
    }
    shown.forEach((_, i) => {
      go(standBeside(SPOTS[i]))
      timers.push(window.setTimeout(() => setReading(i), t))
      t += READ_MS
      timers.push(
        window.setTimeout(() => {
          setCollected((c) => c + 1)
          setReading(-1)
        }, t),
      )
    })
    go(home())
    timers.push(window.setTimeout(onDone, t))
    return () => timers.forEach((id) => window.clearTimeout(id))
    // run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden>
      {shown.map((name, i) => {
        if (i < collected) return null
        const [x, y] = SPOTS[i]
        return (
          <div key={name + i} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${x}%`, top: `${y}%` }}>
            <DocSprite scale={reading === i ? 6 : 5} className={reading === i ? 'animate-pulse' : ''} />
            <span className="border-2 border-slate-900 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-900">{short(name)}</span>
          </div>
        )
      })}

      <div
        className="absolute flex flex-col items-center"
        style={{
          left: `${pos[0]}%`,
          top: `${pos[1]}%`,
          transform: 'translate(-50%, -100%)',
          transition: `left ${TRAVEL_MS}ms steps(13), top ${TRAVEL_MS}ms steps(13)`,
        }}
      >
        {reading >= 0 && (
          <span className="px-panel mb-2 max-w-[13rem] px-2.5 py-1.5 text-center text-xs font-bold text-slate-900">Reading {short(shown[reading])}…</span>
        )}
        <span style={{ display: 'inline-block', transform: `scaleX(${face})` }}>
          <CounterbotSprite scale={4} walking={walking} mood={reading >= 0 ? 'think' : 'idle'} />
        </span>
      </div>

      <div className="px-panel fixed bottom-4 left-1/2 hidden -translate-x-1/2 px-3 py-2 text-xs font-bold text-slate-900 sm:block" style={{ opacity: collected > 0 ? 1 : 0 }}>
        Collected {collected}/{shown.length}
      </div>
    </div>
  )
}
