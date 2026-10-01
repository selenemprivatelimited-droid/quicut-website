// ─────────────────────────────────────────────────────────────────────────────
// App data. In demo mode everything lives in this browser (localStorage).
// Each exported action maps 1:1 to a future backend endpoint, so the screens
// will not change when a real database (Supabase / Firebase / Postgres) arrives.
//
// Money rules
//   Creator credits: ledger of +purchase / -order / +refund / +bonus entries. Balance = sum.
//   Editor money:    earning (₹ per completed video) → payout request → paid by admin.
// Gates
//   KYC verified is required for: buying credits, placing orders (creator);
//   accepting jobs, requesting payouts (editor).
// ─────────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import { quote, packTotal, editType, PAYOUTS, INR_PER_CREDIT, REGIONS } from '../config/pricing.js'
import { chargeForPack, sendPayout } from './payments.js'
import { submitKyc, maskId } from './kyc.js'

const KEY = 'quicut-app-v2'
const listeners = new Set()
const now = () => new Date().toISOString()
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const nextId = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

const verified = (extra = {}) => ({ status: 'verified', docType: 'PAN card', docLast4: '••••234F', region: 'IN', submittedAt: hoursAgo(500), reviewedAt: hoursAgo(498), ...extra })

function seed() {
  const s = {
    seq: 2000,
    creators: [
      { id: 'c1', name: 'Ravi Kumar', handle: '@ravikumar_creates', lang: 'Telugu', phone: '+91 98480 12345', region: 'IN', joined: hoursAgo(400), kyc: verified() },
      { id: 'c2', name: 'Priya Sharma', handle: '@travelpriya', lang: 'Hindi', phone: '+91 99000 55667', region: 'IN', joined: hoursAgo(300), kyc: verified({ docType: 'Aadhaar (DigiLocker)', docLast4: '••••8812' }) },
      { id: 'c3', name: 'Mina Park', handle: '@minaplays', lang: 'English', phone: '+82 10 5555 0101', region: 'GLOBAL', joined: hoursAgo(5), kyc: { status: 'none' } },
    ],
    editors: [
      { id: 'e1', name: 'Arjun Kumar', city: 'Hyderabad', skills: ['vlog', 'gaming', 'wedding'], upi: 'arjun@okicici', rating: 4.9, ratings: 46, status: 'active', kyc: verified({ panLast4: '••••234F' }) },
      { id: 'e2', name: 'Kiran E.', city: 'Vijayawada', skills: ['reel', 'vlog', 'cinematic'], upi: 'kiran.edits@ybl', rating: 4.8, ratings: 31, status: 'active', kyc: verified({ panLast4: '••••771K' }) },
      { id: 'e3', name: 'Sai Teja', city: 'Nellore', skills: ['reel', 'gaming'], upi: '', rating: 0, ratings: 0, status: 'active', kyc: { status: 'pending', docType: 'Aadhaar (DigiLocker)', docLast4: '••••4410', panLast4: '••••902P', region: 'IN', submittedAt: hoursAgo(3), upi: 'saiteja@paytm' } },
    ],
    orders: [],
    ledger: [],
    earnings: [],
    payouts: [],
    deletions: [],
  }
  const buy = (creatorId, credits, inr, at) =>
    s.ledger.push({ id: `L-${s.ledger.length + 1}`, creatorId, type: 'purchase', credits, inr, currency: 'INR', note: `Pack ₹${inr} · UPI`, at })
  buy('c1', 2750, 2499, hoursAgo(90))
  buy('c2', 5750, 4999, hoursAgo(60))

  const mk = (o) => {
    const q = quote(o.typeId, o.addons)
    const order = {
      id: `QC-${1040 + s.orders.length}`,
      brief: '',
      addons: [],
      footage: 'raw_footage.mp4',
      deliveryUrl: '',
      revisions: 0,
      history: [{ status: 'paid', at: o.at }],
      ...o,
      credits: q.credits,
      editorPayInr: q.editorPayInr,
      dueAt: new Date(new Date(o.at).getTime() + q.hours * 3600e3).toISOString(),
    }
    s.orders.push(order)
    s.ledger.push({ id: `L-${s.ledger.length + 1}`, creatorId: o.creatorId, type: 'order', credits: -q.credits, note: `${order.id} · ${editType(o.typeId).name}`, at: o.at })
    return order
  }
  const done = mk({ creatorId: 'c1', typeId: 'gaming', title: 'BGMI Season 3 Highlights', status: 'completed', editorId: 'e1', at: hoursAgo(80), stars: 5, brief: 'Fast cuts, phonk music, cool blue grade.' })
  done.deliveryUrl = 'https://example.com/quicut-demo-delivery'
  s.earnings.push({ id: 'E-1', editorId: 'e1', orderId: done.id, inr: done.editorPayInr, at: hoursAgo(60) })
  mk({ creatorId: 'c1', typeId: 'vlog', addons: ['captions'], title: 'Araku Valley Travel Vlog', status: 'editing', editorId: 'e2', at: hoursAgo(10), brief: 'Telugu lo edit cheyyandi. Warm colour grade, Telugu background music, forest part lo slow motion.' })
  mk({ creatorId: 'c2', typeId: 'reel', title: 'Ooty Trip Reel', status: 'paid', at: hoursAgo(14), brief: 'Cinematic golden tones, trending Insta BGM, 9:16.' })
  mk({ creatorId: 'c2', typeId: 'wedding', addons: ['thumb'], title: 'Kiran & Divya Wedding Teaser', status: 'paid', at: hoursAgo(1), brief: 'Emotional, slow motion on entry, Telugu songs.' })
  return s
}

let state = load()
function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* storage blocked: fall back to seed */
  }
  return seed()
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage blocked: keep in memory */
  }
}
function set(mutator) {
  const draft = structuredClone(state)
  mutator(draft)
  state = draft
  save()
  listeners.forEach((l) => l())
}

export function useStore() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state
  )
}
export const getState = () => state
export const resetDemo = () => set((d) => Object.assign(d, seed()))

const person = (d, role, id) => (role === 'creator' ? d.creators : d.editors).find((p) => p.id === id)
export const isVerified = (p) => p?.kyc?.status === 'verified'

// ── Derived values ──────────────────────────────────────────────────────────
export const creditBalance = (s, creatorId) =>
  s.ledger.filter((l) => l.creatorId === creatorId).reduce((sum, l) => sum + l.credits, 0)

export function editorMoney(s, editorId) {
  const earned = s.earnings.filter((e) => e.editorId === editorId).reduce((a, e) => a + e.inr, 0)
  const mine = s.payouts.filter((p) => p.editorId === editorId)
  const paid = mine.filter((p) => p.status === 'paid').reduce((a, p) => a + p.inr, 0)
  const requested = mine.filter((p) => p.status === 'requested').reduce((a, p) => a + p.inr, 0)
  const inProgress = s.orders
    .filter((o) => o.editorId === editorId && ['editing', 'review', 'revision'].includes(o.status))
    .reduce((a, o) => a + o.editorPayInr, 0)
  return { earned, paid, requested, available: earned - paid - requested, inProgress }
}

export function platformStats(s) {
  const purchases = s.ledger.filter((l) => l.type === 'purchase')
  const cashInInr = purchases.filter((l) => l.currency !== 'USD').reduce((a, l) => a + l.inr, 0)
  const cashInUsd = purchases.filter((l) => l.currency === 'USD').reduce((a, l) => a + l.usd, 0)
  const completed = s.orders.filter((o) => o.status === 'completed')
  const gmv = completed.reduce((a, o) => a + o.credits * INR_PER_CREDIT, 0)
  const editorCost = completed.reduce((a, o) => a + o.editorPayInr, 0)
  return {
    cashInInr,
    cashInUsd,
    gmv,
    revenue: gmv - editorCost,
    liability: s.creators.reduce((a, c) => a + creditBalance(s, c.id), 0),
    payoutsDue: s.payouts.filter((p) => p.status === 'requested').reduce((a, p) => a + p.inr, 0),
    open: s.orders.filter((o) => o.status === 'paid').length,
    active: s.orders.filter((o) => ['editing', 'review', 'revision'].includes(o.status)).length,
    done: completed.length,
  }
}

/** Automated alerts from the Operational SOPs. */
export function alerts(s) {
  const out = []
  const t = Date.now()
  for (const o of s.orders) {
    if (['paid', 'editing', 'revision'].includes(o.status) && new Date(o.dueAt).getTime() < t)
      out.push({ kind: 'deadline', level: 'bad', orderId: o.id, text: `${o.id} is past its deadline`, action: 'Contact the editor within 30 min, reassign, or refund within 2 h.' })
    if (o.status === 'paid' && t - new Date(o.at).getTime() > 2 * 3600e3)
      out.push({ kind: 'unassigned', level: 'warn', orderId: o.id, text: `${o.id} has no editor after 2 hours`, action: 'Assign an editor of the same category.' })
    if (o.stars && o.stars <= 2)
      out.push({ kind: 'rating', level: 'bad', orderId: o.id, text: `${o.id} got ${o.stars}★`, action: 'Review the delivery and contact the editor within 2 hours.' })
  }
  for (const e of s.editors) {
    if (e.ratings >= 5 && e.rating < 4.2) out.push({ kind: 'avg', level: 'bad', editorId: e.id, text: `${e.name} average dropped to ${e.rating}★`, action: 'Quality review meeting within 24 hours.' })
    const revs = s.orders.filter((o) => o.editorId === e.id).reduce((a, o) => a + o.revisions, 0)
    if (revs >= 3) out.push({ kind: 'revisions', level: 'warn', editorId: e.id, text: `${e.name} has ${revs} revision requests`, action: 'Review recent deliveries.' })
  }
  const kycQueue = [...s.creators, ...s.editors].filter((p) => p.kyc?.status === 'pending').length
  if (kycQueue) out.push({ kind: 'kyc', level: 'warn', text: `${kycQueue} KYC ${kycQueue === 1 ? 'check' : 'checks'} waiting for review`, action: 'Approve or reject in People → KYC.' })
  return out
}

// ── KYC ─────────────────────────────────────────────────────────────────────
export async function startKyc(role, id, fields) {
  const res = await submitKyc(role, fields)
  if (!res.ok) throw new Error('Verification could not start. Try again.')
  set((d) => {
    const p = person(d, role, id)
    p.kyc = {
      status: res.status,
      region: fields.region,
      docType: fields.docType,
      docLast4: maskId(fields.docNumber),
      panLast4: role === 'editor' ? maskId(fields.pan) : undefined,
      upi: role === 'editor' ? fields.upi : undefined,
      legalName: fields.legalName.trim(),
      submittedAt: now(),
      providerRef: res.providerRef,
    }
  })
}

export const reviewKyc = (role, id, approve, note = '') =>
  set((d) => {
    const p = person(d, role, id)
    Object.assign(p.kyc, { status: approve ? 'verified' : 'rejected', reviewedAt: now(), note })
    if (approve && role === 'editor' && p.kyc.upi) p.upi = p.kyc.upi
  })

// ── Creator actions ─────────────────────────────────────────────────────────
export async function buyPack(creator, pack, region, method) {
  if (!isVerified(creator)) throw new Error('Complete KYC before buying credits.')
  const pay = await chargeForPack(pack, creator, region, method)
  if (!pay.ok) throw new Error('Payment did not complete')
  const isIn = REGIONS[region].currency === 'INR'
  set((d) =>
    d.ledger.push({
      id: nextId('L'),
      creatorId: creator.id,
      type: 'purchase',
      credits: packTotal(pack),
      currency: isIn ? 'INR' : 'USD',
      inr: isIn ? pack.priceInr : 0,
      usd: isIn ? 0 : pack.priceUsd,
      note: `Pack ${isIn ? '₹' + pack.priceInr : '$' + pack.priceUsd} · ${pay.method}`,
      ref: pay.paymentId,
      gateway: pay.gateway,
      at: now(),
    })
  )
  return pay
}

export function placeOrder({ creatorId, typeId, addons, title, brief, footage }) {
  const c = state.creators.find((x) => x.id === creatorId)
  if (!isVerified(c)) throw new Error('Complete KYC before placing an order.')
  const q = quote(typeId, addons)
  if (creditBalance(state, creatorId) < q.credits) throw new Error('Not enough credits')
  const id = `QC-${state.seq + 1}`
  set((d) => {
    d.seq += 1
    d.orders.unshift({
      id,
      creatorId,
      typeId,
      addons,
      title: title || editType(typeId).name,
      brief,
      footage: footage || 'raw_footage.mp4',
      status: 'paid',
      credits: q.credits,
      editorPayInr: q.editorPayInr,
      at: now(),
      dueAt: new Date(Date.now() + q.hours * 3600e3).toISOString(),
      revisions: 0,
      deliveryUrl: '',
      history: [{ status: 'paid', at: now() }],
    })
    d.ledger.push({ id: nextId('L'), creatorId, type: 'order', credits: -q.credits, note: `${id} · ${editType(typeId).name}`, at: now() })
  })
  return id
}

function move(d, orderId, status, patch = {}) {
  const o = d.orders.find((x) => x.id === orderId)
  Object.assign(o, patch, { status })
  o.history.push({ status, at: now() })
  return o
}

export const approveDelivery = (orderId, stars = 5) =>
  set((d) => {
    const o = move(d, orderId, 'completed', { stars })
    d.earnings.push({ id: nextId('E'), editorId: o.editorId, orderId, inr: o.editorPayInr, at: now() })
    const e = d.editors.find((x) => x.id === o.editorId)
    e.rating = Math.round(((e.rating * e.ratings + stars) / (e.ratings + 1)) * 10) / 10
    e.ratings += 1
  })

export const askRevision = (orderId, note) =>
  set((d) => {
    const o = move(d, orderId, 'revision', { revisionNote: note })
    o.revisions += 1
  })

export const requestDeletion = (creatorId) =>
  set((d) => {
    if (!d.deletions.some((x) => x.userId === creatorId && x.status === 'requested'))
      d.deletions.unshift({ id: nextId('D'), role: 'creator', userId: creatorId, status: 'requested', at: now() })
  })

// ── Editor actions ──────────────────────────────────────────────────────────
export function acceptJob(orderId, editorId) {
  const e = state.editors.find((x) => x.id === editorId)
  if (!isVerified(e)) throw new Error('Your KYC must be approved before you take jobs.')
  set((d) => move(d, orderId, 'editing', { editorId }))
}
export const deliverJob = (orderId, url) => set((d) => move(d, orderId, 'review', { deliveryUrl: url }))

export function requestPayout(editorId) {
  const e = state.editors.find((x) => x.id === editorId)
  if (!isVerified(e)) throw new Error('Complete KYC to receive payouts.')
  const m = editorMoney(state, editorId)
  if (m.available < PAYOUTS.minimumInr) throw new Error(`Minimum payout is ₹${PAYOUTS.minimumInr}`)
  set((d) => d.payouts.unshift({ id: nextId('P'), editorId, inr: m.available, status: 'requested', at: now() }))
}

// ── Admin actions ───────────────────────────────────────────────────────────
export const assignEditor = (orderId, editorId) => set((d) => move(d, orderId, 'editing', { editorId }))

export const refundOrder = (orderId, reason) =>
  set((d) => {
    const o = move(d, orderId, 'refunded', { refundReason: reason })
    d.ledger.push({ id: nextId('L'), creatorId: o.creatorId, type: 'refund', credits: o.credits, note: `${orderId} refund`, at: now() })
  })

export const grantCredits = (creatorId, credits, note) =>
  set((d) => d.ledger.push({ id: nextId('L'), creatorId, type: 'bonus', credits, note: note || 'Bonus from QuiCut', at: now() }))

export async function payPayout(payoutId) {
  const p = state.payouts.find((x) => x.id === payoutId)
  const editor = state.editors.find((e) => e.id === p.editorId)
  const res = await sendPayout(p, editor)
  if (!res.ok) throw new Error('Payout failed')
  set((d) => Object.assign(d.payouts.find((x) => x.id === payoutId), { status: 'paid', paidAt: now(), reference: res.reference }))
}

export const setEditorStatus = (editorId, status) =>
  set((d) => Object.assign(d.editors.find((e) => e.id === editorId), { status }))

export const completeDeletion = (deletionId) =>
  set((d) => {
    const del = d.deletions.find((x) => x.id === deletionId)
    const c = d.creators.find((x) => x.id === del.userId)
    Object.assign(c, { name: 'Deleted user', handle: '', phone: '', kyc: { status: 'deleted' }, deleted: true })
    Object.assign(del, { status: 'done', doneAt: now() })
  })
