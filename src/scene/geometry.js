import * as THREE from 'three'

// Italic lean of the QuiCut wordmark: x' = x + SKEW * y
export const SKEW = 0.24

function roundedRectPoints(x0, y0, x1, y1, r, seg = 10) {
  const pts = []
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2)
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r))
    }
  }
  corner(x1 - r, y0 + r, -Math.PI / 2) // bottom-right
  corner(x1 - r, y1 - r, 0) // top-right
  corner(x0 + r, y1 - r, Math.PI / 2) // top-left
  corner(x0 + r, y0 + r, Math.PI) // bottom-left
  return pts
}

const skew = (pts) => pts.map((p) => new THREE.Vector2(p.x + SKEW * p.y, p.y))

/** The Q ring (outer rounded square with a rounded counter) */
export function makeRingShape() {
  const outer = new THREE.Shape(skew(roundedRectPoints(-1.25, -1.15, 1.25, 1.25, 0.6)))
  const hole = new THREE.Path(skew(roundedRectPoints(-0.5, -0.52, 0.5, 0.7, 0.12)).reverse())
  outer.holes.push(hole)
  return outer
}

/** The Q leg that kicks out of the bottom-right */
export function makeTailShape() {
  return new THREE.Shape(
    skew([
      new THREE.Vector2(0.12, -0.6),
      new THREE.Vector2(0.66, -0.6),
      new THREE.Vector2(1.5, -1.74),
      new THREE.Vector2(0.92, -1.74),
    ])
  )
}

// The blade line — the same line splits the Q into two halves.
export const BLADE_A = new THREE.Vector2(-2.35, -1.62)
export const BLADE_B = new THREE.Vector2(2.25, 1.38)
export const BLADE_DIR = new THREE.Vector2().subVectors(BLADE_B, BLADE_A).normalize()
export const BLADE_NORMAL = new THREE.Vector2(-BLADE_DIR.y, BLADE_DIR.x)

/** A thin tapered sliver along the blade line */
export function makeBladeShape() {
  const len = BLADE_A.distanceTo(BLADE_B)
  const steps = 40
  const top = []
  const bot = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // asymmetric lens: fattest at 38%, needle point at both ends
    const w = 0.075 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 1.4)
    const along = BLADE_A.clone().addScaledVector(BLADE_DIR, t * len)
    top.push(along.clone().addScaledVector(BLADE_NORMAL, w))
    bot.push(along.clone().addScaledVector(BLADE_NORMAL, -w * 0.55))
  }
  return new THREE.Shape([...top, ...bot.reverse()])
}

/** Film strip texture: sprockets + frames with timecodes. Colours default to the brand red. */
export function makeFilmTexture({ hot = '#ed1c24', deep = '#3a0b0d', mid = '#b3141b', deep2 = '#1a0507' } = {}) {
  const W = 2048
  const H = 160
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#0b0b0e'
  g.fillRect(0, 0, W, H)
  // sprocket holes
  g.fillStyle = '#d9d9e0'
  for (let x = 6; x < W; x += 24) {
    g.globalAlpha = 0.55
    g.fillRect(x, 10, 12, 14)
    g.fillRect(x, H - 24, 12, 14)
  }
  g.globalAlpha = 1
  const labels = ['VLOG', 'REEL', 'BGMI', 'WEDDING', 'TRAVEL', 'SHORT', 'FOOD', 'CINEMATIC']
  const hues = [
    [deep, hot],
    ['#101018', '#6b6b78'],
    [deep2, mid],
    ['#14141a', '#e6e6ea'],
    ['#0d0d12', hot],
    ['#202028', '#9a9aa8'],
  ]
  const fw = 200
  for (let i = 0; i < W / fw; i++) {
    const x = i * fw + 8
    const [a, b] = hues[i % hues.length]
    const grd = g.createLinearGradient(x, 32, x + fw - 16, H - 32)
    grd.addColorStop(0, a)
    grd.addColorStop(1, b)
    g.fillStyle = grd
    g.fillRect(x, 32, fw - 16, H - 64)
    g.fillStyle = 'rgba(255,255,255,0.92)'
    g.font = 'italic 800 26px Saira, sans-serif'
    g.fillText(labels[i % labels.length], x + 12, 72)
    g.font = '14px "Space Mono", monospace'
    g.fillStyle = 'rgba(255,255,255,0.6)'
    const s = (i * 7) % 60
    g.fillText(`00:0${i % 10}:${String(s).padStart(2, '0')}:12`, x + 12, H - 44)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Soft radial glow for the red halo behind the Q */
export function makeGlowTexture() {
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grd.addColorStop(0, 'rgba(255,40,40,0.9)')
  grd.addColorStop(0.35, 'rgba(237,28,36,0.35)')
  grd.addColorStop(1, 'rgba(237,28,36,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
