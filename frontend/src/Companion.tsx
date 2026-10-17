import { useEffect, useRef, useState } from 'react'
import { useAssistant } from './assistant'
import { CounterbotSprite } from './Sprite'

const W = 80 // sprite size at scale 4 (20 x 24 pixels)
const H = 96
const HEADER = 76
const MARGIN = 16
const CORNERS = ['br', 'bl', 'tl', 'tr'] as const
type Corner = (typeof CORNERS)[number]

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const spot = (c: Corner) => ({
  x: c === 'bl' || c === 'tl' ? MARGIN : window.innerWidth - W - MARGIN,
  y: c === 'tl' || c === 'tr' ? HEADER : window.innerHeight - H - MARGIN,
})

// Counterbot sits quietly in the bottom-right corner. Click him and he waves his wand, then
// floats to the next corner, where he stays until he is clicked again.
export function Companion() {
  const { line, mood, hidden } = useAssistant()
  const [corner, setCorner] = useState<Corner>('br')
  const [pos, setPos] = useState(() => spot('br'))
  const [waveSignal, setWaveSignal] = useState(0)
  const [floating, setFloating] = useState(false)
  const [recent, setRecent] = useState(false)
  const [shown, setShown] = useState('')
  const busy = useRef(false)
  const timers = useRef<number[]>([])

  // Keep him in his corner when the window changes size.
  useEffect(() => {
    const onResize = () => setPos(spot(corner))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [corner])

  // His home is the bottom-right corner: on every new page he goes back there.
  useEffect(() => {
    const home = () => {
      setCorner('br')
      setPos(spot('br'))
    }
    window.addEventListener('hashchange', home)
    return () => window.removeEventListener('hashchange', home)
  }, [])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const next = () => {
    if (busy.current) return
    busy.current = true
    const to = CORNERS[(CORNERS.indexOf(corner) + 1) % CORNERS.length]
    setWaveSignal((n) => n + 1)
    const go = reduced() ? 0 : 1100
    timers.current.push(
      window.setTimeout(() => {
        setCorner(to)
        setFloating(true)
        setPos(spot(to))
      }, go),
      window.setTimeout(() => {
        setFloating(false)
        busy.current = false
      }, go + 1500),
    )
  }

  // A fresh line from the page is shown briefly, then he goes quiet again.
  useEffect(() => {
    if (!line) return
    setRecent(true)
    const t = window.setTimeout(() => setRecent(false), 6000)
    return () => window.clearTimeout(t)
  }, [line])

  const text = recent ? line : ''
  useEffect(() => {
    if (reduced()) {
      setShown(text)
      return
    }
    setShown('')
    if (!text) return
    let i = 0
    const t = window.setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) window.clearInterval(t)
    }, 24)
    return () => window.clearInterval(t)
  }, [text])

  if (hidden) return null
  const onRight = corner === 'br' || corner === 'tr'
  const below = corner === 'tl' || corner === 'tr'
  const tone =
    mood === 'fight'
      ? { border: '#953724', bg: '#fbe7df', chip: 'bg-rose-600 text-white' }
      : mood === 'happy'
        ? { border: '#55702b', bg: '#eef4dc', chip: 'bg-emerald-600 text-white' }
        : mood === 'think'
          ? { border: '#946520', bg: '#fff3c4', chip: 'bg-amber-300 text-slate-900' }
          : { border: '#4a3827', bg: '#eee4cd', chip: 'bg-slate-900 text-amber-300' }

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{
        left: pos.x,
        top: pos.y,
        width: W,
        height: H,
        transition: reduced() ? 'none' : 'left 1.4s ease-in-out, top 1.4s ease-in-out',
      }}
    >
      <button
        onClick={next}
        className="pointer-events-auto block size-full cursor-pointer bg-transparent"
        aria-label="Counterbot. Click and he will wave and float to another corner."
        title="Click me"
      >
        <span style={{ display: 'inline-block', transform: floating ? 'translateY(-8px)' : undefined, transition: 'transform 0.5s ease-in-out' }}>
          <CounterbotSprite mood={mood} scale={4} idleWave waveSignal={waveSignal} />
        </span>
      </button>
      {text && shown && (
        <div
          key={text}
          className={`px-panel animate-pop-in pointer-events-none absolute w-max max-w-[16rem] px-4 pt-5 pb-3 sm:max-w-sm ${below ? 'top-full mt-4' : 'bottom-full mb-4'} ${onRight ? 'right-0' : 'left-0'}`}
          style={{ borderColor: tone.border, background: tone.bg }}
          role="status"
          aria-live="polite"
        >
          <span className={`font-pixel absolute -top-3.5 left-3 border-[3px] border-slate-900 px-2 py-0.5 text-[11px] tracking-wider uppercase ${tone.chip}`}>Counterbot ✦</span>
          <span className="animate-pulse absolute -top-3 right-2 text-lg leading-none font-black text-amber-500" aria-hidden>
            ✦
          </span>
          <p className="text-[15px] leading-snug font-extrabold text-slate-900">
            {shown}
            <span className="animate-pulse text-indigo-600">▌</span>
          </p>
        </div>
      )}
    </div>
  )
}
