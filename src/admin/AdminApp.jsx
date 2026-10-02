import { useEffect, useState } from 'react'
import Logo from '../Logo.jsx'
import { useStore, resetDemo, alerts, enterAdminLive } from '../app/services/store.js'
import { MODE } from '../app/services/payments.js'
import { KYC_MODE } from '../app/services/kyc.js'
import { Toaster, toast, Icon } from '../app/ui.jsx'
import { RangePicker } from '../app/charts.jsx'
import { Orders, Kyc, Payouts, People, Pricing } from '../app/views/Admin.jsx'
import Copilot from '../app/views/Copilot.jsx'
import Gate from './Gate.jsx'
import { Overview, Team } from './Overview.jsx'
import Analyst from './Analyst.jsx'
import Monitor from './Monitor.jsx'
import Tickets from './Tickets.jsx'
import Access, { canSee, roleLabel } from './Access.jsx'

const NAV = [
  { id: 'overview', label: 'Overview', icon: 'chart' },
  { id: 'analyst', label: 'Data Analyst', icon: 'spark' },
  { id: 'team', label: 'Creators & editors', icon: 'users' },
  { id: 'monitor', label: 'Errors & speed', icon: 'pulse' },
  { id: 'tickets', label: 'Support', icon: 'inbox' },
  { id: 'orders', label: 'Orders', icon: 'list' },
  { id: 'kyc', label: 'KYC', icon: 'shield' },
  { id: 'payouts', label: 'Payouts', icon: 'rupee' },
  { id: 'people', label: 'Accounts', icon: 'user' },
  { id: 'pricing', label: 'Pricing', icon: 'tag' },
  { id: 'access', label: 'Admin team', icon: 'shield' },
]
const TITLES = {
  overview: ['Overview', 'Money, orders and alerts, day by day'],
  analyst: ['Data Analyst', 'Ask questions about QuiCut data in plain language'],
  team: ['Creators & editors', 'Who is growing, who is delivering'],
  monitor: ['Errors & speed', 'Live crashes, failed API calls and page speed from real users'],
  tickets: ['Support', 'Requests from creators and editors'],
  orders: ['Orders', 'Assign editors, refunds, deadlines'],
  kyc: ['KYC', 'Identity checks for creators and editors'],
  payouts: ['Payouts', 'Weekly editor payouts by UPI'],
  people: ['Accounts', 'Bonus credits, editor status, deletion requests'],
  pricing: ['Pricing', 'Credit packs and per-edit prices'],
  access: ['Admin team', 'Who can open the admin panel, and what each role sees'],
}

function initialSection() {
  const h = location.hash.replace('#', '')
  return NAV.some((n) => n.id === h) ? h : 'overview'
}

export default function AdminApp() {
  return <Gate>{(who) => <Shell who={who} />}</Gate>
}

function Shell({ who }) {
  const s = useStore()
  const [sec, setSecState] = useState(initialSection)
  const [days, setDays] = useState(30)
  const [loadErr, setLoadErr] = useState('')
  useEffect(() => {
    if (who.live) enterAdminLive().catch((e) => setLoadErr(e.message))
  }, [who.live])
  const live = !!s.live
  const setSec = (id) => {
    setSecState(id)
    history.replaceState(null, '', '#' + id)
    window.scrollTo({ top: 0 })
  }
  const kycQueue = [...s.creators.map((p) => ({ ...p, role: 'creator' })), ...s.editors.map((p) => ({ ...p, role: 'editor' }))].filter((p) => p.kyc?.status === 'pending')
  const counts = {
    overview: alerts(s).length,
    kyc: kycQueue.length,
    payouts: s.payouts.filter((p) => p.status === 'requested').length,
  }
  const nav = NAV.filter((n) => canSee(who.role, n.id))
  useEffect(() => {
    if (!canSee(who.role, sec)) setSecState(nav[0]?.id || 'overview')
  }, [who.role])
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('qc-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('qc-theme', theme)
    } catch {}
  }, [theme])
  const [title, sub] = TITLES[canSee(who.role, sec) ? sec : nav[0]?.id || 'overview']
  return (
    <div className="admin">
      <aside className="side">
        <a className="side-brand" href="../" aria-label="QuiCut website">
          <Logo height={22} id="admin-logo" />
          <span className="side-tag">Admin</span>
        </a>
        <nav className="side-nav" aria-label="Admin sections">
          {nav.map((n) => (
            <button key={n.id} className={'side-link' + (sec === n.id ? ' is-on' : '')} onClick={() => setSec(n.id)} aria-current={sec === n.id ? 'page' : undefined}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {counts[n.id] ? <span className="side-count">{counts[n.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-user">
            <span className="avatar sm">{(who.email || 'A')[0].toUpperCase()}</span>
            <span className="small">{who.email}</span>
          </div>
          <div className="mode-tags">
            <span className="pill pill-muted">{roleLabel(who.role)}</span>
          </div>
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')} aria-label="Light theme">
              Light
            </button>
            <button className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')} aria-label="Dark theme">
              Dark
            </button>
          </div>
          <div className="mode-tags">
            <span className={'pill ' + (live ? 'pill-green' : 'pill-muted')}>Data: {live ? 'live' : 'demo'}</span>
            <span className="pill pill-muted">Payments: {MODE}</span>
            <span className="pill pill-muted">KYC: {live ? 'manual review' : KYC_MODE}</span>
          </div>
          <div className="btn-row">
            <button
              className="link-btn small"
              onClick={() => {
                resetDemo()
                toast(live ? 'Refreshed' : 'Demo data reset')
              }}
            >
              {live ? 'Refresh data' : 'Reset demo data'}
            </button>
            {who.live && (
              <button className="link-btn small" onClick={who.signOut}>
                Sign out
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-head">
          <div>
            <h1>{title}</h1>
            <p className="muted">{sub}</p>
          </div>
          <div className="btn-row">
            {(sec === 'overview' || sec === 'team') && <RangePicker value={days} onChange={setDays} options={[7, 14, 30, 45]} />}
            {who.live && (
              <button className="btn btn-ghost btn-sm mobile-only" onClick={who.signOut}>
                Sign out
              </button>
            )}
          </div>
        </header>
        {loadErr && <p className="bad small">Could not load live data: {loadErr}</p>}
        {who.live && !live && !loadErr && <p className="muted">Loading live data…</p>}
        {(!who.live || live) && (
          <>
            {sec === 'overview' && <Overview s={s} days={days} go={setSec} />}
            {sec === 'analyst' && <Analyst s={s} />}
            {sec === 'team' && <Team s={s} days={days} />}
            {sec === 'monitor' && <Monitor live={who.live} />}
            {sec === 'tickets' && <Tickets live={who.live} />}
            {sec === 'orders' && <Orders s={s} />}
            {sec === 'kyc' && <Kyc s={s} queue={kycQueue} />}
            {sec === 'payouts' && <Payouts s={s} />}
            {sec === 'people' && <People s={s} />}
            {sec === 'pricing' && <Pricing />}
            {sec === 'access' && <Access me={{ email: who.email, role: who.role }} live={who.live} />}
          </>
        )}
      </main>
      <Copilot role="admin" s={s} ids={{}} />
      <Toaster />
    </div>
  )
}
