import { useState } from 'react'
import { EDIT_TYPES } from '../config/pricing.js'
import { sendSignIn, verifyCode } from '../services/supa.js'
import { initAccount, finishOnboarding, signOutAccount } from '../services/store.js'
import { Sheet, Icon, act } from '../ui.jsx'

/** Email sign-in: sends a link (and a 6-digit code when the email template has one). Used by the app and the admin gate. */
export function EmailSignIn({ redirectTo, onSignedIn, cta = 'Email me a sign-in link' }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const send = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await sendSignIn(email, redirectTo)
      setSent(true)
    } catch (x) {
      setErr(/rate|seconds/i.test(x.message) ? 'Too many sign-in emails just now. Wait a minute and try again.' : x.message)
    }
    setBusy(false)
  }
  const verify = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await verifyCode(email, code)
      await onSignedIn?.()
    } catch (x) {
      setErr(x.message)
    }
    setBusy(false)
  }

  return (
    <>
      {!sent ? (
        <form className="gate-form" onSubmit={send}>
          <input type="email" required autoComplete="email" inputMode="email" placeholder="you@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
          <button className="btn btn-red btn-block" disabled={busy}>
            {busy ? 'Sending…' : cta}
          </button>
        </form>
      ) : (
        <form className="gate-form" onSubmit={verify}>
          <p className="small">
            Sent to <b>{email}</b>. Open the link on this phone or computer, or type the 6-digit code if your email has one.
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
      {err && <p className="bad small">{err}</p>}
    </>
  )
}

export function SignInSheet({ onClose }) {
  return (
    <Sheet title="Sign in to QuiCut" onClose={onClose}>
      <p className="muted">Creators and editors sign in with their email. No password needed.</p>
      <EmailSignIn redirectTo={location.origin + location.pathname} onSignedIn={async () => (await initAccount(), onClose())} cta="Email me a sign-in link" />
      <p className="muted small">New here? The same link creates your account.</p>
    </Sheet>
  )
}

const LANGS = ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Other']

/** First sign-in: pick creator or editor and add the basics. */
export function Onboarding({ email }) {
  const [f, setF] = useState({ role: '', name: '', phone: '', region: 'IN', handle: '', lang: 'Telugu', city: '', skills: [] })
  const [busy, setBusy] = useState(false)
  const up = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const ok = f.role && f.name.trim().length >= 2 && (f.role === 'creator' || f.skills.length > 0)
  const save = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    await act(() => finishOnboarding(f), 'Welcome to QuiCut')
    setBusy(false)
  }
  return (
    <Sheet title="Set up your QuiCut account" onClose={() => {}}>
      <p className="muted small">Signed in as {email}</p>
      <form className="stack" onSubmit={save}>
        <div className="role-pick" role="radiogroup" aria-label="I am a">
          {[
            ['creator', 'I make videos', 'Order edits with credits', 'plus'],
            ['editor', 'I edit videos', 'Take jobs, get paid weekly by UPI', 'cut'],
          ].map(([id, t, d, ic]) => (
            <button type="button" key={id} role="radio" aria-checked={f.role === id} className={'role-card' + (f.role === id ? ' is-on' : '')} onClick={() => setF((x) => ({ ...x, role: id }))}>
              <Icon name={ic} size={22} />
              <b>{t}</b>
              <span className="muted small">{d}</span>
            </button>
          ))}
        </div>
        {f.role && (
          <div className="form-grid">
            <div className="field span-2">
              <label htmlFor="ob-name">Your name</label>
              <input id="ob-name" value={f.name} onChange={up('name')} autoComplete="name" maxLength={120} />
            </div>
            <div className="field">
              <label htmlFor="ob-phone">WhatsApp number</label>
              <input id="ob-phone" value={f.phone} onChange={up('phone')} autoComplete="tel" inputMode="tel" placeholder="+91 98480 12345" maxLength={20} />
            </div>
            <div className="field">
              <label htmlFor="ob-region">Where do you live?</label>
              <select id="ob-region" value={f.region} onChange={up('region')}>
                <option value="IN">India</option>
                <option value="GLOBAL">Outside India</option>
              </select>
            </div>
            {f.role === 'creator' ? (
              <>
                <div className="field">
                  <label htmlFor="ob-handle">Channel or Instagram handle</label>
                  <input id="ob-handle" value={f.handle} onChange={up('handle')} placeholder="@yourchannel" maxLength={60} />
                </div>
                <div className="field">
                  <label htmlFor="ob-lang">Language you brief in</label>
                  <select id="ob-lang" value={f.lang} onChange={up('lang')}>
                    {LANGS.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="field span-2">
                  <label htmlFor="ob-city">City</label>
                  <input id="ob-city" value={f.city} onChange={up('city')} placeholder="Hyderabad" maxLength={60} />
                </div>
                <div className="field span-2">
                  <span className="label">What do you edit?</span>
                  <div className="chips-row">
                    {EDIT_TYPES.map((t) => (
                      <label key={t.id} className={'toggle-chip' + (f.skills.includes(t.id) ? ' is-on' : '')} htmlFor={'sk-' + t.id}>
                        <input
                          id={'sk-' + t.id}
                          type="checkbox"
                          checked={f.skills.includes(t.id)}
                          onChange={() => setF((x) => ({ ...x, skills: x.skills.includes(t.id) ? x.skills.filter((k) => k !== t.id) : [...x.skills, t.id] }))}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        <button className="btn btn-red btn-block" disabled={!ok || busy}>
          {busy ? 'Creating your account…' : 'Continue'}
        </button>
        <button type="button" className="link-btn small" onClick={() => signOutAccount()}>
          Not now, show me the demo
        </button>
      </form>
    </Sheet>
  )
}

export function AccountChip({ s, account }) {
  const me = [...s.creators, ...s.editors].find((p) => p.id === account.uid)
  return (
    <div className="account-chip">
      <span className="avatar sm">{(me?.name || account.email || 'Q')[0].toUpperCase()}</span>
      <span className="account-name">
        <b>{me?.name || account.email}</b>
        <span className="muted small">{account.role === 'editor' ? 'Editor' : 'Creator'}</span>
      </span>
      <button className="icon-btn" onClick={() => signOutAccount()} aria-label="Sign out" title="Sign out">
        <Icon name="logout" size={18} />
      </button>
    </div>
  )
}
