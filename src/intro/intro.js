// QuiCut intro: a code-drawn version of the logo reel, used by the website and the app.
// drawIntro(ctx, t, W, H) is a pure function of time, so the same code plays live in the
// browser and renders frame-by-frame into the MP4 versions of the intro.
//
// Beats (seconds)
//   0.00  SHOOT IT. / SEND IT. / DONE.  quick editor-style cuts, viewfinder overlay
//   0.90  DONE. is sliced, the Q flies in as blade-cut shards and locks with a flash
//   1.75  the blade slashes through the Q, sparks fly, the halves shear and snap back
//   2.05  UICUT slices in letter by letter while the logo slides to centre
//   2.90  light sweep, anamorphic flare, red glow; tagline types in
//   4.30  hold with a slow push-in, then hand off to the page
import { LETTERS } from './glyphs.js'

export const INTRO_DURATION = 5.4
export const INTRO_HANDOFF = 4.75 // when the page should start fading the intro out

const Q_D =
  'M0.37 1.15L0.47 1.14L0.57 1.12L0.66 1.08L0.75 1.04L0.84 0.97L0.92 0.9L0.99 0.82L1.04 0.74L1.09 0.64L1.12 0.55L1.41 -0.65L1.42 -0.74L1.42 -0.84L1.41 -0.92L1.38 -1L1.33 -1.07L1.28 -1.14L1.21 -1.18L1.13 -1.22L1.04 -1.24L0.95 -1.25L-0.35 -1.25L-0.45 -1.24L-0.54 -1.22L-0.64 -1.18L-0.73 -1.14L-0.82 -1.07L-0.89 -1L-0.96 -0.92L-1.02 -0.84L-1.06 -0.74L-1.09 -0.65L-1.38 0.55L-1.4 0.64L-1.4 0.74L-1.38 0.82L-1.35 0.9L-1.31 0.97L-1.25 1.04L-1.18 1.08L-1.1 1.12L-1.02 1.14L-0.93 1.15ZM-0.5 0.52L-0.52 0.52L-0.54 0.51L-0.56 0.51L-0.57 0.5L-0.58 0.48L-0.59 0.47L-0.6 0.45L-0.6 0.44L-0.6 0.42L-0.6 0.4L-0.36 -0.58L-0.35 -0.6L-0.35 -0.62L-0.33 -0.63L-0.32 -0.65L-0.31 -0.66L-0.29 -0.68L-0.27 -0.69L-0.25 -0.69L-0.23 -0.7L-0.21 -0.7L0.55 -0.7L0.57 -0.7L0.58 -0.69L0.6 -0.69L0.61 -0.68L0.62 -0.66L0.63 -0.65L0.64 -0.63L0.64 -0.62L0.64 -0.6L0.64 -0.58L0.4 0.4L0.4 0.42L0.39 0.44L0.38 0.45L0.36 0.47L0.35 0.48L0.33 0.5L0.31 0.51L0.29 0.51L0.27 0.52L0.26 0.52Z'
const TAIL_D = 'M-0.02 0.6L0.52 0.6L1.08 1.74L0.5 1.74Z'
const BLADE_D =
  'M-2.35 1.62L-1.91 1.29L-1.46 0.97L-1.01 0.66L-0.55 0.36L-0.09 0.06L0.38 -0.23L0.85 -0.51L1.32 -0.8L1.78 -1.09L2.25 -1.38L1.79 -1.08L1.34 -0.77L0.88 -0.46L0.43 -0.15L-0.03 0.15L-0.49 0.45L-0.95 0.75L-1.41 1.05L-1.88 1.34L-2.35 1.62Z'

// blade direction (unit) and its normal, in logo units
const B0 = [-2.35, 1.62]
const B1 = [2.25, -1.38]
const BL = Math.hypot(B1[0] - B0[0], B1[1] - B0[1])
const DIR = [(B1[0] - B0[0]) / BL, (B1[1] - B0[1]) / BL]
const NRM = [-DIR[1], DIR[0]]

const LOGO_CX = 2.68 // centre of the full lockup (Q + UICUT)
const LOGO_CY = 0.25
const Q_CX = 0.0

const RED = '#e8281e'
const MONO = "'Space Mono', ui-monospace, Menlo, monospace"
const DISPLAY = "Saira, 'Arial Narrow', 'Arial Black', sans-serif"

// ---------- helpers ----------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const seg = (t, a, b) => clamp01((t - a) / (b - a))
const lerp = (a, b, k) => a + (b - a) * k
const outCubic = (k) => 1 - (1 - k) ** 3
const outExpo = (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k))
const inOutCubic = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2)
const bell = (t, a, peak, b) => (t <= a || t >= b ? 0 : t < peak ? (t - a) / (peak - a) : 1 - (t - peak) / (b - peak))

function rng(seed) {
  let s = seed % 2147483647
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ---------- precomputed, deterministic data ----------
const R = rng(20261001)
const DUST = Array.from({ length: 70 }, () => ({
  x: R(),
  y: R(),
  r: 0.4 + R() * 2.2,
  z: 0.3 + R() * 0.7,
  vx: (R() - 0.3) * 0.02,
  vy: -0.01 - R() * 0.025,
  a: 0.15 + R() * 0.5,
  tw: R() * 6.28,
}))
const SPARKS = Array.from({ length: 90 }, () => ({
  at: R(), // where along the blade it is born (0..1)
  ang: -Math.PI / 2 + (R() - 0.5) * 2.6,
  sp: 1.2 + R() * 3.4,
  life: 0.35 + R() * 0.75,
  sz: 0.012 + R() * 0.03,
  hot: R(),
}))
const SHARDS = 7 // bands cut parallel to the blade
const SHARD_FROM = Array.from({ length: SHARDS }, (_, i) => ({
  side: i % 2 ? 1 : -1,
  dist: 5 + R() * 4,
  lift: (R() - 0.5) * 1.6,
  rot: (R() - 0.5) * 0.7,
  delay: i * 0.045 + R() * 0.03,
}))

const WORDS = [
  { txt: 'SHOOT IT.', a: 0.0, b: 0.3 },
  { txt: 'SEND IT.', a: 0.3, b: 0.6 },
  { txt: 'DONE.', a: 0.6, b: 0.98, red: true },
]
const TAGLINE = 'EDITS IN 24 HOURS  ·  TELUGU · HINDI · ENGLISH'

let P // Path2D cache (created lazily so the module can load anywhere)
function paths() {
  if (P) return P
  const letters = LETTERS.map((l) => ({ ...l, p: new Path2D(l.d) }))
  const all = new Path2D()
  letters.forEach((l) => all.addPath(l.p))
  P = { q: new Path2D(Q_D), tail: new Path2D(TAIL_D), blade: new Path2D(BLADE_D), letters, allLetters: all }
  return P
}

const sprites = {}
function glowSprite(color) {
  if (sprites[color]) return sprites[color]
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(128, 128) : document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  r.addColorStop(0, color)
  r.addColorStop(0.35, color.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * 0.35) + ')'))
  r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return (sprites[color] = c)
}

// ---------- drawing pieces ----------
function fillQ(ctx, P, alpha = 1) {
  const g = ctx.createLinearGradient(0, -1.3, 0, 1.8)
  g.addColorStop(0, '#ff3b3f')
  g.addColorStop(0.55, '#e3141c')
  g.addColorStop(1, '#a8070e')
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fill(P.q, 'evenodd')
  ctx.fill(P.tail)
  ctx.globalAlpha = 1
}

function drawBlade(ctx, P, progress, alpha = 1) {
  if (progress <= 0) return
  ctx.save()
  // reveal from the bottom-left end along the blade
  const len = BL * progress
  ctx.beginPath()
  const ax = B0[0] - NRM[0] * 2
  const ay = B0[1] - NRM[1] * 2
  ctx.moveTo(ax - DIR[0] * 0.2, ay - DIR[1] * 0.2)
  ctx.lineTo(ax + DIR[0] * len, ay + DIR[1] * len)
  ctx.lineTo(ax + DIR[0] * len + NRM[0] * 4, ay + DIR[1] * len + NRM[1] * 4)
  ctx.lineTo(ax - DIR[0] * 0.2 + NRM[0] * 4, ay - DIR[1] * 0.2 + NRM[1] * 4)
  ctx.closePath()
  ctx.clip()
  ctx.globalAlpha = alpha
  ctx.save()
  ctx.translate(0, 0.06)
  ctx.fillStyle = '#040406'
  ctx.fill(P.blade)
  ctx.restore()
  const g = ctx.createLinearGradient(B0[0], B0[1], B1[0], B1[1])
  g.addColorStop(0, 'rgba(255,255,255,0.25)')
  g.addColorStop(0.5, '#ffffff')
  g.addColorStop(1, '#d9d9e0')
  ctx.fillStyle = g
  ctx.fill(P.blade)
  ctx.restore()
}

function silver(ctx) {
  const g = ctx.createLinearGradient(0, -0.45, 0, 0.9)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.55, '#e4e4ea')
  g.addColorStop(1, '#a9a9b6')
  return g
}

function clipBand(ctx, k0, k1) {
  // band between two lines parallel to the blade, at normal offsets k0..k1 from the blade line
  const far = 12
  const p = (k, s) => [B0[0] + NRM[0] * k + DIR[0] * s, B0[1] + NRM[1] * k + DIR[1] * s]
  const a = p(k0, -far)
  const b = p(k0, far * 2)
  const c = p(k1, far * 2)
  const d = p(k1, -far)
  ctx.beginPath()
  ctx.moveTo(a[0], a[1])
  ctx.lineTo(b[0], b[1])
  ctx.lineTo(c[0], c[1])
  ctx.lineTo(d[0], d[1])
  ctx.closePath()
  ctx.clip()
}

function spacedText(ctx, text, x, y, spacing, align = 'center') {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  w -= spacing
  let cx = align === 'center' ? x - w / 2 : x
  for (const ch of text) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
  return w
}

// ---------- main ----------
export function drawIntro(ctx, t, W, H, opts = {}) {
  const P = paths()
  const portrait = H > W * 1.1
  const S = Math.min((W * (portrait ? 0.8 : 0.56)) / 10.2, (H * 0.3) / 3.1)
  const minSide = Math.min(W, H)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  const T_IMPACT = 1.62
  const shake = t > T_IMPACT && t < T_IMPACT + 0.35 ? (1 - (t - T_IMPACT) / 0.35) ** 2 * minSide * 0.012 : 0
  const sx = shake * Math.sin(t * 91)
  const sy = shake * Math.cos(t * 77)

  // background: a cool stage that warms up once the Q lands
  const stage = seg(t, 0.9, 2.2)
  if (stage > 0) {
    const g = ctx.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, Math.max(W, H) * 0.75)
    g.addColorStop(0, `rgba(30,40,52,${0.85 * stage})`)
    g.addColorStop(0.45, `rgba(14,19,26,${0.9 * stage})`)
    g.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // floating dust / bokeh
  const dustA = Math.max(0.25, stage)
  const dot = glowSprite('rgba(200,215,235,0.9)')
  for (const d of DUST) {
    const x = (((d.x + d.vx * t) % 1) + 1) % 1
    const y = (((d.y + d.vy * t) % 1) + 1) % 1
    const tw = 0.6 + 0.4 * Math.sin(t * 2 + d.tw)
    const r = d.r * d.z * minSide * 0.006
    ctx.globalAlpha = d.a * tw * dustA * 0.6
    ctx.drawImage(dot, x * W - r * 2, y * H - r * 2, r * 4, r * 4)
  }
  ctx.globalAlpha = 1

  // ---------- 1. quick cuts: SHOOT IT. / SEND IT. / DONE. ----------
  if (t < 1.25) {
    const fs = Math.min(W * (portrait ? 0.17 : 0.11), H * 0.2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const w of WORDS) {
      if (t < w.a || t >= (w.red ? 1.25 : w.b)) continue
      const k = seg(t, w.a, w.b)
      const sc = 1.12 - 0.12 * outExpo(k)
      ctx.save()
      ctx.translate(W / 2 + sx, H / 2 + sy)
      ctx.scale(sc, sc)
      ctx.transform(1, 0, -0.08, 1, 0, 0)
      ctx.font = `italic 800 ${fs}px ${DISPLAY}`
      if (w.red && t > 0.9) {
        // DONE. gets sliced along the blade angle, halves fly apart
        const s = outCubic(seg(t, 0.9, 1.25))
        const fade = 1 - seg(t, 1.0, 1.25)
        const ang = Math.atan2(DIR[1], DIR[0])
        for (const side of [-1, 1]) {
          ctx.save()
          ctx.rotate(ang)
          // move the half first so its clip edge travels with it
          ctx.translate(side * s * fs * 0.25, side * s * fs * 0.7)
          ctx.beginPath()
          ctx.rect(-W, side < 0 ? -H : 0, W * 2, H)
          ctx.clip()
          ctx.rotate(-ang)
          ctx.globalAlpha = fade
          ctx.fillStyle = RED
          ctx.fillText(w.txt, 0, 0)
          ctx.restore()
        }
        // the cut line itself
        ctx.save()
        ctx.rotate(ang)
        ctx.globalAlpha = bell(t, 0.88, 0.94, 1.1)
        ctx.fillStyle = '#fff'
        const len = W * 1.4 * outExpo(seg(t, 0.88, 0.96))
        ctx.fillRect(-W * 0.7, -1.5, len, 3)
        ctx.restore()
      } else {
        // RGB split on each cut
        const split = (1 - outExpo(seg(t, w.a, w.a + 0.18))) * fs * 0.06
        if (split > 0.3) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.fillStyle = 'rgba(255,40,40,0.8)'
          ctx.fillText(w.txt, -split, 0)
          ctx.fillStyle = 'rgba(0,229,255,0.7)'
          ctx.fillText(w.txt, split, 0)
          ctx.globalCompositeOperation = 'source-over'
        }
        ctx.fillStyle = w.red ? RED : '#fff'
        ctx.fillText(w.txt, 0, 0)
      }
      ctx.restore()
      // white flash frame on each cut
      const fl = 1 - seg(t, w.a, w.a + 0.07)
      if (fl > 0 && w.a > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.18 * fl})`
        ctx.fillRect(0, 0, W, H)
      }
    }
  }

  // ---------- logo group transform ----------
  const slide = inOutCubic(seg(t, 2.0, 2.75))
  const cx = lerp(Q_CX, LOGO_CX, slide)
  const push = 1 + 0.045 * seg(t, 2.8, INTRO_DURATION) + 0.5 * seg(t, INTRO_DURATION - 0.25, INTRO_DURATION) ** 2
  const scale = S * push
  const toScreen = () => {
    ctx.setTransform(scale, 0, 0, scale, W / 2 - cx * scale + sx, H / 2 - LOGO_CY * scale + sy - (portrait ? H * 0.02 : 0))
  }

  // glow behind the Q
  const glow = Math.max(bell(t, T_IMPACT - 0.05, T_IMPACT + 0.1, T_IMPACT + 1.0) * 0.9, seg(t, 1.9, 2.6) * 0.32 + bell(t, 2.9, 3.25, 4.0) * 0.35)
  if (glow > 0 && t > 1) {
    toScreen()
    const gs = glowSprite('rgba(232,40,30,0.9)')
    ctx.globalAlpha = glow
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(gs, -3.4, -2.9, 6.8, 6.8)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  // ---------- 2. Q shards assemble ----------
  if (t >= 0.95) {
    toScreen()
    const kMin = -1.75
    const kMax = 2.05
    const bandW = (kMax - kMin) / SHARDS
    const split = bell(t, 1.85, 1.98, 2.3) * 0.16 // shear along the cut after the slash
    for (let i = 0; i < SHARDS; i++) {
      const f = SHARD_FROM[i]
      const k = outExpo(seg(t, 0.98 + f.delay, T_IMPACT))
      if (k <= 0) continue
      const off = (1 - k) * f.dist * f.side
      const lift = (1 - k) * f.lift
      const rot = (1 - k) * f.rot
      const sc = 1 + (1 - k) * 0.5
      const k0 = kMin + i * bandW
      const k1 = k0 + bandW + 0.01
      const mid = (k0 + k1) / 2
      const shear = mid > 0 ? split : -split
      // motion trail while flying
      const ghosts = k < 0.98 ? 3 : 0
      for (let gI = ghosts; gI >= 0; gI--) {
        const gk = gI === 0 ? 1 : 1 - gI * 0.08
        ctx.save()
        clipBand(ctx, k0, k1)
        ctx.translate(DIR[0] * (off * gk + shear) + NRM[0] * lift, DIR[1] * (off * gk + shear) + NRM[1] * lift)
        ctx.rotate(rot * gk)
        ctx.scale(sc, sc)
        fillQ(ctx, P, gI === 0 ? Math.min(1, k * 1.6) : 0.12 * (1 - gI / 4))
        ctx.restore()
      }
    }
    // blade (shadow cut + steel)
    const bladeK = outExpo(seg(t, 1.74, 2.02))
    drawBlade(ctx, P, bladeK)
    // hot head of the slash
    if (t > 1.72 && t < 2.15) {
      const hk = outExpo(seg(t, 1.74, 2.02))
      const hx = B0[0] + DIR[0] * BL * hk
      const hy = B0[1] + DIR[1] * BL * hk
      const a = 1 - seg(t, 1.98, 2.15)
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = a
      ctx.drawImage(glowSprite('rgba(255,170,90,1)'), hx - 0.9, hy - 0.9, 1.8, 1.8)
      ctx.drawImage(glowSprite('rgba(255,255,255,1)'), hx - 0.35, hy - 0.35, 0.7, 0.7)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
    // sparks
    if (t > 1.74 && t < 3.2) {
      ctx.globalCompositeOperation = 'lighter'
      for (const s of SPARKS) {
        const born = 1.74 + s.at * 0.28
        const age = t - born
        if (age < 0 || age > s.life) continue
        const life = age / s.life
        const bx = B0[0] + DIR[0] * BL * s.at
        const by = B0[1] + DIR[1] * BL * s.at
        const x = bx + Math.cos(s.ang) * s.sp * age
        const y = by + Math.sin(s.ang) * s.sp * age + 2.2 * age * age
        const vx = Math.cos(s.ang) * s.sp
        const vy = Math.sin(s.ang) * s.sp + 4.4 * age
        const len = 0.05
        ctx.strokeStyle = s.hot > 0.6 ? `rgba(255,240,200,${1 - life})` : `rgba(255,${120 + s.hot * 100 | 0},40,${1 - life})`
        ctx.lineWidth = s.sz * (1 - life * 0.6)
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x - vx * len, y - vy * len)
        ctx.stroke()
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  // impact flash + shockwave
  if (t > T_IMPACT - 0.02 && t < T_IMPACT + 0.6) {
    const k = seg(t, T_IMPACT, T_IMPACT + 0.6)
    toScreen()
    ctx.globalAlpha = (1 - k) ** 2 * 0.55
    ctx.strokeStyle = '#ffb4a8'
    ctx.lineWidth = 0.05 * (1 - k)
    ctx.beginPath()
    ctx.arc(Q_CX, 0.2, 0.5 + outCubic(k) * 4.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const fl = (1 - seg(t, T_IMPACT, T_IMPACT + 0.16)) * (t >= T_IMPACT ? 1 : 0)
    if (fl > 0) {
      // warm bloom from the Q rather than a flat white frame
      const qx = W / 2 - cx * scale + Q_CX * scale
      const qy = H / 2 - LOGO_CY * scale + 0.2 * scale
      const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, Math.max(W, H) * 0.6)
      g.addColorStop(0, `rgba(255,230,220,${0.75 * fl})`)
      g.addColorStop(0.35, `rgba(255,120,90,${0.25 * fl})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  // ---------- 3. UICUT slices in ----------
  if (t > 2.0) {
    toScreen()
    const sil = silver(ctx)
    P.letters.forEach((l, i) => {
      const a = 2.08 + i * 0.075
      const k = outExpo(seg(t, a, a + 0.5))
      if (k <= 0) return
      const [x0, y0, x1, y1] = l.box
      const off = (1 - k) * 1.4
      ctx.save()
      // wipe from the left edge of the letter, like a cut being trimmed open
      ctx.beginPath()
      ctx.rect(x0 - 0.3, y0 - 0.5, (x1 - x0 + 0.6) * outCubic(seg(t, a, a + 0.32)), y1 - y0 + 1)
      ctx.clip()
      ctx.translate(off, 0)
      ctx.transform(1, 0, -(1 - k) * 0.5, 1, 0, 0)
      const split = (1 - k) * 0.22
      if (split > 0.01) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = 'rgba(255,40,40,0.75)'
        ctx.save()
        ctx.translate(-split, 0)
        ctx.fill(l.p)
        ctx.restore()
        ctx.fillStyle = 'rgba(0,229,255,0.6)'
        ctx.save()
        ctx.translate(split, 0)
        ctx.fill(l.p)
        ctx.restore()
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.globalAlpha = Math.min(1, k * 1.4)
      ctx.fillStyle = sil
      ctx.fill(l.p)
      ctx.restore()
    })
  }

  // ---------- 4. light sweep + anamorphic flare ----------
  const sweep = seg(t, 2.95, 3.65)
  if (sweep > 0 && sweep < 1) {
    toScreen()
    const bx = lerp(-2.6, 8.4, inOutCubic(sweep))
    const band = (clip) => {
      ctx.save()
      clip()
      ctx.transform(1, 0, -0.45, 1, 0, 0)
      const g = ctx.createLinearGradient(bx - 0.7, 0, bx + 0.7, 0)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.85)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(bx - 3, -3, 6, 7)
      ctx.restore()
    }
    band(() => ctx.clip(P.allLetters))
    ctx.globalAlpha = 0.45
    band(() => ctx.clip(P.q, 'evenodd'))
    ctx.globalAlpha = 1
    // flare across the screen at the sweep point
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const fx = W / 2 - cx * scale + bx * scale + sx
    const fy = H / 2 - LOGO_CY * scale + sy + 0.2 * scale - (portrait ? H * 0.02 : 0)
    const fa = Math.sin(sweep * Math.PI)
    ctx.globalCompositeOperation = 'lighter'
    const lg = ctx.createLinearGradient(fx - W * 0.6, 0, fx + W * 0.6, 0)
    lg.addColorStop(0, 'rgba(120,180,255,0)')
    lg.addColorStop(0.5, `rgba(200,230,255,${0.55 * fa})`)
    lg.addColorStop(1, 'rgba(120,180,255,0)')
    ctx.fillStyle = lg
    ctx.fillRect(fx - W * 0.6, fy - minSide * 0.0025, W * 1.2, minSide * 0.005)
    ctx.globalAlpha = fa * 0.8
    const fs = minSide * 0.12
    ctx.drawImage(glowSprite('rgba(220,235,255,0.9)'), fx - fs / 2, fy - fs / 2, fs, fs)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  // ---------- 5. tagline types in, with a playhead bar ----------
  if (t > 3.05) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const typed = Math.floor(TAGLINE.length * seg(t, 3.1, 3.95))
    const text = TAGLINE.slice(0, typed)
    let fs = Math.max(10, S * 0.3)
    ctx.font = `700 ${fs}px ${MONO}`
    const spacing = fs * 0.18
    let full = 0
    for (const ch of TAGLINE) full += ctx.measureText(ch).width + spacing
    if (full > W * 0.9) {
      fs *= (W * 0.9) / full
      ctx.font = `700 ${fs}px ${MONO}`
      full = (W * 0.9)
    }
    const ty = H / 2 + (2.25 - LOGO_CY) * scale + sy - (portrait ? H * 0.02 : 0)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(190,196,214,0.92)'
    const x0 = W / 2 - full / 2 + sx
    const w = spacedText(ctx, text, x0, ty, fs * 0.18, 'left')
    if (t < 4.3 && Math.floor(t * 4) % 2 === 0) {
      ctx.fillStyle = RED
      ctx.fillRect(x0 + w + fs * 0.2, ty - fs * 0.55, fs * 0.55, fs * 1.1)
    }
    // timeline bar under the tagline: a red playhead running to the end
    const bk = outCubic(seg(t, 3.1, 4.2))
    const by = ty + fs * 1.6
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(x0, by, full, Math.max(1, fs * 0.08))
    ctx.fillStyle = RED
    ctx.fillRect(x0, by, full * bk, Math.max(1, fs * 0.08))
    ctx.beginPath()
    ctx.moveTo(x0 + full * bk - fs * 0.3, by - fs * 0.35)
    ctx.lineTo(x0 + full * bk + fs * 0.3, by - fs * 0.35)
    ctx.lineTo(x0 + full * bk, by + fs * 0.1)
    ctx.closePath()
    ctx.fill()
  }

  // ---------- viewfinder overlay (editor feel), fades out at the end ----------
  const ov = 1 - seg(t, 4.1, 4.6)
  if (ov > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const m = minSide * 0.05
    const L = minSide * 0.05
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * ov})`
    ctx.lineWidth = Math.max(1, minSide * 0.002)
    ctx.beginPath()
    for (const [x, y, dx, dy] of [
      [m, m, 1, 1],
      [W - m, m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1],
    ]) {
      ctx.moveTo(x, y + dy * L)
      ctx.lineTo(x, y)
      ctx.lineTo(x + dx * L, y)
    }
    ctx.stroke()
    const fs = Math.max(9, minSide * 0.022)
    ctx.font = `400 ${fs}px ${MONO}`
    ctx.textBaseline = 'middle'
    const frame = Math.floor(t * 24)
    const tc = `00:00:${String(Math.floor(frame / 24)).padStart(2, '0')}:${String(frame % 24).padStart(2, '0')}`
    ctx.fillStyle = `rgba(255,255,255,${0.6 * ov})`
    ctx.textAlign = 'left'
    ctx.fillText(tc, m + L * 0.4, H - m - L * 0.5)
    ctx.textAlign = 'right'
    ctx.fillText('QUICUT · 4K · 24 FPS', W - m - L * 0.4, m + L * 0.5)
    // REC dot
    if (Math.floor(t * 2.5) % 2 === 0) {
      ctx.fillStyle = `rgba(232,40,30,${ov})`
      ctx.beginPath()
      ctx.arc(m + L * 0.55, m + L * 0.5, fs * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = `rgba(255,255,255,${0.6 * ov})`
    ctx.fillText('REC', m + L * 0.55 + fs * 0.7, m + L * 0.5)
  }

  // vignette + film grain feel
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const vg = ctx.createRadialGradient(W / 2, H / 2, minSide * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.65)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)

  // optional fade to black at the very end (for the exported video files)
  if (opts.fadeOut) {
    const f = seg(t, INTRO_DURATION - 0.35, INTRO_DURATION)
    if (f > 0) {
      ctx.fillStyle = `rgba(0,0,0,${f})`
      ctx.fillRect(0, 0, W, H)
    }
  }
}

/** Play the intro on a canvas. Calls onHandoff once the page should take over. Returns stop(). */
export function playIntro(canvas, { onHandoff } = {}) {
  const ctx = canvas.getContext('2d')
  let raf = 0
  let start = null
  let handed = false
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const size = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
  }
  const frame = (now) => {
    if (start == null) start = now
    const t = Math.min((now - start) / 1000, INTRO_DURATION)
    size()
    drawIntro(ctx, t, canvas.width, canvas.height)
    if (!handed && t >= INTRO_HANDOFF) {
      handed = true
      onHandoff && onHandoff()
    }
    if (t < INTRO_DURATION) raf = requestAnimationFrame(frame)
  }
  // give web fonts a brief moment so the first words render in Saira
  const fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load(`italic 800 40px Saira`), new Promise((r) => setTimeout(r, 450))]) : Promise.resolve()
  let stopped = false
  fontsReady.then(() => {
    if (!stopped) raf = requestAnimationFrame(frame)
  })
  return () => {
    stopped = true
    cancelAnimationFrame(raf)
  }
}
