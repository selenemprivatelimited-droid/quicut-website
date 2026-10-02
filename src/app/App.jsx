import { useEffect, useMemo, useState } from 'react'
import { useStore, resetDemo, useAccount, initAccount, signOutAccount } from './services/store.js'
import { MODE } from './services/payments.js'
import { Toaster, toast } from './ui.jsx'
import { ShellCtx } from './studio.jsx'
import { rest } from './services/supa.js'
import Creator from './views/Creator.jsx'
import Editor from './views/Editor.jsx'
import IntroSplash from '../intro/IntroSplash.jsx'
import { SignInSheet, Onboarding } from './views/Account.jsx'
import Help from './views/Help.jsx'
import ProtoLogin from './views/ProtoLogin.jsx'
import SupportAgent from './views/SupportAgent.jsx'

// Admin is not part of the public app. It lives at /admin/ and opens only for allow-listed admin emails.
const ROLES = [
  { id: 'creator', label: 'Creator' },
  { id: 'editor', label: 'Editor' },
]

function initialRole() {
  const h = location.hash.replace('#', '')
  return ROLES.some((r) => r.id === h) ? h : 'creator'
}

export default function App() {
  const s = useStore()
  const account = useAccount()
  const [signIn, setSignIn] = useState(false)
  const [help, setHelp] = useState(false)
  const [replies, setReplies] = useState(0)
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('quicut-proto-session'))
    } catch {
      return null
    }
  })
  const [demoRole, setRoleState] = useState(() => session?.role || initialRole())
  const [demoCreator, setCreatorId] = useState(() => (session?.role === 'creator' ? session.id : 'c1'))
  const [demoEditor, setEditorId] = useState(() => (session?.role === 'editor' ? session.id : 'e1'))
  const login = (r, id) => {
    const ses = { role: r, id }
    try {
      localStorage.setItem('quicut-proto-session', JSON.stringify(ses))
    } catch {
      /* ignore */
    }
    setSession(ses)
    setRoleState(r)
    ;(r === 'creator' ? setCreatorId : setEditorId)(id)
    history.replaceState(null, '', '#' + r)
  }
  const logout = () => {
    try {
      localStorage.removeItem('quicut-proto-session')
    } catch {
      /* ignore */
    }
    setSession(null)
  }
  useEffect(() => {
    initAccount()
  }, [])
  const setRole = (r) => {
    setRoleState(r)
    history.replaceState(null, '', '#' + r)
  }

  // Signed in: the account decides the role and the person. Otherwise: the demo switcher.
  const live = account.status === 'live' && s.live
  const role = live ? account.role : demoRole
  useEffect(() => {
    document.documentElement.dataset.role = role
  }, [role])
  const creatorId = live ? account.uid : demoCreator
  const editorId = live ? account.uid : demoEditor
  const ready = !live || (role === 'creator' ? s.creators : s.editors).some((p) => p.id === account.uid)
  const people = live ? null : (role === 'creator' ? s.creators : s.editors).filter((p) => !p.deleted).slice(0, 6)
  const who = role === 'creator' ? creatorId : editorId
  // A badge on Help when the QuiCut team has answered a request and is waiting on you.
  useEffect(() => {
    if (!live || help) return
    rest('tickets?select=id&status=eq.pending&limit=20').then((r) => setReplies((r || []).length)).catch(() => {})
  }, [live, help])
  const setWho = role === 'creator' ? setCreatorId : setEditorId

  const shell = useMemo(
    () => ({ live, roles: ROLES, setRole, people, who, setWho, replies, openHelp: () => setHelp(true), openSignIn: () => setSignIn(true), canSignOut: live || !!session, signOut: () => (live ? signOutAccount() : logout()) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, people, who, replies, demoRole, session]
  )

  return (
    <ShellCtx.Provider value={shell}>
    <div className="app">
      <IntroSplash />
      {MODE === 'demo' && !live && (
        <div className="demo-bar">
          <span>
            <b>Demo mode.</b> Unlimited QC, simulated payments. Use the menu to switch Creator and Editor, or sign in.
          </span>
          <button
            className="link-btn"
            onClick={() => {
              resetDemo()
              toast('Demo data reset')
            }}
          >
            Reset demo data
          </button>
        </div>
      )}

      <main className="view">
        {account.status === 'loading' || !ready ? (
          <p className="muted center">Loading your account…</p>
        ) : !live && !session && account.status !== 'onboard' ? (
          <ProtoLogin s={s} initialRole={initialRole()} onLogin={login} onReal={() => setSignIn(true)} />
        ) : (
          <>
            {role === 'creator' && <Creator s={s} creatorId={creatorId} />}
            {role === 'editor' && <Editor s={s} editorId={editorId} />}
          </>
        )}
      </main>
      {signIn && !live && account.status !== 'onboard' && <SignInSheet onClose={() => setSignIn(false)} />}
      {help && live && <Help onClose={() => setHelp(false)} />}
      {account.status === 'onboard' && <Onboarding email={account.email} />}
      {ready && (live || session) && account.status !== 'loading' && account.status !== 'onboard' && <SupportAgent key={role} role={role} s={s} ids={{ creatorId, editorId }} live={live} />}
      <Toaster />
    </div>
    </ShellCtx.Provider>
  )
}
