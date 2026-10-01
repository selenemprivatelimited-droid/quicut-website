import { useEffect, useState } from 'react'
import Logo from '../Logo.jsx'
import { Icon } from '../app/ui.jsx'
import { consumeLinkHash, getSession, rest, sendSignIn, signOut, verifyCode } from '../app/services/supa.js'

// The admin panel is only for QuiCut's admins (1 to 10 people).
// Admins sign in with a link or 6-digit code sent to their email (Supabase Auth). The panel opens only
// when that email is in the public.admins allow-list, which row-level security lets only admins read.
// On localhost the gate opens with demo data so the panel can be developed without signing in.
const DEV_HOSTS = ['localhost', '127.0.0.1']

async function checkAdmin() {
  const s = await getSession()
  if (!s) return null
  const rows = await rest('admins?select=email&limit=1')
  return { email: s.email, admin: Array.isArray(rows) && rows.length > 0, live: true }
}

export default function Gate({ children }) {
  const dev = typeof location !== 'undefined' && DEV_HOSTS.includes(location.hostname)
  const [st, setSt] = useState({ loading: true })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = async () => {
    try {
      await consumeLinkHash()
    } catch (e) {
      setErr(e.message)
    }
    try {
      const who = await checkAdmin()
      if (who) return setSt(who.admin ? { ok: true, ...who } : { denied: true, ...who })
    } catch (e) {
      setErr(e.message)
    }
    setSt(dev ? { ok: true, email: 'dev@localhost', live: false } : { signin: true })
  }

  useEffect(() => {
    refresh()
  }, [])

  const logout = async () => {
    await signOut()
    location.reload()
  }

  const send = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await sendSignIn(email, location.origin + location.pathname)
      setSent(true)
    } catch (e2) {
      setErr(e2.message)
    }
    setBusy(false)
  }
  const verify = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await verifyCode(email, code)
      await refresh()
    } catch (e2) {
      setErr(e2.message)
    }
    setBusy(false)
  }

  if (st.ok) return children({ ...st, signOut: logout })

  return (
    <div className="gate">
      <div className="gate-card">
        <Logo height={28} id="gate-logo" />
        <div className="gate-lock">
          <Icon name="shield" size={34} />
        </div>
        {st.loading && <p className="muted">Checking your admin access…</p>}
        {st.denied && (
          <>
            <h1>Not an admin</h1>
            <p className="muted">
              {st.email} is signed in but isn't on QuiCut's admin list. Ask an existing admin to add you.
            </p>
            <div className="gate-actions">
              <button className="btn btn-ghost" onClick={logout}>
                Sign out
              </button>
              <a className="btn btn-red" href="../app.html">
                Open the QuiCut app
              </a>
            </div>
          </>
        )}
        {st.signin && (
          <>
            <h1>Admins only</h1>
            <p className="muted">QuiCut's private admin panel. Sign in with your admin email and we'll send you a link.</p>
            {!sent ? (
              <form className="gate-form" onSubmit={send}>
                <input type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Admin email" />
                <button className="btn btn-red btn-block" disabled={busy}>
                  {busy ? 'Sending…' : 'Email me a sign-in link'}
                </button>
              </form>
            ) : (
              <form className="gate-form" onSubmit={verify}>
                <p className="small">
                  Sent to <b>{email}</b>. Open the link on this device, or type the 6-digit code if your email has one.
                </p>
                <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Sign-in code" />
                <button className="btn btn-red btn-block" disabled={busy || code.length !== 6}>
                  {busy ? 'Checking…' : 'Sign in'}
                </button>
                <button type="button" className="link-btn small" onClick={() => setSent(false)}>
                  Use a different email
                </button>
              </form>
            )}
          </>
        )}
        {err && <p className="bad small">{err}</p>}
      </div>
    </div>
  )
}
