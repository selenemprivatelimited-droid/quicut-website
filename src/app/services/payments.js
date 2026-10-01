// ─────────────────────────────────────────────────────────────────────────────
// Payments: the single place money moves. Every screen calls these functions,
// so switching from demo to real payments only touches this file.
//
// Today: MODE = 'demo' — purchases and payouts are simulated, nothing is charged.
//
// Creators in India  → Razorpay (INR): UPI (Google Pay / PhonePe / Paytm), cards, netbanking
//   1. Backend  POST /api/credits/order {packId, region:'IN'} → Razorpay Order (amount in paise)
//   2. Browser  Razorpay Checkout with that order_id (script: checkout.razorpay.com/v1/checkout.js)
//   3. Backend  verify HMAC-SHA256(order_id|payment_id, key_secret) → add credits to the ledger
//               + handle the payment.captured webhook (source of truth)
//
// Creators abroad    → Stripe (USD): Apple Pay, Google Pay, cards
//   1. Backend  POST /api/credits/intent {packId, region:'GLOBAL'} → Stripe PaymentIntent
//   2. Browser  Stripe Payment Element / Express Checkout Element (shows Apple Pay & Google Pay
//               automatically on supported devices; Apple Pay needs the domain verified in Stripe)
//   3. Backend  webhook payment_intent.succeeded → add credits to the ledger
//
// Editors            → paid per finished video, weekly
//   India:  RazorpayX Payouts → UPI / bank (needs approved KYC + verified UPI)
//   Abroad: Stripe Connect Express payouts (later)
//
// Secret keys live only on the backend. The browser only ever sees public keys.
// ─────────────────────────────────────────────────────────────────────────────
import { REGIONS } from '../config/pricing.js'

export const MODE = 'demo' // 'live' once the backend endpoints exist
export const PUBLIC_KEYS = { razorpay: '', stripe: '' }

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const ref = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Charge a creator for a credit pack. Returns { ok, paymentId, method, gateway }. */
export async function chargeForPack(pack, creator, region, method) {
  const gateway = REGIONS[region].gateway
  if (MODE === 'demo') {
    await wait(800)
    return { ok: true, paymentId: ref(`${gateway}_demo`), method: `${method} (demo)`, gateway }
  }
  if (gateway === 'razorpay') return razorpayCharge(pack, creator)
  return stripeCharge(pack, creator)
}

/** Send an editor's weekly payout. Returns { ok, reference }. */
export async function sendPayout(payout, editor) {
  if (MODE === 'demo') {
    await wait(600)
    return { ok: true, reference: ref('payout_demo'), to: editor.upi }
  }
  const res = await post('/api/payouts/send', { payoutId: payout.id })
  return { ok: res.ok, reference: res.reference, to: editor.upi }
}

// ── live implementations (used when MODE === 'live') ─────────────────────────────────
async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`Payment server error ${r.status}`)
  return r.json()
}

async function razorpayCharge(pack, creator) {
  const order = await post('/api/credits/order', { packId: pack.id, creatorId: creator.id, region: 'IN' })
  const paid = await new Promise((resolve, reject) => {
    if (!window.Razorpay) return reject(new Error('Razorpay is still loading. Try again.'))
    new window.Razorpay({
      key: PUBLIC_KEYS.razorpay,
      order_id: order.id,
      amount: order.amount,
      currency: 'INR',
      name: 'QuiCut',
      description: order.description,
      prefill: { name: creator.name, contact: creator.phone },
      theme: { color: '#E8281E' },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    }).open()
  })
  const v = await post('/api/credits/verify', paid)
  return { ok: v.ok, paymentId: paid.razorpay_payment_id, method: 'Razorpay', gateway: 'razorpay' }
}

async function stripeCharge(pack, creator) {
  // The Wallet screen mounts Stripe's Express Checkout Element (Apple Pay / Google Pay)
  // with this client secret; confirmation happens in Stripe's UI, credits land via webhook.
  const intent = await post('/api/credits/intent', { packId: pack.id, creatorId: creator.id, region: 'GLOBAL' })
  if (!window.Stripe) throw new Error('Stripe is still loading. Try again.')
  const stripe = window.Stripe(PUBLIC_KEYS.stripe)
  const { error } = await stripe.confirmPayment({ clientSecret: intent.clientSecret, redirect: 'if_required' })
  if (error) throw new Error(error.message)
  return { ok: true, paymentId: intent.id, method: 'Stripe', gateway: 'stripe' }
}
