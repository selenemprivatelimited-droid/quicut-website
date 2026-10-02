import { useEffect, useRef, useState } from 'react'
import { aiChat, chatContext } from '../services/ai.js'
import { rest } from '../services/supa.js'
import { Pill, dueIn, toast } from '../ui.jsx'
import { retrieve } from '../support/kb.js'
import { CREATOR_SUPPORT_ART, EDITOR_SUPPORT_ART } from '../support/art.js'
import '../support/support.css'

// Role-aware AI support agent. Creators talk to Meera, editors to Karthik. Portraits generated with Higgsfield.
// How it works: it looks up the matching help articles, reads the person's own account (balance, orders, KYC, earnings),
// and answers from both. It shows the order they ask about, jumps to the right tab, and hands over to the QuiCut team on request.
const AGENT = {
  creator: {
    name: 'Meera',
    sub: 'Creator support',
    art: CREATOR_SUPPORT_ART,
    persona:
      'You are Meera, QuiCut\'s support agent for creators. Be warm, clear and brief. Answer ONLY from the helpArticles and account data given, and state the facts in the articles fully (numbers, steps). Never invent prices, policies, orders or balances. If the answer is not there, or it involves a payment problem, a refund or a dispute, say you will pass it to the QuiCut team and tell the person to tap "Talk to the team". Never ask for passwords or card numbers.',
    hello: 'Hi, I am Meera. I can help with credits, orders, revisions, KYC and payments, in Telugu, Hindi or English. What do you need?',
    starters: ['Where is my order?', 'Which credit pack is best?', 'How do I ask for a revision?', 'My payment was deducted but no credits'],
  },
  editor: {
    name: 'Karthik',
    sub: 'Editor support',
    art: EDITOR_SUPPORT_ART,
    persona:
      'You are Karthik, QuiCut\'s support agent for video editors. Be practical, clear and brief. Answer ONLY from the helpArticles and account data given, and state the facts in the articles fully (numbers, steps). Never invent pay rates, policies, jobs or earnings. If the answer is not there, or it involves a missing payout, a dispute with a creator or a rating complaint, say you will pass it to the QuiCut team and tell the person to tap "Talk to the team". Never ask for passwords or bank details.',
    hello: 'Hi, I am Karthik. I can help with jobs, deadlines, briefs, payouts, TDS and KYC. What do you need?',
    starters: ['How much will I be paid this Monday?', 'What should I work on first?', 'How does TDS work?', 'Why is my payout not here?'],
  },
}

const ORDER_RE = /\b(?:QC|ORD)[-\s]?(\d{3,6})\b/i

function trimContext(role, ctx) {
  const c = { ...ctx }
  for (const k of ['orders', 'myJobs', 'openJobs']) if (Array.isArray(c[k])) c[k] = c[k].slice(-5)
  return c
}

function goTab(label) {
  const t = [...document.querySelectorAll('.tabs .tab')].find((b) => b.textContent.trim().toLowerCase().startsWith(label.toLowerCase()))
  if (t) t.click()
}

export default function SupportAgent({ role, s, ids, live }) {
  const a = AGENT[role]
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState({})
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState({})
  const list = useRef()
  const key = role + (role === 'creator' ? ids.creatorId : ids.editorId)
  const msgs = threads[key] || []
  // A badge when something in this person's account probably needs help: creator orders ready to review or KYC rejected, editor revisions or KYC rejected.
  const note = (() => {
    const me = (role === 'creator' ? s.creators : s.editors).find((p) => p.id === (role === 'creator' ? ids.creatorId : ids.editorId))
    const parts = []
    if (role === 'creator') {
      const n = s.orders.filter((o) => o.creatorId === ids.creatorId && o.status === 'review').length
      if (n) parts.push(`${n} edit${n > 1 ? 's' : ''} ready to review`)
    } else {
      const n = s.orders.filter((o) => o.editorId === ids.editorId && o.status === 'revision').length
      if (n) parts.push(`${n} revision${n > 1 ? 's' : ''} to fix`)
    }
    if (me?.kyc?.status === 'rejected') parts.push('KYC needs attention')
    return { count: parts.length, text: parts.join(', ') }
  })()

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [msgs.length, busy, open])
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const findOrder = (q) => {
    const m = q.match(ORDER_RE)
    if (!m) return null
    const o = s.orders.find((x) => String(x.id).replace(/\D/g, '') === m[1])
    if (!o) return null
    const mine = role === 'creator' ? o.creatorId === ids.creatorId : o.editorId === ids.editorId
    return mine ? o : null
  }

  const send = async (q) => {
    const content = (q ?? text).trim()
    if (!content || busy) return
    setText('')
    const next = [...msgs, { role: 'user', content }]
    setThreads((t) => ({ ...t, [key]: next }))
    setBusy(true)
    const articles = retrieve(role, content, 3)
    const order = findOrder(content)
    let ctx = {}
    try {
      ctx = trimContext(role, chatContext(role, s, ids))
    } catch {
      /* account not ready */
    }
    // Help articles and the order they asked about go FIRST: the service reads only the start of the context.
    const asked = order ? { code: order.id, title: order.title, status: order.status, dueAt: order.dueAt } : undefined
    ctx = { helpArticles: articles.map((e) => ({ topic: e.title, answer: e.a })), ...(asked ? { askedOrder: asked } : {}), ...ctx }
    const framed = [{ role: 'user', content: a.persona }, { role: 'assistant', content: 'Understood.' }, ...next.slice(-8)]
    const r = await aiChat(role, framed, ctx)
    // Offline: answer straight from the best help article instead of a generic message.
    const reply = r.source === 'rules' && articles[0] ? articles[0].a : r.reply
    const actions = []
    for (const e of articles) if (e.go && !actions.some((x) => x.go === e.go)) actions.push({ go: e.go, label: e.goLabel })
    setThreads((t) => ({ ...t, [key]: [...next, { role: 'assistant', content: reply, source: r.source, actions: actions.slice(0, 2), orderId: order?.id, escalate: true }] }))
    setBusy(false)
  }

  const escalate = async (i) => {
    const thread = msgs
    const firstQ = thread.find((m) => m.role === 'user')?.content || 'Support request'
    const m = (thread.map((x) => x.content).join(' ')).match(ORDER_RE)
    if (!live) {
      toast('Sign in to send this to the QuiCut team (demo mode)')
      return
    }
    setSent((x) => ({ ...x, [i]: 'sending' }))
    try {
      const transcript = thread.map((x) => (x.role === 'user' ? 'Me: ' : `${a.name} (AI): `) + x.content).join('\n').slice(0, 3800)
      await rest('rpc/ticket_create', { method: 'POST', body: { p_subject: firstQ.slice(0, 110), p_body: 'Sent from the AI support chat.\n\n' + transcript, p_order: m ? `QC-${m[1]}` : null } })
      setSent((x) => ({ ...x, [i]: 'done' }))
      toast('Sent to the QuiCut team. Replies appear under Help.')
    } catch (e) {
      setSent((x) => ({ ...x, [i]: '' }))
      toast(e.message || 'Could not send', 'bad')
    }
  }

  return (
    <>
      <button className={'sup-fab' + (open ? ' is-open' : '')} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="sup-panel" title={note.count ? `${a.name}: ${note.text}` : `${a.name} · ${a.sub}`}>
        {open ? <span className="sup-x">✕</span> : <span className="sup-ball"><img src={a.art} alt="" width="52" height="52" /></span>}
        {!open && note.count > 0 && <span className="fab3d-badge" aria-label={note.text}>{note.count}</span>}
        {!open && <span className="sup-lbl">Support</span>}
      </button>
      {open && (
        <section id="sup-panel" className="ai-panel sup-panel" role="dialog" aria-label={`${a.name}, ${a.sub}`}>
          <header className="ai-head">
            <div className="agent-head sup-head">
              <img className="sup-art" src={a.art} alt="" width="48" height="48" />
              <div>
                <div className="ai-title">{a.name} <span className="sup-ai">AI</span></div>
                <div className="muted small">{a.sub}</div>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close support">
              ✕
            </button>
          </header>
          <div className="ai-msgs" ref={list} aria-live="polite">
            <div className="ai-msg bot">{a.hello}</div>
            {note.count > 0 && <div className="ai-msg bot agent-note">Heads up: {note.text}.</div>}
            {msgs.map((m, i) => {
              const o = m.orderId && s.orders.find((x) => x.id === m.orderId)
              return (
                <div key={i} className={'ai-msg ' + (m.role === 'user' ? 'me' : 'bot')}>
                  {m.content}
                  {o && (
                    <div className="sup-order">
                      <b>{o.title}</b>
                      <Pill status={o.status} />
                      {o.dueAt && o.status !== 'completed' && <span className="muted small">{dueIn(o.dueAt)}</span>}
                    </div>
                  )}
                  {m.role !== 'user' && (m.actions?.length > 0 || m.escalate) && (
                    <div className="sup-actions">
                      {m.actions.map((x) => (
                        <button key={x.go} className="ai-chip" onClick={() => { goTab(x.go); setOpen(false) }}>
                          {x.label}
                        </button>
                      ))}
                      {m.escalate && i === msgs.length - 1 && (
                        <button className="ai-chip sup-human" disabled={sent[i] === 'sending' || sent[i] === 'done'} onClick={() => escalate(i)}>
                          {sent[i] === 'done' ? 'Sent to the team' : sent[i] === 'sending' ? 'Sending…' : 'Talk to the team'}
                        </button>
                      )}
                    </div>
                  )}
                  {m.source === 'rules' && <div className="ai-src">Offline answer</div>}
                </div>
              )
            })}
            {busy && (
              <div className="ai-msg bot ai-typing" aria-label="Thinking">
                <i />
                <i />
                <i />
              </div>
            )}
          </div>
          {!msgs.length && (
            <div className="ai-starters">
              {a.starters.map((q) => (
                <button key={q} className="ai-chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="ai-input"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input aria-label={'Message ' + a.name} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ask ' + a.name + '…'} maxLength={800} />
            <button className="btn btn-red btn-sm" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  )
}
