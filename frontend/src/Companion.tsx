import { useEffect, useState } from 'react'
import { useAssistant } from './assistant'
import { WizardSprite } from './Sprite'

const W = 80 // sprite size at scale 4 (20 x 24 pixels)
const H = 96
const MARGIN = 16

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Quillby always stays in the bottom-right corner. Click him and he waves his wand; he never moves.
export function Companion() {
  const { line, mood, hidden } = useAssistant()
  const [waveSignal, setWaveSignal] = useState(0)
  const [recent, setRecent] = useState(false)
  const [shown, setShown] = useState('')

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
  const tone =
    mood === 'fight'
      ? { border: '#953724', bg: '#fbe7df', chip: 'bg-rose-600 text-white' }
      : mood === 'happy'
        ? { border: '#55702b', bg: '#eef4dc', chip: 'bg-emerald-600 text-white' }
        : mood === 'think'
          ? { border: '#946520', bg: '#fff3c4', chip: 'bg-amber-300 text-slate-900' }
          : { border: '#4a3827', bg: '#eee4cd', chip: 'bg-slate-900 text-amber-300' }

  return (
    <div className="pointer-events-none fixed z-40" style={{ right: MARGIN, bottom: MARGIN, width: W, height: H }}>
      <button
        onClick={() => setWaveSignal((n) => n + 1)}
        className="pointer-events-auto block size-full cursor-pointer bg-transparent"
        aria-label="Quillby, your wizard assistant. Click and he will wave his wand."
        title="Click me"
      >
        <WizardSprite mood={mood} scale={4} idleWave waveSignal={waveSignal} />
      </button>
      {text && shown && (
        <div
          key={text}
          className={`px-panel animate-pop-in pointer-events-none absolute w-max max-w-[16rem] px-4 pt-5 pb-3 sm:max-w-sm bottom-full right-0 mb-4`}
          style={{ borderColor: tone.border, background: tone.bg }}
          role="status"
          aria-live="polite"
        >
          <span className={`font-pixel absolute -top-3.5 left-3 border-[3px] border-slate-900 px-2 py-0.5 text-[11px] tracking-wider uppercase ${tone.chip}`}>Quillby ✦</span>
          <span className="animate-pulse absolute -top-3 right-2 text-lg leading-none font-black text-amber-500" aria-hidden>
            ✦
          </span>
          {/* the full line is laid out invisibly so the bubble keeps its final size while typing */}
          <p className="relative min-w-[10.5rem] text-[15px] leading-snug font-extrabold text-slate-900">
            <span className="invisible">{text}</span>
            <span className="absolute inset-0">
              {shown}
              <span className="animate-pulse text-indigo-600">▌</span>
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
