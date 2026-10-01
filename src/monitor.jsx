// QuiCut Monitor: Sentry-style error tracking + real-user performance (APM) on our own Supabase.
// Captures crashes, unhandled promise errors, console.error, failed or slow API calls, React render
// crashes (ErrorBoundary) and Core Web Vitals (LCP, INP, CLS, FCP, TTFB). Events are batched and
// written to public.monitor_events (insert-only for browsers; only admins can read them).
import { Component } from 'react'
import { SUPA_URL, SUPA_KEY } from './app/services/supa.js'

export const RELEASE = '2026.10.01'
const ENDPOINT = `${SUPA_URL}/rest/v1/monitor_events`
const MAX_EVENTS = 60 // per page session, so one broken loop can't flood the table
const MAX_REPEAT = 3 // same issue per session
const SLOW_MS = 6000

let page = 'app'
let started = false
let sent = 0
const seen = new Map()
let queue = []
let timer = null
const sid = (() => {
  try {
    const k = 'qc-mon-sid'
    let v = sessionStorage.getItem(k)
    if (!v) sessionStorage.setItem(k, (v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36)))
    return v
  } catch {
    return Math.random().toString(36).slice(2, 12)
  }
})()

const clip = (s, n) => (s == null ? null : String(s).slice(0, n))
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(16)
}
const topFrame = (stack) =>
  String(stack || '')
    .split('\n')
    .find((l) => /:\d+:\d+/.test(l))
    ?.replace(/\?[^:)]*/, '')
    .replace(/https?:\/\/[^/]+/, '')
    .trim() || ''
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i, /AbortError/i, /Load failed$/i]

function enabled() {
  if (typeof window === 'undefined') return false
  if (window.QUICUT_MONITOR === false) return false
  if (window.QUICUT_MONITOR === true) return true
  return !['localhost', '127.0.0.1'].includes(location.hostname)
}

/** Report one event. kind: error | unhandled | http | vital | console | event */
export function capture(kind, message, { level = 'error', stack, value, meta } = {}) {
  try {
    const msg = clip(message, 1000) || '(no message)'
    if (kind !== 'vital' && IGNORE.some((re) => re.test(msg) || re.test(stack || ''))) return
    const fp = hash(`${kind}|${msg.replace(/\d+/g, '#')}|${topFrame(stack)}`)
    const n = (seen.get(fp) || 0) + 1
    seen.set(fp, n)
    if (n > MAX_REPEAT || sent >= MAX_EVENTS) return
    sent++
    queue.push({
      kind,
      level,
      message: msg,
      stack: clip(stack, 6000),
      page,
      url: clip(location.pathname + location.hash.replace(/access_token=[^&]*/g, 'access_token=…'), 500),
      release: RELEASE,
      session_id: sid,
      fingerprint: fp,
      ua: clip(navigator.userAgent, 400),
      value: typeof value === 'number' && Number.isFinite(value) ? value : null,
      meta: meta || null,
    })
    if (!enabled()) {
      if (window.QUICUT_MONITOR_DEBUG) console.info('[monitor]', queue.at(-1))
      queue = []
      return
    }
    clearTimeout(timer)
    timer = setTimeout(flush, 2500)
  } catch {
    /* the monitor must never break the app */
  }
}

export function captureError(err, meta) {
  capture('error', err?.message || String(err), { stack: err?.stack, meta })
}

function flush(useBeacon) {
  if (!queue.length) return
  const body = JSON.stringify(queue)
  queue = []
  try {
    origFetch(ENDPOINT, {
      method: 'POST',
      keepalive: !!useBeacon || body.length < 60000,
      headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

let origFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : null

function wrapFetch() {
  window.fetch = async function monitoredFetch(input, init) {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (url.startsWith(ENDPOINT)) return origFetch(input, init)
    const t0 = performance.now()
    const method = (init?.method || input?.method || 'GET').toUpperCase()
    const short = clip(url.replace(/[?#].*$/, '').replace(/^https?:\/\//, ''), 200)
    try {
      const res = await origFetch(input, init)
      const ms = Math.round(performance.now() - t0)
      if (res.status >= 500 || res.status === 429) capture('http', `${method} ${short} → ${res.status}`, { level: res.status === 429 ? 'warn' : 'error', value: ms, meta: { status: res.status, ms } })
      else if (ms > SLOW_MS) capture('http', `Slow ${method} ${short}`, { level: 'warn', value: ms, meta: { status: res.status, ms } })
      return res
    } catch (err) {
      if (err?.name !== 'AbortError' && navigator.onLine !== false) capture('http', `${method} ${short} failed: ${err?.message || 'network error'}`, { level: 'warn', meta: { ms: Math.round(performance.now() - t0) } })
      throw err
    }
  }
}

// ---- Core Web Vitals (same thresholds as Google's web-vitals) ----
const RATE = { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] }
const rating = (name, v) => (v <= RATE[name][0] ? 'good' : v <= RATE[name][1] ? 'needs-improvement' : 'poor')

function observeVitals() {
  const v = {}
  const po = (type, cb, opts = {}) => {
    try {
      const o = new PerformanceObserver((l) => l.getEntries().forEach(cb))
      o.observe({ type, buffered: true, ...opts })
    } catch {
      /* unsupported (older Safari) */
    }
  }
  po('largest-contentful-paint', (e) => (v.LCP = e.startTime))
  po('paint', (e) => e.name === 'first-contentful-paint' && (v.FCP = e.startTime))
  let cls = 0
  let win = 0
  let first = 0
  let last = 0
  po('layout-shift', (e) => {
    if (e.hadRecentInput) return
    if (win && e.startTime - last < 1000 && e.startTime - first < 5000) win += e.value
    else {
      win = e.value
      first = e.startTime
    }
    last = e.startTime
    cls = Math.max(cls, win)
    v.CLS = cls
  })
  po('event', (e) => e.interactionId && (v.INP = Math.max(v.INP || 0, e.duration)), { durationThreshold: 40 })
  po('first-input', (e) => (v.INP = Math.max(v.INP || 0, e.duration)))
  try {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav) v.TTFB = Math.max(0, nav.responseStart - (nav.activationStart || 0))
  } catch {
    /* ignore */
  }
  let done = false
  const report = () => {
    if (done) return
    done = true
    const conn = navigator.connection?.effectiveType
    for (const [name, val] of Object.entries(v)) {
      if (val == null) continue
      const value = name === 'CLS' ? Math.round(val * 1000) / 1000 : Math.round(val)
      capture('vital', name, { level: 'info', value, meta: { rating: rating(name, value), conn, w: innerWidth } })
    }
    flush(true)
  }
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && report(), { capture: true })
  addEventListener('pagehide', report, { capture: true })
}

/** Start monitoring. Call once per page, before rendering. */
export function initMonitor(pageName) {
  if (started || typeof window === 'undefined') return
  started = true
  page = pageName
  addEventListener('error', (e) => {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      capture('error', `Failed to load ${e.target.tagName?.toLowerCase()} ${clip(e.target.src || e.target.href, 200)}`, { level: 'warn' })
      return
    }
    capture('error', e.message || e.error?.message, { stack: e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}` })
  }, true)
  addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    capture('unhandled', r?.message || String(r), { stack: r?.stack })
  })
  const ce = console.error
  console.error = (...args) => {
    ce.apply(console, args)
    const err = args.find((a) => a instanceof Error)
    capture('console', args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).join(' ').trim() || 'console.error', { stack: err?.stack })
  }
  wrapFetch()
  observeVitals()
  addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(true))
}

/** Catches render crashes so one broken screen doesn't blank the whole app. */
export class ErrorBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) {
    return { err }
  }
  componentDidCatch(err, info) {
    capture('error', `Render crash: ${err?.message || err}`, { stack: `${err?.stack || ''}\nComponent stack:${info?.componentStack || ''}`.slice(0, 6000) })
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="gate">
        <div className="gate-card">
          <h1>Something went wrong</h1>
          <p className="muted">We've logged the problem and the team can see it. Reload to continue; your data is safe.</p>
          <div className="gate-actions">
            <button className="btn btn-red" onClick={() => location.reload()}>
              Reload
            </button>
            <button className="btn btn-ghost" onClick={() => this.setState({ err: null })}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
