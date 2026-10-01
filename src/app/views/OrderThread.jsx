import { useState } from 'react'
import { sendMessage } from '../services/store.js'
import { aiReply } from '../services/ai.js'
import { ago, dueIn, toast } from '../ui.jsx'
import { VoiceButton } from './Copilot.jsx'

/** Chat between the creator and the editor on one order. Editors get an AI reply drafter. */
export default function OrderThread({ s, o, as }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const msgs = o.messages || []
  const creator = s.creators.find((c) => c.id === o.creatorId)
  const editor = s.editors.find((e) => e.id === o.editorId)
  const other = as === 'creator' ? editor?.name?.split(' ')[0] || 'your editor' : creator?.name?.split(' ')[0] || 'the creator'
  const canChat = !!o.editorId && !['refunded'].includes(o.status)

  const send = () => {
    const t = text.trim()
    if (!t) return
    sendMessage(o.id, as, t)
    setText('')
  }

  const draft = async () => {
    setBusy(true)
    const lastFromCreator = [...msgs].reverse().find((m) => m.from === 'creator')?.text
    const note = lastFromCreator || (o.status === 'revision' ? o.revisionNote : o.brief) || ''
    const r = await aiReply(o, creator, dueIn(o.dueAt), note, text.trim())
    setText(r.reply)
    setBusy(false)
    if (r.source === 'rules') toast('AI offline, used a simple template', 'bad')
  }

  return (
    <div className="thread">
      <div className="thread-head">
        <span className="label">Messages with {other}</span>
        <span className="muted small">{msgs.length ? `${msgs.length} message${msgs.length > 1 ? 's' : ''}` : ''}</span>
      </div>
      {!canChat ? (
        <p className="muted small">Messages open once an editor takes the order.</p>
      ) : (
        <>
          {msgs.length > 0 && (
            <div className="thread-list">
              {msgs.map((m, i) => (
                <div key={i} className={'bubble ' + (m.from === as ? 'mine' : 'theirs')}>
                  <div>{m.text}</div>
                  <div className="bubble-meta">
                    {m.from === 'creator' ? creator?.name : editor?.name} · {ago(m.at)}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="thread-input">
            <textarea
              rows={2}
              aria-label={`Message ${other}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={as === 'editor' ? 'Write a reply, or let AI draft it…' : `Message ${other}…`}
              maxLength={1000}
            />
            <div className="thread-actions">
              <VoiceButton onText={(t) => setText((x) => (x ? x + ' ' : '') + t)} />
              {as === 'editor' && (
                <button type="button" className="btn btn-ai btn-sm" onClick={draft} disabled={busy}>
                  {busy ? 'Drafting…' : '✦ Draft reply'}
                </button>
              )}
              <button type="button" className="btn btn-red btn-sm" onClick={send} disabled={!text.trim()}>
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
