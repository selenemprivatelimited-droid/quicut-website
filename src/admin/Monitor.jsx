import { useEffect, useMemo, useState } from 'react'
import { rest } from '../app/services/supa.js'
import { RELEASE } from '../monitor.jsx'
import { Empty } from '../app/ui.jsx'
import { TrendChart, Kpi, ChartCard, DataTable, seriesTable, fmtNum, fmtPct, SERIES } from '../app/charts.jsx'

// Errors & speed: live view of public.monitor_events (crashes, failed API calls, Core Web Vitals).
const DAY = 864e5
const POLL_MS = 15000
const VITALS = [
  { name: 'LCP', label: 'Largest paint', unit: 'ms', good: 2500, poor: 4000 },
  { name: 'INP', label: 'Tap response', unit: 'ms', good: 200, poor: 500 },
  { name: 'CLS', label: 'Layout shift', unit: '', good: 0.1, poor: 0.25 },
  { name: 'FCP', label: 'First paint', unit: 'ms', good: 1800, poor: 3000 },
  { name: 'TTFB', label: 'Server response', unit: 'ms', good: 800, poor: 1800 },
]
const p75 = (arr) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.75) - 1)]
}
const fmtVital = (v, unit) => (v == null ? '—' : unit === 'ms' ? (v >= 1000 ? (v / 1000).toFixed(2) + 's' : Math.round(v) + 'ms') : v.toFixed(3))
const vClass = (v, x) => (v == null ? '' : v <= x.good ? 'vital-good' : v <= x.poor ? 'vital-mid' : 'vital-poor')
const ago = (t) => {
  const m = Math.round((Date.now() - new Date(t)) / 6e4)
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}
const isProblem = (e) => e.kind !== 'vital' && e.level !== 'info'

export default function Monitor({ live }) {
  const [events, setEvents] = useState(null)
  const [err, setErr] = useState('')
  const [updated, setUpdated] = useState(null)
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!live) return
    let stop = false
    const load = async () => {
      if (document.visibilityState === 'hidden') return
      try {
        const since = new Date(Date.now() - 7 * DAY).toISOString()
        const rows = await rest(`monitor_events?select=*&created_at=gte.${since}&order=created_at.desc&limit=3000`)
        if (!stop) {
          setEvents(rows || [])
          setUpdated(new Date())
          setErr('')
        }
      } catch (e) {
        if (!stop) setErr(e.message)
      }
    }
    load()
    const t = setInterval(load, POLL_MS)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [live])

  const m = useMemo(() => summarize(events || []), [events])

  if (!live)
    return (
      <Empty title="Sign in to see live errors">
        This is demo mode on localhost. On quicutapp.com/admin, signed-in admins see every crash, failed API call and page-speed reading from real
        visitors here, updating every 15 seconds.
      </Empty>
    )
  if (!events) return <p className="muted">{err || 'Loading live events…'}</p>

  const issues = m.issues.filter((i) => filter === 'all' || i.page === filter)
  const errSeries = [{ name: 'Errors', values: m.errDaily, color: 'var(--bad)' }]
  const sessSeries = [{ name: 'Sessions', values: m.sessDaily, color: SERIES[0] }]

  return (
    <div className="stack">
      <div className="notice-live">
        <span className="mon-live">Live · updates every 15s{updated ? ` · ${updated.toLocaleTimeString('en-IN')}` : ''}</span>
        <span className="muted small">
          Release {RELEASE} · last 7 days · {fmtNum(events.length)} events
        </span>
      </div>
      {err && <p className="bad small">{err}</p>}

      <div className="kpi-grid four">
        <Kpi label="Errors, last 24h" value={fmtNum(m.err24)} hint={`${fmtNum(m.err7)} in 7 days`} spark={m.errDaily} color="var(--bad)" />
        <Kpi label="Open issues" value={fmtNum(m.issues.length)} hint="unique problems" />
        <Kpi label="Crash-free sessions" value={fmtPct(m.crashFree)} hint={`${fmtNum(m.sessions)} sessions`} />
        <Kpi label="Users hit by errors" value={fmtNum(m.affected)} hint="sessions with an error" />
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {VITALS.map((x) => (
          <div className="kpi" key={x.name}>
            <div className="kpi-label">
              {x.label} · {x.name}
            </div>
            <div className={'kpi-value ' + vClass(m.vitals[x.name], x)}>{fmtVital(m.vitals[x.name], x.unit)}</div>
            <div className="kpi-foot">
              <span className="delta flat">
                p75 · {m.vitalCount[x.name] || 0} visits · good ≤ {fmtVital(x.good, x.unit)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="chart-row">
        <ChartCard title="Errors per day" sub="Crashes, unhandled errors and failed API calls" table={seriesTable(m.axis, errSeries)}>
          <TrendChart axis={m.axis} series={errSeries} type="bar" height={190} />
        </ChartCard>
        <ChartCard title="Sessions per day" sub="Visits that reported speed data" table={seriesTable(m.axis, sessSeries)}>
          <TrendChart axis={m.axis} series={sessSeries} type="bar" height={190} />
        </ChartCard>
      </div>

      <section className="chart-card">
        <header className="cc-head">
          <div>
            <h3>Issues</h3>
            <p className="muted small">Grouped by fingerprint, newest first. Tap one to see the stack trace.</p>
          </div>
          <div className="range">
            {['all', 'app', 'admin', 'site'].map((f) => (
              <button key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </header>
        {issues.length ? (
          <div className="list">
            {issues.slice(0, 50).map((i) => (
              <div key={i.fp} className="mon-issue" role="button" tabIndex={0} onClick={() => setOpen(open === i.fp ? null : i.fp)} onKeyDown={(e) => e.key === 'Enter' && setOpen(open === i.fp ? null : i.fp)}>
                <div className="mon-issue-main">
                  <div>
                    <span className={'mon-level ' + i.level}>{i.kind}</span> <span className="mon-issue-title">{i.message}</span>
                  </div>
                  <div className="row-meta">
                    {i.page} · {i.url} · last {ago(i.last)} · first {ago(i.first)} · {i.sessions} user{i.sessions === 1 ? '' : 's'}
                  </div>
                  {open === i.fp && (
                    <pre>
                      {(i.stack || 'No stack trace') + `\n\nBrowser: ${i.ua || 'unknown'}\nRelease: ${i.release || '—'}${i.meta ? '\nDetails: ' + JSON.stringify(i.meta) : ''}`}
                    </pre>
                  )}
                </div>
                <div className="mon-count">
                  {fmtNum(i.count)}
                  <div className="muted small">events</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="No issues">No crashes or failed calls in the last 7 days.</Empty>
        )}
      </section>

      <ChartCard title="Speed by page" sub="75th percentile of real visits (Core Web Vitals)">
        <DataTable
          columns={[
            { key: 'page', label: 'Page' },
            { key: 'visits', label: 'Visits', num: true },
            ...VITALS.map((x) => ({ key: x.name, label: x.name, num: true, format: (v) => <span className={vClass(v, x)}>{fmtVital(v, x.unit)}</span> })),
          ]}
          rows={m.byPage}
        />
      </ChartCard>
    </div>
  )
}

function summarize(events) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const axis = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today - i * DAY)
    axis.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), t: +d })
  }
  const idx = (t) => {
    const d = new Date(t)
    d.setHours(0, 0, 0, 0)
    return axis.findIndex((a) => a.t === +d)
  }
  const errDaily = axis.map(() => 0)
  const sessByDay = axis.map(() => new Set())
  const sessions = new Set()
  const bad = new Set()
  const groups = new Map()
  const vit = {}
  const pages = new Map()
  let err24 = 0
  let err7 = 0
  for (const e of events) {
    const i = idx(e.created_at)
    if (e.session_id) {
      sessions.add(e.session_id)
      if (i >= 0) sessByDay[i].add(e.session_id)
    }
    if (e.kind === 'vital') {
      ;(vit[e.message] ||= []).push(e.value)
      const p = pages.get(e.page) || { page: e.page, sessions: new Set(), v: {} }
      p.sessions.add(e.session_id)
      ;(p.v[e.message] ||= []).push(e.value)
      pages.set(e.page, p)
      continue
    }
    if (!isProblem(e)) continue
    if (e.level === 'error') {
      err7++
      if (Date.now() - new Date(e.created_at) < DAY) err24++
      if (i >= 0) errDaily[i]++
      if (e.session_id) bad.add(e.session_id)
    }
    const g = groups.get(e.fingerprint) || { fp: e.fingerprint, count: 0, sess: new Set(), first: e.created_at, last: e.created_at, ...e }
    g.count++
    g.sess.add(e.session_id)
    if (e.created_at < g.first) g.first = e.created_at
    if (e.created_at > g.last) g.last = e.created_at
    groups.set(e.fingerprint, g)
  }
  const vitals = {}
  const vitalCount = {}
  for (const x of VITALS) {
    vitals[x.name] = p75(vit[x.name] || [])
    vitalCount[x.name] = (vit[x.name] || []).length
  }
  return {
    axis,
    errDaily,
    sessDaily: sessByDay.map((s) => s.size),
    err24,
    err7,
    sessions: sessions.size,
    affected: bad.size,
    crashFree: sessions.size ? 1 - bad.size / sessions.size : null,
    issues: [...groups.values()].map((g) => ({ ...g, sessions: g.sess.size })).sort((a, b) => (a.last < b.last ? 1 : -1)),
    vitals,
    vitalCount,
    byPage: [...pages.values()].map((p) => ({ page: p.page, visits: p.sessions.size, ...Object.fromEntries(VITALS.map((x) => [x.name, p75(p.v[x.name] || [])])) })),
  }
}
