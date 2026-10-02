import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Icon } from './ui.jsx'
import { simOn, setSim } from './services/store.js'

/* QuiCut Studio shell and the animated order deck.
   The shell (header, side menu, bottom toolbar) only changes how the existing screens are reached.
   Every screen, store call and service behind them is unchanged. */

export const ShellCtx = createContext(null)
export const useShell = () => useContext(ShellCtx)

/** One tick a second, so countdowns move. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

const pad = (n) => String(n).padStart(2, '0')
export function clock(ms) {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
export function dueText(ms) {
  if (ms <= 0) return 'Due now'
  const m = Math.floor(ms / 60000)
  if (ms < 600000) return `Due in ${m}:${pad(Math.floor((ms % 60000) / 1000))}`
  if (m < 60) return `Due in ${m} min`
  const h = Math.floor(m / 60)
  return h < 48 ? `Due in ${h} h` : `Due in ${Math.round(h / 24)} days`
}

const STAGE = {
  paid: { label: 'Matching an editor', idx: 0 },
  editing: { label: 'Editing', idx: 1 },
  revision: { label: 'Revision', idx: 1 },
  review: { label: 'Ready to review', idx: 2 },
  completed: { label: 'Delivered', idx: 3 },
}
export const stageOf = (o) => STAGE[o.status] || STAGE.paid

/** 0..1: where an order is on its way to delivery. Time-based while it is being edited. */
export function orderProgress(o, now = Date.now()) {
  if (o.status === 'completed') return 1
  if (o.status === 'review') return 0.9
  if (o.status === 'paid') return 0.08
  const hist = o.history || []
  let from = new Date(o.at).getTime()
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].status === 'editing' || hist[i].status === 'revision') {
      from = new Date(hist[i].at).getTime()
      break
    }
  }
  const to = new Date(o.dueAt).getTime()
  const k = (now - from) / Math.max(1, to - from)
  return Math.min(0.85, Math.max(0.15, 0.15 + k * 0.7))
}

/* ───────── the film-strip card ───────── */
const FRAMES = Array.from({ length: 14 })

function Card({ c, now, idx, total, active, style, handlers }) {
  const [fill, setFill] = useState(0)
  const ms = c.dueAt ? new Date(c.dueAt).getTime() - now : null
  const target = Math.round(c.progress * 100)
  useEffect(() => {
    const t = requestAnimationFrame(() => setFill(target))
    return () => cancelAnimationFrame(t)
  }, [target])
  return (
    <article className={'sd-card' + (active ? ' is-active' : '')} style={style} {...handlers} aria-hidden={!active}>
      <div className="sd-top">
        <span className="sd-kicker">
          {c.kicker} · {idx + 1} OF {total}
        </span>
        {ms != null && <span className="sd-pill">{dueText(ms)}</span>}
        {c.pill && ms == null && <span className="sd-pill">{c.pill}</span>}
      </div>
      <div className="sd-film" aria-hidden="true">
        <div className="sd-track">
          {[...FRAMES, ...FRAMES].map((_, i) => (
            <span key={i} className={'sd-frame f' + (i % 3)} />
          ))}
        </div>
        <span className="sd-lit" style={{ width: fill + '%' }} />
        <span className="sd-head" style={{ left: fill + '%' }} />
      </div>
      <div className="sd-meta">{c.meta}</div>
      <h2 className="sd-title">{c.title}</h2>
      <div className="sd-prog">
        <div className="sd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={target} aria-label={c.stage}>
          <span style={{ width: fill + '%' }} />
        </div>
        <b>{c.stage}</b>
      </div>
      {c.extra && <div className="sd-extra">{c.extra}</div>}
      <button className="sd-cta" tabIndex={active ? 0 : -1} onClick={c.onOpen}>
        {c.cta} <Icon name="arrow" size={18} />
      </button>
    </article>
  )
}

/** Stack of swipeable cards, like the pinned design. `cards` = [{key,kicker,title,meta,dueAt,progress,stage,cta,onOpen,order?}] */
export function OrderDeck({ cards, hint }) {
  const now = useNow(1000)
  const [i, setI] = useState(0)
  const [dx, setDx] = useState(0)
  const drag = useRef(null)
  const n = cards.length
  const cur = Math.min(i, Math.max(0, n - 1))
  useEffect(() => {
    if (i > n - 1) setI(Math.max(0, n - 1))
  }, [n, i])

  const handlers = {
    onPointerDown: (e) => {
      drag.current = { x: e.clientX, id: e.pointerId, cap: false }
    },
    onPointerMove: (e) => {
      const d = drag.current
      if (!d) return
      const x = e.clientX - d.x
      if (!d.cap && Math.abs(x) > 8) {
        d.cap = true
        try {
          e.currentTarget.setPointerCapture(d.id)
        } catch {}
      }
      if (d.cap) setDx(x)
    },
    onPointerUp: () => {
      const d = drag.current
      drag.current = null
      if (d?.cap) {
        if (dx < -60 && cur < n - 1) setI(cur + 1)
        else if (dx > 60 && cur > 0) setI(cur - 1)
      }
      setDx(0)
    },
    onPointerCancel: () => {
      drag.current = null
      setDx(0)
    },
  }
  const key = (e) => {
    if (e.key === 'ArrowRight' && cur < n - 1) setI(cur + 1)
    if (e.key === 'ArrowLeft' && cur > 0) setI(cur - 1)
  }
  const c = cards[cur]
  return (
    <section className="sd" aria-roledescription="carousel" aria-label="Your orders" onKeyDown={key}>
      <div className="sd-segs" role="tablist" aria-label="Choose a card">
        {cards.map((x, k) => (
          <button key={x.key} role="tab" aria-selected={k === cur} aria-label={`Card ${k + 1} of ${n}`} className={'sd-seg' + (k === cur ? ' is-on' : '')} onClick={() => setI(k)}>
            <span />
          </button>
        ))}
      </div>
      <div className="sd-deck" style={{ touchAction: 'pan-y' }}>
        {[2, 1].map((k) =>
          cards[cur + k] ? <div key={'b' + k} className="sd-back" style={{ transform: `translateY(${-14 * k}px) scale(${1 - 0.05 * k})`, zIndex: 3 - k }} /> : null
        )}
        <Card
          key={c.key}
          c={c}
          now={now}
          idx={cur}
          total={n}
          active
          handlers={handlers}
          style={{ transform: `translateX(${dx}px) rotate(${dx / 40}deg)`, transition: dx ? 'none' : 'transform 0.35s cubic-bezier(.2,.9,.3,1)' }}
        />
      </div>
      {hint && <p className="sd-hint">{hint}</p>}
      {c.order && <Timeline o={c.order} now={now} />}
    </section>
  )
}

/** The editing-software timeline for the order on screen: V1 track and a playhead that moves. */
export function Timeline({ o, now }) {
  const st = stageOf(o)
  const p = orderProgress(o, now)
  const total = Math.max(1, new Date(o.dueAt).getTime() - new Date(o.at).getTime())
  const hours = total / 3600e3
  const ticks = [0, 0.25, 0.5, 0.75].map((k) => (hours >= 3 ? `${Math.round(k * hours)}h` : `${Math.round(k * hours * 60)}m`))
  const segs = [
    { name: 'Brief', grow: 1 },
    { name: 'Editing', grow: 2 },
    { name: 'Review', grow: 1 },
    { name: 'Done', grow: 1 },
  ]
  const left = o.status === 'completed' ? 1 : new Date(o.dueAt).getTime() - now
  return (
    <div className="st-panel sd-tl" aria-label="Order timeline">
      <div className="sd-ruler">
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="sd-v1">
        <span className="sd-v1-lbl">V1</span>
        <div className="sd-v1-track">
          {segs.map((s, k) => (
            <span key={s.name} className={'sd-seg-clip' + (k < st.idx ? ' is-done' : k === st.idx ? ' is-now' : '')} style={{ flexGrow: s.grow }}>
              {s.name}
            </span>
          ))}
          <i className="sd-playhead" style={{ left: p * 100 + '%' }} />
        </div>
      </div>
      <div className="sd-clock mono">{left === 1 ? 'DELIVERED' : `DUE IN ${clock(left)}`}</div>
    </div>
  )
}

/* ───────── shell ───────── */
export function StudioFrame({ role, tab, setTab, chip, menu, toolbar, name, line, children }) {
  const shell = useShell() || {}
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])
  const go = (id) => {
    setTab(id)
    close()
    window.scrollTo({ top: 0 })
  }
  const TB = ({ t }) => (
    <button className={'st-tool' + (tab === t.tab ? ' is-on' : '')} onClick={() => go(t.tab)}>
      <Icon name={t.icon} size={22} />
      {t.label}
      {t.count ? <span className="st-count">{t.count}</span> : null}
    </button>
  )
  const people = shell.people
  return (
    <div className="studio" data-studio={role}>
      <header className="st-head">
        <button className="st-icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" size={20} />
        </button>
        <div className="st-title">
          QuiCut <span>Studio</span>
        </div>
        {chip}
      </header>
      <div className="st-body">{children}</div>
      <nav className="st-bar" aria-label="Studio tools">
        <TB t={toolbar.left} />
        <button className={'st-main' + (tab === toolbar.main.tab ? ' is-on' : '')} aria-label={toolbar.main.label} onClick={() => go(toolbar.main.tab)}>
          <Icon name={toolbar.main.icon || 'plus'} size={30} />
        </button>
        <TB t={toolbar.right} />
      </nav>
      {open && (
        <div className="st-drawer-wrap">
          <aside className="st-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="st-d-head">
              <div>
                <b>{name}</b>
                <span className="mono">{line}</span>
              </div>
              <button className="st-icon" aria-label="Close menu" onClick={close}>
                <Icon name="close" size={18} />
              </button>
            </div>
            {!shell.live && shell.roles && (
              <div className="st-d-seg" role="tablist" aria-label="View as">
                {shell.roles.map((r) => (
                  <button
                    key={r.id}
                    role="tab"
                    aria-selected={role === r.id}
                    className={role === r.id ? 'is-on' : ''}
                    onClick={() => {
                      shell.setRole(r.id)
                      close()
                    }}
                  >
                    {r.label.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            {people && (
              <label className="st-d-who">
                <span className="mono">SIGNED IN AS</span>
                <select value={shell.who} onChange={(e) => shell.setWho(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="st-d-list">
              {menu.map((sec) => (
                <div key={sec.title}>
                  <div className="st-d-sec">{sec.title}</div>
                  {sec.items.map((it) => (
                    <button key={it.id} className={'st-d-item' + (tab === it.id ? ' is-on' : '')} onClick={() => go(it.id)}>
                      <span>{it.label}</span>
                      {it.count ? <b>{it.count}</b> : null}
                    </button>
                  ))}
                </div>
              ))}
              <div>
                <div className="st-d-sec">HELP</div>
                {shell.live ? (
                  <button
                    className="st-d-item"
                    onClick={() => {
                      close()
                      shell.openHelp()
                    }}
                  >
                    <span>Help &amp; support</span>
                    {shell.replies > 0 ? <b>{shell.replies}</b> : null}
                  </button>
                ) : (
                  <button
                    className="st-d-item"
                    onClick={() => {
                      close()
                      shell.openSignIn()
                    }}
                  >
                    <span>Sign in</span>
                  </button>
                )}
                <a className="st-d-item" href="./" onClick={close}>
                  <span>QuiCut website</span>
                </a>
              </div>
            </div>
            {!shell.live && <SimToggle />}
            {shell.canSignOut && (
              <button className="st-d-out mono" onClick={() => shell.signOut()}>
                SIGN OUT
              </button>
            )}
          </aside>
          <button className="st-scrim" aria-label="Close menu" onClick={close} />
        </div>
      )}
    </div>
  )
}

function SimToggle() {
  const [on, setOn] = useState(simOn())
  return (
    <label className="st-sim">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setSim(e.target.checked)
          setOn(e.target.checked)
        }}
      />
      <span>
        <b>Simulated editor</b>
        <small>Takes orders nobody picks up for 15 s. Turn off when two people test together.</small>
      </span>
    </label>
  )
}

/** Panel with a big number and a caption, for the stat tiles. */
export function Tile({ label, value, sub }) {
  return (
    <div className="st-tile">
      <div className="mono">{label}</div>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  )
}
