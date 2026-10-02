import { useEffect, useRef, useState } from 'react'
import { aiChat, chatContext } from '../app/services/ai.js'
import { rest } from '../app/services/supa.js'
import { CFO_ART, CIO_ART } from './agentArt.js'
import './agents.css'

// Two AI agents for the admin panel: a CFO (money) and a CIO (systems, errors, operations backlog).
// They answer from the live platform numbers. The portraits were generated with Higgsfield.
const AGENTS = {
  cfo: {
    name: 'Aarav · CFO',
    sub: 'Money, margins, payouts',
    art: CFO_ART,
    persona:
      'You are Aarav, the CFO agent for QuiCut, an Indian video-editing marketplace. Focus on cash collected, GMV, QuiCut revenue (20% take rate), editor payouts due, refunds and risks. Answer with concrete rupee numbers from the data, short and direct. If something is not in the data, say so. Do not give personal investment advice.',
    hello: 'I watch the money: cash in, margin, payouts and refunds. What do you want to know?',
    starters: ['How much cash came in this month?', 'What do we owe editors this Monday?', 'Is our take rate healthy?', 'Any refund or payout risk?'],
  },
  cio: {
    name: 'Vihaan · CIO',
    sub: 'Systems, errors, operations',
    art: CIO_ART,
    persona:
      'You are Vihaan, the CIO agent for QuiCut, an Indian video-editing marketplace. Focus on app health (errors, slow pages), stuck or late orders, the KYC and support backlog, and what the team should fix first. Answer in short, concrete steps using the data given. If something is not in the data, say so.',
    hello: 'I watch the systems: errors, speed, stuck orders and backlogs. Ask me what to fix first.',
    starters: ['Any errors I should fix today?', 'Which orders are late or stuck?', 'How big is the KYC and support backlog?', 'What should the team do first today?'],
  },
}

async function systemHealth(live) {
  if (!live) return { note: 'Demo mode: no live error data.' }
  try {
    const rows = await rest('monitor_events?select=level,message,page,created_at&order=created_at.desc&limit=60')
    const by = {}
    for (const r of rows || []) by[r.message] = (by[r.message] || 0) + 1
    return { lastErrors: rows?.length || 0, topIssues: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([message, count]) => ({ message: String(message).slice(0, 120), count })) }
  } catch {
    return { note: 'Error data not available.' }
  }
}

function Agent({ id, s, live, open, onToggle, slot }) {
  const a = AGENTS[id]
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef()

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [msgs.length, busy, open])
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onToggle()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const send = async (q) => {
    const content = (q ?? text).trim()
    if (!content || busy) return
    setText('')
    const next = [...msgs, { role: 'user', content }]
    setMsgs(next)
    setBusy(true)
    const ctx = { ...chatContext('admin', s, {}), agent: id === 'cfo' ? 'CFO' : 'CIO', ...(id === 'cio' ? { systemHealth: await systemHealth(live) } : {}) }
    const framed = [{ role: 'user', content: a.persona }, { role: 'assistant', content: 'Understood.' }, ...next]
    const r = await aiChat('admin', framed, ctx)
    setMsgs([...next, { role: 'assistant', content: r.reply, source: r.source }])
    setBusy(false)
  }

  return (
    <>
      <button className={'agent-fab agent-fab-' + slot + (open ? ' is-open' : '')} onClick={onToggle} aria-expanded={open} aria-controls={'agent-' + id} title={a.name}>
        <img src={a.art} alt="" width="56" height="56" />
        <span className="agent-fab-lbl">{id === 'cfo' ? 'CFO' : 'CIO'}</span>
      </button>
      {open && (
        <section id={'agent-' + id} className="ai-panel agent-panel" role="dialog" aria-label={a.name + ' AI agent'}>
          <header className="ai-head">
            <div className="agent-head">
              <img className="agent-art" src={a.art} alt="" width="52" height="52" />
              <div>
                <div className="ai-title">{a.name}</div>
                <div className="muted small">{a.sub}</div>
              </div>
            </div>
            <button className="icon-btn" onClick={onToggle} aria-label={'Close ' + a.name}>
              ✕
            </button>
          </header>
          <div className="ai-msgs" ref={list} aria-live="polite">
            <div className="ai-msg bot">{a.hello}</div>
            {msgs.map((m, i) => (
              <div key={i} className={'ai-msg ' + (m.role === 'user' ? 'me' : 'bot')}>
                {m.content}
                {m.source === 'rules' && <div className="ai-src">Offline answer</div>}
              </div>
            ))}
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
            <input aria-label={'Message ' + a.name} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Ask ' + a.name.split(' ')[0] + '…'} maxLength={800} />
            <button className="btn btn-red btn-sm" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  )
}

// Two separate agents, each with its own button, window and conversation. Opening one closes the other.
export default function ExecAgents({ s, live }) {
  const [open, setOpen] = useState(null)
  return (
    <>
      <Agent id="cfo" slot="1" s={s} live={live} open={open === 'cfo'} onToggle={() => setOpen((o) => (o === 'cfo' ? null : 'cfo'))} />
      <Agent id="cio" slot="2" s={s} live={live} open={open === 'cio'} onToggle={() => setOpen((o) => (o === 'cio' ? null : 'cio'))} />
    </>
  )
}
