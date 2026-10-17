import { useEffect, useRef } from 'react'
import { Cloud } from './Sprite'

const PX = 4 // each scenery pixel is 4 screen pixels: clearly pixel art, with room for detail

// A fantasy valley: teal sky and fluffy clouds, jagged blue spires, a wizard's tower with red roofs,
// orange autumn trees either side, and a stream with rocks at the bottom.
const SKY = ['#4c9aa6', '#58a5ae', '#66b0b5', '#74bbbc', '#83c5c3', '#93cfca']

const rng = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const hash = (a: number, b: number) => Math.abs(((a * 73856093) ^ (b * 19349663)) % 1000) / 1000

function paint(canvas: HTMLCanvasElement) {
  const w = Math.ceil(window.innerWidth / PX)
  const h = Math.ceil(window.innerHeight / PX)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const px = (x: number, y: number, c: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    ctx.fillStyle = c
    ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1)
  }
  const rect = (x: number, y: number, rw: number, rh: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(rw), Math.ceil(rh))
  }
  const rand = rng(41)

  const horizon = Math.round(h * 0.62) // where the sky meets the mountains
  const waterTop = Math.round(h * 0.9)
  const groundY = Math.round(h * 0.86) // the line the buildings and trees stand on

  // ---- sky: stepped bands with dithered seams
  const bandH = horizon / SKY.length
  for (let y = 0; y < h; y++) {
    const band = Math.min(SKY.length - 1, Math.floor(y / bandH))
    const into = y - band * bandH
    for (let x = 0; x < w; x++) px(x, y, SKY[band > 0 && into < 2 && (x + y) % 2 === 0 ? band - 1 : band])
  }

  // ---- fluffy clouds: a row of rounded lumps, bright on top and shaded underneath
  const fluffy = (cx: number, cy: number, cw: number, ch: number, seed: number) => {
    const r = rng(seed)
    const lumps: [number, number, number][] = []
    const n = Math.max(5, Math.round(cw / 9))
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n
      const lr = ch * (0.32 + 0.6 * Math.sin(t * Math.PI) * (0.6 + 0.4 * r()))
      lumps.push([cx - cw / 2 + t * cw, cy - lr * 0.3, lr])
    }
    const top = cy - ch
    const bottom = cy + ch * 0.28
    for (let y = Math.floor(top); y <= bottom; y++) {
      for (let x = Math.floor(cx - cw / 2 - ch); x <= cx + cw / 2 + ch; x++) {
        let inside = false
        for (const [lx, ly, lr] of lumps) {
          const dx = x - lx
          const dy = y - ly
          if (dx * dx + dy * dy < lr * lr) {
            inside = true
            break
          }
        }
        if (!inside) continue
        const t = (y - top) / (bottom - top)
        const n2 = hash(x >> 1, y >> 1)
        const c = t < 0.28 ? '#f4f8e8' : t < 0.52 ? (n2 > 0.55 ? '#f4f8e8' : '#d6e8d6') : t < 0.78 ? (n2 > 0.5 ? '#d6e8d6' : '#b2d0c6') : '#a2c4bc'
        px(x, y, c)
      }
    }
  }
  fluffy(w * 0.72, h * 0.13, w * 0.5, h * 0.11, 3)
  fluffy(w * 0.1, h * 0.17, w * 0.28, h * 0.07, 9)
  fluffy(w * 0.9, h * 0.34, w * 0.26, h * 0.07, 14)
  fluffy(w * 0.55, h * 0.42, w * 0.2, h * 0.05, 21)
  fluffy(w * 0.2, h * 0.36, w * 0.1, h * 0.04, 33)

  // ---- mountains: a mist-blue base, a jagged central spire group and a rounded peak on the right
  const MT = { body: '#5f7f9b', lit: '#86a2b8', shade: '#4a6580', mist: '#8fb0c0' }
  const crag = (cx: number, hw: number, ht: number, jag: number) => {
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const t = Math.abs(x - cx) / hw
      const top = Math.round(waterTop - ht * Math.pow(1 - t, 1.5) + (hash(x, 5) - 0.5) * jag * (1 - t) - (x % 6 === 0 ? 2 : 0))
      for (let y = top; y < waterTop; y++) {
        const rock = y - top < 3 && x < cx ? MT.lit : x > cx + hw * 0.25 ? MT.shade : hash(x >> 2, y >> 3) > 0.84 ? MT.lit : MT.body
        px(x, y, rock)
      }
    }
  }
  const mass = (cx: number, hw: number, ht: number) => {
    for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
      const t = Math.abs(x - cx) / hw
      const top = Math.round(waterTop - ht * (1 - t * t))
      for (let y = top; y < waterTop; y++) px(x, y, y - top < 3 && x < cx ? MT.lit : x > cx ? MT.shade : MT.body)
    }
  }
  mass(w * 0.12, w * 0.2, h * 0.3)
  crag(w * 0.43, w * 0.09, h * 0.5, 6)
  crag(w * 0.5, w * 0.06, h * 0.36, 5)
  crag(w * 0.38, w * 0.05, h * 0.3, 4)
  mass(w * 0.73, w * 0.17, h * 0.34)
  // mist rising off the valley floor: four soft bands, dithered where they meet
  const MIST = ['#6f92ab', '#7b9eb3', '#88a9bd', '#96b5c6']
  const mistTop = Math.round(h * 0.74)
  const mistH = (waterTop - mistTop) / MIST.length
  for (let y = mistTop; y < waterTop; y++) {
    const band = Math.min(MIST.length - 1, Math.floor((y - mistTop) / mistH))
    const into = (y - mistTop) - band * mistH
    for (let x = 0; x < w; x++) {
      const seam = band > 0 && into < 2 && (x + y) % 2 === 0
      // keep the mountains' shape: only tint pixels that are already mountain-coloured
      px(x, y, MIST[seam ? band - 1 : band])
    }
  }

  // ---- water along the bottom, with banks of grass
  for (let y = waterTop; y < h; y++) {
    for (let x = 0; x < w; x++) px(x, y, '#3f8f96')
  }
  for (let i = 0; i < w * 0.8; i++) {
    const x = Math.floor(w * 0.28 + rand() * w * 0.55)
    const y = waterTop + 1 + Math.floor(rand() * (h - waterTop - 1))
    const len = 2 + Math.floor(rand() * 5)
    for (let k = 0; k < len; k++) px(x + k, y, '#8ed0cc')
  }
  const GRASS = ['#7aa43a', '#6a9534', '#8cb946']
  const bank = (x0: number, x1: number, top: number, bend: number) => {
    for (let x = x0; x < x1; x++) {
      const t = (x - x0) / (x1 - x0)
      const edge = Math.round(top + bend * Math.sin(t * Math.PI))
      for (let y = edge; y < h; y++) px(x, y, y === edge ? GRASS[2] : y < edge + 3 ? GRASS[0] : '#587d30')
    }
  }
  bank(0, Math.round(w * 0.46), groundY, 3)
  bank(Math.round(w * 0.66), w, groundY, 4)

  // ---- the wizard's tower, with red-tiled roofs
  const gx = Math.round(w * 0.2) // centre of the main house
  const roof = (cx: number, baseY: number, half: number, ht: number) => {
    for (let i = 0; i < ht; i++) {
      const hw = Math.round(half * (1 - i / ht))
      rect(cx - hw, baseY - i, hw * 2 + 1, 1, i % 3 === 0 ? '#a24a28' : '#b95430')
      px(cx - hw, baseY - i, '#d97a45')
    }
  }
  const brick = (x: number, y: number, bw: number, bh: number, c1: string, c2: string, c3: string) => {
    rect(x, y, bw, bh, c1)
    for (let j = 0; j < bh; j += 3) for (let i = (j / 3) % 2 ? 2 : 0; i < bw; i += 5) rect(x + i, y + j, 3, 1, c2)
    rect(x + bw - 3, y, 3, bh, c3)
  }
  const tallH = Math.round(h * 0.5)
  // tall tower
  brick(gx - 12, groundY - tallH, 16, tallH, '#8b6c58', '#7d5f4c', '#6f5242')
  rect(gx - 15, groundY - tallH - 4, 22, 5, '#6e4f3f')
  for (let i = 0; i < 22; i += 4) rect(gx - 15 + i, groundY - tallH - 7, 3, 3, '#6e4f3f')
  brick(gx - 10, groundY - tallH - 12, 12, 8, '#8b6c58', '#7d5f4c', '#6f5242')
  rect(gx - 4, groundY - tallH - 18, 1, 6, '#4a3a2c')
  rect(gx - 3, groundY - tallH - 18, 6, 3, '#e8c15a')
  ;[0.25, 0.5, 0.72].forEach((f) => rect(gx - 7, groundY - tallH + Math.round(tallH * f), 2, 4, '#3a2f3f'))
  // short tower on the left, conical red roof
  brick(gx - 36, groundY - Math.round(h * 0.28), 18, Math.round(h * 0.28), '#9a7a62', '#8a6b55', '#7a5d49')
  rect(gx - 39, groundY - Math.round(h * 0.28) - 3, 24, 4, '#6e4f3f')
  roof(gx - 27, groundY - Math.round(h * 0.28) - 3, 11, 16)
  rect(gx - 31, groundY - Math.round(h * 0.2), 2, 4, '#3a2f3f')
  rect(gx - 24, groundY - Math.round(h * 0.2), 2, 4, '#3a2f3f')
  // main house: timber-framed walls, big red gable
  const hhH = Math.round(h * 0.17)
  rect(gx - 22, groundY - hhH, 46, hhH, '#d9b98a')
  for (let i = 0; i <= 46; i += 9) rect(gx - 22 + i, groundY - hhH, 2, hhH, '#6b4a35')
  rect(gx - 22, groundY - Math.round(hhH / 2), 46, 2, '#6b4a35')
  roof(gx + 1, groundY - hhH, 26, 18)
  ;[-16, -4, 8, 16].forEach((ox) => rect(gx + ox, groundY - Math.round(hhH * 0.8), 3, 5, '#3a2f3f'))
  rect(gx - 3, groundY - 9, 6, 9, '#4a3226')
  rect(gx - 2, groundY - 11, 4, 2, '#4a3226')
  // low outbuilding with its own roof
  rect(gx - 56, groundY - 9, 20, 9, '#cfae80')
  roof(gx - 46, groundY - 9, 12, 7)
  // steps down to the water, and the lamp post
  for (let i = 0; i < 9; i++) rect(gx + 24 + i * 2, groundY + i - 1, 5, 2, i % 2 ? '#8a5a3b' : '#6e4630')
  rect(gx + 36, groundY - 28, 2, 28, '#4a3a2c')
  rect(gx + 30, groundY - 28, 8, 1, '#4a3a2c')
  rect(gx + 28, groundY - 33, 5, 6, '#f6d77a')
  rect(gx + 27, groundY - 34, 7, 1, '#4a3a2c')

  // ---- foliage helpers: clumped orange canopies, green bushes
  const ORANGE = ['#f09a3a', '#e8812a', '#f7b44e', '#c9651f']
  const canopy = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy + (hash(x, y) - 0.5) * 0.4 > 1) continue
        const lowness = (y - (cy - ry)) / (2 * ry)
        const n = hash(Math.floor(x / 3), Math.floor(y / 3))
        const idx = lowness > 0.7 ? 3 : lowness < 0.3 && n > 0.4 ? 2 : n > 0.66 ? 0 : n > 0.33 ? 1 : 0
        px(x, y, hash(x, y) > 0.93 ? '#fcd27a' : ORANGE[idx])
      }
    }
  }
  const trunk = (x: number, top: number, bottom: number, tw: number) => {
    rect(x, top, tw, bottom - top, '#5a3a2c')
    rect(x + tw, top, 1, bottom - top, '#7a523a')
    for (let k = 0; k < 14; k++) {
      px(x - k, top + 6 - k * 0.7, '#5a3a2c')
      px(x + tw + k, top + 4 - k * 0.7, '#5a3a2c')
    }
  }
  const bush = (cx: number, cy: number, rx: number, ry: number, light: string, mid: string, dark: string) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy + (hash(x, y) - 0.5) * 0.35 > 1) continue
        const n = hash(Math.floor(x / 2), Math.floor(y / 2))
        px(x, y, y > cy + ry * 0.3 ? dark : n > 0.6 ? light : mid)
      }
    }
  }
  // bushes at the foot of the tower
  bush(gx + 28, groundY - 2, 9, 7, '#8cb946', '#5f8a3a', '#3e5a30')
  bush(gx - 22, groundY + 1, 8, 5, '#7aa84a', '#5f8a3a', '#3e5a30')
  bush(gx + 44, groundY - 4, 8, 7, '#c8b94a', '#8aa63e', '#587a30')
  bush(gx + 6, groundY + 2, 7, 4, '#d8c24a', '#8aa63e', '#587a30')

  // left tree, partly off the edge
  trunk(Math.round(w * 0.045), Math.round(h * 0.4), groundY + 2, 4)
  canopy(w * 0.055, h * 0.38, w * 0.1, h * 0.2)
  canopy(w * 0.0, h * 0.5, w * 0.06, h * 0.12)
  // two trees on the right
  trunk(Math.round(w * 0.82), Math.round(h * 0.52), groundY + 2, 3)
  canopy(w * 0.83, h * 0.5, w * 0.09, h * 0.16)
  trunk(Math.round(w * 0.93), Math.round(h * 0.46), groundY + 2, 3)
  canopy(w * 0.95, h * 0.44, w * 0.1, h * 0.2)
  // a small hut and wall on the right bank
  rect(Math.round(w * 0.74), groundY - 8, 16, 10, '#8b6c58')
  roof(Math.round(w * 0.74) + 8, groundY - 8, 11, 8)
  rect(Math.round(w * 0.74) + 6, groundY - 5, 4, 7, '#4a3226')
  for (let i = 0; i < 18; i += 4) rect(Math.round(w * 0.67) + i, groundY - 4, 3, 4, '#8b6c58')
  rect(Math.round(w * 0.67), groundY - 1, 19, 3, '#7a5d49')
  bush(w * 0.99, groundY - 6, 8, 9, '#f2b44a', '#e8812a', '#c9651f')
  bush(w * 0.9, groundY + 1, 7, 4, '#c8b94a', '#8aa63e', '#587a30')

  // ---- rocks along the water
  const ROCK = ['#7a5666', '#6a4a58', '#8d6a7a']
  const rock = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy > 1) continue
        px(x, y, y < cy - ry * 0.3 ? ROCK[2] : y > cy + ry * 0.4 ? ROCK[1] : ROCK[0])
      }
    }
  }
  for (let i = 0; i < 9; i++) {
    const side = i % 2 === 0
    const x = side ? w * (0.04 + rand() * 0.34) : w * (0.64 + rand() * 0.32)
    rock(x, waterTop + 1 + rand() * 3, 3 + rand() * 3, 2 + rand() * 2)
  }
  for (let i = 0; i < 5; i++) rock(w * (0.34 + rand() * 0.28), waterTop + 3 + rand() * (h - waterTop - 4), 2 + rand() * 2, 1.5 + rand())
}

// A fixed pixel landscape behind every page.
export function Scenery() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let t = 0
    const run = () => paint(el)
    run()
    const onResize = () => {
      window.clearTimeout(t)
      t = window.setTimeout(run, 120)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.clearTimeout(t)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <canvas ref={ref} className="absolute inset-0 size-full [image-rendering:pixelated]" />
      <Cloud className="px-cloud absolute top-[10%] left-0 opacity-80" scale={6} light="#f4f8e8" shade="#cfe3d0" />
    </div>
  )
}
