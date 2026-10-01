// QuiCut AI: a small Cloudflare Worker that gives the app its AI features.
// Runs on Workers AI (binding "AI"), so there is no API key to manage.
// Deployed at https://api.quicutapp.com
//
//   GET  /v1/health                         -> { ok, model }
//   POST /v1/brief    { text, catalog }      -> brief agent: language, English summary, checklist, suggested tier/add-ons
//   POST /v1/explain  { order, catalog }     -> editor job explainer: clear English steps
//   POST /v1/reply    { note, order, tone }  -> drafts an editor's reply to a creator
//   POST /v1/ops      { snapshot }           -> admin ops brief from a data snapshot
//   POST /v1/chat     { role, messages, context } -> role-aware assistant (creator / editor / admin)

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'
const ALLOWED_ORIGINS = [
  'https://quicutapp.com',
  'https://www.quicutapp.com',
  'https://selenemprivatelimited-droid.github.io',
  'http://localhost:5173',
  'http://localhost:8790',
]
const MAX_BODY = 16000 // bytes
const RATE = { windowMs: 60000, max: 30 } // per IP, per isolate

const ABOUT = `QuiCut is an Indian video-editing marketplace. Creators upload raw footage, write a brief in Telugu, Hindi or English,
and a verified editor delivers a finished edit (most in 24 hours). Creators pay with QuiCut Credits (QC, 1 QC = Rs 1), bought in packs
through Razorpay (India: UPI, cards, netbanking) or Stripe (abroad: Apple Pay, Google Pay, cards). Editors earn a fixed amount per video
(80% of the price), paid every Monday by UPI (minimum Rs 500). Every order includes one free revision. KYC is required for everyone
before money moves. Account deletion is completed within 30 days (DPDP Act).`

const hits = new Map()

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (data, status, origin) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(origin) } })

function limited(ip) {
  const now = Date.now()
  const h = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs)
  h.push(now)
  hits.set(ip, h)
  return h.length > RATE.max
}

const clip = (s, n) => String(s ?? '').slice(0, n)

async function run(env, messages, { maxTokens = 600, jsonMode = false } = {}) {
  const opts = { messages, max_tokens: maxTokens, temperature: 0.3 }
  if (jsonMode) opts.response_format = { type: 'json_object' }
  let out
  try {
    out = await env.AI.run(MODEL, opts)
  } catch (e) {
    delete opts.response_format
    out = await env.AI.run(FALLBACK_MODEL, opts)
  }
  const r = out?.response
  return typeof r === 'string' ? r : JSON.stringify(r ?? '')
}

function parseJson(text) {
  if (text && typeof text === 'object') return text
  try {
    return JSON.parse(text)
  } catch {
    const m = String(text).match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0])
      } catch {}
    }
  }
  return null
}

function catalogText(catalog) {
  const t = (catalog?.types || []).map((x) => `${x.id}: ${x.name}, ${x.credits} QC, ${x.output}, ${x.delivery}`).join('\n')
  const a = (catalog?.addons || []).map((x) => `${x.id}: ${x.name}, +${x.credits} QC`).join('\n')
  return `Edit tiers:\n${t}\nAdd-ons:\n${a}`
}

// ---------- tasks ----------
async function brief(env, body) {
  const text = clip(body.text, 2500)
  if (!text.trim()) return { error: 'Write a brief first.' }
  const sys = `${ABOUT}
You are QuiCut's brief agent. A creator wrote an editing brief, possibly in Telugu, Hindi, English, or a mix written in English letters.
Read it and return ONLY a JSON object with these keys:
"language": the language(s) the brief is written in, e.g. "Telugu (in English letters)",
"summary": one or two plain English sentences an editor can act on,
"checklist": array of 3 to 8 objects {"item": short instruction for the editor, "detail": optional extra detail}, covering colour grade, music, pacing, text, captions, format, and anything else asked,
"suggestedType": the best tier id from the list,
"suggestedAddons": array of add-on ids the brief clearly asks for (may be empty),
"questions": array of 0 to 3 short questions to ask the creator if something important is missing.
Only use tier and add-on ids from this list:
${catalogText(body.catalog)}`
  const raw = await run(env, [
    { role: 'system', content: sys },
    { role: 'user', content: text },
  ], { maxTokens: 700, jsonMode: true })
  const j = parseJson(raw)
  if (!j) return { error: 'The AI answer could not be read. Try again.' }
  return j
}

async function explain(env, body) {
  const o = body.order || {}
  const sys = `${ABOUT}
You help a QuiCut video editor. Turn this order into a clear plan in simple English. Translate anything not in English.
Return ONLY JSON: {"english": "the brief in plain English", "steps": ["step 1", "step 2", ...] (4 to 8 steps, in working order),
"watchOut": ["things that are easy to miss", ...] (0 to 3 items)}.`
  const user = `Edit: ${clip(o.type, 80)} (${clip(o.output, 40)}). Add-ons: ${clip((o.addons || []).join(', '), 200)}.
Deadline: ${clip(o.due, 60)}. Creator language: ${clip(o.lang, 40)}.
Brief: ${clip(o.brief, 2000) || '(none, follow the tier defaults)'}
${o.revisionNote ? 'Revision requested: ' + clip(o.revisionNote, 600) : ''}`
  const j = parseJson(await run(env, [{ role: 'system', content: sys }, { role: 'user', content: user }], { maxTokens: 700, jsonMode: true }))
  return j || { error: 'The AI answer could not be read. Try again.' }
}

async function reply(env, body) {
  const sys = `${ABOUT}
You draft a short, friendly, professional message from a QuiCut editor to a creator. Match the creator's language if they wrote in Telugu
or Hindi (use English letters), otherwise English. 2 to 4 sentences. No promises about money or dates beyond what is given.
Return ONLY JSON: {"reply": "..."}`
  const user = `Order: ${clip(body.order?.title, 120)} (${clip(body.order?.type, 60)}). Deadline: ${clip(body.order?.due, 60)}.
Creator said: ${clip(body.note, 1200)}
What the editor wants to say: ${clip(body.intent, 400) || 'Acknowledge and confirm the next step.'}`
  const j = parseJson(await run(env, [{ role: 'system', content: sys }, { role: 'user', content: user }], { maxTokens: 300, jsonMode: true }))
  return j || { error: 'The AI answer could not be read. Try again.' }
}

async function ops(env, body) {
  const snap = clip(JSON.stringify(body.snapshot || {}), 9000)
  const sys = `${ABOUT}
You are the QuiCut operations analyst. From the JSON snapshot of the platform, write today's ops brief for the founder.
Follow the SOPs: deadlines first, then orders unassigned for over 2 hours, ratings of 2 stars or less or editor averages under 4.2,
3+ revisions, pending KYC, payouts due, account deletion requests. Use only facts in the snapshot, with order ids and names.
Return ONLY JSON: {"headline": "one sentence on how today looks", "items": [{"level": "urgent"|"soon"|"fyi", "text": "what is happening", "action": "what to do"}] (max 8),
"numbers": "one line with the key money and order numbers"}`
  const j = parseJson(await run(env, [{ role: 'system', content: sys }, { role: 'user', content: snap }], { maxTokens: 800, jsonMode: true }))
  return j || { error: 'The AI answer could not be read. Try again.' }
}

const ROLE_HINT = {
  creator:
    'You are talking to a creator. Help them pick the right edit tier and add-ons, understand credits and packs, write a better brief, and follow their orders. Be warm and brief.',
  editor:
    'You are talking to an editor. Help with jobs, deadlines, briefs, revisions, earnings, payouts and TDS. Be practical and brief.',
  admin:
    'You are talking to the QuiCut founder/admin. Answer questions about the platform data in the context precisely, with numbers, ids and names. Suggest next actions from the SOPs when useful.',
}

async function chat(env, body) {
  const role = ['creator', 'editor', 'admin'].includes(body.role) ? body.role : 'creator'
  const ctx = clip(JSON.stringify(body.context || {}), 8000)
  const msgs = (body.messages || [])
    .slice(-10)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role, content: clip(m.content, 1500) }))
  if (!msgs.length) return { error: 'Ask a question first.' }
  const sys = `${ABOUT}
${ROLE_HINT[role]}
Use the context below as the truth about this user's account; do not invent orders, balances or people. If something is not in the context, say so.
Reply in the language the user writes in (Telugu or Hindi in English letters is fine). Keep answers under 120 words, plain text, no markdown tables.
Context: ${ctx}`
  const text = await run(env, [{ role: 'system', content: sys }, ...msgs], { maxTokens: 450 })
  return { reply: text.trim() }
}

const ROUTES = { brief, explain, reply, ops, chat }

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || ''
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) })
    if (url.pathname === '/v1/health') return json({ ok: true, model: MODEL }, 200, origin)
    const task = url.pathname.replace(/^\/v1\//, '')
    if (req.method !== 'POST' || !ROUTES[task]) return json({ error: 'Not found' }, 404, origin)
    if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Origin not allowed' }, 403, origin)
    const ip = req.headers.get('CF-Connecting-IP') || 'anon'
    if (limited(ip)) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429, origin)
    const raw = await req.text()
    if (raw.length > MAX_BODY) return json({ error: 'Request too large' }, 413, origin)
    let body
    try {
      body = JSON.parse(raw || '{}')
    } catch {
      return json({ error: 'Bad JSON' }, 400, origin)
    }
    try {
      const out = await ROUTES[task](env, body)
      return json(out, out?.error ? 422 : 200, origin)
    } catch (e) {
      return json({ error: 'AI is busy right now. Try again in a moment.' }, 503, origin)
    }
  },
}
