// Tiny Supabase client (REST + Auth) with no extra dependencies.
// The publishable key is safe in the browser: every table is protected by row-level security.
export const SUPA_URL = 'https://tnvnqvuqynjgjsdylibd.supabase.co'
export const SUPA_KEY = 'sb_publishable_4MyTa2OS-QEsAOGMqWaZQw_v6Yxy61d'

const KEY = 'qc-sb-session'
const now = () => Math.floor(Date.now() / 1000)

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}
function write(s) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
}

async function auth(path, body, token) {
  const r = await fetch(`${SUPA_URL}/auth/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || `Auth error ${r.status}`)
  return j
}

function store(j) {
  const s = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at || now() + Number(j.expires_in || 3600),
    email: j.user?.email,
  }
  write(s)
  return s
}

/** Sends a sign-in email (magic link, plus a 6-digit code if the email template includes it). */
export function sendSignIn(email, redirectTo) {
  return auth(`otp?redirect_to=${encodeURIComponent(redirectTo)}`, { email: email.trim().toLowerCase(), create_user: true })
}

/** Signs in with the 6-digit code from the email. */
export async function verifyCode(email, code) {
  return store(await auth('verify', { type: 'email', email: email.trim().toLowerCase(), token: code.trim() }))
}

/** Picks up the session when the person lands here from the magic link. */
export async function consumeLinkHash() {
  if (!location.hash.includes('access_token=')) {
    if (location.hash.includes('error_description=')) {
      const p = new URLSearchParams(location.hash.slice(1))
      history.replaceState(null, '', location.pathname + location.search)
      throw new Error(p.get('error_description') || 'The sign-in link did not work')
    }
    return null
  }
  const p = new URLSearchParams(location.hash.slice(1))
  history.replaceState(null, '', location.pathname + location.search)
  const token = p.get('access_token')
  const user = await auth('user', null, token)
  return store({ access_token: token, refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || undefined, user })
}

/** Current session, refreshed when it is about to expire. */
export async function getSession() {
  let s = read()
  if (!s) return null
  if (s.expires_at - now() < 60) {
    try {
      s = store(await auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token }))
    } catch {
      write(null)
      return null
    }
  }
  return s
}

export async function signOut() {
  const s = read()
  write(null)
  if (s) await auth('logout', {}, s.access_token).catch(() => {})
}

/** Data API call as the signed-in person (or anonymous). */
export async function rest(path, { method = 'GET', body, prefer } = {}) {
  const s = await getSession()
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPA_KEY,
      ...(s ? { Authorization: `Bearer ${s.access_token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 204 || r.status === 201) return null
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.message || `Database error ${r.status}`)
  return j
}
