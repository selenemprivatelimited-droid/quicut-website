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

export default function ExecAgents({ s, live }) {
  const [open, setOpen] = useState(false)
  const [who, setWho] = useState('cfo')
  const [threads, setThreads] = useState({ cfo: [], cio: [] })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef()
  const a = AGENTS[who]
  const msgs = threads[who]

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [msgs.length, busy, open, who])
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  const send = async (q) => {
    const content = (q ?? text).trim()
    if (!content || busy) return
    setText('')
    const id = who
    const next = [...threads[id], { role: 'user', content }]
    setThreads((t) => ({ ...t, [id]: next }))
    setBusy(true)
    const ctx = { ...chatContext('admin', s, {}), agent: id === 'cfo' ? 'CFO' : 'CIO', ...(id === 'cio' ? { systemHealth: await systemHealth(live) } : {}) }
    const framed = [{ role: 'user', content: AGENTS[id].persona }, { role: 'assistant', content: 'Understood.' }, ...next]
    const r = await aiChat('admin', framed, ctx)
    setThreads((t) => ({ ...t, [id]: [...next, { role: 'assistant', content: r.reply, source: r.source }] }))
    setBusy(false)
  }

  return (
    <>
      <button className={'ai-fab agents-fab' + (open ? ' is-open' : '')} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="agents-panel">
        {open ? (
          <span className="ai-fab-lbl">Close</span>
        ) : (
          <>
            <span className="agent-stack" aria-hidden="true">
              <img src={CFO_ART} alt="" width="30" height="30" />
              <img src={CIO_ART} alt="" width="30" height="30" />
            </span>
            <span className="ai-fab-lbl">CFO & CIO</span>
          </>
        )}
      </button>
      {open && (
        <section id="agents-panel" className="ai-panel" role="dialog" aria-label="CFO and CIO AI agents">
          <header className="ai-head">
            <div className="agent-head">
              <img className="agent-art" src={a.art} alt="" width="52" height="52" />
              <div>
                <div className="ai-title">{a.name}</div>
                <div className="muted small">{a.sub}</div>
              </div>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close agents">
              ✕
            </button>
          </header>
          <div className="seg agent-tabs" role="tablist" aria-label="Choose agent">
            {['cfo', 'cio'].map((k) => (
              <button key={k} role="tab" aria-selected={who === k} className={'seg-btn' + (who === k ? ' is-on' : '')} onClick={() => setWho(k)}>
                {k === 'cfo' ? 'CFO · Money' : 'CIO · Systems'}
              </button>
            ))}
          </div>
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
