import { useState } from 'react'
import Logo from '../Logo.jsx'
import { useStore, resetDemo } from './services/store.js'
import { MODE } from './services/payments.js'
import { Toaster, toast } from './ui.jsx'
import Creator from './views/Creator.jsx'
import Editor from './views/Editor.jsx'
import Admin from './views/Admin.jsx'
import IntroSplash from '../intro/IntroSplash.jsx'
import Copilot from './views/Copilot.jsx'

const ROLES = [
  { id: 'creator', label: 'Creator' },
  { id: 'editor', label: 'Editor' },
  { id: 'admin', label: 'Admin' },
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

  const people = role === 'creator' ? s.creators : role === 'editor' ? s.editors : null
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
            <b>Demo mode.</b> Payments are simulated and data stays in this browser. Switch roles above to follow an order
            from creator to editor to admin.
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
        {role === 'admin' && <Admin s={s} />}
      </main>
      <Copilot role={role} s={s} ids={{ creatorId, editorId }} />
      <Toaster />
    </div>
  )
}
