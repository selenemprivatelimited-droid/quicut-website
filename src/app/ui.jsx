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

export function Tabs({ tabs, value, onChange }) {
  return (
    <nav className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          className={'tab' + (value === t.id ? ' is-on' : '')}
          onClick={() => onChange(t.id)}
        >
          {t.label}
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
