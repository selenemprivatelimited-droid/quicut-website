// Live mode: real accounts on Supabase. Loads what the signed-in person may see (row-level
// security decides) and maps it to the same shape the demo store uses, so every screen works
// unchanged. All writes go through server functions (/rest/v1/rpc/...) that check permissions,
// balances and order status before anything changes.
import { rest, getSession, consumeLinkHash, signOut } from './supa.js'
import { maskId } from './kyc.js'

const STATUS = { placed: 'paid', assigned: 'editing', in_progress: 'editing', review: 'review', revision: 'revision', completed: 'completed', refunded: 'refunded', cancelled: 'refunded' }
const num = (v) => (v == null ? 0 : Number(v))

export const rpc = (fn, args = {}) => rest(`rpc/${fn}`, { method: 'POST', body: args })

/** Who is signed in, and do they have a QuiCut profile yet? */
export async function whoAmI() {
  await consumeLinkHash()
  const s = await getSession()
  if (!s) return null
  const uid = JSON.parse(atob(s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub
  const rows = await rest(`profiles?select=*&id=eq.${uid}`)
  return { uid, email: s.email, profile: rows?.[0] || null }
}

export async function createProfile(uid, f) {
  const body = { id: uid, role: f.role, full_name: f.name.trim().slice(0, 120), phone: (f.phone || '').trim().slice(0, 20) || null, region: f.region === 'GLOBAL' ? 'GLOBAL' : 'IN' }
  if (f.role === 'creator') Object.assign(body, { handle: (f.handle || '').trim().slice(0, 60) || null, lang: f.lang || null })
  else Object.assign(body, { city: (f.city || '').trim().slice(0, 60) || null, skills: f.skills || [] })
  await rest('profiles', { method: 'POST', body, prefer: 'return=minimal' })
}

export { signOut }

const person = (p) => ({
  id: p.id,
  name: p.full_name || 'QuiCut user',
  handle: p.handle || '',
  lang: p.lang || '',
  city: p.city || '',
  phone: p.phone || '',
  region: p.region,
  joined: p.created_at,
  skills: p.skills || [],
  upi: p.upi_id || '',
  rating: num(p.rating),
  ratings: p.ratings || 0,
  status: p.editor_status || 'active',
  deleted: p.full_name === 'Deleted user',
  kyc: {
    status: p.kyc_status,
    region: p.region,
    docType: p.kyc_doc_type,
    docLast4: p.kyc_doc_last4,
    panLast4: p.kyc_pan_last4,
    upi: p.kyc_upi,
    legalName: p.kyc_legal_name,
    note: p.kyc_note,
    submittedAt: p.kyc_submitted_at,
    reviewedAt: p.kyc_reviewed_at,
  },
})

/** Everything this account can see, in the demo store's shape. */
export async function fetchState() {
  const q = (path) => rest(path).catch(() => [])
  const [profiles, orders, ledger, payments, earnings, payouts, deletions, messages] = await Promise.all([
    q('profiles?select=*&order=created_at.desc&limit=2000'),
    q('orders?select=*&order=created_at.desc&limit=2000'),
    q('credit_ledger?select=*&order=created_at.asc&limit=5000'),
    q('payments?select=*&limit=5000'),
    q('earnings?select=*&order=created_at.asc&limit=5000'),
    q('payouts?select=*&order=requested_at.desc&limit=2000'),
    q('deletion_requests?select=*&order=created_at.desc&limit=500'),
    q('order_messages?select=*&order=created_at.asc&limit=5000'),
  ])
  const creators = new Map()
  const editors = new Map()
  for (const p of profiles) (p.role === 'creator' ? creators : editors).set(p.id, person(p))
  // People on the other side of an order: only the public details copied onto the order.
  for (const o of orders) {
    if (!creators.has(o.creator_id))
      creators.set(o.creator_id, { id: o.creator_id, name: o.creator_name || 'Creator', handle: o.creator_handle || '', lang: o.creator_lang || '', region: 'IN', kyc: { status: 'verified' }, skills: [] })
    if (o.editor_id && !editors.has(o.editor_id))
      editors.set(o.editor_id, { id: o.editor_id, name: o.editor_name || 'Editor', city: o.editor_city || '', rating: num(o.editor_rating), ratings: 0, skills: [], status: 'active', kyc: { status: 'verified' } })
  }
  const code = new Map(orders.map((o) => [o.id, o.code]))
  const msgs = new Map()
  for (const m of messages) {
    if (!msgs.has(m.order_id)) msgs.set(m.order_id, [])
    msgs.get(m.order_id).push({ from: m.sender_role, text: m.body, at: m.created_at })
  }
  const pay = new Map(payments.map((p) => [p.id, p]))
  return {
    live: true,
    seq: 0,
    creators: [...creators.values()],
    editors: [...editors.values()],
    orders: orders.map((o) => ({
      id: o.code,
      dbId: o.id,
      creatorId: o.creator_id,
      editorId: o.editor_id,
      typeId: o.edit_type,
      addons: o.addons || [],
      title: o.title || o.code,
      brief: o.brief_text || '',
      checklist: o.checklist,
      done: o.done || {},
      footage: o.footage || 'raw_footage.mp4',
      status: STATUS[o.status] || o.status,
      credits: o.credits,
      editorPayInr: num(o.editor_pay_inr),
      at: o.created_at,
      dueAt: o.deadline,
      doneAt: o.done_at,
      revisions: o.revisions || 0,
      revisionNote: o.revision_note,
      refundReason: o.refund_reason,
      stars: o.stars,
      deliveryUrl: o.delivery_url || '',
      history: o.history || [],
      messages: msgs.get(o.id) || [],
    })),
    ledger: ledger.map((l) => {
      const p = l.payment_id ? pay.get(l.payment_id) : null
      return {
        id: 'L' + l.id,
        creatorId: l.user_id,
        type: l.reason === 'adjustment' ? 'bonus' : l.reason,
        credits: l.delta,
        currency: p?.currency || 'INR',
        inr: p && p.currency === 'INR' ? num(p.amount) : 0,
        usd: p && p.currency === 'USD' ? num(p.amount) : 0,
        gateway: p?.provider,
        note: l.note || (l.reason === 'order' ? code.get(l.order_id) : l.reason),
        at: l.created_at,
      }
    }),
    earnings: earnings.map((e) => ({ id: 'E' + e.id, editorId: e.editor_id, orderId: code.get(e.order_id) || '', inr: num(e.amount_inr), at: e.created_at })),
    payouts: payouts.map((p) => ({ id: p.id, editorId: p.editor_id, inr: num(p.amount_inr), status: p.status === 'processing' ? 'requested' : p.status, at: p.requested_at, paidAt: p.paid_at, reference: p.reference })),
    deletions: deletions.map((d) => ({ id: d.id, role: 'creator', userId: d.user_id, status: d.status, at: d.created_at, doneAt: d.done_at })),
  }
}

// ── actions (each one is a checked server function) ──
export const placeOrder = (a) => rpc('place_order', { p_type: a.typeId, p_addons: a.addons || [], p_title: a.title || '', p_brief: a.brief || '', p_footage: a.footage || null, p_checklist: a.checklist || null })
export const acceptJob = (dbId) => rpc('accept_job', { p_order: dbId })
export const deliverJob = (dbId, url) => rpc('deliver_job', { p_order: dbId, p_url: url })
export const toggleStep = (dbId, key) => rpc('toggle_step', { p_order: dbId, p_key: key })
export const approveDelivery = (dbId, stars) => rpc('approve_delivery', { p_order: dbId, p_stars: stars })
export const askRevision = (dbId, note) => rpc('ask_revision', { p_order: dbId, p_note: note })
export const sendMessage = (dbId, text) => rpc('send_message', { p_order: dbId, p_body: text })
export const requestPayout = () => rpc('request_payout')
export const requestDeletion = () => rpc('request_deletion')
export const submitKyc = (f) =>
  rpc('submit_kyc', { p_region: f.region, p_doc_type: f.docType, p_doc_last4: maskId(f.docNumber), p_pan_last4: f.pan ? maskId(f.pan) : null, p_upi: f.upi || null, p_legal_name: f.legalName })
export const adminAssign = (dbId, editorId) => rpc('admin_assign', { p_order: dbId, p_editor: editorId })
export const adminRefund = (dbId, reason) => rpc('admin_refund', { p_order: dbId, p_reason: reason })
export const adminReviewKyc = (uid, approve, note) => rpc('admin_review_kyc', { p_user: uid, p_approve: approve, p_note: note || null })
export const adminGrant = (uid, credits, note) => rpc('admin_grant_credits', { p_user: uid, p_credits: credits, p_note: note })
export const adminPayPayout = (id, reference) => rpc('admin_pay_payout', { p_payout: id, p_reference: reference })
export const adminEditorStatus = (uid, status) => rpc('admin_set_editor_status', { p_user: uid, p_status: status })
export const adminCompleteDeletion = (id) => rpc('admin_complete_deletion', { p_request: id })
