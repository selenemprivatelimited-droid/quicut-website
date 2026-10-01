import { useState } from 'react'
import Logo from '../Logo.jsx'
import { useStore, resetDemo } from './services/store.js'
import { MODE } from './services/payments.js'
import { Toaster, toast } from './ui.jsx'
import Creator from './views/Creator.jsx'
import Editor from './views/Editor.jsx'
import IntroSplash from '../intro/IntroSplash.jsx'
import Copilot from './views/Copilot.jsx'

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
  const [role, setRoleState] = useState(initialRole)
  const [creatorId, setCreatorId] = useState('c1')
  const [editorId, setEditorId] = useState('e1')
  const setRole = (r) => {
    setRoleState(r)
    history.replaceState(null, '', '#' + r)
  }

  const people = (role === 'creator' ? s.creators : s.editors).filter((p) => !p.deleted).slice(0, 6)
  const who = role === 'creator' ? creatorId : editorId
  const setWho = role === 'creator' ? setCreatorId : setEditorId

  return (
    <div className="app">
      <IntroSplash />
      <header className="topbar">
        <a href="./" className="brand" aria-label="QuiCut website">
          <Logo height={24} id="app-logo" />
        </a>
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
      </header>

      {MODE === 'demo' && (
        <div className="demo-bar">
          <span>
            <b>Demo mode.</b> Payments are simulated and data stays in this browser. Switch between Creator and Editor above to
            follow an order end to end.
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
        {role === 'creator' && <Creator s={s} creatorId={creatorId} />}
        {role === 'editor' && <Editor s={s} editorId={editorId} />}
      </main>
      <Copilot role={role} s={s} ids={{ creatorId, editorId }} />
      <Toaster />
    </div>
  )
}
