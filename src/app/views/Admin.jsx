// Admin sections (used by the private admin app in src/admin/).
import { useState } from 'react'
import { EDIT_TYPES, ADDONS, CREDIT_PACKS, PACKS_ARE_PLACEHOLDER, PAYOUTS, packTotal, packPrice, editType } from '../config/pricing.js'
import {
  creditBalance,
  editorMoney,
  assignEditor,
  refundOrder,
  reviewKyc,
  payPayout,
  grantCredits,
  setEditorStatus,
  completeDeletion,
  isLive,
} from '../services/store.js'
import { Pill, Empty, Credits, act, inr, qc, ago, dueIn } from '../ui.jsx'
import { aiOps, aiChat, opsSnapshot } from '../services/ai.js'
import { AiCard } from './Copilot.jsx'

const LEVEL = { urgent: 'alert-bad', soon: 'alert-warn', fyi: 'alert-info' }
const tabFor = (t) => (/kyc|verif/i.test(t) ? 'kyc' : /payout|upi/i.test(t) ? 'payouts' : /QC-\d+|order|deadline|late|unassigned/i.test(t) ? 'orders' : 'people')

export function OpsBrief({ s, go }) {
  const [brief, setBrief] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [ans, setAns] = useState(null)
  const [asking, setAsking] = useState(false)
  const run = async () => {
    setBusy(true)
    setBrief(await aiOps(s))
    setBusy(false)
  }
  const ask = async (e) => {
    e.preventDefault()
    if (!q.trim()) return
    setAsking(true)
    setAns(await aiChat('admin', [{ role: 'user', content: q.trim() }], opsSnapshot(s)))
    setAsking(false)
  }
  return (
    <section className="ops-ai">
      <div className="ops-ai-head">
        <div>
          <p className="kicker">// ai ops desk</p>
          <h3>Today at QuiCut</h3>
        </div>
        <button className="btn btn-ai btn-sm" onClick={run} disabled={busy}>
          {busy ? 'Reading all orders…' : brief ? '✦ Refresh brief' : "✦ Generate today's brief"}
        </button>
      </div>
      {brief && (
        <AiCard title="Ops brief" source={brief.source} onClose={() => setBrief(null)}>
          <p className="strong">{brief.headline}</p>
          {brief.numbers && <p className="mono small muted">{brief.numbers}</p>}
          <div className="list">
            {brief.items.map((it, i) => (
              <button key={i} className={`alert ${LEVEL[it.level]} alert-btn`} onClick={() => go(tabFor(it.text + ' ' + it.action))}>
                <div>
                  <div className="row-title">{it.text}</div>
                  {it.action && <div className="row-meta">→ {it.action}</div>}
                </div>
                <span className={`pill ${it.level === 'urgent' ? 'pill-amber' : 'pill-muted'}`}>{it.level}</span>
              </button>
            ))}
          </div>
        </AiCard>
      )}
      <form className="ask-data" onSubmit={ask}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask your data: which editor is fastest? how much is owed to editors?" aria-label="Ask a question about the platform data" maxLength={300} />
        <button className="btn btn-ghost btn-sm" type="submit" disabled={asking || !q.trim()}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {ans && (
        <AiCard title="Answer" source={ans.source} onClose={() => setAns(null)}>
          <p className="pre">{ans.reply}</p>
        </AiCard>
      )}
    </section>
  )
}

export function Orders({ s }) {
  const [filter, setFilter] = useState('all')
  const list = s.orders.filter((o) =>
    filter === 'all' ? true : filter === 'active' ? ['editing', 'review', 'revision'].includes(o.status) : o.status === filter
  )
  const name = (arr, id) => arr.find((x) => x.id === id)?.name || '—'
  return (
    <div className="stack">
      <div className="seg" role="radiogroup" aria-label="Filter orders">
        {[
          ['all', 'All'],
          ['paid', 'Waiting'],
          ['active', 'In progress'],
          ['completed', 'Delivered'],
          ['refunded', 'Refunded'],
        ].map(([k, l]) => (
          <button key={k} role="radio" aria-checked={filter === k} className={'seg-btn' + (filter === k ? ' is-on' : '')} onClick={() => setFilter(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Creator</th>
              <th>Edit</th>
              <th className="num">Credits</th>
              <th className="num">Editor pay</th>
              <th>Status</th>
              <th>Editor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((o) => {
              const live = ['paid', 'editing', 'revision'].includes(o.status)
              const late = live && new Date(o.dueAt) < new Date()
              return (
                <tr key={o.id} className={late ? 'late' : ''}>
                  <td>
                    <div className="mono">{o.id}</div>
                    <div className="muted small">{o.title}</div>
                  </td>
                  <td>{name(s.creators, o.creatorId)}</td>
                  <td>
                    {editType(o.typeId).name}
                    <div className={'small ' + (late ? 'bad' : 'muted')}>{live ? dueIn(o.dueAt) : ago(o.at)}</div>
                  </td>
                  <td className="num">{qc(o.credits)}</td>
                  <td className="num">{inr(o.editorPayInr)}</td>
                  <td>
                    <Pill status={o.status} />
                  </td>
                  <td>
                    {live ? (
                      <select
                        aria-label={`Editor for ${o.id}`}
                        value={o.editorId || ''}
                        onChange={(e) => act(() => assignEditor(o.id, e.target.value), `${o.id} assigned`)}
                      >
                        <option value="" disabled>
                          Assign…
                        </option>
                        {s.editors
                          .filter((e) => e.kyc?.status === 'verified' && e.status === 'active')
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                              {e.skills.includes(o.typeId) ? ' ✓' : ''}
                            </option>
                          ))}
                      </select>
                    ) : (
                      name(s.editors, o.editorId)
                    )}
                  </td>
                  <td>
                    {!['completed', 'refunded'].includes(o.status) && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => act(() => refundOrder(o.id, 'Admin refund'), `${qc(o.credits)} credits refunded`)}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!list.length && <Empty title="No orders in this view" />}
    </div>
  )
}

export function Kyc({ s, queue }) {
  const [notes, setNotes] = useState({})
  const reviewed = [...s.creators.map((p) => ({ ...p, role: 'creator' })), ...s.editors.map((p) => ({ ...p, role: 'editor' }))].filter((p) =>
    ['verified', 'rejected'].includes(p.kyc?.status)
  )
  return (
    <div className="stack">
      <h3 className="section-title">Waiting for review</h3>
      {queue.length ? (
        <div className="list">
          {queue.map((p) => (
            <div key={p.id} className="kyc-card">
              <div className="kyc-who">
                <div className="row-title">
                  {p.kyc.legalName || p.name} <span className="pill pill-muted">{p.role}</span>
                </div>
                <div className="row-meta mono">
                  {p.kyc.docType} {p.kyc.docLast4}
                  {p.kyc.panLast4 ? ` · PAN ${p.kyc.panLast4}` : ''}
                  {p.kyc.upi ? ` · UPI ${p.kyc.upi}` : ''} · {p.kyc.region === 'IN' ? 'India' : 'Outside India'} · submitted {ago(p.kyc.submittedAt)}
                </div>
              </div>
              <input
                aria-label={`Rejection reason for ${p.name}`}
                placeholder="Reason if rejecting"
                value={notes[p.id] || ''}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
              />
              <div className="btn-row">
                <button
                  className="btn btn-green btn-sm"
                  onClick={() => act(() => reviewKyc(p.role, p.id, true), `${p.name} verified`)}
                >
                  Approve
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={!notes[p.id]}
                  onClick={() => act(() => reviewKyc(p.role, p.id, false, notes[p.id]), `${p.name} rejected`)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Queue is empty">New KYC submissions from creators and editors land here.</Empty>
      )}
      <h3 className="section-title">Recently reviewed</h3>
      <div className="list">
        {reviewed.map((p) => (
          <div key={p.role + p.id} className="row static">
            <div className="row-main">
              <div className="row-title">
                {p.name} <span className="muted small">· {p.role}</span>
              </div>
              <div className="row-meta mono">
                {p.kyc.docType} {p.kyc.docLast4}
                {p.kyc.note ? ` · ${p.kyc.note}` : ''}
              </div>
            </div>
            <div className="row-side">
              <Pill status={p.kyc.status === 'verified' ? 'completed' : 'refunded'}>{p.kyc.status === 'verified' ? 'Verified' : 'Rejected'}</Pill>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small">Only document type and last 4 characters are stored. Full documents stay with the KYC provider.</p>
    </div>
  )
}

export function Payouts({ s }) {
  const [busy, setBusy] = useState(null)
  const [refs, setRefs] = useState({})
  const live = isLive()
  const due = s.payouts.filter((p) => p.status === 'requested')
  const paid = s.payouts.filter((p) => p.status === 'paid')
  const ed = (id) => s.editors.find((e) => e.id === id)
  const pay = async (p) => {
    setBusy(p.id)
    await act(() => payPayout(p.id, refs[p.id]), live ? `${inr(p.inr)} marked paid` : `${inr(p.inr)} sent to ${ed(p.editorId).upi}`)
    setBusy(null)
  }
  return (
    <div className="stack">
      <h3 className="section-title">Due · {PAYOUTS.schedule}</h3>
      {due.length ? (
        <div className="list">
          {due.map((p) => (
            <div key={p.id} className="row static">
              <div className="row-main">
                <div className="row-title">{ed(p.editorId).name}</div>
                <div className="row-meta mono">
                  {ed(p.editorId).upi} · requested {ago(p.at)}
                </div>
              </div>
              <div className="row-side">
                <b className="mono">{inr(p.inr)}</b>
                {live && (
                  <input
                    className="small-input"
                    aria-label={`UPI reference for ${ed(p.editorId).name}`}
                    placeholder="UPI ref no."
                    value={refs[p.id] || ''}
                    onChange={(e) => setRefs((r) => ({ ...r, [p.id]: e.target.value }))}
                  />
                )}
                <button className="btn btn-green btn-sm" disabled={busy === p.id || (live && !(refs[p.id] || '').trim())} onClick={() => pay(p)}>
                  {busy === p.id ? 'Saving…' : live ? 'Mark paid' : `Pay via ${PAYOUTS.method}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No payouts waiting">Editors request payouts from their Earnings tab.</Empty>
      )}
      <h3 className="section-title">Editor balances</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Editor</th>
              <th className="num">Earned</th>
              <th className="num">Paid</th>
              <th className="num">Available</th>
            </tr>
          </thead>
          <tbody>
            {s.editors.map((e) => {
              const m = editorMoney(s, e.id)
              return (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className="num">{inr(m.earned)}</td>
                  <td className="num">{inr(m.paid)}</td>
                  <td className="num good">{inr(m.available)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {paid.length > 0 && (
        <>
          <h3 className="section-title">Paid</h3>
          <div className="list">
            {paid.map((p) => (
              <div key={p.id} className="row static">
                <div className="row-main">
                  <div className="row-title">{ed(p.editorId).name}</div>
                  <div className="row-meta mono">
                    {p.reference} · {ago(p.paidAt)}
                  </div>
                </div>
                <div className="row-side mono">{inr(p.inr)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function People({ s }) {
  const [grant, setGrant] = useState({})
  const reqs = s.deletions.filter((d) => d.status === 'requested')
  return (
    <div className="stack">
      {reqs.length > 0 && (
        <>
          <h3 className="section-title">Account deletion requests</h3>
          <div className="list">
            {reqs.map((d) => {
              const c = [...s.creators, ...s.editors].find((x) => x.id === d.userId) || { name: 'A user' }
              return (
                <div key={d.id} className="alert alert-warn">
                  <div>
                    <div className="row-title">{c.name} wants their account deleted</div>
                    <div className="row-meta">Requested {ago(d.at)}. Remove footage from R2 and KYC data within 30 days (DPDP).</div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => act(() => completeDeletion(d.id), 'Account deleted and logged')}
                  >
                    Mark deleted
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
      <h3 className="section-title">Creators</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Creator</th>
              <th>KYC</th>
              <th className="num">Credits</th>
              <th>Give bonus credits</th>
            </tr>
          </thead>
          <tbody>
            {s.creators.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.name}
                  <div className="muted small">
                    {c.handle} · {c.region === 'IN' ? 'India' : 'Global'}
                  </div>
                </td>
                <td>
                  <KycPill p={c} />
                </td>
                <td className="num">
                  <Credits n={creditBalance(s, c.id)} />
                </td>
                <td>
                  <div className="btn-row">
                    <input
                      className="small-input"
                      inputMode="numeric"
                      aria-label={`Bonus credits for ${c.name}`}
                      placeholder="100"
                      value={grant[c.id] || ''}
                      onChange={(e) => setGrant((g) => ({ ...g, [c.id]: e.target.value.replace(/\D/g, '') }))}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={!grant[c.id] || c.deleted}
                      onClick={async () => {
                        const n = Number(grant[c.id])
                        if (await act(() => grantCredits(c.id, n, 'Credits from QuiCut').then(() => true), `${n} credits given to ${c.name}`)) setGrant((g) => ({ ...g, [c.id]: '' }))
                      }}
                    >
                      Give
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="section-title">Editors</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Editor</th>
              <th>KYC</th>
              <th>Rating</th>
              <th>Skills</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {s.editors.map((e) => (
              <tr key={e.id} className={e.ratings >= 5 && e.rating < 4.2 ? 'late' : ''}>
                <td>
                  {e.name}
                  <div className="muted small">{e.city}</div>
                </td>
                <td>
                  <KycPill p={e} />
                </td>
                <td>{e.ratings ? `${e.rating}★ (${e.ratings})` : 'New'}</td>
                <td className="small">{e.skills.map((k) => editType(k).name).join(', ')}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => act(() => setEditorStatus(e.id, e.status === 'active' ? 'paused' : 'active'))}
                    aria-label={`${e.status === 'active' ? 'Pause' : 'Activate'} ${e.name}`}
                  >
                    <Pill status={e.status} /> {e.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KycPill({ p }) {
  const st = p.kyc?.status || 'none'
  const map = { verified: ['completed', 'Verified'], pending: ['requested', 'Pending'], rejected: ['refunded', 'Rejected'], none: ['refunded', 'Not started'], deleted: ['refunded', 'Deleted'] }
  const [tone, label] = map[st]
  return <Pill status={tone}>{label}</Pill>
}

export function Pricing() {
  return (
    <div className="stack">
      <p className="muted">
        All prices come from <code>src/app/config/pricing.js</code>. Change them there and every screen updates.
      </p>
      <h3 className="section-title">Credit packs {PACKS_ARE_PLACEHOLDER && <span className="pill pill-amber">Placeholder</span>}</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Pack</th>
              <th className="num">India (Razorpay)</th>
              <th className="num">Global (Stripe)</th>
              <th className="num">Credits</th>
            </tr>
          </thead>
          <tbody>
            {CREDIT_PACKS.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.name || p.id} {p.tag && <span className="muted small">· {p.tag}</span>}
                  {p.fits && <div className="muted small">{p.fits}</div>}
                </td>
                <td className="num">{packPrice(p, 'IN')}</td>
                <td className="num">{packPrice(p, 'GLOBAL')}</td>
                <td className="num">
                  {qc(packTotal(p))}
                  {p.bonus ? <span className="muted small"> (+{qc(p.bonus)})</span> : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="section-title">Edits</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Edit</th>
              <th className="num">Creator pays</th>
              <th className="num">Editor gets</th>
              <th className="num">QuiCut keeps</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {[...EDIT_TYPES, ...ADDONS.map((a) => ({ ...a, name: '+ ' + a.name, delivery: '' }))].map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="num">{qc(t.credits)} QC</td>
                <td className="num">{inr(t.editorPayInr)}</td>
                <td className="num">{inr(t.credits - t.editorPayInr)}</td>
                <td className="small muted">{t.delivery}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
