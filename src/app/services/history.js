// Demo history: 45 days of believable activity so dashboards, trends and the Data Analyst
// have something to work with. Deterministic (seeded), so every visitor sees the same story.
// Replaced by real rows once the app moves to a database.
import { quote, editType, CREDIT_PACKS, packTotal } from '../config/pricing.js'

const DAY = 864e5

function rng(seed) {
  let s = seed % 2147483647
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const MORE_CREATORS = [
  ['Anusha Reddy', '@anusha.vlogs', 'Telugu', 'IN'],
  ['Vikram Singh', '@vikram_rides', 'Hindi', 'IN'],
  ['Sneha Iyer', '@snehacooks', 'Tamil', 'IN'],
  ['Rohit Verma', '@rohitplaysbgmi', 'Hindi', 'IN'],
  ['Lakshmi Devi', '@lakshmi_weddings', 'Telugu', 'IN'],
  ['Arjun Nair', '@arjunshorts', 'English', 'IN'],
  ['Meera Joshi', '@meerajourneys', 'Hindi', 'IN'],
  ['Karthik Rao', '@karthikfilms', 'Kannada', 'IN'],
  ['Sam Wilson', '@samtravels', 'English', 'GLOBAL'],
  ['Aisha Khan', '@aishaeats', 'English', 'GLOBAL'],
  ['Teja Varma', '@teja.tech', 'Telugu', 'IN'],
  ['Pooja Patel', '@poojastyle', 'Hindi', 'IN'],
]
const MORE_EDITORS = [
  { id: 'e4', name: 'Divya R.', city: 'Chennai', skills: ['wedding', 'cinematic', 'vlog'], upi: 'divya.r@okaxis' },
  { id: 'e5', name: 'Rahul M.', city: 'Bengaluru', skills: ['gaming', 'reel'], upi: 'rahulm@ybl' },
  { id: 'e6', name: 'Fatima S.', city: 'Hyderabad', skills: ['vlog', 'reel', 'cinematic'], upi: 'fatima.s@paytm' },
]
const TYPE_WEIGHTS = [
  ['reel', 0.34],
  ['vlog', 0.34],
  ['gaming', 0.16],
  ['cinematic', 0.09],
  ['wedding', 0.07],
]
const TITLES = {
  reel: ['Goa Sunset Reel', 'Street Food Reel', 'Outfit Transition', 'Temple Visit Short', 'Gym Day Reel'],
  vlog: ['Hampi Weekend Vlog', 'Day in My Life', 'Hyderabad Food Walk', 'Kerala Backwaters', 'New Phone Unboxing'],
  gaming: ['BGMI Clutch Montage', 'Free Fire Rank Push', 'GTA Funny Moments', 'Valorant Aces'],
  cinematic: ['Monsoon Film', 'Brand Story Film', 'Coorg Cinematic'],
  wedding: ['Sangeet Highlights', 'Engagement Teaser', 'Haldi Film'],
}
const ADDON_IDS = ['captions', 'thumb', 'express', 'motion']

export function addHistory(s, { verified, now = Date.now() }) {
  const R = rng(20261001)
  const pick = (arr) => arr[Math.floor(R() * arr.length)]
  const iso = (t) => new Date(t).toISOString()
  let n = 0

  // more people, joined over the period
  MORE_CREATORS.forEach(([name, handle, lang, region], i) => {
    const joinedDaysAgo = Math.round(44 - i * 3.2 - R() * 2)
    s.creators.push({
      id: `h${i + 1}`,
      name,
      handle,
      lang,
      region,
      phone: '',
      joined: iso(now - joinedDaysAgo * DAY),
      kyc: verified({ region, docType: region === 'IN' ? 'Aadhaar (DigiLocker)' : 'Passport', docLast4: '••••' + (1000 + Math.floor(R() * 8999)) }),
    })
  })
  MORE_EDITORS.forEach((e, i) => {
    s.editors.push({ ...e, rating: 0, ratings: 0, status: 'active', joined: iso(now - (40 - i * 9) * DAY), kyc: verified({ panLast4: '••••' + (100 + i) + 'Q' }) })
  })
  s.editors.forEach((e) => (e.joined = e.joined || iso(now - 45 * DAY)))

  const balance = {}
  const credit = (c, credits, at) => {
    const packs = CREDIT_PACKS.filter((p) => !p.period)
    const p = packs.find((x) => packTotal(x) >= credits) || packs[packs.length - 1]
    const isIn = c.region === 'IN'
    s.ledger.push({
      id: `L-h${++n}`,
      creatorId: c.id,
      type: 'purchase',
      credits: packTotal(p),
      currency: isIn ? 'INR' : 'USD',
      inr: isIn ? p.priceInr : 0,
      usd: isIn ? 0 : p.priceUsd,
      note: `Pack ${isIn ? '₹' + p.priceInr : '$' + p.priceUsd} · ${isIn ? pick(['UPI', 'UPI', 'Card', 'Netbanking']) : pick(['Apple Pay', 'Google Pay', 'Card'])}`,
      gateway: isIn ? 'razorpay' : 'stripe',
      at: iso(at),
    })
    balance[c.id] = (balance[c.id] || 0) + packTotal(p)
  }

  const pickType = () => {
    let x = R()
    for (const [id, w] of TYPE_WEIGHTS) if ((x -= w) <= 0) return id
    return 'vlog'
  }

  const stars = {}
  for (let d = 45; d >= 3; d--) {
    const dayStart = now - d * DAY
    const growth = (45 - d) / 42
    const count = Math.max(1, Math.round(2 + growth * 9 + (R() - 0.5) * 4 + (new Date(dayStart).getDay() % 6 === 0 ? 2 : 0)))
    for (let k = 0; k < count; k++) {
      const at = dayStart + (8 + R() * 14) * 3600e3
      const pool = s.creators.filter((c) => c.kyc?.status === 'verified' && new Date(c.joined).getTime() < at)
      if (!pool.length) continue
      const c = pick(pool)
      const typeId = pickType()
      const addons = ADDON_IDS.filter(() => R() < 0.18)
      const q = quote(typeId, addons)
      if ((balance[c.id] || 0) < q.credits) credit(c, q.credits - (balance[c.id] || 0), at - 3600e3 * (1 + R() * 20))
      balance[c.id] -= q.credits
      const editors = s.editors.filter((e) => e.kyc?.status === 'verified' && e.skills.includes(typeId) && new Date(e.joined).getTime() < at)
      const e = editors.length ? pick(editors) : s.editors[0]
      const took = q.hours * (0.45 + R() * 0.75)
      const doneAt = at + took * 3600e3
      const st = R() < 0.06 ? 3 : R() < 0.3 ? 4 : 5
      const revisions = R() < 0.18 ? 1 : 0
      const id = `QC-${500 + n}`
      s.orders.push({
        id,
        creatorId: c.id,
        typeId,
        addons,
        title: pick(TITLES[typeId]),
        brief: '',
        footage: 'raw_footage.mp4',
        status: 'completed',
        editorId: e.id,
        credits: q.credits,
        editorPayInr: q.editorPayInr,
        at: iso(at),
        dueAt: iso(at + q.hours * 3600e3),
        doneAt: iso(doneAt),
        revisions,
        stars: st,
        deliveryUrl: 'https://example.com/quicut-demo-delivery',
        history: [
          { status: 'paid', at: iso(at) },
          { status: 'completed', at: iso(doneAt) },
        ],
      })
      n++
      s.ledger.push({ id: `L-h${++n}`, creatorId: c.id, type: 'order', credits: -q.credits, note: `${id} · ${editType(typeId).name}`, at: iso(at) })
      s.earnings.push({ id: `E-h${n}`, editorId: e.id, orderId: id, inr: q.editorPayInr, at: iso(doneAt) })
      ;(stars[e.id] = stars[e.id] || []).push(st)
    }
  }

  // weekly payouts every Monday for what each editor had earned by then
  const paidTo = {}
  for (let d = 45; d >= 1; d--) {
    const t = now - d * DAY
    if (new Date(t).getDay() !== 1) continue
    for (const e of s.editors) {
      if (!e.upi) continue
      const earned = s.earnings.filter((x) => x.editorId === e.id && new Date(x.at).getTime() < t).reduce((a, x) => a + x.inr, 0)
      const due = earned - (paidTo[e.id] || 0)
      if (due >= 500) {
        s.payouts.push({ id: `P-h${++n}`, editorId: e.id, inr: due, status: 'paid', at: iso(t - 3 * 3600e3), paidAt: iso(t + 10 * 3600e3), reference: `rzpx_${(n * 7919).toString(36)}` })
        paidTo[e.id] = (paidTo[e.id] || 0) + due
      }
    }
  }

  // ratings follow the delivered work
  for (const e of s.editors) {
    const list = stars[e.id] || []
    if (!list.length) continue
    const total = e.rating * e.ratings + list.reduce((a, x) => a + x, 0)
    e.ratings += list.length
    e.rating = Math.round((total / e.ratings) * 10) / 10
  }
  s.orders.sort((a, b) => new Date(b.at) - new Date(a.at))
}
