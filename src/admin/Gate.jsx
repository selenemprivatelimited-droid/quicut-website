import { useEffect, useState } from 'react'
import Logo from '../Logo.jsx'
import { Icon } from '../app/ui.jsx'
import { consumeLinkHash, getSession, rest, signOut, sessionLevel, mfaFactor } from '../app/services/supa.js'
import Mfa from './Mfa.jsx'
import { EmailSignIn } from '../app/views/Account.jsx'

// The admin panel is only for QuiCut's admins (1 to 10 people).
// Admins sign in with a link or 6-digit code sent to their email (Supabase Auth), then a second step:
// a 6-digit code from an authenticator app. The panel opens only when that email is in the public.admins
// allow-list, which row-level security lets only admins read. Each admin has a role (Founder, Support Lead, ...)
// that decides which sections they see.
const DEV_HOSTS = ['localhost', '127.0.0.1']

async function checkAdmin() {
  const s = await getSession()
  if (!s) return null
  const rows = await rest('admins?select=email,role')
  const me = Array.isArray(rows) ? rows.find((r) => r.email === String(s.email || '').toLowerCase()) : null
  return { email: s.email, admin: !!me, role: me?.role || 'founder', live: true }
}

export default function Gate({ children }) {
  const dev = typeof location !== 'undefined' && DEV_HOSTS.includes(location.hostname)
  const [st, setSt] = useState({ loading: true })
  const [err, setErr] = useState('')

  const refresh = async () => {
    try {
      await consumeLinkHash()
    } catch (e) {
      setErr(e.message)
    }
    try {
      const who = await checkAdmin()
      if (who && !who.admin) return setSt({ denied: true, ...who })
      if (who) {
        // Admins also need the authenticator code (second step) before the panel opens.
        const sess = await getSession()
        if (sessionLevel(sess) !== 'aal2') {
          const factor = await mfaFactor()
          return setSt({ mfa: true, factor, ...who })
        }
        return setSt({ ok: true, ...who })
      }
    } catch (e) {
      setErr(e.message)
    }
    // No sign-in screen: without a session the panel opens with sample data only. Real data and actions
    // stay locked in the database (row-level security), so nothing real is exposed. Add ?signin to the
    // address to sign in as an admin and see live numbers.
    const wantSignin = typeof location !== 'undefined' && /[?&]signin\b/.test(location.search)
    setSt(wantSignin ? { signin: true } : { ok: true, email: 'demo@quicut', role: 'founder', live: false })
  }

  useEffect(() => {
    document.documentElement.dataset.role = 'admin'
    refresh()
  }, [])

  const logout = async () => {
    await signOut()
    location.reload()
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
        {st.mfa && <Mfa factor={st.factor} onDone={refresh} onCancel={logout} />}
        {st.signin && (
          <>
            <h1>Admins only</h1>
            <p className="muted">QuiCut's private admin panel. Sign in with your admin email and we'll send you a link.</p>
            <EmailSignIn redirectTo={location.origin + location.pathname} onSignedIn={refresh} />
          </>
        )}
        {err && <p className="bad small">{err}</p>}
      </div>
    </div>
  )
}
