import { useEffect, useState } from 'react'
import { rest } from '../app/services/supa.js'
import { toast } from '../app/ui.jsx'

// Admin team: who can open the panel and which sections each role sees. Only a founder can change it.
export const ROLES = [
  { id: 'founder', label: 'Founder', note: 'Full access', sections: null },
  { id: 'support', label: 'Support Lead', note: 'Tickets and orders', sections: ['orders', 'people', 'monitor'] },
  { id: 'quality', label: 'Quality Head', note: 'Editor quality', sections: ['team', 'kyc', 'orders', 'monitor'] },
  { id: 'editor_ops', label: 'Editor Ops', note: 'Editors and vetting', sections: ['team', 'kyc', 'people', 'payouts'] },
  { id: 'finance', label: 'Finance', note: 'Payouts and refunds', sections: ['overview', 'payouts', 'orders', 'pricing'] },
  { id: 'growth', label: 'Growth', note: 'Analytics', sections: ['overview', 'analyst', 'team'] },
]
export const roleLabel = (id) => ROLES.find((r) => r.id === id)?.label || id
export const canSee = (role, section) => {
  if (section === 'access') return role === 'founder'
  const r = ROLES.find((x) => x.id === role)
  return !r || r.sections === null || r.sections.includes(section)
}

export default function Access({ me, live }) {
  const [rows, setRows] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('support')
  const [busy, setBusy] = useState(false)
  const founder = me.role === 'founder'

  const load = async () => {
    if (!live) return setRows([{ email: me.email, role: 'founder', demo: true }])
    setRows(await rest('admins?select=email,role,added_at&order=added_at.asc'))
  }
  useEffect(() => {
    load().catch((e) => toast(e.message))
  }, [])

  const save = async (em, rl) => {
    setBusy(true)
    try {
      await rest('rpc/admin_team_set', { method: 'POST', body: { p_email: em, p_role: rl } })
      toast('Team updated')
      setEmail('')
      await load()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }

  return (
    <div className="stack">
      <div className="chart-card">
        <h3>Admin team ({rows ? rows.length : '…'} of 10)</h3>
        <p className="muted small">Each person signs in with their own email and sees only the sections for their role.</p>
        {!live && <p className="muted small">Demo mode. Sign in as an admin (add ?signin to the address) to manage the real team.</p>}
        <div className="list">
          {(rows || []).map((r) => (
            <div className="row" key={r.email}>
              <div className="row-main">
                <div className="row-title">{r.email}</div>
                <div className="row-meta">{ROLES.find((x) => x.id === r.role)?.note}</div>
              </div>
              <div className="row-side">
                {founder && live ? (
                  <select className="small-input" value={r.role} disabled={busy} onChange={(e) => save(r.email, e.target.value)} aria-label={'Role for ' + r.email}>
                    {ROLES.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="pill pill-muted">{roleLabel(r.role)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {founder && live && (
        <form
          className="chart-card"
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim()) save(email, role)
          }}
        >
          <h3>Add a team member</h3>
          <div className="form-grid">
            <label className="field">
              <span className="label">Work email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
            </label>
            <label className="field">
              <span className="label">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label} · {x.note}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn btn-red" disabled={busy}>
            Add to team
          </button>
        </form>
      )}
    </div>
  )
}
