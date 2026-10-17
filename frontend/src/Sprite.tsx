import { useEffect, useState } from 'react'

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
  b: '#3b5dc9', // Counterbot stays blue
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

/* ---------- Counterbot: the customer's assistant ---------- */

export type Mood = 'idle' | 'think' | 'fight' | 'happy' | 'sad'
const EYE: Record<Mood, string> = { idle: '#8fe6ee', think: '#e8c067', fight: '#e8844f', happy: '#b7d96b', sad: '#bfae8f' }

function counterbotRows(blink: boolean, mood: Mood): string[] {
  // Visor rows (cols 4..11): open eyes, a squint for blinking, angry slant for fighting.
  const visor =
    blink || mood === 'sad'
      ? ['kkkkkkkk', 'kkkkkkkk', 'kcckkcck']
      : mood === 'fight'
        ? ['kckkkkck', 'kkcckcck', 'kkkkkkkk']
        : mood === 'happy'
          ? ['kkckkckk', 'kcckkcck', 'kkkkkkkk']
          : ['kkkkkkkk', 'kcckkcck', 'kkkkkkkk']
  const rows = [
    '.......yy.......',
    '.......kk.......',
    '...kkkkkkkkkk...',
    '..kbbbbbbbbbbk..',
    `..kb${visor[0]}bk..`,
    `..kb${visor[1]}bk..`,
    `..kb${visor[2]}bk..`,
    '..kbbbbbbbbbbk..',
    '...kkkkkkkkkk...',
    '..kkbbbbbbbbkk..',
    '.kgkbbyyyybbkgk.',
    '.kgkbbbyybbbkgk.',
    '..kkbbbbbbbbkk..',
    '...kbbbbbbbbk...',
    '...kbbk..kbbk...',
    '..kkkkk..kkkkk..',
  ]
  if (mood === 'happy') {
    // confetti
    rows[0] = '.y.....yy....y..'
    rows[1] = 'y......kk.....y.'
  }
  return rows
}

export function CounterbotSprite({ mood = 'idle', scale = 4, bob = true, walking = false, className = '' }: { mood?: Mood; scale?: number; bob?: boolean; walking?: boolean; className?: string }) {
  const [blink, setBlink] = useState(false)
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
      <PixelSprite rows={counterbotRows(blink, mood)} colors={{ ...PAL, c: EYE[mood] }} scale={scale} label="Counterbot, your assistant" />
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

export function Avatar({ who, scale = 3 }: { who: 'company_bot' | 'human_agent' | 'customer_bot' | 'customer' | 'system'; scale?: number }) {
  if (who === 'customer' || who === 'system') return null
  return (
    <span className="inline-flex shrink-0 items-end justify-center border-[3px] border-slate-900 bg-white" style={{ width: 16 * scale + 6, height: 16 * scale + 6 }}>
      {who === 'company_bot' ? <NovaSprite scale={scale} /> : who === 'human_agent' ? <SamSprite scale={scale} /> : <CounterbotSprite scale={scale} bob={false} />}
    </span>
  )
}
