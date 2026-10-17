import { useEffect, useRef } from 'react'
import { Cloud } from './Sprite'

const PX = 5 // each scenery pixel is 5 screen pixels: clearly pixel art, not too coarse

// An autumn forest at golden hour: a glowing sky and misty valley in the middle, a leafy path
// winding in, tall dark trunks and orange canopies framing both sides, bushes in the corners.
// Colours stay light and warm so dark text reads on top of it.
const SKY = ['#e6b476', '#ecc084', '#f1cc94', '#f5d8a6', '#f8e3b8', '#faecca']

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
  const rand = rng(31)

  // ---- sky: stepped bands, lighter toward the glowing middle, with dithered seams
  const skyEnd = Math.round(h * 0.7)
  const bandH = skyEnd / SKY.length
  for (let y = 0; y < skyEnd; y++) {
    const band = Math.min(SKY.length - 1, Math.floor(y / bandH))
    const into = y - band * bandH
    for (let x = 0; x < w; x++) px(x, y, SKY[band > 0 && into < 2 && (x + y) % 2 === 0 ? band - 1 : band])
  }

  // ---- soft clouds: lumpy ovals, cream on top and peach underneath
  const cloud = (cx: number, cy: number, rx: number, ry: number, tones: [string, string, string]) => {
    const lumps = [
      [0, 0, 1, 1],
      [-0.55, 0.12, 0.6, 0.7],
      [0.55, 0.1, 0.62, 0.72],
      [0.15, -0.3, 0.55, 0.6],
    ]
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx * 1.7); x <= cx + rx * 1.7; x++) {
        let inside = false
        for (const [ox, oy, sx, sy] of lumps) {
          const dx = (x - (cx + ox * rx)) / (rx * sx)
          const dy = (y - (cy + oy * ry)) / (ry * sy)
          if (dx * dx + dy * dy + (hash(x >> 1, y >> 1) - 0.5) * 0.28 < 1) inside = true
        }
        if (!inside) continue
        const t = (y - (cy - ry)) / (2 * ry)
        const seam = (a: number) => Math.abs(t - a) < 0.07 && (x + y) % 2 === 0
        px(x, y, t < 0.38 ? (seam(0.38) ? tones[1] : tones[0]) : t < 0.66 ? (seam(0.66) ? tones[2] : tones[1]) : tones[2])
      }
    }
  }
  const T: [string, string, string] = ['#fff8e2', '#f8dfb2', '#ebc590']
  cloud(w * 0.42, h * 0.1, w * 0.1, h * 0.04, T)
  cloud(w * 0.62, h * 0.2, w * 0.11, h * 0.045, T)
  cloud(w * 0.48, h * 0.33, w * 0.13, h * 0.04, T)
  cloud(w * 0.3, h * 0.27, w * 0.07, h * 0.03, T)
  cloud(w * 0.72, h * 0.36, w * 0.08, h * 0.03, T)

  // ---- misty hills in the distance
  const hills = (base: number, amp: number, f: number, ph: number, body: string, edge: string) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(h * base - h * amp * (Math.sin(x * f + ph) * 0.5 + 0.5))
      for (let y = top; y < h; y++) px(x, y, y === top ? edge : body)
    }
  }
  hills(0.56, 0.06, 0.028, 0.5, '#e8c898', '#f2d8ae')
  hills(0.6, 0.05, 0.039, 2.4, '#dcb482', '#e8c698')
  cloud(w * 0.5, h * 0.62, w * 0.2, h * 0.032, ['#fcf0d0', '#f5e0b4', '#ecd0a0'])

  // ---- forest floor, warm banded browns
  const floorTop = Math.round(h * 0.66)
  const FLOOR = ['#b8803f', '#aa7437', '#9b6830', '#8d5d2a']
  for (let y = floorTop; y < h; y++) {
    const band = Math.min(FLOOR.length - 1, Math.floor(((y - floorTop) / (h - floorTop)) * FLOOR.length))
    for (let x = 0; x < w; x++) px(x, y, FLOOR[band])
  }
  // fallen leaves scattered on the floor
  const LEAF = ['#e8803a', '#f0a040', '#d9622a', '#f4c062', '#c9552a']
  for (let i = 0; i < w * 5; i++) {
    const x = Math.floor(rand() * w)
    const y = floorTop + Math.floor(rand() * (h - floorTop))
    px(x, y, LEAF[Math.floor(rand() * LEAF.length)])
  }
  // the path, winding in from the middle and widening toward the viewer
  for (let y = floorTop; y < h; y++) {
    const t = (y - floorTop) / (h - floorTop)
    const cxp = w * 0.5 + w * 0.05 * Math.sin(y * 0.09) * (0.3 + t)
    const half = 1 + t * w * 0.14
    for (let x = Math.floor(cxp - half); x <= cxp + half; x++) {
      const edge = x < cxp - half + 1.5 || x > cxp + half - 1.5
      px(x, y, edge ? '#c78d45' : hash(x >> 1, y >> 1) > 0.78 ? '#f6d68c' : '#e8b866')
    }
  }

  // ---- tall dark trunks framing both sides, with a few branches
  const TRUNK = '#5a3b2b'
  const trunk = (fx: number, tw: number, lean: number) => {
    const x0 = w * fx
    for (let y = 0; y < h; y++) {
      const x = Math.round(x0 + lean * y)
      rect(x, y, tw, 1, TRUNK)
      px(x + tw, y, '#7a523a')
    }
    // two branches reaching up and out
    ;[0.22, 0.4].forEach((fy, i) => {
      const dir = fx < 0.5 ? -1 : 1
      for (let k = 0; k < 16; k++) px(Math.round(x0 + lean * h * fy) + dir * k * (i ? 0.7 : 1), Math.round(h * fy) - k * 0.9, TRUNK)
    })
  }
  trunk(0.03, 3, 0.02)
  trunk(0.09, 2, -0.01)
  trunk(0.17, 2, 0.015)
  trunk(0.83, 2, -0.015)
  trunk(0.91, 3, 0.01)
  trunk(0.97, 2, -0.02)

  // ---- foliage: a leaf-textured blob in autumn colours
  const FOLIAGE = ['#f0963a', '#e8803a', '#f4b24e', '#dd6a30', '#f6c162']
  const blob = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy + (hash(x, y) - 0.5) * 0.45 > 1) continue
        const patch = hash(Math.floor(x / 8) + 11, Math.floor(y / 6))
        const fam = patch < 0.45 ? [0, 1] : patch < 0.75 ? [2, 4] : [3, 1]
        px(x, y, hash(x, y) > 0.92 ? '#f9d98a' : FOLIAGE[fam[hash(x >> 1, y >> 1) > 0.5 ? 1 : 0]])
      }
    }
  }
  const canopy: [number, number, number, number][] = [
    [0.02, 0.05, 0.16, 0.12],
    [0.14, 0.09, 0.11, 0.09],
    [0.24, 0.04, 0.1, 0.07],
    [0.0, 0.26, 0.1, 0.09],
    [0.98, 0.05, 0.17, 0.12],
    [0.86, 0.1, 0.11, 0.09],
    [0.76, 0.04, 0.1, 0.07],
    [1.0, 0.27, 0.1, 0.09],
  ]
  canopy.forEach(([fx, fy, rx, ry]) => blob(w * fx, h * fy, w * rx, h * ry))

  // ---- bushes in the lower corners: green, yellow, orange and red leaves
  const FAMILIES = [
    ['#5d7a38', '#7a9a46', '#4a6330'],
    ['#5d7a38', '#7a9a46', '#4a6330'],
    ['#d9b43c', '#e8c85a', '#c49a2a'],
    ['#e07a2e', '#f09a44', '#c5602a'],
    ['#e07a2e', '#f09a44', '#c5602a'],
    ['#c5502a', '#d9663a', '#a8401f'],
  ]
  const leafAt = (x: number, y: number) => {
    const fam = FAMILIES[Math.floor(hash(Math.floor(x / 9) + 3, Math.floor(y / 6)) * FAMILIES.length)]
    return fam[Math.floor(hash(x >> 1, y >> 1) * fam.length)]
  }
  const bush = (fromLeft: boolean, reach: number, peak: number) => {
    for (let i = 0; i < w * reach; i++) {
      const x = fromLeft ? i : w - 1 - i
      const k = 1 - i / (w * reach)
      const top = Math.round(h * (0.97 - peak * Math.pow(k, 0.9)) + (hash(x, 3) - 0.5) * 4)
      for (let y = top; y < h; y++) px(x, y, hash(x, y) > 0.95 ? '#f2e08a' : leafAt(x, y))
    }
  }
  bush(true, 0.3, 0.4)
  bush(false, 0.3, 0.44)
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
      <Cloud className="px-cloud absolute top-[16%] left-0 opacity-70" scale={7} light="#fff8e2" shade="#f0d09c" />
    </div>
  )
}
