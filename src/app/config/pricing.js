// ─────────────────────────────────────────────────────────────────────────────
// QuiCut money settings. Change numbers here; every screen reads from this file.
//
// Creators pay with QuiCut Credits (QC), bought in packs like UC in BGMI.
// Editors are paid in rupees per finished video, every week by UPI.
// ─────────────────────────────────────────────────────────────────────────────

export const CREDIT = { name: 'QuiCut Credits', short: 'QC' }

// PLACEHOLDER PACKS: replace with the founder's final packs.
// priceInr is charged through Razorpay (India), priceUsd through Stripe (rest of world).
export const PACKS_ARE_PLACEHOLDER = true
export const CREDIT_PACKS = [
  { id: 'starter', priceInr: 299, priceUsd: 4.99, credits: 300, bonus: 0 },
  { id: 'creator', priceInr: 999, priceUsd: 14.99, credits: 1000, bonus: 50, tag: 'Popular' },
  { id: 'pro', priceInr: 2499, priceUsd: 34.99, credits: 2500, bonus: 250 },
  { id: 'studio', priceInr: 4999, priceUsd: 64.99, credits: 5000, bonus: 750, tag: 'Best value' },
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
  region === 'IN' ? '₹' + p.priceInr.toLocaleString('en-IN') : '$' + p.priceUsd.toFixed(2)
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
