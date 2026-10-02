import { useEffect, useState } from 'react'
import { rest } from '../app/services/supa.js'
import { toast, ago, Empty } from '../app/ui.jsx'

// Support inbox: requests that creators and editors send from the app's Help button.
const TONE = { open: 'pill-amber', pending: 'pill-blue', solved: 'pill-green' }
const LABEL = { open: 'Open', pending: 'Waiting for user', solved: 'Solved' }

const DEMO = [
  {
    id: 1,
    user_id: 'demo',
    order_code: 'QC-1041',
    subject: 'Colour grade looks different from my reference',
    status: 'open',
    updated_at: new Date(Date.now() - 36e5).toISOString(),
    ticket_messages: [{ id: 1, from_admin: false, body: 'Can the editor match the warm grade from my reference clip? Thanks!', created_at: new Date(Date.now() - 36e5).toISOString() }],
  },
]

export default function Tickets({ live }) {
  const [rows, setRows] = useState(null)
  const [names, setNames] = useState({})
  const [open, setOpen] = useState(null)
  const [filter, setFilter] = useState('open')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!live) return setRows(DEMO)
    const t = await rest('tickets?select=*,ticket_messages(id,from_admin,body,created_at)&order=updated_at.desc&limit=100')
    setRows(t)
    const ids = [...new Set(t.map((x) => x.user_id))]
    if (ids.length) {
      const p = await rest(`profiles?select=id,full_name,role&id=in.(${ids.join(',')})`)
      setNames(Object.fromEntries((p || []).map((x) => [x.id, `${x.full_name || 'Unnamed'} · ${x.role}`])))
    }
  }
  useEffect(() => {
    load().catch((e) => toast(e.message))
  }, [])

  const call = async (fn, body, ok) => {
    if (!live) return toast('Demo mode: sign in as an admin to answer real tickets')
    setBusy(true)
    try {
      await rest(`rpc/${fn}`, { method: 'POST', body })
      toast(ok)
      setReply('')
      await load()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }

  const list = (rows || []).filter((t) => filter === 'all' || t.status === filter)
  const cur = rows?.find((t) => t.id === open)

  if (cur) {
    const msgs = [...cur.ticket_messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
    return (
      <div className="stack">
        <button className="link-btn small" onClick={() => setOpen(null)}>
          ← All tickets
        </button>
        <div className="chart-card">
          <h3>{cur.subject}</h3>
          <p className="muted small">
            {names[cur.user_id] || 'Demo user'}
            {cur.order_code ? ` · ${cur.order_code}` : ''} · <span className={'pill ' + TONE[cur.status]}>{LABEL[cur.status]}</span>
          </p>
          <div className="thread-list">
            {msgs.map((m) => (
              <div key={m.id} className={'bubble' + (m.from_admin ? ' mine' : '')}>
                <div>{m.body}</div>
                <div className="bubble-meta">
                  {m.from_admin ? 'QuiCut' : 'User'} · {ago(m.created_at)}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (reply.trim()) call('ticket_reply', { p_ticket: cur.id, p_body: reply }, 'Reply sent')
            }}
          >
            <label className="field">
              <span className="label">Your reply</span>
              <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} required />
            </label>
            <div className="btn-row">
              <button className="btn btn-red" disabled={busy}>
                Send reply
              </button>
              {cur.status !== 'solved' && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => call('ticket_set_status', { p_ticket: cur.id, p_status: 'solved' }, 'Marked solved')}>
                  Mark solved
                </button>
              )}
              {cur.status === 'solved' && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => call('ticket_set_status', { p_ticket: cur.id, p_status: 'open' }, 'Reopened')}>
                  Reopen
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Ticket status">
        {['open', 'pending', 'solved', 'all'].map((f) => (
          <button key={f} className={'seg-btn' + (filter === f ? ' is-on' : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : LABEL[f]}
            {f !== 'all' && rows ? ` (${rows.filter((t) => t.status === f).length})` : ''}
          </button>
        ))}
      </div>
      {rows && !list.length && <Empty title="No tickets here">New requests from creators and editors show up in this list.</Empty>}
      <div className="list">
        {list.map((t) => (
          <button key={t.id} className="row" onClick={() => setOpen(t.id)}>
            <div className="row-main">
              <div className="row-title">{t.subject}</div>
              <div className="row-meta">
                {names[t.user_id] || 'Demo user'}
                {t.order_code ? ` · ${t.order_code}` : ''} · {ago(t.updated_at)}
              </div>
            </div>
            <div className="row-side">
              <span className={'pill ' + TONE[t.status]}>{LABEL[t.status]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
