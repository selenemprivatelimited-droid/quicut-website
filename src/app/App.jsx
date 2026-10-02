import { useEffect, useState } from 'react'
import Logo from '../Logo.jsx'
import { useStore, resetDemo, useAccount, initAccount } from './services/store.js'
import { MODE } from './services/payments.js'
import { Toaster, toast, Icon } from './ui.jsx'
import Creator from './views/Creator.jsx'
import Editor from './views/Editor.jsx'
import IntroSplash from '../intro/IntroSplash.jsx'
import { SignInSheet, Onboarding, AccountChip } from './views/Account.jsx'
import Help from './views/Help.jsx'

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
  const [demoRole, setRoleState] = useState(initialRole)
  const [demoCreator, setCreatorId] = useState('c1')
  const [demoEditor, setEditorId] = useState('e1')
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
  const setWho = role === 'creator' ? setCreatorId : setEditorId

  return (
    <div className="app">
      <IntroSplash />
      <header className="topbar">
        <a href="./" className="brand" aria-label="QuiCut website">
          <Logo height={24} id="app-logo" />
        </a>
        {live ? (
          <AccountChip s={s} account={account} />
        ) : (
          <div className="role-switch" role="tablist" aria-label="View as">
            {ROLES.map((r) => (
              <button
                key={r.id}
                role="tab"
                aria-selected={role === r.id}
                className={'role' + (role === r.id ? ' is-on' : '')}
                onClick={() => setRole(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        {people && (
          <label className="who">
            <span className="sr-only">Signed in as</span>
            <select id="who" value={who} onChange={(e) => setWho(e.target.value)}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {live && (
          <button className="btn btn-ghost btn-sm" onClick={() => setHelp(true)} aria-label="Help and support">
            <Icon name="inbox" size={16} /> Help
          </button>
        )}
        {!live && account.status !== 'loading' && (
          <button className="btn btn-ghost btn-sm signin-btn" onClick={() => setSignIn(true)}>
            <Icon name="user" size={16} /> Sign in
          </button>
        )}
      </header>

      {MODE === 'demo' && !live && (
        <div className="demo-bar">
          <span>
            <b>Demo mode.</b> Payments are simulated and data stays in this browser. Switch between Creator and Editor above to
            follow an order end to end, or sign in to use your real account.
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
      <Toaster />
    </div>
  )
}
