import { useState } from 'react'
import Logo from '../../Logo.jsx'
import { demoSignUp } from '../services/store.js'

/* Prototype login. Any password works: this build is for testing the flows, not for real accounts.
   Picking a persona jumps straight in; typing a new email makes a fresh verified demo person. */
export default function ProtoLogin({ s, initialRole, onLogin, onReal }) {
  const [role, setRole] = useState(initialRole)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const people = (role === 'creator' ? s.creators : s.editors).filter((p) => !p.deleted)
  const slug = (p) => p.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')
  const emailFor = (p) => `${slug(p)}@demo.quicut`
  const submit = (e) => {
    e.preventDefault()
    const em = email.trim().toLowerCase()
    if (!em) return
    const hit = people.find((p) => emailFor(p) === em || slug(p) === em.split('@')[0])
    if (hit) return onLogin(role, hit.id)
    const name = em.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Tester'
    onLogin(role, demoSignUp(role, name))
  }
  return (
    <div className="studio pl">
      <div className="pl-card">
        <Logo height={28} id="pl-logo" />
        <h1 className="pl-h">
          QuiCut <span>Studio</span>
        </h1>
        <p className="pl-tag mono">PROTOTYPE LOGIN · ANY PASSWORD WORKS</p>
        <div className="st-d-seg" role="tablist" aria-label="I am a">
          {['creator', 'editor'].map((r) => (
            <button key={r} role="tab" aria-selected={role === r} className={role === r ? 'is-on' : ''} onClick={() => setRole(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="pl-form">
          <div className="field">
            <label htmlFor="pl-email">Email</label>
            <input id="pl-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === 'creator' ? 'ravi@demo.quicut' : 'arjun@demo.quicut'} />
          </div>
          <div className="field">
            <label htmlFor="pl-pw">Password</label>
            <input id="pl-pw" type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="anything" />
          </div>
          <button className="btn btn-red btn-block" disabled={!email.trim()}>
            Log in as {role}
          </button>
        </form>
        <p className="pl-or mono">OR JUMP STRAIGHT IN</p>
        <div className="pl-people">
          {people.slice(0, 4).map((p) => (
            <button key={p.id} className="pl-person" onClick={() => onLogin(role, p.id)}>
              <span className="avatar sm">{p.name[0]}</span>
              <span>
                <b>{p.name}</b>
                <small className="mono">{emailFor(p)}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="muted small pl-note">Creators get unlimited QC. A simulated editor picks up orders after 15 seconds, so you can watch one go from order to delivery. One delivery hour runs as 10 seconds.</p>
        <button className="link-btn small" onClick={onReal}>
          I have a real QuiCut account
        </button>
      </div>
    </div>
  )
}
