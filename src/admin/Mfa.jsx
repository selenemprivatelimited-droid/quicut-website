import { useEffect, useState } from 'react'
import { mfaEnroll, mfaVerify } from '../app/services/supa.js'

// Step two of admin sign-in: a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password...).
// First time: scan the QR code to link the app. After that: just type the code.
export default function Mfa({ factor, onDone, onCancel }) {
  const [enroll, setEnroll] = useState(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (factor) return
    mfaEnroll().then(setEnroll).catch((e) => setErr(e.message))
  }, [factor])

  const factorId = factor?.id || enroll?.id
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await mfaVerify(factorId, code)
      onDone()
    } catch (x) {
      setErr(/invalid/i.test(x.message) ? 'That code is not right. Wait for the next code and try again.' : x.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="gate-form">
      <h1>{factor ? 'Two-step verification' : 'Set up two-step verification'}</h1>
      {factor ? (
        <p className="muted">Enter the 6-digit code from your authenticator app.</p>
      ) : (
        <>
          <p className="muted">Admins need a second step. Scan this with an authenticator app, then type the 6-digit code it shows.</p>
          {enroll?.qr && <img src={enroll.qr} alt="QR code to add QuiCut admin to your authenticator app" width="180" height="180" style={{ background: '#fff', padding: 8, borderRadius: 12, alignSelf: 'center' }} />}
          {enroll?.secret && (
            <p className="muted small">
              Cannot scan? Type this key into the app: <span className="mono">{enroll.secret}</span>
            </p>
          )}
        </>
      )}
      <label className="field">
        <span className="label">Code</span>
        <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" required autoFocus />
      </label>
      {err && <p className="bad small">{err}</p>}
      <button className="btn btn-red btn-block" disabled={busy || code.length !== 6 || !factorId}>
        {busy ? 'Checking…' : 'Verify and open admin'}
      </button>
      <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
        Sign out
      </button>
    </form>
  )
}
