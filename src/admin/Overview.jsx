import { useMemo } from 'react'
import { alerts } from '../app/services/store.js'
import { platformMetrics, USD_INR } from '../app/services/metrics.js'
import { OpsBrief } from '../app/views/Admin.jsx'
import { Empty, Icon, Pill } from '../app/ui.jsx'
import { TrendChart, HBars, Kpi, ChartCard, DataTable, seriesTable, fmtInr, fmtInrShort, fmtNum, fmtPct, SERIES } from '../app/charts.jsx'

export function Overview({ s, days, go }) {
  const m = useMemo(() => platformMetrics(s, days), [s, days])
  const al = alerts(s)
  const money = [
    { name: 'Cash collected', values: m.cashDaily, color: SERIES[0] },
    { name: 'GMV delivered', values: m.gmvDaily, color: SERIES[1] },
    { name: 'QuiCut revenue', values: m.revenueDaily, color: SERIES[2] },
  ]
  const orders = [{ name: 'Orders placed', values: m.ordersDaily, color: SERIES[0] }]
  const payouts = [{ name: 'Paid to editors', values: m.payoutDaily, color: SERIES[3] }]
  const take = m.gmv.value ? m.revenue.value / m.gmv.value : null
  return (
    <div className="stack">
      <div className="kpi-grid six">
        <Kpi label="Cash collected" value={fmtInrShort(m.cash.value)} delta={m.cash.delta} spark={m.cashDaily} color={SERIES[0]} />
        <Kpi label="GMV delivered" value={fmtInrShort(m.gmv.value)} delta={m.gmv.delta} spark={m.gmvDaily} color={SERIES[1]} />
        <Kpi label="QuiCut revenue" value={fmtInrShort(m.revenue.value)} delta={m.revenue.delta} spark={m.revenueDaily} color={SERIES[2]} />
        <Kpi label="Orders" value={fmtNum(m.orders.value)} delta={m.orders.delta} spark={m.ordersDaily} color={SERIES[0]} />
        <Kpi label="Active creators" value={fmtNum(m.active.value)} delta={m.active.delta} hint="ordered in period" />
        <Kpi label="Paid to editors" value={fmtInrShort(m.payouts.value)} delta={m.payouts.delta} spark={m.payoutDaily} color={SERIES[3]} hint={`take rate ${fmtPct(take)}`} />
      </div>

      <ChartCard
        title="Money per day"
        sub={`Last ${days} days · cash in from packs (Stripe USD at ₹${USD_INR}), GMV and QuiCut's 20% on delivered edits`}
        table={seriesTable(m.axis, money, fmtInr)}
      >
        <TrendChart axis={m.axis} series={money} type="area" format={fmtInr} tickFormat={fmtInrShort} height={260} />
      </ChartCard>

      <div className="chart-row">
        <ChartCard title="Orders per day" sub="Placed by creators" table={seriesTable(m.axis, orders)}>
          <TrendChart axis={m.axis} series={orders} type="bar" height={200} />
        </ChartCard>
        <ChartCard title="Editor payouts" sub="UPI payouts sent, by day" table={seriesTable(m.axis, payouts, fmtInr)}>
          <TrendChart axis={m.axis} series={payouts} type="bar" height={200} format={fmtInr} tickFormat={fmtInrShort} />
        </ChartCard>
      </div>

      <div className="chart-row">
        <ChartCard title="Revenue by edit type" sub={`QuiCut's share, last ${days} days`}>
          <HBars items={[...m.byType].sort((a, b) => b.value - a.value)} format={fmtInr} />
        </ChartCard>
        <ChartCard title="Cash by region" sub="Where the money comes from">
          <HBars items={m.regionCash.map((r, i) => ({ ...r, color: SERIES[i] }))} format={fmtInr} />
        </ChartCard>
      </div>

      <OpsBrief s={s} go={go} />

      <section className="chart-card">
        <header className="cc-head">
          <div>
            <h3>Alerts</h3>
            <p className="muted small">From the operational SOPs</p>
          </div>
        </header>
        {al.length ? (
          <div className="list">
            {al.map((a, i) => (
              <div key={i} className={`alert alert-${a.level}`}>
                <div className="alert-ico">
                  <Icon name="alert" size={18} />
                </div>
                <div className="grow">
                  <div className="row-title">{a.text}</div>
                  <div className="row-meta">{a.action}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => go(a.kind === 'kyc' ? 'kyc' : a.orderId ? 'orders' : 'people')}>
                  Open
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="All clear">No deadline, rating or KYC alerts right now.</Empty>
        )}
      </section>
    </div>
  )
}

export function Team({ s, days }) {
  const m = useMemo(() => platformMetrics(s, days), [s, days])
  const growth = [
    { name: 'New creators', values: m.newCreators, color: SERIES[0] },
    { name: 'New editors', values: m.newEditors, color: SERIES[1] },
  ]
  return (
    <div className="stack">
      <div className="kpi-grid four">
        <Kpi label="Creators" value={fmtNum(s.creators.filter((c) => !c.deleted).length)} hint={`${m.active.value} active in period`} />
        <Kpi label="Editors" value={fmtNum(s.editors.length)} hint={`${s.editors.filter((e) => e.status === 'active').length} active`} />
        <Kpi label="New creators" value={fmtNum(m.newCreators.reduce((a, b) => a + b, 0))} hint={`last ${days} days`} />
        <Kpi label="Avg on-time" value={fmtPct(avg(m.editors.filter((e) => e.onTime != null).map((e) => e.onTime)))} hint="delivered before deadline" />
      </div>
      <ChartCard title="Sign-ups per day" sub={`Last ${days} days`} table={seriesTable(m.axis, growth)}>
        <TrendChart axis={m.axis} series={growth} type="line" height={220} />
      </ChartCard>
      <ChartCard title="Editor leaderboard" sub={`Delivered work, last ${days} days`}>
        <DataTable
          columns={[
            { key: 'name', label: 'Editor' },
            { key: 'jobs', label: 'Jobs', num: true },
            { key: 'earned', label: 'Earned', num: true, format: fmtInr },
            { key: 'onTime', label: 'On time', num: true, format: fmtPct },
            { key: 'rating', label: 'Rating', num: true, format: (v) => (v == null ? '—' : v.toFixed(2) + '★') },
            { key: 'status', label: 'Status', format: (v) => <Pill status={v} /> },
          ]}
          rows={m.editors}
        />
      </ChartCard>
      <ChartCard title="Top creators" sub={`By credits spent, last ${days} days`}>
        <HBars items={m.creators.slice(0, 10).map((c) => ({ label: `${c.name} · ${c.orders} order${c.orders === 1 ? '' : 's'}`, value: c.spent }))} format={(v) => fmtNum(v) + ' QC'} />
      </ChartCard>
    </div>
  )
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
