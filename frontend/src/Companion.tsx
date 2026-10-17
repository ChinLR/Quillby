import { useEffect, useState } from 'react'
import { useAssistant } from './assistant'
import { CounterbotSprite } from './Sprite'

// Counterbot stays on screen the whole time, talking in a speech box.
export function Companion() {
  const { line, mood, place, hidden } = useAssistant()
  const [shown, setShown] = useState('')
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(line)
      return
    }
    setShown('')
    let i = 0
    const t = window.setInterval(() => {
      i++
      setShown(line.slice(0, i))
      if (i >= line.length) window.clearInterval(t)
    }, 24)
    return () => window.clearInterval(t)
  }, [line])

  if (hidden) return null
  const right = place === 'right'
  return (
    <div
      className={`pointer-events-none fixed bottom-3 z-40 flex items-end gap-2 sm:bottom-5 ${right ? 'right-3 flex-row-reverse sm:right-5' : 'left-3 sm:left-5'}`}
    >
      <button onClick={() => setOpen(!open)} className="pointer-events-auto shrink-0 bg-transparent" aria-label={open ? 'Hide Counterbot' : 'Show Counterbot'} aria-pressed={open}>
        <CounterbotSprite mood={mood} scale={4} />
      </button>
      {open && line && (
        <div className="px-panel pointer-events-auto relative mb-3 max-w-[15rem] px-3 py-2 sm:max-w-xs" role="status" aria-live="polite">
          {right ? (
            <>
              <span className="absolute top-1/2 -right-[14px] size-0 -translate-y-1/2 border-y-[8px] border-l-[10px] border-y-transparent border-l-slate-900" aria-hidden />
              <span className="absolute top-1/2 -right-[8px] size-0 -translate-y-1/2 border-y-[5px] border-l-[6px] border-y-transparent border-l-white" aria-hidden />
            </>
          ) : (
            <>
              <span className="absolute top-1/2 -left-[14px] size-0 -translate-y-1/2 border-y-[8px] border-r-[10px] border-y-transparent border-r-slate-900" aria-hidden />
              <span className="absolute top-1/2 -left-[8px] size-0 -translate-y-1/2 border-y-[5px] border-r-[6px] border-y-transparent border-r-white" aria-hidden />
            </>
          )}
          <p className="text-[13px] leading-snug font-semibold text-slate-900">
            <span className="font-pixel text-[11px] text-indigo-700 uppercase">Counterbot </span>
            {shown}
            <span className="animate-pulse">▌</span>
          </p>
        </div>
      )}
    </div>
  )
}
