// ─────────────────────────────────────────────────────────────────────────────
// QuiCut money settings. Change numbers here; every screen reads from this file.
//
// Creators pay with QuiCut Credits (QC), bought in packs like UC in BGMI.
// Editors are paid in rupees per finished video, every week by UPI.
// ─────────────────────────────────────────────────────────────────────────────

export const CREDIT = { name: 'QuiCut Credits', short: 'QC' }

// Credit packs, built from the Final Pricing Model v2.0 edit prices and the QuiCut Pro plan
// in the 7-month plan (Rs 1,599 a month for 4 edits with a priority queue).
// priceInr is charged through Razorpay (India), priceUsd through Stripe (rest of world).
// `fits` is shown on the pack so creators see what the credits buy.
export const PACKS_ARE_PLACEHOLDER = false
export const CREDIT_PACKS = [
  { id: 'reel', name: 'Single Reel', priceInr: 299, priceUsd: 3.99, credits: 299, bonus: 0, fits: '1 Reel / Short' },
  { id: 'starter', name: 'Starter', priceInr: 999, priceUsd: 12.99, credits: 999, bonus: 50, fits: '2 Standard Vlogs' },
  {
    id: 'pro',
    name: 'QuiCut Pro',
    priceInr: 1599,
    priceUsd: 19.99,
    credits: 1599,
    bonus: 397,
    period: 'month',
    tag: 'Pro · monthly',
    fits: '4 Standard Vlogs a month + priority queue',
  },
  { id: 'creator', name: 'Creator', priceInr: 2499, priceUsd: 29.99, credits: 2499, bonus: 250, tag: 'Popular', fits: '5 Vlogs or 1 Wedding edit' },
  { id: 'studio', name: 'Studio', priceInr: 4999, priceUsd: 59.99, credits: 4999, bonus: 750, tag: 'Best value', fits: '11 Vlogs or 7 Gaming montages' },
]

// Where the creator pays from decides the gateway, currency and methods.
export const REGIONS = {
  IN: {
    label: 'India',
    currency: 'INR',
    gateway: 'razorpay',
    methods: ['UPI · Google Pay, PhonePe, Paytm', 'Debit / credit card · RuPay, Visa, Mastercard', 'Netbanking'],
  },
  GLOBAL: {
    label: 'Outside India',
    currency: 'USD',
    gateway: 'stripe',
    methods: ['Apple Pay', 'Google Pay', 'Card · Visa, Mastercard, Amex'],
  },
}
export const packPrice = (p, region) =>
  (region === 'IN' ? '₹' + p.priceInr.toLocaleString('en-IN') : '$' + p.priceUsd.toFixed(2)) + (p.period === 'month' ? '/mo' : '')
export function guessRegion() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    return tz === 'Asia/Calcutta' || tz === 'Asia/Kolkata' ? 'IN' : 'GLOBAL'
  } catch {
    return 'IN'
  }
}

// What each edit costs the creator (credits) and pays the editor (₹ per video).
// Rupee prices + editor share follow the Final Pricing Model v2.0 (80/20 split).
export const EDIT_TYPES = [
  { id: 'reel', name: 'Reel / Short', credits: 299, editorPayInr: 239, delivery: 'Same day', hours: 12, output: 'Up to 90 sec' },
  { id: 'vlog', name: 'Standard Vlog', credits: 499, editorPayInr: 399, delivery: '24 hours', hours: 24, output: '5–12 min' },
  { id: 'gaming', name: 'Gaming Montage', credits: 799, editorPayInr: 639, delivery: '24 hours', hours: 24, output: '3–8 min' },
  { id: 'cinematic', name: 'Premium Cinematic', credits: 1199, editorPayInr: 959, delivery: '48 hours', hours: 48, output: '8–20 min' },
  { id: 'wedding', name: 'Wedding / Event', credits: 2499, editorPayInr: 1999, delivery: '3 days', hours: 72, output: '5–15 min' },
]

export const ADDONS = [
  { id: 'express', name: 'Express 12-hour', credits: 199, editorPayInr: 159 },
  { id: 'captions', name: 'Subtitles / captions', credits: 99, editorPayInr: 79 },
  { id: 'thumb', name: 'Thumbnail design', credits: 199, editorPayInr: 159 },
  { id: 'motion', name: 'Motion graphics pack', credits: 349, editorPayInr: 279 },
  { id: 'revision', name: 'Extra revision', credits: 149, editorPayInr: 119 },
  { id: 'raw', name: 'Raw project files', credits: 49, editorPayInr: 39 },
]

export const PAYOUTS = {
  schedule: 'Every Monday',
  method: 'UPI',
  minimumInr: 500,
  tdsThresholdInrPerYear: 30000, // TDS 10% above this (Sec 194J/194C, confirm with CA)
}

// Value of one credit in rupees, used for revenue reports.
export const INR_PER_CREDIT = 1

export const packTotal = (p) => p.credits + (p.bonus || 0)
export const editType = (id) => EDIT_TYPES.find((t) => t.id === id)
export const addon = (id) => ADDONS.find((a) => a.id === id)

export function quote(typeId, addonIds = []) {
  const t = editType(typeId)
  const adds = addonIds.map(addon).filter(Boolean)
  return {
    credits: t.credits + adds.reduce((s, a) => s + a.credits, 0),
    editorPayInr: t.editorPayInr + adds.reduce((s, a) => s + a.editorPayInr, 0),
    hours: addonIds.includes('express') ? 12 : t.hours,
  }
}
