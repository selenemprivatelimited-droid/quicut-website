// QuiCut AI: every AI feature in the app calls through here.
// Live: the Cloudflare Worker at api.quicutapp.com (Workers AI, source in workers/ai/worker.js).
// If it can't be reached, each function falls back to simple built-in rules, so screens never break.
import { EDIT_TYPES, ADDONS, editType, addon, CREDIT_PACKS, packTotal, PAYOUTS } from '../config/pricing.js'
import { BRIEF_RULES } from '../../content.js'
import { creditBalance, editorMoney, platformStats, alerts } from './store.js'

export const AI_URL = (typeof window !== 'undefined' && window.QUICUT_AI_URL) || 'https://api.quicutapp.com'

const CATALOG = {
  types: EDIT_TYPES.map(({ id, name, credits, output, delivery }) => ({ id, name, credits, output, delivery })),
  addons: ADDONS.map(({ id, name, credits }) => ({ id, name, credits })),
}

async function call(task, body, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const r = await fetch(`${AI_URL}/v1/${task}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok || data.error) throw new Error(data.error || `AI error ${r.status}`)
    return { ...data, source: 'ai' }
  } finally {
    clearTimeout(timer)
  }
}

const arr = (x) => (Array.isArray(x) ? x : [])
const str = (x) => (typeof x === 'string' ? x : x == null ? '' : String(x))

// ---------- creator: brief agent ----------
function localBrief(text) {
  const t = text.toLowerCase()
  const tags = []
  for (const r of BRIEF_RULES) {
    if (!r.words.some((w) => t.includes(w))) continue
    if (r.tag === 'Background music' && tags.some((x) => x.tag.endsWith('music'))) continue
    tags.push(r)
  }
  const type = /wedding|pelli|shaadi/.test(t)
    ? 'wedding'
    : /bgmi|gaming|montage|free fire|pubg/.test(t)
      ? 'gaming'
      : /cinematic|film/.test(t)
        ? 'cinematic'
        : /reel|short|9:16|vertical/.test(t)
          ? 'reel'
          : 'vlog'
  const lang = /[ఀ-౿]|cheyyandi|pettandi|lo |kavali/.test(t) ? 'Telugu' : /[ऀ-ॿ]|karo|chahiye|mein/.test(t) ? 'Hindi' : 'English'
  return {
    language: lang,
    summary: tags.length ? `Edit with: ${tags.map((x) => x.tag.toLowerCase()).join(', ')}.` : 'No clear instructions found. Follow the tier defaults.',
    checklist: tags.map((x) => ({ item: x.tag, detail: '' })),
    suggestedType: type,
    suggestedAddons: /caption|subtitle/.test(t) ? ['captions'] : [],
    questions: [],
    source: 'rules',
  }
}

export async function aiBrief(text) {
  try {
    const r = await call('brief', { text, catalog: CATALOG })
    return {
      language: str(r.language),
      summary: str(r.summary),
      checklist: arr(r.checklist).map((c) => (typeof c === 'string' ? { item: c, detail: '' } : { item: str(c.item), detail: str(c.detail) })).filter((c) => c.item),
      suggestedType: editType(r.suggestedType) ? r.suggestedType : localBrief(text).suggestedType,
      suggestedAddons: arr(r.suggestedAddons).filter((a) => addon(a)),
      questions: arr(r.questions).map(str).filter(Boolean),
      source: 'ai',
    }
  } catch {
    return localBrief(text)
  }
}

// ---------- editor: explain a job, draft a reply ----------
const orderFacts = (o, creator, dueText) => ({
  title: o.title,
  type: editType(o.typeId).name,
  output: editType(o.typeId).output,
  addons: o.addons.map((a) => addon(a).name),
  due: dueText,
  lang: creator?.lang || '',
  brief: o.brief || '',
  revisionNote: o.status === 'revision' ? o.revisionNote : '',
})

export async function aiExplain(o, creator, dueText) {
  try {
    const r = await call('explain', { order: orderFacts(o, creator, dueText) })
    return { english: str(r.english), steps: arr(r.steps).map(str).filter(Boolean), watchOut: arr(r.watchOut).map(str).filter(Boolean), source: 'ai' }
  } catch {
    const b = localBrief(o.brief || '')
    return {
      english: o.brief || 'No brief written. Follow the tier defaults.',
      steps: [
        `Download the footage and check it covers a ${editType(o.typeId).name} (${editType(o.typeId).output}).`,
        ...b.checklist.map((c) => c.item),
        ...o.addons.map((a) => `Add-on: ${addon(a).name}`),
        'Export, upload to Drive or R2, and submit the delivery link.',
      ],
      watchOut: o.status === 'revision' && o.revisionNote ? [`Revision: ${o.revisionNote}`] : [],
      source: 'rules',
    }
  }
}

export async function aiReply(o, creator, dueText, note, intent) {
  try {
    const r = await call('reply', { order: orderFacts(o, creator, dueText), note, intent })
    return { reply: str(r.reply), source: 'ai' }
  } catch {
    return {
      reply: `Hi ${creator?.name?.split(' ')[0] || 'there'}, thanks for the note on "${o.title}". ${intent || "I'm on it and will share the update"} before the deadline.`,
      source: 'rules',
    }
  }
}

// ---------- admin: ops brief ----------
export function opsSnapshot(s) {
  const k = platformStats(s)
  const name = (arr2, id) => arr2.find((x) => x.id === id)?.name
  return {
    now: new Date().toISOString(),
    stats: k,
    alerts: alerts(s).map((a) => a.text),
    orders: s.orders.slice(-25).map((o) => ({
      id: o.id,
      title: o.title,
      type: o.typeId,
      status: o.status,
      creator: name(s.creators, o.creatorId),
      editor: name(s.editors, o.editorId) || null,
      dueAt: o.dueAt,
      placedAt: o.at,
      revisions: o.revisions || 0,
      stars: o.stars || null,
      credits: o.credits,
    })),
    editors: s.editors.map((e) => ({ name: e.name, status: e.status, kyc: e.kyc?.status || 'none', rating: e.rating, ratings: e.ratings, ...editorMoney(s, e.id) })),
    creators: s.creators.map((c) => ({ name: c.name, region: c.region, kyc: c.kyc?.status || 'none', credits: creditBalance(s, c.id) })),
    payoutsRequested: s.payouts.filter((p) => p.status === 'requested').map((p) => ({ editor: name(s.editors, p.editorId), inr: p.inr })),
    deletionRequests: s.deletions.filter((d) => d.status === 'requested').length,
  }
}

export async function aiOps(s) {
  try {
    const r = await call('ops', { snapshot: opsSnapshot(s) }, 40000)
    return {
      headline: str(r.headline),
      items: arr(r.items).map((i) => ({ level: ['urgent', 'soon', 'fyi'].includes(i.level) ? i.level : 'fyi', text: str(i.text), action: str(i.action) })),
      numbers: str(r.numbers),
      source: 'ai',
    }
  } catch {
    const al = alerts(s)
    const k = platformStats(s)
    return {
      headline: al.length ? `${al.length} thing${al.length > 1 ? 's' : ''} need attention today.` : 'All clear today.',
      items: al.map((a) => ({ level: a.level === 'bad' ? 'urgent' : 'soon', text: a.text, action: a.action })),
      numbers: `Cash in ₹${Math.round(k.cashInInr).toLocaleString('en-IN')} · GMV ₹${Math.round(k.gmv).toLocaleString('en-IN')} · ${k.open} waiting, ${k.active} in progress`,
      source: 'rules',
    }
  }
}

// ---------- chat assistant (all roles) ----------
export function chatContext(role, s, ids) {
  if (role === 'creator') {
    const me = s.creators.find((c) => c.id === ids.creatorId)
    return {
      me: { name: me.name, handle: me.handle, language: me.lang, region: me.region, kyc: me.kyc?.status || 'none' },
      balanceCredits: creditBalance(s, me.id),
      orders: s.orders.filter((o) => o.creatorId === me.id).map((o) => ({ id: o.id, title: o.title, type: editType(o.typeId).name, status: o.status, credits: o.credits, dueAt: o.dueAt })),
      editTypes: CATALOG.types,
      addons: CATALOG.addons,
      packs: CREDIT_PACKS.map((p) => ({ name: p.name, priceInr: p.priceInr, priceUsd: p.priceUsd, credits: packTotal(p), monthly: p.period === 'month', fits: p.fits })),
    }
  }
  if (role === 'editor') {
    const me = s.editors.find((e) => e.id === ids.editorId)
    return {
      me: { name: me.name, city: me.city, skills: me.skills, rating: me.rating, ratings: me.ratings, kyc: me.kyc?.status || 'none', upi: me.upi || null },
      money: editorMoney(s, me.id),
      payouts: PAYOUTS,
      myJobs: s.orders.filter((o) => o.editorId === me.id).map((o) => ({ id: o.id, title: o.title, type: editType(o.typeId).name, status: o.status, payInr: o.editorPayInr, dueAt: o.dueAt, revisionNote: o.revisionNote || null })),
      openJobs: s.orders.filter((o) => o.status === 'paid').map((o) => ({ id: o.id, title: o.title, type: editType(o.typeId).name, payInr: o.editorPayInr, dueAt: o.dueAt })),
      payPerVideo: EDIT_TYPES.map((t) => ({ type: t.name, payInr: t.editorPayInr })),
    }
  }
  return opsSnapshot(s)
}

const FAQ_LOCAL = [
  [/credit|pack|buy|uc|top ?up/, 'Credits (QC) pay for edits: 1 credit = ₹1. Buy a pack in Wallet with UPI, card or netbanking (India) or Apple Pay / Google Pay (abroad). Bigger packs include bonus credits.'],
  [/kyc|verify|aadhaar|pan|passport/, 'KYC is needed before money moves. Open Profile → Start KYC, add your ID, a selfie, and (for editors) PAN and UPI. It is usually reviewed within a few hours.'],
  [/payout|paid|upi|monday|withdraw/, 'Editors are paid every Monday by UPI once the available balance is at least ₹500. Request a payout from the Earnings tab.'],
  [/revision|change|fix/, 'Every order includes one free revision. Open the order, write what to change, and send it to your editor.'],
  [/price|cost|how much|tier|reel|vlog|wedding|gaming|cinematic/, `Edits: ${EDIT_TYPES.map((t) => `${t.name} ${t.credits} QC`).join(', ')}. Add-ons like captions or express delivery cost extra.`],
  [/delete|account/, 'You can request account deletion from Profile. Data and footage are removed within 30 days.'],
]

export async function aiChat(role, messages, context) {
  try {
    const r = await call('chat', { role, messages, context })
    return { reply: str(r.reply), source: 'ai' }
  } catch {
    const q = (messages[messages.length - 1]?.content || '').toLowerCase()
    const hit = FAQ_LOCAL.find(([re]) => re.test(q))
    return {
      reply: hit ? hit[1] : "The AI assistant is offline right now. Try again in a minute, or check the Wallet, Orders and Profile tabs.",
      source: 'rules',
    }
  }
}
