// Day-by-day numbers for the dashboards, derived from the live store so every action
// (an order, a payout, a purchase) shows up in the charts immediately.
import { editType, EDIT_TYPES } from '../config/pricing.js'

export const USD_INR = 84 // display conversion for Stripe (USD) cash in reports
const DAY = 864e5

const dayKey = (t) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Last `days` calendar days (oldest first) as { key, label, t }. */
export function dayAxis(days, now = Date.now()) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * DAY
    const d = new Date(t)
    out.push({ key: dayKey(t), t, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })
  }
  return out
}

function bucket(axis, items, getT, getV = () => 1) {
  const idx = Object.fromEntries(axis.map((a, i) => [a.key, i]))
  const vals = axis.map(() => 0)
  for (const it of items) {
    const t = getT(it)
    if (!t) continue
    const i = idx[dayKey(t)]
    if (i !== undefined) vals[i] += getV(it)
  }
  return vals
}

const sum = (a) => a.reduce((x, y) => x + y, 0)
const inWindow = (t, from, to) => {
  const x = new Date(t).getTime()
  return x >= from && x < to
}

/** Totals for this window and the one before it, for "vs previous period" deltas. */
// A change % is only shown when the data covers the whole previous window (no fake "+300%").
function periods(days, s, now = Date.now()) {
  const to = now + 1
  const from = now - days * DAY
  const start = Math.min(...[...(s?.orders || []), ...(s?.ledger || [])].map((x) => new Date(x.at).getTime()).filter(Number.isFinite), now)
  const full = start <= from - days * DAY + DAY
  return { cur: [from, to], prev: [from - days * DAY, from], d: full ? delta : () => null }
}
const delta = (cur, prev) => (prev ? (cur - prev) / prev : cur ? 1 : 0)

const cashInr = (l) => (l.currency === 'USD' ? (l.usd || 0) * USD_INR : l.inr || 0)
const completedAt = (o) => o.doneAt || o.history?.find((h) => h.status === 'completed')?.at

// ── Creator ────────────────────────────────────────────────────────────────────────
export function creatorMetrics(s, creatorId, days) {
  const axis = dayAxis(days)
  const ledger = s.ledger.filter((l) => l.creatorId === creatorId)
  const orders = s.orders.filter((o) => o.creatorId === creatorId && o.status !== 'refunded')
  const spentDaily = bucket(axis, ledger.filter((l) => l.type === 'order'), (l) => l.at, (l) => -l.credits)
  const ordersDaily = bucket(axis, orders, (o) => o.at)
  const { cur, prev, d } = periods(days, s)
  const spent = (w) => -sum(ledger.filter((l) => l.type === 'order' && inWindow(l.at, ...w)).map((l) => l.credits))
  const count = (w) => orders.filter((o) => inWindow(o.at, ...w)).length
  const delivered = orders.filter((o) => o.status === 'completed' && completedAt(o))
  const hours = delivered.filter((o) => inWindow(completedAt(o), ...cur)).map((o) => (new Date(completedAt(o)) - new Date(o.at)) / 3600e3)
  const byType = EDIT_TYPES.map((t) => ({ label: t.name, value: orders.filter((o) => o.typeId === t.id && inWindow(o.at, ...cur)).length })).filter((x) => x.value)
  return {
    axis,
    spentDaily,
    ordersDaily,
    spent: { value: spent(cur), delta: d(spent(cur), spent(prev)) },
    orders: { value: count(cur), delta: d(count(cur), count(prev)) },
    avgHours: hours.length ? sum(hours) / hours.length : null,
    byType,
  }
}

// ── Editor ─────────────────────────────────────────────────────────────────────────
export function editorMetrics(s, editorId, days) {
  const axis = dayAxis(days)
  const earnings = s.earnings.filter((e) => e.editorId === editorId)
  const done = s.orders.filter((o) => o.editorId === editorId && o.status === 'completed' && completedAt(o))
  const earnDaily = bucket(axis, earnings, (e) => e.at, (e) => e.inr)
  const jobsDaily = bucket(axis, done, completedAt)
  const { cur, prev, d } = periods(days, s)
  const earned = (w) => sum(earnings.filter((e) => inWindow(e.at, ...w)).map((e) => e.inr))
  const jobs = (w) => done.filter((o) => inWindow(completedAt(o), ...w))
  const onTime = (list) => (list.length ? list.filter((o) => new Date(completedAt(o)) <= new Date(o.dueAt)).length / list.length : null)
  const rated = (list) => list.filter((o) => o.stars)
  const avgStars = (list) => (rated(list).length ? sum(rated(list).map((o) => o.stars)) / rated(list).length : null)
  // rolling 7-day average rating per day
  const ratingDaily = axis.map((a) => {
    const win = done.filter((o) => o.stars && new Date(completedAt(o)).getTime() <= a.t + DAY && new Date(completedAt(o)).getTime() > a.t - 6 * DAY)
    return win.length ? Math.round((sum(win.map((o) => o.stars)) / win.length) * 100) / 100 : null
  })
  return {
    axis,
    earnDaily,
    jobsDaily,
    ratingDaily,
    earned: { value: earned(cur), delta: d(earned(cur), earned(prev)) },
    jobs: { value: jobs(cur).length, delta: d(jobs(cur).length, jobs(prev).length) },
    onTime: { value: onTime(jobs(cur)), prev: onTime(jobs(prev)) },
    stars: { value: avgStars(jobs(cur)), prev: avgStars(jobs(prev)) },
  }
}

// ── Platform (admin) ───────────────────────────────────────────────────────
export function platformMetrics(s, days) {
  const axis = dayAxis(days)
  const purchases = s.ledger.filter((l) => l.type === 'purchase')
  const completed = s.orders.filter((o) => o.status === 'completed' && completedAt(o))
  const placed = s.orders.filter((o) => o.status !== 'refunded')
  const cashDaily = bucket(axis, purchases, (l) => l.at, cashInr)
  const gmvDaily = bucket(axis, completed, completedAt, (o) => o.credits)
  const revenueDaily = bucket(axis, completed, completedAt, (o) => o.credits - o.editorPayInr)
  const ordersDaily = bucket(axis, placed, (o) => o.at)
  const payoutDaily = bucket(axis, s.payouts.filter((p) => p.status === 'paid'), (p) => p.paidAt, (p) => p.inr)
  const newCreators = bucket(axis, s.creators, (c) => c.joined)
  const newEditors = bucket(axis, s.editors, (e) => e.joined)
  const { cur, prev, d } = periods(days, s)
  const tot = (list, getT, getV, w) => sum(list.filter((x) => getT(x) && inWindow(getT(x), ...w)).map(getV))
  const k = (list, getT, getV) => {
    const c = tot(list, getT, getV, cur)
    const p = tot(list, getT, getV, prev)
    return { value: c, delta: d(c, p) }
  }
  const activeCreators = (w) => new Set(placed.filter((o) => inWindow(o.at, ...w)).map((o) => o.creatorId)).size
  const byType = EDIT_TYPES.map((t) => ({
    label: t.name,
    value: sum(completed.filter((o) => o.typeId === t.id && inWindow(completedAt(o), ...cur)).map((o) => o.credits - o.editorPayInr)),
  }))
  const regionCash = [
    { label: 'India · Razorpay', value: tot(purchases.filter((l) => l.currency !== 'USD'), (l) => l.at, cashInr, cur) },
    { label: 'Global · Stripe', value: tot(purchases.filter((l) => l.currency === 'USD'), (l) => l.at, cashInr, cur) },
  ]
  const editors = s.editors
    .map((e) => {
      const mine = completed.filter((o) => o.editorId === e.id && inWindow(completedAt(o), ...cur))
      const onTime = mine.length ? mine.filter((o) => new Date(completedAt(o)) <= new Date(o.dueAt)).length / mine.length : null
      const rated = mine.filter((o) => o.stars)
      return {
        id: e.id,
        name: e.name,
        jobs: mine.length,
        earned: sum(mine.map((o) => o.editorPayInr)),
        onTime,
        rating: rated.length ? sum(rated.map((o) => o.stars)) / rated.length : null,
        status: e.status,
      }
    })
    .sort((a, b) => b.earned - a.earned)
  const creators = s.creators
    .map((c) => ({ id: c.id, name: c.name, region: c.region, spent: sum(placed.filter((o) => o.creatorId === c.id && inWindow(o.at, ...cur)).map((o) => o.credits)), orders: placed.filter((o) => o.creatorId === c.id && inWindow(o.at, ...cur)).length }))
    .filter((c) => c.orders)
    .sort((a, b) => b.spent - a.spent)
  return {
    axis,
    cashDaily,
    gmvDaily,
    revenueDaily,
    ordersDaily,
    payoutDaily,
    newCreators,
    newEditors,
    cash: k(purchases, (l) => l.at, cashInr),
    gmv: k(completed, completedAt, (o) => o.credits),
    revenue: k(completed, completedAt, (o) => o.credits - o.editorPayInr),
    orders: k(placed, (o) => o.at, () => 1),
    payouts: k(s.payouts.filter((p) => p.status === 'paid'), (p) => p.paidAt, (p) => p.inr),
    active: { value: activeCreators(cur), delta: d(activeCreators(cur), activeCreators(prev)) },
    byType,
    regionCash,
    editors,
    creators,
  }
}

// ── Tables for the Data Analyst agent ──────────────────────────────────────
export function analystTables(s) {
  const name = (arr, id) => arr.find((x) => x.id === id)?.name || null
  const creatorRegion = (id) => s.creators.find((c) => c.id === id)?.region || 'IN'
  return {
    orders: s.orders.map((o) => {
      const done = completedAt(o)
      return {
        id: o.id,
        date: dayKey(o.at),
        type: editType(o.typeId).name,
        status: o.status,
        creator: name(s.creators, o.creatorId),
        editor: name(s.editors, o.editorId),
        region: creatorRegion(o.creatorId),
        credits: o.credits,
        editor_pay_inr: o.editorPayInr,
        quicut_revenue_inr: o.status === 'completed' ? o.credits - o.editorPayInr : 0,
        addons: o.addons.length,
        revisions: o.revisions || 0,
        stars: o.stars || null,
        hours_to_deliver: done ? Math.round(((new Date(done) - new Date(o.at)) / 3600e3) * 10) / 10 : null,
        on_time: done ? new Date(done) <= new Date(o.dueAt) : null,
      }
    }),
    payments: s.ledger
      .filter((l) => l.type === 'purchase')
      .map((l) => ({
        date: dayKey(l.at),
        creator: name(s.creators, l.creatorId),
        region: l.currency === 'USD' ? 'GLOBAL' : 'IN',
        gateway: l.gateway || (l.currency === 'USD' ? 'stripe' : 'razorpay'),
        amount_inr: Math.round(cashInr(l)),
        credits: l.credits,
      })),
    payouts: s.payouts.map((p) => ({ date: dayKey(p.paidAt || p.at), editor: name(s.editors, p.editorId), amount_inr: p.inr, status: p.status })),
    creators: s.creators.map((c) => ({ name: c.name, region: c.region, language: c.lang, joined: dayKey(c.joined), kyc: c.kyc?.status || 'none' })),
    editors: s.editors.map((e) => ({ name: e.name, city: e.city, rating: e.rating, ratings: e.ratings, status: e.status, kyc: e.kyc?.status || 'none', joined: dayKey(e.joined) })),
  }
}
