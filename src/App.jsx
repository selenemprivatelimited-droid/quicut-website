import { useEffect, useMemo, useRef, useState } from 'react'
import Scene from './scene/Scene.jsx'
import Logo from './Logo.jsx'
import { startIntro, sceneState } from './store.js'
import IntroSplash from './intro/IntroSplash.jsx'
import {
  TIERS,
  ADDONS,
  EDITOR_SHARE,
  STEPS,
  STATS,
  LANGS,
  SAMPLE_BRIEF,
  BRIEF_RULES,
  FAQ,
} from './content.js'

// Everything is priced in QuiCut Credits (QC). 1 QC = ₹1 when you buy credits.
const qc = (n) => Math.round(n).toLocaleString('en-IN') + ' QC'
// Teaser: first digit only. The full price is one tap away and always shown in the app before you confirm.
const teaser = (n) => Math.round(n).toLocaleString('en-IN').replace(/\d/g, (d, i) => (i === 0 ? d : '•')) + ' QC'

function Nav() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={'nav' + (solid ? ' is-solid' : '')}>
      <a className="nav-logo" href="#top" aria-label="QuiCut home">
        <Logo height={30} id="nav-logo" />
      </a>
      <nav className="nav-links" aria-label="Sections">
        <a href="#how">How it works</a>
        <a href="#pricing">Pricing</a>
        <a href="#languages">Languages</a>
        <a href="#editors">For editors</a>
        <a href="app.html">Open the app</a>
      </nav>
      <a className="btn btn-red btn-sm" href="#join">
        Join the waitlist
      </a>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="top" data-pose="hero">
      <div className="hero-copy">
        <p className="eyebrow">Video editing marketplace for Indian creators</p>
        <h1 className="display hero-title">
          Shoot it.
          <br />
          Send it.
          <br />
          <span className="red">Done by morning.</span>
        </h1>
        <p className="lede">
          Upload your raw footage, write the brief in Telugu, Hindi or English, and a verified editor delivers a
          finished cut in 24 hours. One fixed price per video, shown before you pay.
        </p>
        <div className="hero-ctas">
          <a className="btn btn-red" href="#join">
            Join the waitlist
          </a>
          <a className="btn btn-ghost" href="#pricing">
            See pricing
          </a>
        </div>
        <ul className="hero-facts" aria-label="Highlights">
          <li>
            <b>24h</b> standard delivery
          </li>
          <li>
            <b>1</b> free revision
          </li>
          <li>
            <b>80%</b> of every order to the editor
          </li>
        </ul>
      </div>
      <p className="hero-hint mono" aria-hidden="true">
        Tap the Q to cut again
      </p>
    </section>
  )
}

function Marquee() {
  const words = ['Vlogs', 'Reels', 'BGMI montages', 'Weddings', 'Travel films', 'Shorts', 'Food vlogs', 'Mini-docs']
  const row = [...words, ...words]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row.map((w, i) => (
          <span key={i} className={i % 2 ? 'outline' : ''}>
            {w}
          </span>
        ))}
      </div>
    </div>
  )
}

function How() {
  return (
    <section className="section" id="how" data-pose="how">
      <div className="wrap wrap-right">
        <p className="eyebrow">How it works</p>
        <h2 className="display h2">From raw footage to final cut in four steps.</h2>
        <ol className="filmstrip">
          {STEPS.map((s, i) => (
            <li key={s.title} className="frame">
              <span className="frame-tc mono">SCENE {String(i + 1).padStart(2, '0')}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="frame-meta mono">{s.meta}</span>
            </li>
          ))}
        </ol>
        <div className="stages" aria-label="Order tracking stages">
          {['Paid', 'Assigned', 'Editing', 'Review', 'Delivered'].map((s, i) => (
            <span key={s} className={'stage' + (i === 2 ? ' is-live' : '')}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Numbers() {
  return (
    <section className="section" id="numbers" data-pose="numbers">
      <div className="wrap wrap-left">
        <p className="eyebrow">Why now</p>
        <h2 className="display h2">India makes more video than anyone. Editing hasn't kept up.</h2>
        <div className="stats">
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <div className="stat-v display">{s.value}</div>
              <div className="stat-l">{s.label}</div>
              <div className="stat-s mono">{s.src}</div>
            </div>
          ))}
        </div>
        <p className="body-note">
          A freelance vlog edit in India runs ₹1,500 to ₹3,500, and rush delivery usually costs 25–50% extra. On QuiCut,
          24-hour delivery is the standard, at a fixed price you see before you pay.
        </p>
      </div>
    </section>
  )
}

function TiltCard({ children, className = '', ...rest }) {
  const ref = useRef()
  const move = (e) => {
    if (sceneState.reducedMotion) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    ref.current.style.setProperty('--ry', `${x * 10}deg`)
    ref.current.style.setProperty('--rx', `${-y * 10}deg`)
  }
  const leave = () => {
    ref.current.style.setProperty('--ry', '0deg')
    ref.current.style.setProperty('--rx', '0deg')
  }
  return (
    <div ref={ref} className={'tilt ' + className} onMouseMove={move} onMouseLeave={leave} {...rest}>
      {children}
    </div>
  )
}

const STAGE_NOTES = ['Instantly', 'Within an hour', 'Your editor works on it', 'One free revision included']

// Replaces the old order preview: shows how an order moves, and how long yours takes.
function Journey({ tier, addons, express }) {
  const [at, setAt] = useState(0)
  useEffect(() => {
    if (sceneState.reducedMotion) return setAt(4)
    const t = setInterval(() => setAt((x) => Math.min(4, x + 1)), 1100)
    return () => clearInterval(t)
  }, [])
  const stages = ['Paid', 'Matched', 'Editing', 'Review', 'Delivered']
  const notes = [...STAGE_NOTES, express ? 'In 12 hours' : tier.delivery]
  return (
    <aside className="receipt" aria-live="polite">
      <p className="mono receipt-id">YOUR EDIT, IN MOTION</p>
      <h3 className="display" style={{ fontSize: '1.15rem', margin: '0.3rem 0 0.9rem' }}>
        {tier.name}
      </h3>
      <div style={{ height: 6, borderRadius: 6, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: '0.9rem' }}>
        <div style={{ height: '100%', width: (at / 4) * 100 + '%', background: 'var(--red)', borderRadius: 6, transition: 'width 0.9s ease' }} />
      </div>
      {stages.map((st, i) => (
        <div key={st} className="receipt-row" style={{ opacity: i <= at ? 1 : 0.4, transition: 'opacity 0.5s' }}>
          <span>
            {i < at ? '✓ ' : i === at ? '● ' : '○ '}
            {st}
          </span>
          <span className="mono">{notes[i]}</span>
        </div>
      ))}
      <div className="receipt-row dim">
        <span>You get</span>
        <span className="mono">{tier.output}</span>
      </div>
      <div className="receipt-row dim">
        <span>From</span>
        <span className="mono">{tier.raw}</span>
      </div>
      {addons.length > 0 && (
        <div className="receipt-row dim">
          <span>Add-ons</span>
          <span className="mono">{addons.map((a) => a.name).join(', ')}</span>
        </div>
      )}
      <p className="fine" style={{ margin: '0.8rem 0' }}>You see the exact QC before you confirm an order in the app.</p>
      <a className="btn btn-red btn-block" href="#join">
        Get early access
      </a>
    </aside>
  )
}

function Pricing() {
  const [tierId, setTierId] = useState('vlog')
  const [addons, setAddons] = useState(() => new Set(['captions']))
  const tier = TIERS.find((t) => t.id === tierId)

  const toggle = (id) =>
    setAddons((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <section className="section" id="pricing" data-pose="pricing">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">Pricing</p>
          <h2 className="display h2">One price per video. No bidding, no haggling.</h2>
          <p className="lede">Every order includes one free revision. Pick a tier to build your order.</p>
        </div>
        <div className="tiers" role="radiogroup" aria-label="Choose a tier">
          {TIERS.map((t) => (
            <TiltCard
              key={t.id}
              className={'tier' + (t.id === tierId ? ' is-picked' : '')}
              role="radio"
              aria-checked={t.id === tierId}
              tabIndex={0}
              onClick={() => setTierId(t.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setTierId(t.id))}
            >
              {t.popular && <span className="tier-flag mono">Most ordered</span>}
              <h3 className="tier-name">{t.name}</h3>
              <div className={'tier-price display'}>
                {t.id === tierId ? qc(t.price) : teaser(t.price)}
                {t.id !== tierId && <small style={{ display: 'block', marginTop: '0.3rem', fontSize: '0.72rem', fontWeight: 600, letterSpacing: 0, color: 'var(--red)' }}>Tap to see price</small>}
              </div>
              <p className="tier-for">{t.for}</p>
              <dl className="tier-spec">
                <div>
                  <dt>Output</dt>
                  <dd>{t.output}</dd>
                </div>
                <div>
                  <dt>Footage</dt>
                  <dd>{t.raw}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{t.delivery}</dd>
                </div>
              </dl>
              <p className="tier-market mono">Freelance market {t.market}</p>
            </TiltCard>
          ))}
        </div>

        <div className="builder">
          <div className="addons">
            <h3 className="builder-h">Add-ons</h3>
            <div className="addon-grid">
              {ADDONS.map((a) => (
                <label key={a.id} className={'addon' + (addons.has(a.id) ? ' is-on' : '')} htmlFor={'addon-' + a.id}>
                  <input id={'addon-' + a.id} type="checkbox" checked={addons.has(a.id)} onChange={() => toggle(a.id)} />
                  <span className="addon-name">{a.name}</span>
                  <span className="addon-note">{a.note}</span>
                </label>
              ))}
            </div>
          </div>
          <Journey key={tierId + [...addons].sort().join()} tier={tier} addons={ADDONS.filter((a) => addons.has(a.id))} express={addons.has('express')} />
        </div>
      </div>
    </section>
  )
}

function detectScript(text) {
  if (/[ఀ-౿]/.test(text)) return 'Telugu script'
  if (/[ऀ-ॿ]/.test(text)) return 'Hindi (Devanagari)'
  if (/[஀-௿]/.test(text)) return 'Tamil script'
  if (/[ಀ-೿]/.test(text)) return 'Kannada script'
  if (/\b(lo|cheyyandi|peyyandi|cheste|ki|undi|chala)\b/i.test(text)) return 'Telugu in English letters'
  if (/\b(karo|chahiye|mein|aur|hai|wala)\b/i.test(text)) return 'Hindi in English letters'
  return 'English'
}

function readBrief(text) {
  const t = text.toLowerCase()
  const tags = []
  for (const r of BRIEF_RULES) {
    if (r.words.some((w) => t.includes(w))) {
      if (r.tag === 'Background music' && tags.some((x) => x.tag.endsWith('music'))) continue
      tags.push(r)
    }
  }
  return tags
}

function Languages() {
  const [brief, setBrief] = useState(SAMPLE_BRIEF)
  const [result, setResult] = useState(() => ({ lang: detectScript(SAMPLE_BRIEF), tags: readBrief(SAMPLE_BRIEF) }))
  const [busy, setBusy] = useState(false)

  const run = (e) => {
    e.preventDefault()
    setBusy(true)
    setTimeout(() => {
      setResult({ lang: detectScript(brief), tags: readBrief(brief) })
      setBusy(false)
    }, 450)
  }

  return (
    <section className="section" id="languages" data-pose="langs">
      <div className="wrap wrap-right">
        <p className="eyebrow">Brief in your language</p>
        <h2 className="display h2">Write it the way you say it.</h2>
        <p className="lede">
          Creators explain edits in their own words. QuiCut reads the brief and hands the editor a clear checklist, so a
          Telugu brief never gets lost in translation.
        </p>
        <ul className="lang-row">
          {LANGS.map((l) => (
            <li key={l.name} className={l.when === 'At launch' ? 'is-live' : ''}>
              <span className="lang-script">{l.script}</span>
              <span className="lang-when mono">{l.when}</span>
            </li>
          ))}
        </ul>
        <form className="brief" onSubmit={run}>
          <label htmlFor="brief-text" className="mono brief-label">
            Try it. Edit this sample brief
          </label>
          <textarea id="brief-text" rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} />
          <div className="brief-bar">
            <button className="btn btn-ghost btn-sm" type="submit" disabled={busy}>
              {busy ? 'Reading…' : 'Read my brief'}
            </button>
            <span className="mono brief-lang">Detected: {result.lang}</span>
          </div>
          <div className="brief-out" aria-live="polite">
            <p className="mono brief-label">Editor checklist</p>
            {result.tags.length ? (
              <ul className="chips">
                {result.tags.map((t) => (
                  <li key={t.tag} className="chip">
                    <span aria-hidden="true">{t.icon}</span> {t.tag}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim">Mention a colour grade, music, pacing or text and it will show up here.</p>
            )}
          </div>
          <p className="fine">Demo uses simple keyword matching. The app uses AI to read full briefs.</p>
        </form>
      </div>
    </section>
  )
}

function Editors() {
  return (
    <section className="section" id="editors" data-pose="editors">
      <div className="wrap wrap-left">
        <p className="eyebrow">For editors</p>
        <h2 className="display h2">Edit from home. Keep 80% of every order.</h2>
        <p className="lede">
          Steady orders matched to what you are good at, paid every Monday to your UPI. No chasing clients, no bidding
          wars.
        </p>
        <div className="payout">
          <div className="payout-head mono">
            <span>Order</span>
            <span>Creator pays</span>
            <span>You earn</span>
          </div>
          {TIERS.map((t) => (
            <div key={t.id} className="payout-row">
              <span>{t.name}</span>
              <span className="mono">{teaser(t.price)}</span>
              <span className="mono green">{qc(t.price * EDITOR_SHARE)}</span>
            </div>
          ))}
        </div>
        <p className="fine">Earnings are shown in QuiCut Credits and paid out to your UPI in rupees at 1 QC = ₹1.</p>
        <ul className="perks">
          <li>
            <b>Weekly UPI payouts</b> every Monday
          </li>
          <li>
            <b>Structured briefs</b> in your language
          </li>
          <li>
            <b>Orders by speciality</b> vlog, gaming, wedding, travel
          </li>
          <li>
            <b>Ratings that pay off</b> top editors get first pick
          </li>
        </ul>
        <a className="btn btn-red" href="#join" onClick={() => window.dispatchEvent(new CustomEvent('qc-role', { detail: 'editor' }))}>
          Apply as an editor
        </a>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="section" id="faq">
      <div className="wrap narrow">
        <p className="eyebrow">Questions</p>
        <h2 className="display h2">Good to know</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Join() {
  const [role, setRole] = useState('creator')
  const [status, setStatus] = useState({ kind: 'idle' })
  const [form, setForm] = useState({ name: '', handle: '', phone: '', lang: 'Telugu' })

  useEffect(() => {
    const on = (e) => setRole(e.detail)
    window.addEventListener('qc-role', on)
    return () => window.removeEventListener('qc-role', on)
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const phone = form.phone.replace(/[^\d]/g, '')
    if (!form.name.trim()) return setStatus({ kind: 'error', msg: 'Add your name so we know who to welcome.' })
    if (phone.length < 10) return setStatus({ kind: 'error', msg: 'Enter a 10-digit WhatsApp number, like 98765 43210.' })
    const payload = { ...form, phone, role, at: new Date().toISOString() }
    const endpoint = window.QUICUT_WAITLIST_ENDPOINT
    if (!endpoint) {
      setStatus({ kind: 'preview', name: form.name.trim() })
      return
    }
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...payload, _subject: `QuiCut waitlist: ${payload.name} (${role})`, _template: 'table' }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json().catch(() => ({}))
      if (data.success === 'false' || data.success === false) throw new Error(data.message || 'rejected')
      setStatus({ kind: 'done', name: form.name.trim() })
    } catch {
      setStatus({ kind: 'error', msg: 'That did not go through. Check your connection and try again.' })
    }
  }

  return (
    <section className="section join" id="join" data-pose="join">
      <div className="wrap narrow">
        <p className="eyebrow">Early access</p>
        <h2 className="display h2 center">Be first in line when QuiCut opens.</h2>
        <p className="lede center">Android and iOS. Creators get launch pricing, editors get first orders.</p>
        {status.kind === 'done' || status.kind === 'preview' ? (
          <div className="join-done" role="status">
            <div className="display join-done-h">You're in, {status.name}.</div>
            <p>We'll message you on WhatsApp when early access opens.</p>
            {status.kind === 'preview' && (
              <p className="fine">Preview mode: sign-ups are not being sent anywhere until a form backend is connected.</p>
            )}
          </div>
        ) : (
          <form className="join-form" onSubmit={submit} noValidate>
            <div className="role" role="radiogroup" aria-label="I am a">
              {['creator', 'editor'].map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  className={'role-btn' + (role === r ? ' is-on' : '')}
                  onClick={() => setRole(r)}
                >
                  I'm {r === 'creator' ? 'a creator' : 'an editor'}
                </button>
              ))}
            </div>
            <div className="field">
              <label htmlFor="j-name">Name</label>
              <input id="j-name" value={form.name} onChange={set('name')} autoComplete="name" placeholder="Ravi Kumar" />
            </div>
            <div className="field">
              <label htmlFor="j-handle">{role === 'creator' ? 'Instagram or YouTube handle' : 'Portfolio link'}</label>
              <input
                id="j-handle"
                value={form.handle}
                onChange={set('handle')}
                placeholder={role === 'creator' ? '@ravikumar_creates' : 'youtube.com/@yourwork'}
              />
            </div>
            <div className="field">
              <label htmlFor="j-phone">WhatsApp number</label>
              <input id="j-phone" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="98765 43210" />
            </div>
            <div className="field">
              <label htmlFor="j-lang">Language you create in</label>
              <select id="j-lang" value={form.lang} onChange={set('lang')}>
                {['Telugu', 'Hindi', 'Tamil', 'Kannada', 'English', 'Other'].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            {status.kind === 'error' && (
              <p className="form-error" role="alert">
                {status.msg}
              </p>
            )}
            <button className="btn btn-red btn-block" type="submit" disabled={status.kind === 'sending'}>
              {status.kind === 'sending' ? 'Joining…' : 'Join the waitlist'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <Logo height={26} id="foot-logo" />
      <p>© 2026 Runovah Technologies Pvt Ltd · Nellore, Andhra Pradesh</p>
      <p className="mono">Shoot it. Send it. Done by morning.</p>
    </footer>
  )
}

export default function App() {
  const webgl = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      return !!(c.getContext('webgl2') || c.getContext('webgl'))
    } catch {
      return false
    }
  }, [])
  return (
    <>
      {webgl ? <Scene /> : <div className="scene scene-fallback" />}
      <IntroSplash onFinish={startIntro} />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <How />
        <Numbers />
        <Pricing />
        <Languages />
        <Editors />
        <Faq />
        <Join />
      </main>
      <Footer />
    </>
  )
}
