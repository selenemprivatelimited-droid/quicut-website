import { useEffect, useState } from 'react'
import { CREDIT } from './config/pricing.js'

export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export const qc = (n) => Math.round(n).toLocaleString('en-IN')

export function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

export function dueIn(iso) {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (m <= 0) return 'Overdue'
  if (m < 60) return `Due in ${m} min`
  const h = Math.floor(m / 60)
  return h < 48 ? `Due in ${h} h ${m % 60} m` : `Due in ${Math.round(h / 24)} days`
}

const STATUS = {
  paid: ['Waiting for editor', 'amber'],
  editing: ['Editing', 'blue'],
  review: ['Ready to review', 'violet'],
  revision: ['Revision', 'amber'],
  completed: ['Delivered', 'green'],
  refunded: ['Refunded', 'muted'],
  requested: ['Requested', 'amber'],
  active: ['Active', 'green'],
  paused: ['Paused', 'muted'],
}
export function Pill({ status, children }) {
  const [label, tone] = STATUS[status] || [status, 'muted']
  return <span className={`pill pill-${tone}`}>{children || label}</span>
}

export function Coin({ size = 18 }) {
  return (
    <span className="coin" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {CREDIT.short}
    </span>
  )
}

export function Credits({ n, big }) {
  return (
    <span className={'credits' + (big ? ' credits-big' : '')}>
      <Coin size={big ? 30 : 16} /> {qc(n)}
      <span className="sr-only"> {CREDIT.name}</span>
    </span>
  )
}

const ICONS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H19v3M3 7.5V18a2 2 0 0 0 2 2h15V9H5.5A2.5 2.5 0 0 1 3 7.5ZM16.5 14.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20.5c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  inbox: 'M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13v6H4v-6Z',
  cut: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.1 7.9 20 20M8.1 16.1 20 4',
  rupee: 'M6 4h12M6 9h12M14 4c3 0 3 10-3 10H6l9 7',
  shield: 'M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6L12 3Z',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15.6c2 .6 3.2 2.1 3.7 4.4',
  tag: 'M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  pulse: 'M2 12h4l2.5-6 4 13 3-9 1.5 2H22',
}
export function Icon({ name, size = 20 }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.spark} />
    </svg>
  )
}

/** Tabs. With `bottom`, phones get a native-style bottom tab bar (icon + label); larger screens keep top tabs. */
export function Tabs({ tabs, value, onChange, bottom }) {
  return (
    <nav className={'tabs' + (bottom ? ' tabs-bottom' : '')} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={'tab' + (value === t.id ? ' is-on' : '')}
          onClick={() => {
            onChange(t.id)
            if (bottom && typeof window !== 'undefined' && window.innerWidth < 760) window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          {t.icon && <Icon name={t.icon} size={22} />}
          <span className="tab-lbl">{t.label}</span>
          {t.count ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </nav>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={'stat-card' + (tone ? ` tone-${tone}` : '')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {children && <p>{children}</p>}
    </div>
  )
}

let pushToast = () => {}
export const toast = (msg, tone = 'ok') => pushToast({ msg, tone, id: Math.random() })

/** Run an action (sync or async), toast the result or the error. Returns the result, or undefined on error. */
export async function act(fn, ok) {
  try {
    const r = await fn()
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok)
    return r
  } catch (e) {
    toast(e.message || 'Something went wrong', 'bad')
  }
}
export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    pushToast = (t) => {
      setItems((x) => [...x, t])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200)
    }
  }, [])
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Stars({ value, onChange }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={'star' + (n <= value ? ' is-on' : '')}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export const STAGES = ['paid', 'editing', 'review', 'completed']
export function Timeline({ order }) {
  const at = order.status === 'revision' ? 1 : STAGES.indexOf(order.status)
  const names = ['Paid', 'Editing', 'Review', 'Delivered']
  return (
    <ol className="timeline">
      {names.map((n, i) => (
        <li key={n} className={i < at ? 'done' : i === at ? 'now' : ''}>
          <span className="tl-dot" />
          {n}
        </li>
      ))}
    </ol>
  )
}
