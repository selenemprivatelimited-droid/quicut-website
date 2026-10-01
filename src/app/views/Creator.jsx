import { useState } from 'react'
import {
  EDIT_TYPES,
  ADDONS,
  CREDIT_PACKS,
  PACKS_ARE_PLACEHOLDER,
  CREDIT,
  REGIONS,
  quote,
  packTotal,
  packPrice,
  editType,
  addon,
} from '../config/pricing.js'
import { creditBalance, buyPack, placeOrder, approveDelivery, askRevision, requestDeletion, isVerified } from '../services/store.js'
import { aiBrief } from '../services/ai.js'
import { AiCard, VoiceButton } from './Copilot.jsx'
import OrderThread from './OrderThread.jsx'
import { KycBanner } from './Kyc.jsx'
import { Tabs, Credits, Coin, Pill, Empty, Sheet, Timeline, Stars, toast, qc, ago, dueIn } from '../ui.jsx'

export default function Creator({ s, creatorId }) {
  const [tab, setTab] = useState('home')
  const me = s.creators.find((c) => c.id === creatorId)
  const balance = creditBalance(s, creatorId)
  const orders = s.orders.filter((o) => o.creatorId === creatorId)
  const toReview = orders.filter((o) => o.status === 'review').length

  return (
    <div className="role-view">
      <div className="view-head">
        <div>
          <p className="kicker">// creator</p>
          <h1>Hi {me.name.split(' ')[0]}</h1>
        </div>
        <button className="balance-chip" onClick={() => setTab('wallet')} aria-label="Open wallet">
          <Credits n={balance} />
          <span className="chip-add">+ Add</span>
        </button>
      </div>
      <KycBanner role="creator" person={me} compact />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'home', label: 'Home' },
          { id: 'new', label: 'New edit' },
          { id: 'orders', label: 'Orders', count: toReview },
          { id: 'wallet', label: 'Wallet' },
          { id: 'profile', label: 'Profile' },
        ]}
      />
      {tab === 'home' && <Home orders={orders} balance={balance} go={setTab} />}
      {tab === 'new' && <NewEdit me={me} balance={balance} go={setTab} />}
      {tab === 'orders' && <Orders s={s} orders={orders} />}
      {tab === 'wallet' && <Wallet s={s} me={me} balance={balance} />}
      {tab === 'profile' && <Profile s={s} me={me} orders={orders} />}
    </div>
  )
}

function Home({ orders, balance, go }) {
  const active = orders.filter((o) => !['completed', 'refunded'].includes(o.status))
  const cheapest = Math.min(...EDIT_TYPES.map((t) => t.credits))
  return (
    <div className="stack">
      <section className="hero-card">
        <div>
          <p className="kicker">// new project</p>
          <h2>Start your next video edit</h2>
          <p className="muted">From {qc(cheapest)} credits · delivered in 24 hours on most edits</p>
        </div>
        <button className="btn btn-red" onClick={() => go('new')}>
          Start project
        </button>
      </section>
      {balance < cheapest && (
        <div className="notice">
          You have <Credits n={balance} />. Top up to order your next edit.{' '}
          <button className="link-btn" onClick={() => go('wallet')}>
            Buy credits
          </button>
        </div>
      )}
      <h3 className="section-title">In progress</h3>
      {active.length ? (
        <div className="list">
          {active.map((o) => (
            <OrderRow key={o.id} o={o} onClick={() => go('orders')} />
          ))}
        </div>
      ) : (
        <Empty title="No edits in progress">Start one and it shows up here with a live countdown.</Empty>
      )}
    </div>
  )
}

export function OrderRow({ o, onClick, right, sub }) {
  return (
    <button className="row" onClick={onClick}>
      <div className="row-main">
        <div className="row-title">{o.title}</div>
        <div className="row-meta">
          {o.id} · {editType(o.typeId).name}
          {!['completed', 'refunded'].includes(o.status) && <> · {dueIn(o.dueAt)}</>}
          {sub}
        </div>
      </div>
      <div className="row-side">{right || <Pill status={o.status} />}</div>
    </button>
  )
}

function NewEdit({ me, balance, go }) {
  const [typeId, setTypeId] = useState('vlog')
  const [adds, setAdds] = useState([])
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [file, setFile] = useState(null)
  const q = quote(typeId, adds)
  const short = q.credits - balance
  const [ai, setAi] = useState(null)
  const [aiBusy, setAiBusy] = useState(false)
  const ok = isVerified(me)

  const readWithAi = async () => {
    setAiBusy(true)
    const r = await aiBrief(brief)
    setAi(r)
    setAiBusy(false)
  }
  const applyAi = () => {
    setTypeId(ai.suggestedType)
    setAdds((a) => [...new Set([...a, ...ai.suggestedAddons])])
    toast('AI suggestion applied')
  }
  const aiDiffers = ai && (ai.suggestedType !== typeId || ai.suggestedAddons.some((x) => !adds.includes(x)))

  const toggle = (id) => setAdds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  const submit = (e) => {
    e.preventDefault()
    try {
      const id = placeOrder({ creatorId: me.id, typeId, addons: adds, title: title.trim(), brief, footage: file?.name, checklist: ai?.checklist?.length ? ai : null })
      toast(`${id} placed. ${qc(q.credits)} credits used.`)
      go('orders')
    } catch (err) {
      toast(err.message, 'bad')
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <h3 className="section-title">1. Pick your editing tier</h3>
      <div className="type-grid" role="radiogroup" aria-label="Edit type">
        {EDIT_TYPES.map((t) => (
          <button
            type="button"
            key={t.id}
            role="radio"
            aria-checked={typeId === t.id}
            className={'type' + (typeId === t.id ? ' is-on' : '')}
            onClick={() => setTypeId(t.id)}
          >
            <span className="type-name">{t.name}</span>
            <Credits n={t.credits} />
            <span className="type-meta">
              {t.output} · {t.delivery}
            </span>
          </button>
        ))}
      </div>

      <h3 className="section-title">2. Add-ons</h3>
      <div className="chips-row">
        {ADDONS.map((a) => (
          <label key={a.id} className={'toggle-chip' + (adds.includes(a.id) ? ' is-on' : '')} htmlFor={'ad-' + a.id}>
            <input id={'ad-' + a.id} type="checkbox" checked={adds.includes(a.id)} onChange={() => toggle(a.id)} />
            {a.name} <span className="muted">+{qc(a.credits)}</span>
          </label>
        ))}
      </div>

      <h3 className="section-title">3. Upload footage + brief</h3>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="o-title">Video title</label>
          <input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Araku Valley Travel Vlog" />
        </div>
        <div className="field">
          <label htmlFor="o-file">Raw footage (MP4, MOV, MKV · max 5 GB)</label>
          <input id="o-file" type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        </div>
        <div className="field span-2">
          <label htmlFor="o-brief">Your brief, in Telugu, Hindi or English</label>
          <textarea
            id="o-brief"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Telugu lo edit cheyyandi. Warm colour grade, Telugu background music, forest part lo slow motion…"
          />
          <div className="ai-row">
            <VoiceButton onText={(t) => setBrief((b) => (b ? b + ' ' : '') + t)} />
            <button type="button" className="btn btn-ai btn-sm" onClick={readWithAi} disabled={aiBusy || brief.trim().length < 8}>
              {aiBusy ? 'Reading your brief…' : '✦ Read my brief with AI'}
            </button>
            <span className="muted small">Turns your brief into a checklist for your editor and suggests the right edit.</span>
          </div>
          {ai && (
            <AiCard title="AI brief" source={ai.source} onClose={() => setAi(null)}>
              {ai.language && <p className="mono small muted">Language: {ai.language}</p>}
              {ai.summary && <p>{ai.summary}</p>}
              {ai.checklist.length > 0 && (
                <ul className="ai-check">
                  {ai.checklist.map((c, i) => (
                    <li key={i}>
                      <b>{c.item}</b>
                      {c.detail && c.detail !== c.item ? <span className="muted"> · {c.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {ai.questions.length > 0 && (
                <div className="ai-questions">
                  <span className="label">Your editor may ask</span>
                  {ai.questions.map((q, i) => (
                    <p key={i} className="small">? {q}</p>
                  ))}
                </div>
              )}
              <div className="ai-suggest">
                <span className="small">
                  Suggested: <b>{editType(ai.suggestedType).name}</b>
                  {ai.suggestedAddons.length ? ' + ' + ai.suggestedAddons.map((a) => addon(a).name).join(', ') : ''}
                </span>
                {aiDiffers ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={applyAi}>
                    Use this
                  </button>
                ) : (
                  <span className="pill pill-green">Matches your pick</span>
                )}
              </div>
            </AiCard>
          )}
        </div>
      </div>

      <div className="checkout">
        <div>
          <div className="muted small">Total</div>
          <Credits n={q.credits} big />
          <div className="muted small">
            Delivered within {q.hours} hours · balance after: {qc(Math.max(0, balance - q.credits))}
          </div>
        </div>
        {!ok ? (
          <span className="bad small">Complete KYC above to place orders</span>
        ) : short > 0 ? (
          <div className="checkout-actions">
            <span className="bad small">You need {qc(short)} more credits</span>
            <button type="button" className="btn btn-red" onClick={() => go('wallet')}>
              Buy credits
            </button>
          </div>
        ) : (
          <button className="btn btn-red" type="submit">
            Confirm · {qc(q.credits)} {CREDIT.short}
          </button>
        )}
      </div>
      <p className="muted small">Footage upload is simulated in this demo. Live uploads go to Cloudflare R2 with signed links.</p>
    </form>
  )
}

function Orders({ s, orders }) {
  const [open, setOpen] = useState(null)
  const o = orders.find((x) => x.id === open)
  if (!orders.length) return <Empty title="No orders yet">Your edits will appear here.</Empty>
  return (
    <>
      <div className="list">
        {orders.map((x) => (
          <OrderRow key={x.id} o={x} onClick={() => setOpen(x.id)} />
        ))}
      </div>
      {o && <OrderSheet s={s} o={o} onClose={() => setOpen(null)} />}
    </>
  )
}

function OrderSheet({ s, o, onClose }) {
  const [note, setNote] = useState('')
  const [stars, setStars] = useState(5)
  const editor = s.editors.find((e) => e.id === o.editorId)
  return (
    <Sheet title={o.title} onClose={onClose}>
      <p className="mono small muted">// {o.id}</p>
      <Timeline order={o} />
      <dl className="kv">
        <dt>Edit</dt>
        <dd>
          {editType(o.typeId).name}
          {o.addons.length ? ' + ' + o.addons.map((a) => addon(a).name).join(', ') : ''}
        </dd>
        <dt>Paid</dt>
        <dd>
          <Credits n={o.credits} />
        </dd>
        <dt>Editor</dt>
        <dd>{editor ? `${editor.name} · ${editor.rating}★ · ${editor.city}` : 'Being matched'}</dd>
        <dt>Status</dt>
        <dd>
          <Pill status={o.status} /> {!['completed', 'refunded'].includes(o.status) && <span className="muted small">{dueIn(o.dueAt)}</span>}
        </dd>
        {o.brief && (
          <>
            <dt>Brief</dt>
            <dd>{o.brief}</dd>
          </>
        )}
        {o.stars && (
          <>
            <dt>Your rating</dt>
            <dd>{'★'.repeat(o.stars)}</dd>
          </>
        )}
      </dl>
      {o.checklist?.checklist?.length > 0 && (
        <div className="ai-mini">
          <span className="ai-tag">✦ Your AI brief</span>
          <span className="small muted">
            {o.checklist.checklist.length} items sent to your editor
            {o.done ? ` · ${Object.values(o.done).filter(Boolean).length} done` : ''}
          </span>
        </div>
      )}
      <OrderThread s={s} o={o} as="creator" />
      {o.status === 'review' && (
        <div className="stack">
          <a className="btn btn-ghost" href={o.deliveryUrl} target="_blank" rel="noreferrer">
            Watch the edit
          </a>
          <div className="field">
            <span className="label">Rate this edit</span>
            <Stars value={stars} onChange={setStars} />
          </div>
          <button
            className="btn btn-red"
            onClick={() => {
              approveDelivery(o.id, stars)
              toast('Approved. Your editor gets paid.')
              onClose()
            }}
          >
            Approve and download
          </button>
          <div className="field">
            <label htmlFor="rev-note">Need changes? {o.revisions === 0 ? 'Your first revision is free.' : ''}</label>
            <textarea id="rev-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Audio too loud at 4:30, trim the intro" />
          </div>
          <button
            className="btn btn-ghost"
            disabled={!note.trim()}
            onClick={() => {
              askRevision(o.id, note.trim())
              toast('Revision sent to your editor')
              onClose()
            }}
          >
            Ask for a revision
          </button>
        </div>
      )}
      {o.status === 'completed' && o.deliveryUrl && (
        <a className="btn btn-ghost" href={o.deliveryUrl} target="_blank" rel="noreferrer">
          Download final video
        </a>
      )}
      {o.status === 'refunded' && <p className="muted">Refunded: {qc(o.credits)} credits went back to your wallet.</p>}
    </Sheet>
  )
}

function Wallet({ s, me, balance }) {
  const [region, setRegion] = useState(me.kyc?.region || me.region || 'IN')
  const [method, setMethod] = useState(REGIONS[region].methods[0])
  const [pick, setPick] = useState(null)
  const [busy, setBusy] = useState(false)
  const history = s.ledger.filter((l) => l.creatorId === me.id).slice().reverse()
  const ok = isVerified(me)
  const R = REGIONS[region]

  const changeRegion = (r) => {
    setRegion(r)
    setMethod(REGIONS[r].methods[0])
  }
  const pay = async () => {
    setBusy(true)
    try {
      await buyPack(me, pick, region, method.split(' ·')[0])
      toast(`${qc(packTotal(pick))} credits added`)
      setPick(null)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <section className="wallet-card">
        <p className="kicker">// available balance</p>
        <Credits n={balance} big />
        <p className="muted small">{CREDIT.name} work on every edit type. They never expire, and refunds come back as credits.</p>
      </section>
      <div className="wallet-head">
        <h3 className="section-title">Buy credits</h3>
        <div className="seg" role="radiogroup" aria-label="Paying from">
          {Object.entries(REGIONS).map(([k, r]) => (
            <button key={k} role="radio" aria-checked={region === k} className={'seg-btn' + (region === k ? ' is-on' : '')} onClick={() => changeRegion(k)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {PACKS_ARE_PLACEHOLDER && <p className="muted small">Sample packs. Final packs and prices coming soon.</p>}
      <div className="pack-grid">
        {CREDIT_PACKS.map((p) => (
          <div key={p.id} className="pack">
            {p.tag && <span className="pack-tag">{p.tag}</span>}
            <div className="pack-credits">
              <Coin size={26} /> {qc(packTotal(p))}
            </div>
            <div className="pack-bonus">{p.bonus ? `${qc(p.credits)} + ${qc(p.bonus)} bonus` : 'No bonus'}</div>
            <button className="btn btn-red btn-block" disabled={!ok} onClick={() => setPick(p)}>
              {packPrice(p, region)}
            </button>
          </div>
        ))}
      </div>
      {!ok && <p className="bad small">Complete KYC to buy credits.</p>}
      <h3 className="section-title">Transactions</h3>
      <div className="list">
        {history.map((l) => (
          <div key={l.id} className="row static">
            <div className="row-main">
              <div className="row-title">{l.note}</div>
              <div className="row-meta">{ago(l.at)}</div>
            </div>
            <div className={'row-side mono ' + (l.credits > 0 ? 'good' : '')}>
              {l.credits > 0 ? '+' : '−'}
              {qc(Math.abs(l.credits))} {CREDIT.short}
            </div>
          </div>
        ))}
      </div>

      {pick && (
        <Sheet title="Checkout" onClose={() => !busy && setPick(null)}>
          <dl className="kv">
            <dt>Pack</dt>
            <dd>
              <Credits n={packTotal(pick)} />
            </dd>
            <dt>Price</dt>
            <dd className="strong">{packPrice(pick, region)}</dd>
            <dt>Paying from</dt>
            <dd>{R.label}</dd>
          </dl>
          <fieldset className="methods">
            <legend className="label">Choose payment</legend>
            {R.methods.map((m) => (
              <label key={m} className={'method' + (method === m ? ' is-on' : '')}>
                <input type="radio" name="pm" checked={method === m} onChange={() => setMethod(m)} />
                {m}
              </label>
            ))}
          </fieldset>
          <button className="btn btn-red btn-block" onClick={pay} disabled={busy}>
            {busy ? 'Processing…' : `Pay ${packPrice(pick, region)}`}
          </button>
          <p className="muted small center">
            🔒 Secured by {R.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} · Demo mode, nothing is charged
          </p>
        </Sheet>
      )}
    </div>
  )
}

function Profile({ s, me, orders }) {
  const pending = s.deletions.some((d) => d.userId === me.id && d.status === 'requested')
  const done = orders.filter((o) => o.status === 'completed')
  return (
    <div className="stack">
      <section className="profile-card">
        <div className="avatar">{me.name[0]}</div>
        <div>
          <div className="profile-name">{me.name}</div>
          <div className="muted mono small">
            // {me.handle} · {me.lang} creator
          </div>
        </div>
      </section>
      <div className="stat-row">
        <div className="mini-stat">
          <b>{orders.length}</b> orders
        </div>
        <div className="mini-stat">
          <b>{done.length}</b> delivered
        </div>
        <div className="mini-stat">
          <b>{qc(orders.reduce((a, o) => a + (o.status === 'refunded' ? 0 : o.credits), 0))}</b> credits spent
        </div>
      </div>
      <h3 className="section-title">Identity (KYC)</h3>
      <KycBanner role="creator" person={me} />
      <h3 className="section-title">Privacy</h3>
      <div className="row static">
        <div className="row-main">
          <div className="row-title">Delete my account</div>
          <div className="row-meta">Your data and footage are removed within 30 days, as required by the DPDP Act.</div>
        </div>
        <div className="row-side">
          {pending ? (
            <span className="pill pill-amber">Requested</span>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                requestDeletion(me.id)
                toast('Deletion requested. Our team will confirm on WhatsApp.')
              }}
            >
              Request deletion
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
