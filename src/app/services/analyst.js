// QuiCut Data Analyst agent (admin only), modelled on the "AI Data Analysis Agent" in awesome-llm-apps.
// Loop: plan (AI writes a structured query) -> run (this file executes it on the admin tables, no code eval)
//       -> self-correct once if the query is invalid -> explain (AI turns the result into an answer).
import { AI_URL } from './ai.js'

const DAY = 864e5

async function post(task, body, timeoutMs = 35000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${AI_URL}/v1/${task}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data.error) throw new Error(data.error || `AI error ${r.status}`)
    return data
  } finally {
    clearTimeout(t)
  }
}

/** Column types + example values for the planner. */
export function schemaOf(tables) {
  const out = {}
  for (const [name, rows] of Object.entries(tables)) {
    const cols = {}
    const sample = rows.slice(0, 40)
    for (const k of Object.keys(rows[0] || {})) {
      const vals = sample.map((r) => r[k]).filter((v) => v != null)
      const type = typeof vals[0] === 'number' ? 'number' : typeof vals[0] === 'boolean' ? 'boolean' : k === 'date' || k === 'joined' ? 'date YYYY-MM-DD' : 'text'
      const examples = [...new Set(vals.map(String))].slice(0, type === 'text' ? 6 : 2)
      cols[k] = `${type} (e.g. ${examples.join(', ')})`
    }
    out[name] = { rows: rows.length, columns: cols }
  }
  return out
}

const weekStart = (d) => {
  const t = new Date(d + 'T00:00:00')
  const day = (t.getDay() + 6) % 7
  t.setDate(t.getDate() - day)
  return t.toISOString().slice(0, 10)
}

/** Runs a structured query on in-memory tables. Throws a readable error when the query is invalid. */
export function runQuery(tables, q) {
  if (!q || !tables[q.table]) throw new Error(`Unknown table "${q?.table}". Use one of: ${Object.keys(tables).join(', ')}`)
  let rows = tables[q.table]
  const cols = Object.keys(rows[0] || {})
  const need = (c) => {
    if (c && c !== '*' && !cols.includes(c)) throw new Error(`Unknown column "${c}" in ${q.table}. Columns: ${cols.join(', ')}`)
  }
  for (const f of q.filters || []) {
    need(f.column)
    const v = f.value
    rows = rows.filter((r) => {
      const x = r[f.column]
      switch (f.op) {
        case '=':
          return String(x).toLowerCase() === String(v).toLowerCase()
        case '!=':
          return String(x).toLowerCase() !== String(v).toLowerCase()
        case '>':
          return x > v
        case '<':
          return x < v
        case '>=':
          return x >= v
        case '<=':
          return x <= v
        case 'contains':
          return String(x ?? '').toLowerCase().includes(String(v).toLowerCase())
        case 'in':
          return (Array.isArray(v) ? v : [v]).map((y) => String(y).toLowerCase()).includes(String(x).toLowerCase())
        case 'last_days': {
          const from = new Date(Date.now() - Number(v) * DAY).toISOString().slice(0, 10)
          return String(x) >= from
        }
        default:
          throw new Error(`Unknown filter op "${f.op}"`)
      }
    })
  }
  const by = q.group_by && q.group_by !== 'null' ? q.group_by : null
  need(by)
  const bucket = by === 'date' || by === 'joined' ? q.time_bucket : null
  const keyOf = (r) => {
    if (!by) return 'All'
    const v = r[by]
    if (bucket === 'week') return weekStart(v)
    if (bucket === 'month') return String(v).slice(0, 7)
    return v == null ? '(none)' : v
  }
  const metrics = (q.metrics && q.metrics.length ? q.metrics : [{ agg: 'count', column: '*', as: 'count' }]).map((m, i) => {
    need(m.column)
    return { ...m, as: m.as || `${m.agg}_${m.column === '*' ? 'rows' : m.column}` || `m${i}` }
  })
  const groups = new Map()
  for (const r of rows) {
    const k = keyOf(r)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(r)
  }
  let out = [...groups.entries()].map(([k, list]) => {
    const row = by ? { [by]: k } : {}
    for (const m of metrics) {
      const vals = m.column === '*' ? list : list.map((r) => r[m.column]).filter((v) => v != null)
      const nums = vals.map(Number).filter((n) => !Number.isNaN(n))
      let v
      switch (m.agg) {
        case 'count':
          v = m.column === '*' ? list.length : vals.length
          break
        case 'count_distinct':
          v = new Set(vals.map(String)).size
          break
        case 'sum':
          v = nums.reduce((a, b) => a + b, 0)
          break
        case 'avg':
          v = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
          break
        case 'min':
          v = nums.length ? Math.min(...nums) : null
          break
        case 'max':
          v = nums.length ? Math.max(...nums) : null
          break
        default:
          throw new Error(`Unknown aggregate "${m.agg}"`)
      }
      row[m.as] = v == null ? null : Math.round(v * 100) / 100
    }
    return row
  })
  const sortBy = q.sort_by && (out[0] && q.sort_by in out[0]) ? q.sort_by : by === 'date' ? 'date' : metrics[0].as
  const dir = q.sort_dir === 'asc' || (sortBy === 'date' && q.sort_dir !== 'desc') ? 1 : -1
  out.sort((a, b) => (a[sortBy] > b[sortBy] ? dir : a[sortBy] < b[sortBy] ? -dir : 0))
  const total = out.length
  out = out.slice(0, Math.min(100, Math.max(1, Number(q.limit) || 50)))
  return { rows: out, total, scanned: rows.length, groupBy: by, metrics: metrics.map((m) => m.as) }
}

/** Simple offline planner so the analyst still answers common questions without the AI. */
function localPlan(question) {
  const q = question.toLowerCase()
  const days = Number((q.match(/(\d+)\s*day/) || [])[1]) || (q.includes('week') ? 7 : 30)
  const recent = [{ column: 'date', op: 'last_days', value: days }]
  if (/editor/.test(q))
    return { thinking: 'Rank editors by revenue they delivered.', query: { table: 'orders', filters: [{ column: 'status', op: '=', value: 'completed' }, ...recent], group_by: 'editor', metrics: [{ agg: 'count', column: '*', as: 'jobs' }, { agg: 'sum', column: 'editor_pay_inr', as: 'earned_inr' }, { agg: 'avg', column: 'stars', as: 'avg_stars' }], sort_by: 'earned_inr', sort_dir: 'desc', limit: 10 }, chart: 'bar', title: 'Editors by earnings' }
  if (/creator|customer|spend/.test(q))
    return { thinking: 'Rank creators by credits spent.', query: { table: 'orders', filters: recent, group_by: 'creator', metrics: [{ agg: 'sum', column: 'credits', as: 'credits_spent' }, { agg: 'count', column: '*', as: 'orders' }], sort_by: 'credits_spent', sort_dir: 'desc', limit: 10 }, chart: 'bar', title: 'Top creators' }
  if (/type|tier|category/.test(q))
    return { thinking: 'Compare edit types.', query: { table: 'orders', filters: recent, group_by: 'type', metrics: [{ agg: 'count', column: '*', as: 'orders' }, { agg: 'sum', column: 'quicut_revenue_inr', as: 'revenue_inr' }], sort_by: 'orders', sort_dir: 'desc', limit: 10 }, chart: 'bar', title: 'Orders by edit type' }
  if (/cash|payment|money in|sales/.test(q))
    return { thinking: 'Sum payments per day.', query: { table: 'payments', filters: recent, group_by: 'date', time_bucket: 'day', metrics: [{ agg: 'sum', column: 'amount_inr', as: 'cash_inr' }], sort_by: 'date', sort_dir: 'asc', limit: 100 }, chart: 'line', title: 'Cash collected per day' }
  return { thinking: 'Sum QuiCut revenue per day.', query: { table: 'orders', filters: [{ column: 'status', op: '=', value: 'completed' }, ...recent], group_by: 'date', time_bucket: 'day', metrics: [{ agg: 'sum', column: 'quicut_revenue_inr', as: 'revenue_inr' }, { agg: 'count', column: '*', as: 'orders' }], sort_by: 'date', sort_dir: 'asc', limit: 100 }, chart: 'line', title: 'Revenue per day' }
}

/** Full agent run. onStep(step) is called as each stage starts/finishes, for the live trace. */
export async function analyze(question, tables, onStep = () => {}) {
  const schema = schemaOf(tables)
  const today = new Date().toISOString().slice(0, 10)
  let plan
  let source = 'ai'
  let result
  onStep({ id: 'plan', label: 'Understanding the question', state: 'run' })
  try {
    plan = await post('analyst-plan', { question, schema, today })
  } catch {
    plan = localPlan(question)
    source = 'rules'
  }
  onStep({ id: 'plan', label: plan.thinking || 'Planned the query', state: 'done' })
  onStep({ id: 'run', label: 'Running the query on your data', state: 'run' })
  try {
    result = runQuery(tables, plan.query)
  } catch (err) {
    onStep({ id: 'run', label: `Query error: ${err.message}. Fixing it`, state: 'warn' })
    try {
      plan = source === 'ai' ? await post('analyst-plan', { question, schema, today, error: err.message }) : localPlan(question)
      result = runQuery(tables, plan.query)
    } catch (err2) {
      plan = localPlan(question)
      source = 'rules'
      result = runQuery(tables, plan.query)
    }
  }
  onStep({ id: 'run', label: `Scanned ${result.scanned} rows, ${result.total} result row${result.total === 1 ? '' : 's'}`, state: 'done' })
  onStep({ id: 'explain', label: 'Writing the answer', state: 'run' })
  let explain
  try {
    if (source !== 'ai') throw new Error('offline')
    explain = await post('analyst-explain', { question, query: plan.query, rows: result.rows.slice(0, 40), total: result.total })
  } catch {
    const m = result.metrics[0]
    const top = result.rows[0]
    explain = {
      answer: top ? `${result.total} result rows. ${result.groupBy ? `Top: ${top[result.groupBy]} with ${m} ${top[m]}.` : `${m}: ${top[m]}.`}` : 'No data matched that question.',
      highlights: [],
      followups: ['Revenue per day this month', 'Top editors by earnings', 'Orders by edit type'],
    }
  }
  onStep({ id: 'explain', label: 'Answer ready', state: 'done' })
  return { plan, result, explain, source }
}

export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
