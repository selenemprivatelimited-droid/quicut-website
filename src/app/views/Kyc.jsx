import { useState } from 'react'
import { KYC_STEPS, DOC_TYPES, checkFields } from '../services/kyc.js'
import { startKyc } from '../services/store.js'
import { Sheet, toast, ago } from '../ui.jsx'

const COPY = {
  none: ['Verify your identity', 'Takes about 2 minutes. Required before money moves on QuiCut.'],
  pending: ['Verification in review', 'We usually finish within a few hours. You will get a WhatsApp message.'],
  rejected: ['Verification needs another try', 'Something did not match. Check the details and submit again.'],
  verified: ['Identity verified', 'You are all set.'],
}

/** Status banner. Shows a button to start / retry KYC when needed. */
export function KycBanner({ role, person, compact }) {
  const [open, setOpen] = useState(false)
  const st = person.kyc?.status || 'none'
  if (st === 'verified' && compact) return null
  const [title, body] = COPY[st] || COPY.none
  const need = role === 'creator' ? 'buy credits and order edits' : 'take jobs and get paid'
  return (
    <>
      <div className={`kyc-banner kyc-${st}`}>
        <div>
          <div className="kyc-title">
            <span className="kyc-dot" aria-hidden="true" />
            {title}
          </div>
          <p>
            {st === 'none' ? `Verify your identity to ${need}. ` : ''}
            {st === 'rejected' && person.kyc.note ? `Reason: ${person.kyc.note}. ` : ''}
            {body}
          </p>
          {st === 'verified' && (
            <p className="mono small">
              {person.kyc.docType} {person.kyc.docLast4}
              {person.kyc.panLast4 ? ` · PAN ${person.kyc.panLast4}` : ''} · verified {ago(person.kyc.reviewedAt || person.kyc.submittedAt)}
            </p>
          )}
        </div>
        {(st === 'none' || st === 'rejected') && (
          <button className="btn btn-red btn-sm" onClick={() => setOpen(true)}>
            {st === 'none' ? 'Start KYC' : 'Try again'}
          </button>
        )}
      </div>
      {open && <KycSheet role={role} person={person} onClose={() => setOpen(false)} />}
    </>
  )
}

function KycSheet({ role, person, onClose }) {
  const [f, setF] = useState({
    region: person.region || 'IN',
    legalName: person.name,
    docType: '',
    docNumber: '',
    pan: '',
    upi: '',
    nda: false,
    selfie: null,
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const up = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const docs = DOC_TYPES[role === 'editor' ? 'IN' : f.region]

  const submit = async (e) => {
    e.preventDefault()
    const problem = checkFields(role, f)
    if (problem) return setErr(problem)
    setErr('')
    setBusy(true)
    try {
      await startKyc(role, person.id, { ...f, selfie: f.selfie?.name })
      toast('KYC submitted for review')
      onClose()
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Verify your identity" onClose={onClose}>
      <ol className="kyc-steps">
        {KYC_STEPS[role].map((s) => (
          <li key={s.id}>{s.label}</li>
        ))}
      </ol>
      <form className="form-grid" onSubmit={submit} noValidate>
        {role === 'creator' && (
          <div className="field span-2">
            <label htmlFor="k-region">Where do you live?</label>
            <select id="k-region" value={f.region} onChange={(e) => setF((x) => ({ ...x, region: e.target.value, docType: '' }))}>
              <option value="IN">India</option>
              <option value="GLOBAL">Outside India</option>
            </select>
          </div>
        )}
        <div className="field span-2">
          <label htmlFor="k-name">Full name as on your ID</label>
          <input id="k-name" value={f.legalName} onChange={up('legalName')} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="k-doc">ID document</label>
          <select id="k-doc" value={f.docType} onChange={up('docType')}>
            <option value="">Choose…</option>
            {docs.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="k-num">ID number</label>
          <input id="k-num" value={f.docNumber} onChange={up('docNumber')} autoComplete="off" placeholder="Only the last 4 are kept" />
        </div>
        {role === 'editor' && (
          <>
            <div className="field">
              <label htmlFor="k-pan">PAN (for TDS)</label>
              <input id="k-pan" value={f.pan} onChange={up('pan')} autoComplete="off" placeholder="ABCDE1234F" maxLength={10} />
            </div>
            <div className="field">
              <label htmlFor="k-upi">UPI ID for payouts</label>
              <input id="k-upi" value={f.upi} onChange={up('upi')} autoComplete="off" placeholder="name@okicici" />
            </div>
          </>
        )}
        <div className="field span-2">
          <label htmlFor="k-selfie">Selfie for the face match</label>
          <input id="k-selfie" type="file" accept="image/*" capture="user" onChange={(e) => setF((x) => ({ ...x, selfie: e.target.files[0] || null }))} />
        </div>
        {role === 'editor' && (
          <label className="check span-2" htmlFor="k-nda">
            <input id="k-nda" type="checkbox" checked={f.nda} onChange={up('nda')} />
            I agree to the footage NDA: creator files stay confidential and are never reused outside the order.
          </label>
        )}
        {err && (
          <p className="form-error span-2" role="alert">
            {err}
          </p>
        )}
        <button className="btn btn-red btn-block span-2" type="submit" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit for verification'}
        </button>
        <p className="muted small span-2">
          Your documents go to our verification partner. QuiCut keeps only the last 4 characters of your ID numbers. Demo
          mode: nothing leaves this browser.
        </p>
      </form>
    </Sheet>
  )
}
