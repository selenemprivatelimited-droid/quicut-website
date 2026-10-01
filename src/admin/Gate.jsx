import { useEffect, useState } from 'react'
import Logo from '../Logo.jsx'
import { Icon } from '../app/ui.jsx'
import { consumeLinkHash, getSession, rest, signOut } from '../app/services/supa.js'
import { EmailSignIn } from '../app/views/Account.jsx'

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
            <EmailSignIn redirectTo={location.origin + location.pathname} onSignedIn={refresh} />
          </>
        )}
        {err && <p className="bad small">{err}</p>}
      </div>
    </div>
  )
}
