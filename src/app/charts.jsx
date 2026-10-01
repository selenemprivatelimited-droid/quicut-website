// Small SVG chart kit for the QuiCut dashboards (no chart library needed).
// Follows the data-viz rules: one y-axis, 2px lines, 4px rounded bar ends on the baseline,
// recessive grid, crosshair + tooltip on hover, legend for 2+ series, and a table view.
import { useEffect, useMemo, useRef, useState } from 'react'

export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

export const fmtInr = (n) => (n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'))
export const fmtInrShort = (n) => {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e7) return '₹' + (n / 1e7).toFixed(1).replace(/\.0$/, '') + 'Cr'
  if (a >= 1e5) return '₹' + (n / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'
  if (a >= 1e3) return '₹' + (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return '₹' + Math.round(n)
}
export const fmtNum = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-IN'))
export const fmtPct = (n) => (n == null ? '—' : Math.round(n * 100) + '%')

function useWidth() {
  const ref = useRef()
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceMax(v) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

/** Time-series chart: type 'area' | 'line' | 'bar' (bar = single series). */
export function TrendChart({ axis, series, type = 'area', format = fmtNum, tickFormat, height = 220, minY, maxY }) {
  const [ref, W] = useWidth()
  const [hover, setHover] = useState(null)
  const H = height
  const pad = { l: 46, r: 12, t: 12, b: 26 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const n = axis.length
  const all = series.flatMap((s) => s.values.filter((v) => v != null))
  const lo = minY ?? 0
  const hi = maxY ?? niceMax(Math.max(...all, 0) * 1.08)
  const x = (i) => pad.l + (type === 'bar' ? (iw / n) * (i + 0.5) : n > 1 ? (iw * i) / (n - 1) : iw / 2)
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih
  const span = hi - lo || 1
  const mant = Math.round((span / 10 ** Math.floor(Math.log10(span))) * 10) / 10
  const steps = span <= 3 && Number.isInteger(span) ? span : [1, 2.5, 5].includes(mant) ? 5 : 4
  const ticks = Array.from({ length: steps + 1 }, (_, k) => lo + (span * k) / steps)
  const xEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))))
  const tf = tickFormat || format

  const path = (vals) => {
    let d = ''
    vals.forEach((v, i) => {
      if (v == null) return
      const cmd = d && vals[i - 1] != null ? 'L' : 'M'
      d += `${cmd}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    return d
  }
  const area = (vals) => {
    const p = path(vals)
    if (!p) return ''
    const first = vals.findIndex((v) => v != null)
    const last = vals.length - 1 - [...vals].reverse().findIndex((v) => v != null)
    return `${p}L${x(last).toFixed(1)},${y(lo)}L${x(first).toFixed(1)},${y(lo)}Z`
  }

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = type === 'bar' ? Math.floor(((px - pad.l) / iw) * n) : Math.round(((px - pad.l) / iw) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }
  const bw = Math.max(2, Math.min(28, (iw / n) * 0.62))

  return (
    <div className="chart" ref={ref}>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: s.color || SERIES[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={series.map((s) => s.name).join(', ') + ' by day'}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={onMove}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className={i === 0 ? 'axis' : 'grid'} />
            <text x={pad.l - 8} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">
              {tf(t)}
            </text>
          </g>
        ))}
        {axis.map((a, i) =>
          (i % xEvery === 0 && (n - 1 - i >= xEvery * 0.7 || i === 0)) || i === n - 1 ? (
            <text key={a.key} x={x(i)} y={H - 6} className="tick" textAnchor={i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle'}>
              {a.label}
            </text>
          ) : null
        )}
        {type === 'bar'
          ? series[0].values.map((v, i) => {
              const h = Math.max(0, y(lo) - y(v || 0))
              const r = Math.min(4, h / 2, bw / 2)
              const x0 = x(i) - bw / 2
              const y0 = y(lo) - h
              return h > 0 ? (
                <path
                  key={i}
                  d={`M${x0},${y(lo)}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + bw - r}Q${x0 + bw},${y0} ${x0 + bw},${y0 + r}V${y(lo)}Z`}
                  fill={series[0].color || SERIES[0]}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              ) : null
            })
          : series.map((s, si) => (
              <g key={s.name}>
                {type === 'area' && <path d={area(s.values)} fill={s.color || SERIES[si]} opacity={series.length > 1 ? 0.08 : 0.16} />}
                <path d={path(s.values)} fill="none" stroke={s.color || SERIES[si]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            ))}
        {hover != null && (
          <g>
            {type !== 'bar' && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />}
            {type !== 'bar' &&
              series.map((s, si) =>
                s.values[hover] != null ? (
                  <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4.5" fill={s.color || SERIES[si]} stroke="var(--s1)" strokeWidth="2" />
                ) : null
              )}
          </g>
        )}
      </svg>
      {hover != null && (
        <div className="tip" style={{ left: Math.min(Math.max(x(hover), 70), W - 70) }}>
          <div className="tip-h">{axis[hover].label}</div>
          {series.map((s, si) => (
            <div key={s.name} className="tip-r">
              <i style={{ background: s.color || SERIES[si] }} />
              <span>{s.name}</span>
              <b>{format(s.values[hover])}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tiny trend line for KPI tiles. */
export function Spark({ values, color = SERIES[0] }) {
  const w = 100
  const h = 28
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`)
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** Ranked horizontal bars with labels and values. */
export function HBars({ items, format = fmtNum, color = SERIES[0], max }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1)
  const [hover, setHover] = useState(null)
  return (
    <div className="hbars">
      {items.map((it, i) => (
        <div key={it.label} className="hbar" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} title={`${it.label}: ${format(it.value)}`}>
          <div className="hbar-top">
            <span>{it.label}</span>
            <b>{format(it.value)}</b>
          </div>
          <div className="hbar-track">
            <span style={{ width: `${(it.value / top) * 100}%`, background: it.color || color, opacity: hover == null || hover === i ? 1 : 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** KPI tile: label, big value, change vs previous period, sparkline. */
export function Kpi({ label, value, delta, spark, color, hint, goodWhenUp = true }) {
  const up = delta > 0.0005
  const down = delta < -0.0005
  const good = (up && goodWhenUp) || (down && !goodWhenUp)
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">
        {delta != null && (up || down) ? (
          <span className={'delta ' + (good ? 'up' : 'down')}>
            {up ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))}%<span className="sr-only"> vs previous period</span>
          </span>
        ) : (
          <span className="delta flat">{hint || (delta == null ? 'new, no earlier data' : 'no change')}</span>
        )}
        {spark && <Spark values={spark} color={color} />}
      </div>
    </div>
  )
}

export function RangePicker({ value, onChange, options = [7, 14, 30] }) {
  return (
    <div className="range" role="radiogroup" aria-label="Time range">
      {options.map((d) => (
        <button key={d} role="radio" aria-checked={value === d} className={value === d ? 'is-on' : ''} onClick={() => onChange(d)}>
          {d}D
        </button>
      ))}
    </div>
  )
}

/** Card with a title and a Chart / Table switch, so every chart has a table view. */
export function ChartCard({ title, sub, right, table, children, className = '' }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className={'chart-card ' + className}>
      <header className="cc-head">
        <div>
          <h3>{title}</h3>
          {sub && <p className="muted small">{sub}</p>}
        </div>
        <div className="cc-actions">
          {right}
          {table && (
            <button className="cc-toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
              {asTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </header>
      {asTable && table ? <DataTable {...table} /> : children}
    </section>
  )
}

export function DataTable({ columns, rows, max = 60 }) {
  return (
    <div className="table-wrap dt">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.num ? 'num' : ''}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, max).map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : ''}>
                  {c.format ? c.format(r[c.key]) : r[c.key] == null ? '—' : String(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Turns an axis + series into DataTable props. */
export const seriesTable = (axis, series, format = fmtNum) => ({
  columns: [{ key: 'day', label: 'Day' }, ...series.map((s) => ({ key: s.name, label: s.name, num: true, format }))],
  rows: [...axis]
    .map((a, i) => ({ day: a.label, ...Object.fromEntries(series.map((s) => [s.name, s.values[i]])) }))
    .reverse(),
})

export function useAnimatedNumber(target, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (now) => {
      const k = Math.min(1, (now - start) / ms)
      const e = 1 - (1 - k) ** 3
      setV(a + (target - a) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

export const useMemoMetrics = (fn, deps) => useMemo(fn, deps)
