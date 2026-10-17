import { useCallback, useEffect, useRef, useState } from 'react'
import { useAssistant } from './assistant'
import type { Place } from './assistant'
import { CounterbotSprite } from './Sprite'

const W = 80 // sprite size at scale 4 (20 x 24 pixels)
const H = 96
const HEADER = 70
const QUIPS = ['Psst. Click me when you need me.', 'I read small print for fun.', 'Nice day for a fight with a bot.', 'Got a document? I will go and fetch it.', 'Just stretching my legs.']

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const dock = (place: Place) => ({ x: place === 'right' ? window.innerWidth - W - 16 : 16, y: window.innerHeight - H - 16 })
const randomSpot = () => ({
  x: 8 + Math.random() * Math.max(1, window.innerWidth - W - 16),
  y: HEADER + Math.random() * Math.max(1, window.innerHeight - H - HEADER - 12),
})

// Counterbot roams the screen on his own. Click him to send him to his post, where he works
// (reads documents, fights the bot); click again to let him wander off.
export function Companion() {
  const { line, mood, place, hidden, working } = useAssistant()
  const [override, setOverride] = useState<'focus' | 'roam' | null>(null)
  const mode = override ?? (working ? 'focus' : 'roam')
  const [pos, setPos] = useState(() => dock(place))
  const posRef = useRef(pos)
  const [face, setFace] = useState(1)
  const [walking, setWalking] = useState(false)
  const [moveMs, setMoveMs] = useState(0)
  const [quip, setQuip] = useState('')
  const [recent, setRecent] = useState(false)
  const [shown, setShown] = useState('')
  const walkTimer = useRef(0)

  useEffect(() => setOverride(null), [working])

  const moveTo = useCallback((to: { x: number; y: number }) => {
    const from = posRef.current
    const dist = Math.hypot(to.x - from.x, to.y - from.y)
    const ms = Math.max(300, Math.min(2600, dist * 4.2))
    if (to.x !== from.x) setFace(to.x < from.x ? -1 : 1)
    posRef.current = to
    setMoveMs(ms)
    setWalking(true)
    setPos(to)
    window.clearTimeout(walkTimer.current)
    walkTimer.current = window.setTimeout(() => setWalking(false), ms)
    return ms
  }, [])

  // Focus mode: stand at the post.
  useEffect(() => {
    if (mode !== 'focus') return
    moveTo(dock(place))
    const onResize = () => moveTo(dock(place))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode, place, moveTo])

  // Roam mode: wander to a random spot, pause, repeat.
  useEffect(() => {
    if (mode !== 'roam') return
    if (reduced()) {
      moveTo(dock(place))
      return
    }
    let t = 0
    const step = () => {
      const ms = moveTo(randomSpot())
      t = window.setTimeout(step, ms + 900 + Math.random() * 2200)
    }
    t = window.setTimeout(step, 600)
    return () => window.clearTimeout(t)
    // place only matters when docking
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, moveTo])

  // An occasional remark while roaming.
  useEffect(() => {
    if (mode !== 'roam' || reduced()) return
    let t1 = 0
    let t2 = 0
    const loop = () => {
      t1 = window.setTimeout(
        () => {
          setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)])
          t2 = window.setTimeout(() => setQuip(''), 4500)
          loop()
        },
        9000 + Math.random() * 7000,
      )
    }
    loop()
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      setQuip('')
    }
  }, [mode])

  // A fresh line from the page is shown for a few seconds even while roaming.
  useEffect(() => {
    if (!line) return
    setRecent(true)
    const t = window.setTimeout(() => setRecent(false), 6000)
    return () => window.clearTimeout(t)
  }, [line])

  const text = mode === 'focus' ? line : quip || (recent ? line : '')
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
  const tone =
    mood === 'fight'
      ? { border: '#953724', bg: '#fbe7df', chip: 'bg-rose-600 text-white' }
      : mood === 'happy'
        ? { border: '#55702b', bg: '#eef4dc', chip: 'bg-emerald-600 text-white' }
        : mood === 'think'
          ? { border: '#946520', bg: '#fff3c4', chip: 'bg-amber-300 text-slate-900' }
          : { border: '#4a3827', bg: '#eee4cd', chip: 'bg-slate-900 text-amber-300' }
  const onRight = pos.x > window.innerWidth / 2
  const below = pos.y < 170

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{
        left: pos.x,
        top: pos.y,
        width: W,
        height: H,
        transition: reduced() ? 'none' : `left ${moveMs}ms linear, top ${moveMs}ms linear`,
      }}
    >
      <button
        onClick={() => setOverride(mode === 'focus' ? 'roam' : 'focus')}
        className="pointer-events-auto block size-full cursor-pointer bg-transparent"
        aria-label={mode === 'focus' ? 'Counterbot is working. Click to let him wander.' : 'Counterbot is wandering. Click to put him to work.'}
        title={mode === 'focus' ? 'Click to let him wander' : 'Click to put him to work'}
      >
        <span style={{ display: 'inline-block', transform: `scaleX(${face})` }}>
          <CounterbotSprite mood={mood} scale={4} walking={walking} bob={!walking} />
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
          <span className="animate-pulse absolute -right-2 bottom-3 text-sm leading-none font-black text-amber-500 [animation-delay:-0.5s]" aria-hidden>
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
