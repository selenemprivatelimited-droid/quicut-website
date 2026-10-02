import { useEffect, useState } from 'react'
import { Sheet, toast, ago } from '../ui.jsx'
import { rest } from '../services/supa.js'

// Help & support for signed-in creators and editors: send a request, read QuiCut's replies.
export default function Help({ onClose }) {
  const [tickets, setTickets] = useState(null)
  const [view, setView] = useState('list')
  const [subject, setSubject] = useState('')
  const [order, setOrder] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => setTickets(await rest('tickets?select=*,ticket_messages(id,from_admin,body,created_at)&order=updated_at.desc&limit=30'))
  useEffect(() => {
    load().catch(() => setTickets([]))
  }, [])

  const run = async (fn, args, ok) => {
    setBusy(true)
    try {
      await rest(`rpc/${fn}`, { method: 'POST', body: args })
      toast(ok)
      await load()
      return true
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  const cur = tickets?.find((t) => t.id === open)
  return (
    <Sheet title={view === 'new' ? 'New request' : cur ? cur.subject : 'Help & support'} onClose={onClose}>
      {view === 'new' ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await run('ticket_create', { p_subject: subject, p_body: body, p_order: order || null }, 'Sent. We will reply here.')) {
              setSubject('')
              setBody('')
              setOrder('')
              setView('list')
            }
          }}
        >
          <label className="field">
            <span className="label">What do you need help with?</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} minLength={3} maxLength={120} required />
          </label>
          <label className="field">
            <span className="label">Order number (optional)</span>
            <input value={order} onChange={(e) => setOrder(e.target.value)} placeholder="QC-1041" maxLength={20} />
          </label>
          <label className="field">
            <span className="label">Details</span>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} required />
          </label>
          <button className="btn btn-red btn-block" disabled={busy}>
            Send
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setView('list')}>
            Back
          </button>
        </form>
      ) : cur ? (
        <div className="stack">
          <div className="thread-list">
            {[...cur.ticket_messages]
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((m) => (
                <div key={m.id} className={'bubble' + (m.from_admin ? '' : ' mine')}>
                  <div>{m.body}</div>
                  <div className="bubble-meta">
                    {m.from_admin ? 'QuiCut' : 'You'} · {ago(m.created_at)}
                  </div>
                </div>
              ))}
          </div>
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault()
              if (reply.trim() && (await run('ticket_reply', { p_ticket: cur.id, p_body: reply }, 'Sent'))) setReply('')
            }}
          >
            <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" maxLength={4000} aria-label="Reply" />
            <button className="btn btn-red btn-block" disabled={busy || !reply.trim()}>
              Send reply
            </button>
          </form>
          <button className="btn btn-ghost btn-block" onClick={() => setOpen(null)}>
            Back
          </button>
        </div>
      ) : (
        <div className="stack">
          <button className="btn btn-red btn-block" onClick={() => setView('new')}>
            New request
          </button>
          {tickets && !tickets.length && <p className="muted center">No requests yet. Tell us what is wrong and the QuiCut team will reply here.</p>}
          <div className="list">
            {(tickets || []).map((t) => (
              <button key={t.id} className="row" onClick={() => setOpen(t.id)}>
                <div className="row-main">
                  <div className="row-title">{t.subject}</div>
                  <div className="row-meta">
                    {t.status === 'solved' ? 'Solved' : t.status === 'pending' ? 'QuiCut replied' : 'Open'} · {ago(t.updated_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}
