import { useState } from 'react'
import { EDIT_TYPES, ADDONS, PAYOUTS, editType, addon } from '../config/pricing.js'
import { editorMoney, acceptJob, deliverJob, requestPayout, isVerified } from '../services/store.js'
import { KycBanner } from './Kyc.jsx'
import { OrderRow } from './Creator.jsx'
import { Tabs, Pill, Empty, Sheet, Stat, toast, inr, ago, dueIn } from '../ui.jsx'

export default function Editor({ s, editorId }) {
  const [tab, setTab] = useState('jobs')
  const me = s.editors.find((e) => e.id === editorId)
  const money = editorMoney(s, editorId)
  const open = s.orders.filter((o) => o.status === 'paid')
  const mine = s.orders.filter((o) => o.editorId === editorId && o.status !== 'refunded')
  const active = mine.filter((o) => ['editing', 'revision'].includes(o.status))

  return (
    <div className="role-view">
      <div className="view-head">
        <div>
          <p className="kicker">// editor dashboard</p>
          <h1>Good to see you, {me.name.split(' ')[0]}</h1>
        </div>
        <div className="earn-chip">
          <span className="muted small">Available</span>
          <b>{inr(money.available)}</b>
        </div>
      </div>
      <KycBanner role="editor" person={me} compact />
      <div className="stat-grid">
        <Stat label="Earned so far" value={inr(money.earned)} tone="green" />
        <Stat label="In progress" value={inr(money.inProgress)} sub={`${active.length} active`} />
        <Stat label="Rating" value={me.ratings ? `${me.rating}★` : 'New'} sub={`${me.ratings} reviews`} tone="amber" />
        <Stat label="Next payout" value={PAYOUTS.schedule.replace('Every ', '')} sub={`${PAYOUTS.method} · ${me.upi || 'add UPI in KYC'}`} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'jobs', label: 'New jobs', count: open.length },
          { id: 'work', label: 'My work', count: active.length },
          { id: 'earn', label: 'Earnings' },
          { id: 'profile', label: 'Profile' },
        ]}
      />
      {tab === 'jobs' && <Jobs s={s} me={me} open={open} />}
      {tab === 'work' && <Work s={s} mine={mine} />}
      {tab === 'earn' && <Earnings s={s} me={me} money={money} />}
      {tab === 'profile' && <Profile me={me} />}
    </div>
  )
}

function JobSheet({ s, o, me, onClose, mode }) {
  const [url, setUrl] = useState(o.deliveryUrl || '')
  const creator = s.creators.find((c) => c.id === o.creatorId)
  return (
    <Sheet title={o.title} onClose={onClose}>
      <div className="pay-banner">
        <span>You earn</span>
        <b>{inr(o.editorPayInr)}</b>
      </div>
      <dl className="kv">
        <dt>Order</dt>
        <dd className="mono">{o.id}</dd>
        <dt>Edit</dt>
        <dd>
          {editType(o.typeId).name} · {editType(o.typeId).output}
          {o.addons.length ? ' + ' + o.addons.map((a) => addon(a).name).join(', ') : ''}
        </dd>
        <dt>Creator</dt>
        <dd>
          {creator.handle} · {creator.lang}
        </dd>
        <dt>Deadline</dt>
        <dd className="amber">{dueIn(o.dueAt)}</dd>
        <dt>Footage</dt>
        <dd className="mono small">{o.footage} · signed link, 2 h expiry</dd>
      </dl>
      <div className="ai-brief">
        <span className="ai-tag">✦ Claude AI brief</span>
        <p>{o.brief || 'No brief written. Follow the tier defaults.'}</p>
        {o.status === 'revision' && o.revisionNote && (
          <p className="amber">
            <b>Revision:</b> {o.revisionNote}
          </p>
        )}
      </div>
      {mode === 'accept' && (
        <button
          className="btn btn-green btn-block"
          disabled={!isVerified(me)}
          onClick={() => {
            try {
              acceptJob(o.id, me.id)
              toast(`${o.id} is yours. Deadline ${dueIn(o.dueAt).toLowerCase()}.`)
              onClose()
            } catch (e) {
              toast(e.message, 'bad')
            }
          }}
        >
          Accept order · {inr(o.editorPayInr)}
        </button>
      )}
      {mode === 'deliver' && (
        <div className="stack">
          <div className="field">
            <label htmlFor="d-url">Delivery link (Drive, R2 or YouTube unlisted)</label>
            <input id="d-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </div>
          <button
            className="btn btn-red btn-block"
            disabled={!/^https?:\/\/\S+\.\S+/.test(url)}
            onClick={() => {
              deliverJob(o.id, url)
              toast('Delivered. The creator has been notified.')
              onClose()
            }}
          >
            Submit delivery
          </button>
        </div>
      )}
      <div className="nda">
        <b>NDA active.</b> Creator footage is confidential. Do not share or reuse it outside this order.
      </div>
    </Sheet>
  )
}

function Jobs({ s, me, open }) {
  const [pick, setPick] = useState(null)
  const o = open.find((x) => x.id === pick)
  const fits = (x) => me.skills.includes(x.typeId)
  const sorted = [...open].sort((a, b) => fits(b) - fits(a))
  if (!open.length) return <Empty title="No new jobs right now">New orders appear here the moment creators pay.</Empty>
  return (
    <>
      {!isVerified(me) && <p className="bad small">You can browse jobs now. Accepting them unlocks after your KYC is approved.</p>}
      <div className="list">
        {sorted.map((x) => (
          <OrderRow
            key={x.id}
            o={x}
            onClick={() => setPick(x.id)}
            sub={fits(x) ? ' · matches your skills' : ''}
            right={<span className="pay">{inr(x.editorPayInr)}</span>}
          />
        ))}
      </div>
      {o && <JobSheet s={s} o={o} me={me} mode="accept" onClose={() => setPick(null)} />}
    </>
  )
}

function Work({ s, mine }) {
  const [pick, setPick] = useState(null)
  const o = mine.find((x) => x.id === pick)
  if (!mine.length) return <Empty title="Nothing here yet">Accept a job and it moves here.</Empty>
  return (
    <>
      <div className="list">
        {mine.map((x) => (
          <OrderRow key={x.id} o={x} onClick={() => setPick(x.id)} />
        ))}
      </div>
      {o && (
        <JobSheet
          s={s}
          o={o}
          me={s.editors.find((e) => e.id === o.editorId)}
          mode={['editing', 'revision'].includes(o.status) ? 'deliver' : 'view'}
          onClose={() => setPick(null)}
        />
      )}
    </>
  )
}

function Earnings({ s, me, money }) {
  const earnings = s.earnings.filter((e) => e.editorId === me.id).slice().reverse()
  const payouts = s.payouts.filter((p) => p.editorId === me.id)
  return (
    <div className="stack">
      <section className="wallet-card green">
        <p className="kicker">// available for payout</p>
        <div className="big-money">{inr(money.available)}</div>
        <p className="muted small">
          Paid {PAYOUTS.schedule.toLowerCase()} by {PAYOUTS.method} to {me.upi || 'your verified UPI'}. Minimum {inr(PAYOUTS.minimumInr)}.
        </p>
        <button
          className="btn btn-green"
          disabled={money.available < PAYOUTS.minimumInr || !isVerified(me)}
          onClick={() => {
            try {
              requestPayout(me.id)
              toast('Payout requested')
            } catch (e) {
              toast(e.message, 'bad')
            }
          }}
        >
          Request payout
        </button>
      </section>
      <div className="tds">
        TDS: once your earnings pass {inr(PAYOUTS.tdsThresholdInrPerYear)} in a year, 10% TDS is deducted on payouts and a
        certificate is issued. That is why PAN is part of KYC.
      </div>
      <h3 className="section-title">What you earn per video</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Edit</th>
              <th className="num">You earn</th>
            </tr>
          </thead>
          <tbody>
            {EDIT_TYPES.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="num good">{inr(t.editorPayInr)}</td>
              </tr>
            ))}
            {ADDONS.map((a) => (
              <tr key={a.id} className="dim">
                <td>+ {a.name}</td>
                <td className="num">+{inr(a.editorPayInr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="section-title">History</h3>
      <div className="list">
        {payouts.map((p) => (
          <div key={p.id} className="row static">
            <div className="row-main">
              <div className="row-title">Payout · {PAYOUTS.method}</div>
              <div className="row-meta">
                {ago(p.at)} {p.reference ? `· ${p.reference}` : ''}
              </div>
            </div>
            <div className="row-side">
              <Pill status={p.status === 'paid' ? 'completed' : 'requested'}>{p.status === 'paid' ? 'Paid' : 'Requested'}</Pill>
              <span className="mono">−{inr(p.inr)}</span>
            </div>
          </div>
        ))}
        {earnings.map((e) => (
          <div key={e.id} className="row static">
            <div className="row-main">
              <div className="row-title">Order {e.orderId}</div>
              <div className="row-meta">{ago(e.at)}</div>
            </div>
            <div className="row-side mono good">+{inr(e.inr)}</div>
          </div>
        ))}
        {!payouts.length && !earnings.length && <Empty title="No earnings yet">Finish your first job to see it here.</Empty>}
      </div>
    </div>
  )
}

function Profile({ me }) {
  return (
    <div className="stack">
      <section className="profile-card">
        <div className="avatar">{me.name[0]}</div>
        <div>
          <div className="profile-name">{me.name}</div>
          <div className="muted mono small">
            // {me.skills.map((k) => editType(k).name).join(' · ')} · {me.city}
          </div>
        </div>
      </section>
      <h3 className="section-title">Identity and payouts (KYC)</h3>
      <KycBanner role="editor" person={me} />
    </div>
  )
}
