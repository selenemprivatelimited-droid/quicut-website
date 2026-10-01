import { useEffect, useRef, useState } from 'react'
import { aiChat, chatContext } from '../services/ai.js'

const STARTERS = {
  creator: ['Which edit should I pick for a 10 min travel vlog?', 'How many credits do I have?', 'Which credit pack is best value?', 'Where is my order?'],
  editor: ['What should I work on first?', 'How much will I get paid this Monday?', 'Explain TDS for me', 'Which open job pays the most?'],
  admin: ['Which orders are late or at risk?', 'Who are my best and worst editors?', 'How much revenue so far?', 'What should I do first today?'],
}
const HELLO = {
  creator: 'Hi! I can help you pick an edit, write a brief, choose a credit pack or track an order. Ask in Telugu, Hindi or English.',
  editor: 'Hi! Ask me about your jobs, deadlines, briefs, revisions or payouts.',
  admin: 'Ask me anything about orders, editors, creators, KYC or money. I answer from the live platform data.',
}

/** Floating "Ask QuiCut AI" assistant, available to every role. */
export default function Copilot({ role, s, ids }) {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState({})
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef()
  const key = role + (role === 'creator' ? ids.creatorId : role === 'editor' ? ids.editorId : '')
  const msgs = threads[key] || []

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [msgs.length, busy, open])

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
    const next = [...msgs, { role: 'user', content }]
    setThreads((t) => ({ ...t, [key]: next }))
    setBusy(true)
    const r = await aiChat(role, next, chatContext(role, s, ids))
    setThreads((t) => ({ ...t, [key]: [...next, { role: 'assistant', content: r.reply, source: r.source }] }))
    setBusy(false)
  }

  return (
    <>
      <button className={'ai-fab' + (open ? ' is-open' : '')} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="ai-panel">
        <span className="ai-spark" aria-hidden="true">✦</span>
        <span>{open ? 'Close' : 'Ask QuiCut AI'}</span>
      </button>
      {open && (
        <section id="ai-panel" className="ai-panel" role="dialog" aria-label="QuiCut AI assistant">
          <header className="ai-head">
            <div>
              <div className="ai-title">
                <span className="ai-spark" aria-hidden="true">✦</span> QuiCut AI
              </div>
              <div className="muted small">{role === 'admin' ? 'Ops assistant' : role === 'editor' ? 'Editor assistant' : 'Creator assistant'}</div>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              ✕
            </button>
          </header>
          <div className="ai-msgs" ref={list} aria-live="polite">
            <div className="ai-msg bot">{HELLO[role]}</div>
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
              {STARTERS[role].map((q) => (
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
            <input
              aria-label="Message QuiCut AI"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={role === 'creator' ? 'Ask anything… (Telugu, Hindi, English)' : 'Ask anything…'}
              maxLength={800}
            />
            <VoiceButton onText={(t) => setText((x) => (x ? x + ' ' : '') + t)} />
            <button className="btn btn-red btn-sm" type="submit" disabled={busy || !text.trim()}>
              Send
            </button>
          </form>
        </section>
      )}
    </>
  )
}

/** Small "AI" result card used inside the views. */
export function AiCard({ title, source, children, onClose }) {
  return (
    <div className="ai-card">
      <div className="ai-card-head">
        <span className="ai-tag">✦ {title}</span>
        <span className="muted small">{source === 'rules' ? 'offline rules' : 'QuiCut AI'}</span>
        {onClose && (
          <button className="link-btn small" onClick={onClose}>
            Hide
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

const LANGS = [
  ['te-IN', 'తె'],
  ['hi-IN', 'हि'],
  ['en-IN', 'EN'],
]

/** Speak instead of typing. Uses the browser's speech recognition (Chrome, Edge, Android, Safari). */
export function VoiceButton({ onText }) {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('qc-voice-lang') || 'te-IN'
    } catch {
      return 'te-IN'
    }
  })
  const [on, setOn] = useState(false)
  const rec = useRef(null)
  if (!SR) return null

  const cycle = () => {
    const i = LANGS.findIndex(([l]) => l === lang)
    const next = LANGS[(i + 1) % LANGS.length][0]
    setLang(next)
    try {
      localStorage.setItem('qc-voice-lang', next)
    } catch {
      /* storage blocked */
    }
  }
  const toggle = () => {
    if (on) {
      rec.current?.stop()
      return
    }
    const r = new SR()
    r.lang = lang
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '))
    r.onend = () => setOn(false)
    r.onerror = () => setOn(false)
    rec.current = r
    setOn(true)
    r.start()
  }
  return (
    <span className="voice">
      <button type="button" className={'voice-btn' + (on ? ' is-on' : '')} onClick={toggle} aria-label={on ? 'Stop listening' : 'Speak instead of typing'} title="Speak instead of typing">
        {on ? '■' : '🎙'}
      </button>
      <button type="button" className="voice-lang" onClick={cycle} aria-label={`Voice language: ${lang}`} title="Change voice language">
        {LANGS.find(([l]) => l === lang)[1]}
      </button>
    </span>
  )
}
