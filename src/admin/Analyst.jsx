import { useMemo, useRef, useState } from 'react'
import { analystTables } from '../app/services/metrics.js'
import { analyze, toCsv } from '../app/services/analyst.js'
import { Icon } from '../app/ui.jsx'
import { TrendChart, HBars, DataTable, fmtInr, fmtInrShort, fmtNum } from '../app/charts.jsx'

const STARTERS = [
  'What was QuiCut revenue per day in the last 30 days?',
  'Which editors earned the most this month?',
  'Which edit type brings the most revenue?',
  'How much cash came from Stripe vs Razorpay?',
  'Which creators spent the most credits?',
  'What is the average delivery time by edit type?',
]

const isMoney = (k) => /inr|revenue|amount|earn|cash|pay|gmv/i.test(k)
const fmtFor = (k) => (isMoney(k) ? fmtInr : (v) => (v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? fmtNum(v) : v.toLocaleString('en-IN', { maximumFractionDigits: 2 })) : String(v)))

function describe(q) {
  if (!q) return ''
  const ms = (q.metrics || []).map((m) => `${m.agg}(${m.column})`).join(', ')
  const by = q.group_by && q.group_by !== 'null' ? ` by ${q.group_by}${q.time_bucket && q.time_bucket !== 'null' ? ' / ' + q.time_bucket : ''}` : ''
  const f = (q.filters || []).map((x) => `${x.column} ${x.op} ${Array.isArray(x.value) ? x.value.join('|') : x.value}`).join(' · ')
  return `${q.table} · ${ms || 'count(*)'}${by}${f ? ' · where ' + f : ''}`
}

export default function Analyst({ s }) {
  const tables = useMemo(() => analystTables(s), [s])
  const [runs, setRuns] = useState([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef()

  const ask = async (question) => {
    const text = (question ?? q).trim()
    if (!text || busy) return
    setQ('')
    setBusy(true)
    const id = Date.now()
    setRuns((r) => [...r, { id, question: text, steps: [], out: null }])
    const onStep = (st) =>
      setRuns((r) =>
        r.map((x) => {
          if (x.id !== id) return x
          const steps = x.steps.some((y) => y.id === st.id) ? x.steps.map((y) => (y.id === st.id ? st : y)) : [...x.steps, st]
          return { ...x, steps }
        })
      )
    setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
    try {
      const out = await analyze(text, tables, onStep)
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, out } : x)))
    } catch (e) {
      setRuns((r) => r.map((x) => (x.id === id ? { ...x, error: e.message } : x)))
    }
    setBusy(false)
    setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
  }

  return (
    <div className="stack analyst">
      <section className="analyst-intro">
        <div className="analyst-badge">
          <Icon name="spark" size={22} />
        </div>
        <div>
          <h3>QuiCut Data Analyst</h3>
          <p className="muted small">
            Ask in plain English, Telugu or Hindi. The agent plans a query, runs it on QuiCut's data, charts the result and
            explains it. It never edits data.
          </p>
          <div className="chips-row">
            {Object.entries(tables).map(([name, rows]) => (
              <span key={name} className="ds-chip">
                <Icon name="list" size={14} /> {name} · {rows.length}
              </span>
            ))}
          </div>
        </div>
      </section>

      {runs.map((r) => (
        <Run key={r.id} run={r} onAsk={ask} />
      ))}
      {!runs.length && (
        <div className="starters">
          {STARTERS.map((x) => (
            <button key={x} className="starter" onClick={() => ask(x)}>
              <Icon name="chart" size={16} /> {x}
            </button>
          ))}
        </div>
      )}
      <div ref={end} />
      <form
        className="analyst-input"
        onSubmit={(e) => {
          e.preventDefault()
          ask()
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about revenue, editors, creators, payouts…" aria-label="Ask the data analyst" maxLength={400} />
        <button className="btn btn-ai" type="submit" disabled={busy || !q.trim()}>
          {busy ? 'Analysing…' : '✦ Analyse'}
        </button>
      </form>
    </div>
  )
}

function Run({ run, onAsk }) {
  const [tab, setTab] = useState('chart')
  const out = run.out
  return (
    <article className="run">
      <div className="run-q">
        <Icon name="user" size={16} /> {run.question}
      </div>
      <ol className="trace">
        {run.steps.map((st) => (
          <li key={st.id} className={'trace-' + st.state}>
            <span className="trace-dot" aria-hidden="true" />
            {st.label}
          </li>
        ))}
      </ol>
      {run.error && <p className="bad small">{run.error}</p>}
      {out && (
        <div className="run-out">
          <div className="run-head">
            <div>
              <h4>{out.plan.title || 'Result'}</h4>
              <code className="query">{describe(out.plan.query)}</code>
            </div>
            <div className="btn-row">
              <div className="range">
                {['chart', 'table'].map((t) => (
                  <button key={t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
                    {t === 'chart' ? 'Chart' : 'Table'}
                  </button>
                ))}
              </div>
              <button
                className="cc-toggle"
                onClick={() => {
                  const blob = new Blob([toCsv(out.result.rows)], { type: 'text/csv' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = 'quicut-analysis.csv'
                  a.click()
                }}
              >
                CSV
              </button>
            </div>
          </div>
          {tab === 'chart' ? <ResultChart plan={out.plan} result={out.result} /> : <ResultTable result={out.result} />}
          <p className="answer">{out.explain.answer}</p>
          {out.explain.highlights?.length > 0 && (
            <ul className="ai-check">
              {out.explain.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          )}
          <div className="chips-row">
            {(out.explain.followups || []).map((f) => (
              <button key={f} className="ai-chip" onClick={() => onAsk(f)}>
                {f}
              </button>
            ))}
          </div>
          {out.source === 'rules' && <p className="muted small">AI offline: answered with the built-in planner.</p>}
        </div>
      )}
    </article>
  )
}

function ResultTable({ result }) {
  const cols = Object.keys(result.rows[0] || {})
  return <DataTable columns={cols.map((c) => ({ key: c, label: c.replace(/_/g, ' '), num: typeof result.rows[0][c] === 'number', format: fmtFor(c) }))} rows={result.rows} max={100} />
}

function ResultChart({ plan, result }) {
  const rows = result.rows
  const m = result.metrics[0]
  if (!rows.length) return <p className="muted">No rows matched.</p>
  const by = result.groupBy
  const kind = plan.chart === 'number' || !by ? 'number' : by === 'date' || by === 'joined' ? 'line' : plan.chart === 'table' ? 'table' : 'bar'
  if (kind === 'number')
    return (
      <div className="big-result">
        {result.metrics.map((k) => (
          <div key={k}>
            <div className="kpi-label">{k.replace(/_/g, ' ')}</div>
            <div className="kpi-value">{fmtFor(k)(rows[0][k])}</div>
          </div>
        ))}
      </div>
    )
  if (kind === 'table') return <ResultTable result={result} />
  if (kind === 'line') {
    const sorted = [...rows].sort((a, b) => (a[by] > b[by] ? 1 : -1))
    const axis = sorted.map((r) => ({ key: String(r[by]), label: shortDate(r[by]) }))
    return (
      <div>
        <TrendChart axis={axis} series={[{ name: m.replace(/_/g, ' '), values: sorted.map((r) => r[m]) }]} type={sorted.length > 20 ? 'area' : 'bar'} format={fmtFor(m)} tickFormat={isMoney(m) ? fmtInrShort : fmtNum} height={230} />
        {result.metrics.length > 1 && <p className="muted small">Chart shows {m.replace(/_/g, ' ')}. Switch to Table for {result.metrics.slice(1).join(', ').replace(/_/g, ' ')}.</p>}
      </div>
    )
  }
  return (
    <div>
      <HBars items={rows.slice(0, 15).map((r) => ({ label: String(r[by]), value: r[m] || 0 }))} format={fmtFor(m)} />
      {result.metrics.length > 1 && <p className="muted small">Bars show {m.replace(/_/g, ' ')}. Switch to Table for the other columns.</p>}
    </div>
  )
}

function shortDate(v) {
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (/^\d{4}-\d{2}$/.test(s)) return new Date(s + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  return s
}
