import { useCallback, useEffect, useRef, useState } from 'react'

// Pixel art as strings: one character per pixel, '.' is transparent. Rendered as crisp SVG rects.
export function PixelSprite({
  rows,
  colors,
  scale = 4,
  className = '',
  label,
}: {
  rows: string[]
  colors: Record<string, string>
  scale?: number
  className?: string
  label?: string
}) {
  const h = rows.length
  const w = rows[0].length
  const rects: React.ReactNode[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < w) {
      const ch = row[x]
      if (ch === '.' || !colors[ch]) {
        x++
        continue
      }
      let run = 1
      while (x + run < w && row[x + run] === ch) run++
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={run} height={1} fill={colors[ch]} />)
      x += run
    }
  })
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {rects}
    </svg>
  )
}

const PAL = {
  k: '#241b13',
  b: '#3b5dc9', // the wizard stays blue
  l: '#73c1f5',
  y: '#e2b04f',
  o: '#d9814f',
  r: '#b0452f',
  g: '#bfae8f',
  d: '#7a6648',
  w: '#fbf4e4',
  s: '#f0c9a0',
  h: '#5b3a24',
  t: '#6b8a37',
  n: '#8a5a3b',
}

/* ---------- Quillby: the customer's assistant ---------- */

export type Mood = 'idle' | 'think' | 'fight' | 'duel' | 'happy' | 'sad'

// Quillby is a wizard: blue robe and pointed hat with a gold star, white beard, a staff,
// and a sword that comes out when he fights. 20 x 24 pixels.
const WIZARD_COLORS = {
  k: '#241b13',
  b: '#3a56b0',
  B: '#2a3f87',
  L: '#6f8fe0',
  y: '#f2c744',
  w: '#f4f0e6',
  g: '#cfc8b8',
  s: '#f0c9a0',
  n: '#8a5a3b',
  i: '#e4ebf2',
  I: '#9aa8ba',
  p: '#e89a93',
}
const WIZARD_BASE = [
  '.........kk.........',
  '........kBBk........',
  '........kbbk........',
  '.......kbbbbk.......',
  '.......kbbLbk.......',
  '......kbbbbbbk......',
  '......kbbyybbk......',
  '.....kbbbyybbbk.....',
  '....kbbbbbbbbbbk....',
  '..kkkkkkkkkkkkkkkk..',
  '...kyyyyyyyyyyyyk...',
  '....kssssssssssk....',
  '....kssksssskssk....',
  '....kssssssssssk....',
  '...kwwwwwwwwwwwwk...',
  '...kwwwwgwwgwwwwk...',
  '....kwwwwwwwwwwk....',
  '..kbbbbbwwwwbbbbbk..',
  '..kbbLbbbwwbbbbLbk..',
  '..kbbbbbbbbbbbbbbk..',
  '..kbbbbyyyyyybbbbk..',
  '..kbbbbbbbbbbbbbbk..',
  '..kBBBBBBBBBBBBBBk..',
  '...kkkkkkkkkkkkkk...',
]

function wizardRows(blink: boolean, mood: Mood, wave: number): string[] {
  const g = WIZARD_BASE.map((r) => r.split(''))
  const put = (x: number, y: number, c: string) => {
    if (g[y] && x >= 0 && x < g[y].length) g[y][x] = c
  }
  if (mood === 'fight') {
    // sword raised in the right hand
    put(18, 0, 'I')
    for (let y = 1; y <= 13; y++) {
      put(18, y, 'i')
      put(19, y, 'I')
    }
    for (let x = 17; x <= 19; x++) put(x, 14, 'y')
    put(18, 15, 's')
    put(18, 16, 'n')
    put(18, 17, 'y')
    // furrowed brows
    put(6, 11, 'k')
    put(7, 11, 'k')
    put(12, 11, 'k')
    put(13, 11, 'k')
  } else if (mood === 'duel') {
    // wand duel: no staff, wand arm out to the left (the wand itself is drawn by the scene)
    put(1, 15, 's')
    put(1, 16, 's')
    put(0, 15, 's')
    put(6, 11, 'k')
    put(7, 11, 'k')
    put(12, 11, 'k')
    put(13, 11, 'k')
  } else {
    // staff with a gold star on top; when he waves it, the staff is raised and magic flies
    const top = wave ? 0 : 2
    put(18, top, 'y')
    put(17, top + 1, 'y')
    put(18, top + 1, 'y')
    put(19, top + 1, 'y')
    put(18, top + 2, 'y')
    for (let y = top + 3; y <= 22; y++) put(18, y, 'n')
    put(18, 15, 's')
    put(18, 16, 's')
    if (wave === 1) {
      put(15, 0, 'y')
      put(16, 3, 'L')
      put(14, 2, 'L')
      put(19, 5, 'y')
    } else if (wave === 2) {
      put(14, 1, 'y')
      put(16, 5, 'L')
      put(15, 3, 'y')
      put(19, 4, 'L')
    }
  }
  if (blink || mood === 'sad') {
    put(7, 12, 's')
    put(12, 12, 's')
    put(7, 13, 'k')
    put(12, 13, 'k')
  }
  if (mood === 'happy') {
    put(6, 13, 'p')
    put(13, 13, 'p')
    put(2, 5, 'y')
    put(16, 6, 'y')
    put(1, 9, 'y')
  }
  return g.map((r) => r.join(''))
}

export function WizardSprite({
  mood = 'idle',
  scale = 4,
  bob = true,
  walking = false,
  idleWave = false,
  waveSignal = 0,
  className = '',
}: {
  mood?: Mood
  scale?: number
  bob?: boolean
  walking?: boolean
  idleWave?: boolean // an occasional, rare wave of the staff
  waveSignal?: number // change this number to make him wave once, right now
  className?: string
}) {
  const [blink, setBlink] = useState(false)
  const [wave, setWave] = useState(0)
  const calm = mood === 'fight'
  const walkingRef = useRef(walking)
  walkingRef.current = walking
  const timers = useRef<number[]>([])
  const cast = useCallback((force = false) => {
    if (walkingRef.current && !force) return
    ;[1, 2, 1, 2, 1, 2, 1, 0].forEach((f, i) => timers.current.push(window.setTimeout(() => setWave(f), i * 160)))
  }, [])
  useEffect(() => {
    if (!idleWave || calm || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return
    let t = 0
    const loop = () => {
      t = window.setTimeout(() => {
        cast()
        loop()
      }, 14000 + Math.random() * 10000)
    }
    loop()
    const pending = timers.current
    return () => {
      window.clearTimeout(t)
      pending.forEach((id) => window.clearTimeout(id))
      setWave(0)
    }
  }, [idleWave, calm, cast])
  useEffect(() => {
    if (waveSignal > 0) cast(true)
  }, [waveSignal, cast])
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t1 = 0
    let t2 = 0
    const loop = () => {
      t1 = window.setTimeout(() => {
        setBlink(true)
        t2 = window.setTimeout(() => {
          setBlink(false)
          loop()
        }, 160)
      }, 2400 + Math.random() * 2200)
    }
    loop()
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])
  return (
    <span className={`inline-block ${walking ? 'px-walk' : bob ? 'px-bob' : ''} ${className}`}>
      <span style={{ display: 'inline-block', transformOrigin: '50% 100%', transform: wave === 1 ? 'rotate(-5deg)' : wave === 2 ? 'rotate(5deg)' : undefined }}>
        <PixelSprite rows={wizardRows(blink, mood, wave)} colors={WIZARD_COLORS} scale={scale} label="Quillby, your wizard assistant" />
      </span>
    </span>
  )
}

/* ---------- Nova: the airline's chatbot ---------- */

const NOVA = [
  '................',
  '.......kk.......',
  '.......rr.......',
  '..kkkkkkkkkkkk..',
  '..kggggggggggk..',
  '..kgkkkggkkkgk..',
  '..kgkkkggkkkgk..',
  '..kggggggggggk..',
  '..kgggkkkkgggk..',
  '..kggggggggggk..',
  '..kkkkkkkkkkkk..',
  '...kddddddddk...',
  '...kdwwddwwdk...',
  '...kddddddddk...',
  '...kkkkkkkkkk...',
  '...kk......kk...',
]
export function NovaSprite({ scale = 4, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite rows={NOVA} colors={PAL} scale={scale} className={className} label="Nova, the airline's chatbot" />
}

/* ---------- Sam: the human agent ---------- */

const SAM = [
  '................',
  '....kkkkkkkk....',
  '...khhhhhhhhk...',
  '..khhhhhhhhhhk..',
  '..khhssssssshk..',
  '..kgsskssksskg..',
  '..kgssssssssgk..',
  '...ksssrrsssk...',
  '....ksssssk.....',
  '..kkttttttttkk..',
  '..kttttttttttk..',
  '..kttttttttttk..',
  '..kttttttttttk..',
  '..kkkkkkkkkkkk..',
  '...kddk..kddk...',
  '...kkkk..kkkk...',
]
export function SamSprite({ scale = 4, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite rows={SAM.map((r) => r.padEnd(16, '.').slice(0, 16))} colors={PAL} scale={scale} className={className} label="Sam, the human agent" />
}

/* ---------- scenery and icons ---------- */

const CLOUD = [
  '........wwww..........',
  '......wwwwwwww.wwww...',
  '..wwwwwwwwwwwwwwwwwwl.',
  '.wwwwwwwwwwwwwwwwwwwll',
  '..llllllllllllllllll..',
]
export function Cloud({ scale = 6, className = '', light = '#fbf4e4', shade = '#dccdb0' }: { scale?: number; className?: string; light?: string; shade?: string }) {
  return <PixelSprite rows={CLOUD} colors={{ ...PAL, w: light, l: shade }} scale={scale} className={className} />
}

// A floating mossy island with a rocky underside and hanging roots, drawn procedurally.
const hash = (a: number, b: number) => Math.abs(((a * 73856093) ^ (b * 19349663)) % 997)
export function islandRows(w = 36, h = 24): string[] {
  const grid: string[][] = Array.from({ length: h }, () => Array(w).fill('.'))
  const mid = (w - 1) / 2
  for (let r = 0; r < h - 2; r++) {
    const half = Math.max(1, Math.round((w / 2 - 1) * Math.pow(1 - r / (h * 0.92), 0.8)))
    for (let x = Math.round(mid - half); x <= Math.round(mid + half); x++) {
      const n = hash(Math.floor(x / 2), Math.floor(r / 2))
      grid[r][x] = r < 2 ? (n % 4 === 0 ? 'M' : 'm') : r === 2 ? (n % 3 === 0 ? 'm' : 'g') : n % 11 === 0 ? 'd' : n % 4 === 0 ? 'S' : 's'
    }
  }
  // moss overhang drips and roots
  for (let x = 2; x < w - 2; x += 3) if (grid[3][x] !== '.' && hash(x, 3) % 2) grid[3][x] = 'm'
  for (let i = 0; i < 4; i++) {
    const x = Math.round(mid - 6 + i * 4 + (hash(i, 9) % 3))
    for (let r = h - 8; r < h; r++) if (grid[r - 1]?.[x] !== '.' || grid[r][x] === 'r') grid[r][x] = 'r'
  }
  return grid.map((row) => row.join(''))
}
const ISLAND_COLORS = { m: '#b4c231', M: '#8a9a24', g: '#4c6b3a', s: '#5d6e6a', S: '#3f4f4d', d: '#7b5a3c', r: '#5b3d27' }
export function Island({ scale = 8, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite rows={islandRows()} colors={ISLAND_COLORS} scale={scale} className={className} />
}

const DOC = [
  'kkkkkkkkkkk',
  'kwwwwwwwwwk',
  'kwddddddwwk',
  'kwwwwwwwwwk',
  'kwddddddddk',
  'kwwwwwwwwwk',
  'kwddddwwwwk',
  'kwwwwwwwwwk',
  'kwddddddddk',
  'kwwwwwwwwwk',
  'kwdddddwyyk',
  'kwwwwwwwyyk',
  'kwwwwwwwwwk',
  'kkkkkkkkkkk',
]
export function DocSprite({ scale = 4, className = '' }: { scale?: number; className?: string }) {
  return <PixelSprite rows={DOC} colors={PAL} scale={scale} className={className} label="A document" />
}

const ICONS: Record<string, string[]> = {
  book: ['.kkkkkk.', 'kbbbbbbk', 'kbwwwwbk', 'kbbbbbbk', 'kbwwwwbk', 'kbbbbbbk', 'kbbbbbbk', '.kkkkkk.'],
  loop: ['..kkkk..', '.kyyyyk.', 'kyk..kyk', 'kyk..kkk', 'kyk..kyk', 'kyk..kyk', '.kyyyyk.', '..kkkk..'],
  compass: ['..kkkk..', '.kwwwwk.', 'kwwwrwwk', 'kwwrrbwk', 'kwbrrwwk', 'kwbwwwwk', '.kwwwwk.', '..kkkk..'],
  eye: ['........', '..kkkk..', '.kwwwwk.', 'kwwbbwwk', 'kwwbbwwk', '.kwwwwk.', '..kkkk..', '........'],
  phone: ['.kkkkkk.', '.kddddk.', '.kbbbbk.', '.kbwwbk.', '.kbbbbk.', '.kbbbbk.', '.kddddk.', '.kkkkkk.'],
  shield: ['kkkkkkkk', 'kbbbbbbk', 'kbbyybbk', 'kbbyybbk', 'kbbbbbbk', '.kbbbbk.', '..kbbk..', '...kk...'],
}
export function Icon({ name, scale = 5, className = '' }: { name: keyof typeof ICONS; scale?: number; className?: string }) {
  return <PixelSprite rows={ICONS[name]} colors={PAL} scale={scale} className={className} />
}

/* ---------- who is who in a chat ---------- */

export function Avatar({ who }: { who: 'company_bot' | 'human_agent' | 'customer_bot' | 'customer' | 'system' }) {
  if (who === 'customer' || who === 'system') return null
  return (
    <span className="inline-flex size-[54px] shrink-0 items-end justify-center border-[3px] border-slate-900 bg-white">
      {who === 'company_bot' ? <NovaSprite scale={3} /> : who === 'human_agent' ? <SamSprite scale={3} /> : <WizardSprite scale={2} bob={false} />}
    </span>
  )
}
