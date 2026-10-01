//
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
//
import { useSyncExternalStore } from 'react'
import { quote, packTotal, editType, PAYOUTS, INR_PER_CREDIT, REGIONS } from '../config/pricing.js'
import { chargeForPack, sendPayout } from './payments.js'
import { submitKyc, maskId } from './kyc.js'
import { addHistory } from './history.js'
import * as live from './live.js'

const KEY = 'quicut-app-v3'
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
  addHistory(s, { verified })
  const buy = (creatorId, credits, inr, at) =>
    s.ledger.push({ id: `L-${s.ledger.length + 1}`, creatorId, type: 'purchase', credits, inr, currency: 'INR', note: `Pack ₹${inr} · UPI`, at })
  buy('c1', 2750, 2499, hoursAgo(90))
  buy('c2', 5750, 4999, hoursAgo(60))

  let live = 0
  const mk = (o) => {
    const q = quote(o.typeId, o.addons)
    const order = {
      id: `QC-${1040 + live++}`,
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
  done.doneAt = hoursAgo(62)
  done.deliveryUrl = 'https://example.com/quicut-demo-delivery'
  s.earnings.push({ id: 'E-1', editorId: 'e1', orderId: done.id, inr: done.editorPayInr, at: hoursAgo(60) })
  mk({ creatorId: 'c1', typeId: 'vlog', addons: ['captions'], title: 'Araku Valley Travel Vlog', status: 'editing', editorId: 'e2', at: hoursAgo(10), brief: 'Telugu lo edit cheyyandi. Warm colour grade, Telugu background music, forest part lo slow motion.' })
  mk({ creatorId: 'c2', typeId: 'reel', title: 'Ooty Trip Reel', status: 'paid', at: hoursAgo(14), brief: 'Cinematic golden tones, trending Insta BGM, 9:16.' })
  mk({ creatorId: 'c2', typeId: 'wedding', addons: ['thumb'], title: 'Kiran & Divya Wedding Teaser', status: 'paid', at: hoursAgo(1), brief: 'Emotional, slow motion on entry, Telugu songs.' })
  s.orders.sort((a, b) => new Date(b.at) - new Date(a.at))
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
export const resetDemo = () => (liveOn ? refreshLive() : set((d) => Object.assign(d, seed())))

// ── Live mode (real accounts on Supabase) ──
// Signed-in people see their real data; everyone else gets the demo above.
let liveOn = false
let poll = null
export const isLive = () => liveOn
let account = { status: 'demo' }
const accountListeners = new Set()
function setAccount(a) {
  account = a
  accountListeners.forEach((l) => l())
}
export function useAccount() {
  return useSyncExternalStore(
    (l) => (accountListeners.add(l), () => accountListeners.delete(l)),
    () => account
  )
}

export async function refreshLive() {
  const next = await live.fetchState()
  liveOn = true
  state = next
  listeners.forEach((l) => l())
}

function startPolling() {
  clearInterval(poll)
  poll = setInterval(() => {
    if (document.visibilityState === 'visible') refreshLive().catch(() => {})
  }, 20000)
}

/** On app load: pick up a sign-in link, then switch to live mode if the person has an account. */
export async function initAccount() {
  try {
    setAccount({ status: 'loading' })
    const who = await live.whoAmI()
    if (!who) return setAccount({ status: 'demo' })
    if (!who.profile) return setAccount({ status: 'onboard', uid: who.uid, email: who.email })
    await refreshLive()
    startPolling()
    setAccount({ status: 'live', uid: who.uid, email: who.email, role: who.profile.role })
  } catch (e) {
    setAccount({ status: 'demo', error: e.message })
  }
}

/** Admin panel: signed-in admins load everything row-level security lets them read. */
export async function enterAdminLive() {
  await refreshLive()
  startPolling()
}

export async function finishOnboarding(fields) {
  await live.createProfile(account.uid, fields)
  await initAccount()
}

export async function signOutAccount() {
  clearInterval(poll)
  await live.signOut()
  liveOn = false
  state = load()
  listeners.forEach((l) => l())
  setAccount({ status: 'demo' })
}

const dbId = (code) => state.orders.find((o) => o.id === code)?.dbId
async function liveDo(promise) {
  const out = await promise
  await refreshLive()
  return out
}

const person = (d, role, id) => (role === 'creator' ? d.creators : d.editors).find((p) => p.id === id)
export const isVerified = (p) => p?.kyc?.status === 'verified'

// ── Derived values ──
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
    const week = s.orders.filter((o) => o.editorId === e.id && t - new Date(o.at).getTime() < 7 * 864e5)
    const revs = week.reduce((a, o) => a + (o.revisions || 0), 0)
    if (revs >= 3 && revs / week.length >= 0.3)
      out.push({ kind: 'revisions', level: 'warn', editorId: e.id, text: `${e.name} had ${revs} revision requests on ${week.length} jobs this week`, action: 'Review recent deliveries.' })
  }
  const kycQueue = [...s.creators, ...s.editors].filter((p) => p.kyc?.status === 'pending').length
  if (kycQueue) out.push({ kind: 'kyc', level: 'warn', text: `${kycQueue} KYC ${kycQueue === 1 ? 'check' : 'checks'} waiting for review`, action: 'Approve or reject in People → KYC.' })
  return out
}

// ── KYC ──
export async function startKyc(role, id, fields) {
  if (liveOn) return liveDo(live.submitKyc(fields))
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

export const reviewKyc = async (role, id, approve, note = '') =>
  liveOn ? liveDo(live.adminReviewKyc(id, approve, note)) : set((d) => {
    const p = person(d, role, id)
    Object.assign(p.kyc, { status: approve ? 'verified' : 'rejected', reviewedAt: now(), note })
    if (approve && role === 'editor' && p.kyc.upi) p.upi = p.kyc.upi
  })

// ── Creator actions ──
export async function buyPack(creator, pack, region, method) {
  if (!isVerified(creator)) throw new Error('Complete KYC before buying credits.')
  if (liveOn) throw new Error('Online payments open soon. Message QuiCut on WhatsApp and we will add your credits.')
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

export async function placeOrder({ creatorId, typeId, addons, title, brief, footage, checklist }) {
  if (liveOn) return liveDo(live.placeOrder({ typeId, addons, title, brief, footage, checklist }))
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
      checklist: checklist || null,
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

export const approveDelivery = async (orderId, stars = 5) =>
  liveOn ? liveDo(live.approveDelivery(dbId(orderId), stars)) : set((d) => {
    const o = move(d, orderId, 'completed', { stars, doneAt: now() })
    d.earnings.push({ id: nextId('E'), editorId: o.editorId, orderId, inr: o.editorPayInr, at: now() })
    const e = d.editors.find((x) => x.id === o.editorId)
    e.rating = Math.round(((e.rating * e.ratings + stars) / (e.ratings + 1)) * 10) / 10
    e.ratings += 1
  })

export const askRevision = async (orderId, note) =>
  liveOn ? liveDo(live.askRevision(dbId(orderId), note)) : set((d) => {
    const o = move(d, orderId, 'revision', { revisionNote: note })
    o.revisions += 1
  })

export const requestDeletion = async (creatorId) =>
  liveOn ? liveDo(live.requestDeletion()) : set((d) => {
    if (!d.deletions.some((x) => x.userId === creatorId && x.status === 'requested'))
      d.deletions.unshift({ id: nextId('D'), role: 'creator', userId: creatorId, status: 'requested', at: now() })
  })

// ── Shared: order messages + editor checklist ──
export const sendMessage = async (orderId, from, text) =>
  liveOn ? liveDo(live.sendMessage(dbId(orderId), text)) : set((d) => {
    const o = d.orders.find((x) => x.id === orderId)
    o.messages = [...(o.messages || []), { from, text: String(text).slice(0, 1000), at: now() }]
  })

export const toggleStep = async (orderId, key) =>
  liveOn ? liveDo(live.toggleStep(dbId(orderId), key)) : set((d) => {
    const o = d.orders.find((x) => x.id === orderId)
    o.done = { ...(o.done || {}), [key]: !(o.done || {})[key] }
  })

// ── Editor actions ──
export async function acceptJob(orderId, editorId) {
  if (liveOn) return liveDo(live.acceptJob(dbId(orderId)))
  const e = state.editors.find((x) => x.id === editorId)
  if (!isVerified(e)) throw new Error('Your KYC must be approved before you take jobs.')
  set((d) => move(d, orderId, 'editing', { editorId }))
}
export const deliverJob = async (orderId, url) =>
  liveOn ? liveDo(live.deliverJob(dbId(orderId), url)) : set((d) => move(d, orderId, 'review', { deliveryUrl: url }))

export async function requestPayout(editorId) {
  if (liveOn) return liveDo(live.requestPayout())
  const e = state.editors.find((x) => x.id === editorId)
  if (!isVerified(e)) throw new Error('Complete KYC to receive payouts.')
  const m = editorMoney(state, editorId)
  if (m.available < PAYOUTS.minimumInr) throw new Error(`Minimum payout is ₹${PAYOUTS.minimumInr}`)
  set((d) => d.payouts.unshift({ id: nextId('P'), editorId, inr: m.available, status: 'requested', at: now() }))
}

// ── Admin actions ──
export const assignEditor = async (orderId, editorId) =>
  liveOn ? liveDo(live.adminAssign(dbId(orderId), editorId)) : set((d) => move(d, orderId, 'editing', { editorId }))

export const refundOrder = async (orderId, reason) =>
  liveOn ? liveDo(live.adminRefund(dbId(orderId), reason)) : set((d) => {
    const o = move(d, orderId, 'refunded', { refundReason: reason })
    d.ledger.push({ id: nextId('L'), creatorId: o.creatorId, type: 'refund', credits: o.credits, note: `${orderId} refund`, at: now() })
  })

export const grantCredits = async (creatorId, credits, note) =>
  liveOn ? liveDo(live.adminGrant(creatorId, credits, note)) : set((d) => d.ledger.push({ id: nextId('L'), creatorId, type: 'bonus', credits, note: note || 'Bonus from QuiCut', at: now() }))

export async function payPayout(payoutId, reference) {
  if (liveOn) return liveDo(live.adminPayPayout(payoutId, reference))
  const p = state.payouts.find((x) => x.id === payoutId)
  const editor = state.editors.find((e) => e.id === p.editorId)
  const res = await sendPayout(p, editor)
  if (!res.ok) throw new Error('Payout failed')
  set((d) => Object.assign(d.payouts.find((x) => x.id === payoutId), { status: 'paid', paidAt: now(), reference: res.reference }))
}

export const setEditorStatus = async (editorId, status) =>
  liveOn ? liveDo(live.adminEditorStatus(editorId, status)) : set((d) => Object.assign(d.editors.find((e) => e.id === editorId), { status }))

export const completeDeletion = async (deletionId) =>
  liveOn ? liveDo(live.adminCompleteDeletion(deletionId)) : set((d) => {
    const del = d.deletions.find((x) => x.id === deletionId)
    const c = d.creators.find((x) => x.id === del.userId)
    Object.assign(c, { name: 'Deleted user', handle: '', phone: '', kyc: { status: 'deleted' }, deleted: true })
    Object.assign(del, { status: 'done', doneAt: now() })
  })
