import { useCallback, useEffect, useMemo, useState } from 'react'
import Logo from '../Logo.jsx'
import { Toaster, toast } from '../app/ui.jsx'
import { consumeLinkHash, getSession, rest, signOut } from '../app/services/supa.js'
import { EmailSignIn } from '../app/views/Account.jsx'

// Editor applications: the applicant side of QuiCut's five-step selection.
// 1 Screening, 2 Portfolio, 3 Test edit, 4 Reliability and interview, 5 Probation.
// Every decision is made by the QuiCut team in the admin panel; this page only collects and shows.

export const STEPS = ['Screening', 'Portfolio', 'Test edit', 'Interview', 'Probation']
const TYPES = ['Vlog', 'Gaming', 'Travel', 'Reel or Short', 'Wedding', 'Food', 'Cinematic', 'Podcast']
const LANGS = ['తెలుగు', 'English', 'हिन्दी', 'தமிழ்']
const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Other state']

// What stops an application. Mirrors the "What you need" list so nobody wastes a form.
const BLOCKS = {
  years: (v) => v === 'Less than 1 year' && "QuiCut needs at least 1 year of editing experience. You're welcome to apply once you have it.",
  software: (v) => v === 'Other software' && 'Orders need Premiere Pro, DaVinci Resolve or Final Cut Pro.',
  device: (v) => v === 'Phone or tablet only' && "Editing on a phone or tablet isn't enough for QuiCut orders. You need a laptop or desktop to apply.",
  ram: (v) => v === '8 GB or less' && 'The minimum is 16 GB of RAM.',
  cpu: (v) => v === 'Older or lower than these' && 'The minimum is Intel i5 8th gen, Ryzen 5 or Apple M1.',
  storage: (v) => v === 'Less than 100 GB' && 'You need at least 100 GB free for raw footage.',
  upload: (v) => v !== '' && Number(v) < 20 && 'The minimum upload speed is 20 Mbps.',
}

const useNow = (ms = 1000) => {
  const [n, setN] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return n
}
const clock = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000))
  const p = (x) => String(x).padStart(2, '0')
  return { h: p(Math.floor(t / 3600)), m: p(Math.floor((t % 3600) / 60)), s: p(t % 60), done: t <= 0 }
}
const fdate = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')
const isUrl = (v) => /^https?:\/\/\S+\.\S+/i.test((v || '').trim())

function Select({ label, value, onChange, options, block }) {
  const msg = block && BLOCKS[block]?.(value)
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {msg && <span className="ap-block">{msg}</span>}
    </label>
  )
}
function Chips({ label, value, onChange, options }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="ap-chips">
        {options.map((o) => (
          <button type="button" key={o} className={'ap-chip' + (value.includes(o) ? ' is-on' : '')} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
function Text({ label, hint, ...p }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input {...p} />
      {hint && <span className="muted small">{hint}</span>}
    </label>
  )
}
function Check({ checked, onChange, children }) {
  return (
    <label className="ap-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

function Tracker({ app }) {
  const done = app.status === 'verified' ? 5 : app.stage - 1
  return (
    <ol className="ap-steps" aria-label="Your progress">
      {STEPS.map((s, i) => (
        <li key={s} className={i < done ? 'is-done' : i === done && app.status === 'active' ? 'is-now' : ''}>
          <span className="ap-dot">{i < done ? '✓' : i + 1}</span>
          <span className="ap-step-name">{s}</span>
        </li>
      ))}
    </ol>
  )
}

const FAQ = [
  ['Is the test edit paid?', 'No. The test edit and the 6-hour task are unpaid. Your first 10 real orders during probation are paid like any other order.'],
  ['Can I retake a step?', 'No. Each step has one attempt. If you are not selected, you can apply again after 60 days.'],
  ['How is my test edit scored?', 'Our team scores it without seeing your name, out of 100: cut and pacing, colour, audio and music, following the brief, and output quality. The pass mark is 75.'],
  ['Why do you need Aadhaar and PAN?', 'To confirm every editor is a real person with one account, and to pay you and deduct tax correctly. We only ask for them after you pass the interview, inside the QuiCut app. Never type them into this page or send them on WhatsApp.'],
]

export default function Apply() {
  const [sess, setSess] = useState(undefined)
  const [app, setApp] = useState(undefined)
  const [notes, setNotes] = useState([])
  const [starting, setStarting] = useState(false)
  const [bell, setBell] = useState(false)

  const load = useCallback(async () => {
    const rows = await rest('editor_applications?select=*&order=created_at.desc&limit=1')
    setApp(rows?.[0] || null)
    const n = await rest('notifications?select=*&order=created_at.desc&limit=12').catch(() => [])
    setNotes(n || [])
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await consumeLinkHash()
      } catch (e) {
        toast(e.message)
      }
      const s = await getSession()
      setSess(s)
      if (s) await load().catch((e) => toast(e.message))
      else setApp(null)
    })()
  }, [load])

  // keep the status fresh while the page is open
  useEffect(() => {
    if (!sess) return
    const t = setInterval(() => load().catch(() => {}), 30000)
    return () => clearInterval(t)
  }, [sess, load])

  const unread = notes.filter((n) => !n.read).length
  const readAll = async () => {
    setBell(!bell)
    if (!bell && unread) {
      await rest('notifications?read=eq.false', { method: 'PATCH', body: { read: true } }).catch(() => {})
      setTimeout(() => setNotes((x) => x.map((n) => ({ ...n, read: true }))), 1500)
    }
  }
  const out = async () => {
    await signOut()
    location.reload()
  }

  const canReapply = app && app.status === 'not_selected' && (!app.reapply_after || new Date(app.reapply_after) <= new Date())
  const showForm = sess && starting && (!app || canReapply)
  const loading = sess === undefined || (sess && app === undefined)

  return (
    <div className="ap">
      <header className="ap-top">
        <a href="../" className="ap-brand" aria-label="QuiCut website">
          <Logo height={22} id="ap-logo" />
          <span className="side-tag">Editor applications</span>
        </a>
        <div className="ap-top-r">
          {sess && (
            <div className="ap-bellwrap">
              <button className="btn btn-ghost btn-sm" onClick={readAll} aria-label="Notifications">
                Updates{unread ? <span className="ap-badge">{unread}</span> : null}
              </button>
              {bell && (
                <div className="ap-notes">
                  {notes.length === 0 && <p className="muted small">Nothing yet. We message you after each step.</p>}
                  {notes.map((n) => (
                    <div key={n.id} className="ap-note">
                      <b>{n.title}</b>
                      {n.body && <span className="muted small">{n.body}</span>}
                      <span className="muted small">{fdate(n.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {sess && (
            <button className="link-btn small" onClick={out}>
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="ap-main">
        {loading && <p className="muted">Loading…</p>}
        {!loading && !sess && !starting && <Landing onStart={() => setStarting(true)} />}
        {!loading && !sess && starting && (
          <div className="chart-card ap-narrow">
            <h2>Sign in to apply</h2>
            <p className="muted">We use your email so we can keep your application safe and message you after each step. No password needed.</p>
            <EmailSignIn redirectTo={location.origin + location.pathname} onSignedIn={() => location.reload()} />
          </div>
        )}
        {!loading && sess && !app && !starting && <Landing onStart={() => setStarting(true)} />}
        {!loading && showForm && <Form email={sess.email} onDone={() => { setStarting(false); load() }} />}
        {!loading && sess && app && !showForm && <Status app={app} reload={load} onReapply={() => setStarting(true)} canReapply={canReapply} />}
      </main>
      <Toaster />
    </div>
  )
}

function Landing({ onStart }) {
  return (
    <div className="stack">
      <section className="ap-hero">
        <h1>Edit for creators across India</h1>
        <p className="muted">
          Get paid for every edit, choose when you work, and get briefs in your own language. We select editors through five steps so creators can trust every delivery.
        </p>
        <button className="btn btn-red" onClick={onStart}>
          Start your application
        </button>
        <div className="ap-facts">
          <div>
            <b>₹239 – ₹1,999</b>
            <span>Pay per edit, depending on the type</span>
          </div>
          <div>
            <b>Weekly</b>
            <span>Payouts straight to your bank</span>
          </div>
          <div>
            <b>4</b>
            <span>Languages for briefs and the app</span>
          </div>
        </div>
      </section>
      <div className="ap-two">
        <section className="chart-card">
          <h3>What you need</h3>
          <p className="muted small">Please check these before you apply. Applications that don't meet them can't go ahead.</p>
          <ul className="ap-list">
            <li>At least 1 year of video editing experience</li>
            <li>Premiere Pro, DaVinci Resolve or Final Cut Pro</li>
            <li>A laptop or desktop, not a phone or tablet</li>
            <li>16 GB RAM, Intel i5 8th gen or Ryzen 5 or newer</li>
            <li>100 GB free storage</li>
            <li>Upload speed of at least 20 Mbps</li>
            <li>A portfolio with 3 different types of edits</li>
            <li>Aadhaar and PAN for verification, after your interview</li>
          </ul>
        </section>
        <section className="chart-card">
          <h3>How selection works</h3>
          <p className="muted small">Most people who pass finish all five steps in about two weeks. You'll get an update here and by email after each step.</p>
          <ol className="ap-how">
            <li><b>Screening</b> We check your setup and speed.</li>
            <li><b>Portfolio</b> We review three of your own edits.</li>
            <li><b>Test edit</b> One 24-hour brief, scored blind.</li>
            <li><b>Interview</b> A 6-hour task and a 15-minute call.</li>
            <li><b>Probation</b> Your first 10 paid orders, reviewed closely.</li>
          </ol>
        </section>
      </div>
      <section className="chart-card">
        <h3>Questions</h3>
        {FAQ.map(([q, a]) => (
          <details key={q} className="ap-faq">
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </section>
    </div>
  )
}

const EMPTY = {
  full_name: '', whatsapp: '', city: '', state: '', langs: [],
  years: '', software: '', hours: '', turnaround: '', types: [],
  device: '', ram: '', cpu: '', gpu: '', storage: '', upload: '', speed_link: '', setup_link: '',
  portfolio_link: '', s1: '', t1: '', s2: '', t2: '', s3: '', t3: '',
  own: false, manual: false, deadline: false,
}

function Form({ email, onDone }) {
  const [part, setPart] = useState(1)
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const inp = (k) => ({ value: f[k], onChange: (e) => set(k)(e.target.value) })

  const blocked = useMemo(() => Object.keys(BLOCKS).filter((k) => BLOCKS[k](f[k])), [f])
  const p1 = f.full_name.trim().length > 2 && /^\d{10}$/.test(f.whatsapp.replace(/\D/g, '').slice(-10)) && f.city.trim() && f.state && f.langs.length
  const p2 = f.years && f.software && f.hours && f.turnaround && f.types.length
  const p3 = f.device && f.ram && f.cpu && f.storage && f.upload && isUrl(f.speed_link) && isUrl(f.setup_link)
  const types3 = new Set([f.t1, f.t2, f.t3])
  const p4 = isUrl(f.portfolio_link) && isUrl(f.s1) && isUrl(f.s2) && isUrl(f.s3) && f.t1 && f.t2 && f.t3 && types3.size === 3 && f.own && f.manual && f.deadline
  const ok = [p1, p2, p3, p4][part - 1]
  const blockNow = blocked.length > 0

  const submit = async () => {
    setBusy(true)
    try {
      const form = {
        full_name: f.full_name.trim(), whatsapp: f.whatsapp.replace(/\D/g, '').slice(-10), email, city: f.city.trim(), state: f.state, langs: f.langs,
        years: f.years, software: f.software, hours: f.hours, turnaround: f.turnaround, types: f.types,
        device: f.device === 'Phone or tablet only' ? 'phone' : f.device, ram: f.ram, cpu: f.cpu, gpu: f.gpu, storage: f.storage, upload_mbps: Number(f.upload),
        speed_link: f.speed_link.trim(), setup_link: f.setup_link.trim(), portfolio_link: f.portfolio_link.trim(),
        samples: [1, 2, 3].map((i) => ({ link: f['s' + i].trim(), type: f['t' + i] })),
        pledges: { own: f.own, manual: f.manual, deadline: f.deadline },
      }
      await rest('rpc/app_submit', { method: 'POST', body: { p_form: form } })
      toast('Application sent')
      onDone()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }

  return (
    <form
      className="chart-card ap-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (part < 4) setPart(part + 1)
        else submit()
      }}
    >
      <p className="muted small">Part {part} of 4 · {['About you', 'Your experience', 'Your editing setup', 'Your portfolio'][part - 1]}</p>
      <div className="ap-bar"><i style={{ width: part * 25 + '%' }} /></div>

      {part === 1 && (
        <div className="form-grid">
          <Text label="Full name (as on PAN)" {...inp('full_name')} autoComplete="name" />
          <Text label="WhatsApp number" inputMode="numeric" placeholder="10-digit number" {...inp('whatsapp')} autoComplete="tel-national" />
          <Text label="Email" value={email} readOnly />
          <Text label="City" {...inp('city')} />
          <Select label="State" value={f.state} onChange={set('state')} options={STATES} />
          <Chips label="Languages you can work in" value={f.langs} onChange={set('langs')} options={LANGS} />
        </div>
      )}
      {part === 2 && (
        <div className="form-grid">
          <Select label="Years of video editing" value={f.years} onChange={set('years')} block="years" options={['Less than 1 year', '1–2 years', '2–4 years', '4–7 years', '7+ years']} />
          <Select label="Main editing software" value={f.software} onChange={set('software')} block="software" options={['Premiere Pro', 'DaVinci Resolve', 'Final Cut Pro', 'Other software']} />
          <Select label="Hours you can edit per day" value={f.hours} onChange={set('hours')} options={['2–4 hours', '4–6 hours', '6–8 hours', '8+ hours']} />
          <Select label="Time you usually need for a 10-minute vlog" value={f.turnaround} onChange={set('turnaround')} options={['Under 6 hours', '6–10 hours', '10–16 hours', '16–24 hours']} />
          <Chips label="Types of edits you've done" value={f.types} onChange={set('types')} options={TYPES} />
        </div>
      )}
      {part === 3 && (
        <div className="form-grid">
          <Select label="Device" value={f.device} onChange={set('device')} block="device" options={['Windows laptop or desktop', 'Mac', 'Phone or tablet only']} />
          <Select label="RAM" value={f.ram} onChange={set('ram')} block="ram" options={['8 GB or less', '16 GB', '32 GB or more']} />
          <Select label="Processor" value={f.cpu} onChange={set('cpu')} block="cpu" options={['Intel i5 8th gen or newer', 'Intel i7 / i9', 'AMD Ryzen 5 or newer', 'Apple M1 or newer', 'Older or lower than these']} />
          <Select label="Graphics card (recommended)" value={f.gpu} onChange={set('gpu')} options={['GTX 1060 / RX 580 or better', 'Apple silicon', 'Built-in graphics only']} />
          <Select label="Free storage" value={f.storage} onChange={set('storage')} block="storage" options={['Less than 100 GB', '100–250 GB', 'More than 250 GB']} />
          <label className="field">
            <span className="label">Upload speed (Mbps)</span>
            <input type="number" min="0" step="0.1" {...inp('upload')} />
            {BLOCKS.upload(f.upload) && <span className="ap-block">{BLOCKS.upload(f.upload)}</span>}
          </label>
          <Text label="Speed test screenshot link" hint="Upload the screenshot to Google Drive or Imgur and paste the link. Make sure anyone with the link can open it." type="url" placeholder="https://" {...inp('speed_link')} />
          <Text label="Short screen recording of your setup (link)" hint="Show your system details and your editing software open. Under 1 minute." type="url" placeholder="https://" {...inp('setup_link')} />
        </div>
      )}
      {part === 4 && (
        <div className="form-grid">
          <p className="muted small">Share three of your own edits, each a different type. We check every one for originality.</p>
          <Text label="Portfolio link (YouTube, Google Drive or Behance)" type="url" placeholder="https://" {...inp('portfolio_link')} />
          {[1, 2, 3].map((i) => (
            <div className="ap-sample" key={i}>
              <Text label={'Sample edit ' + i + ' link'} type="url" placeholder="https://" {...inp('s' + i)} />
              <Select label="Type" value={f['t' + i]} onChange={set('t' + i)} options={TYPES} />
            </div>
          ))}
          {f.t1 && f.t2 && f.t3 && types3.size < 3 && <span className="ap-block">Each sample needs a different type.</span>}
          <Check checked={f.own} onChange={set('own')}>These edits are my own work. I understand that submitting someone else's work means permanent disqualification.</Check>
          <Check checked={f.manual} onChange={set('manual')}>I edit by hand. I don't rely only on AI auto-edit tools.</Check>
          <Check checked={f.deadline} onChange={set('deadline')}>I understand the test edit has a 24-hour deadline and no retakes.</Check>
        </div>
      )}

      {blockNow && <p className="ap-block">Some answers don't meet QuiCut's minimum, so this application can't go ahead yet. Fix the highlighted answers or come back when you meet them.</p>}
      <div className="btn-row">
        {part > 1 && (
          <button type="button" className="btn btn-ghost" onClick={() => setPart(part - 1)}>
            Back
          </button>
        )}
        <button className="btn btn-red" disabled={!ok || blockNow || busy}>
          {part < 4 ? 'Continue' : busy ? 'Sending…' : 'Submit application'}
        </button>
      </div>
    </form>
  )
}

function Status({ app, reload, onReapply, canReapply }) {
  const closed = app.status === 'not_selected' || app.status === 'blocked'
  const name = (app.form?.full_name || '').split(' ')[0]
  return (
    <div className="stack">
      <div className="chart-card">
        <div className="ap-row">
          <div>
            <p className="muted small">Application {app.code}</p>
            <h2>{name ? `Hi ${name}, here's where you are` : "Here's where you are"}</h2>
          </div>
          <span className={'pill ' + (app.status === 'verified' ? 'pill-green' : closed ? 'pill-muted' : 'pill-blue')}>
            {app.status === 'verified' ? 'Verified editor' : closed ? 'Closed' : 'Step ' + app.stage + ' of 5'}
          </span>
        </div>
        <Tracker app={app} />
      </div>

      {closed && <NotSelected app={app} onReapply={onReapply} canReapply={canReapply} />}
      {!closed && app.status === 'verified' && (
        <div className="chart-card">
          <h3>You're a verified editor</h3>
          <p className="muted">You finished probation. You now get priority on new jobs and your full payout rate.</p>
          <a className="btn btn-red" href="../app.html">Open the QuiCut app</a>
        </div>
      )}
      {!closed && app.status === 'active' && app.stage <= 2 && <Waiting app={app} />}
      {!closed && app.status === 'active' && app.stage === 3 && <TestEdit app={app} reload={reload} />}
      {!closed && app.status === 'active' && app.stage === 4 && <Interview app={app} reload={reload} />}
      {!closed && app.status === 'active' && app.stage === 5 && <Probation app={app} />}

      <section className="chart-card">
        <h3>Questions</h3>
        {FAQ.map(([q, a]) => (
          <details key={q} className="ap-faq">
            <summary>{q}</summary>
            <p className="muted">{a}</p>
          </details>
        ))}
      </section>
    </div>
  )
}

function Waiting({ app }) {
  return (
    <div className="chart-card">
      <h3>{app.stage === 1 ? 'We are checking your setup' : 'We are reviewing your portfolio'}</h3>
      <p className="muted">
        {app.stage === 1
          ? 'Our team checks your speed test, screen recording and the details you gave. You will hear from us within 2 days.'
          : 'Our team checks every sample for originality and quality. This usually takes 2 to 3 days.'}
      </p>
      <p className="muted small">You do not need to do anything. We will update this page and email you.</p>
    </div>
  )
}

const BRIEF = [
  ['Type', 'Travel vlog'],
  ['Length', '6–8 min'],
  ['Pacing', 'Medium, cinematic'],
  ['Colour', 'Warm, golden hour'],
  ['Music', 'Chill lo-fi, upbeat ending'],
  ['Captions', 'Telugu and English'],
]

function TestEdit({ app, reload }) {
  const now = useNow()
  const sub = app.submit?.test
  const [l1, setL1] = useState('')
  const [l2, setL2] = useState('')
  const [c, setC] = useState([false, false, false])
  const [busy, setBusy] = useState(false)
  const t = clock(new Date(app.test_due).getTime() - now)
  const send = async () => {
    setBusy(true)
    try {
      await rest('rpc/app_submit_test', { method: 'POST', body: { p_links: { vlog: l1.trim(), reel: l2.trim() } } })
      toast('Test edit submitted')
      await reload()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }
  if (sub)
    return (
      <div className="chart-card">
        <h3>Submitted</h3>
        <p className="muted">Our team will score it without seeing your name. We'll message you with the result.</p>
        <Rubric />
      </div>
    )
  return (
    <div className="stack">
      <div className="chart-card">
        <h3>Your test edit</h3>
        <div className={'ap-timer' + (t.done ? ' is-late' : '')} role="timer" aria-label="Time left">
          <span>Time left</span>
          <b>{t.h}<i>h</i> : {t.m}<i>m</i> : {t.s}<i>s</i></b>
          <small>Submit by {fdate(app.test_due)}</small>
        </div>
        <p className="ap-warn">One attempt only. There are no retakes. Late or missing submissions aren't scored, and you can apply again after 60 days.</p>
      </div>
      <div className="ap-two">
        <section className="chart-card">
          <h3>Brief</h3>
          <p className="muted small">Translated for you</p>
          <dl className="ap-dl">
            {BRIEF.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          <p className="label">Special instructions</p>
          <ul className="ap-list">
            <li>Remove dead silences</li>
            <li>Keep the waterfall scene in full</li>
            <li>1080p MP4, H.264, up to 2 GB</li>
          </ul>
          <p className="label">Second part: your specialisation</p>
          <p className="muted">From the same footage, make a 30-second vertical Reel (9:16) in the style you do best.</p>
          <p className="muted small">The raw footage link (QuiCut_Test_Araku_Raw, 46 min) is sent to your WhatsApp and email when your portfolio is approved. This footage belongs to QuiCut. Use it only for this test.</p>
        </section>
        <section className="chart-card">
          <h3>Submit your edits</h3>
          <Text label="Travel vlog (6–8 min), share link" hint="Upload to Google Drive or YouTube (unlisted). Anyone with the link must be able to open it." type="url" placeholder="https://" value={l1} onChange={(e) => setL1(e.target.value)} />
          <Text label="Specialisation Reel (30 sec, 9:16), share link" type="url" placeholder="https://" value={l2} onChange={(e) => setL2(e.target.value)} />
          <Check checked={c[0]} onChange={(v) => setC([v, c[1], c[2]])}>I followed every instruction in the brief</Check>
          <Check checked={c[1]} onChange={(v) => setC([c[0], v, c[2]])}>Both files are 1080p MP4 with no watermark</Check>
          <Check checked={c[2]} onChange={(v) => setC([c[0], c[1], v])}>This is entirely my own editing work</Check>
          <button className="btn btn-red" disabled={busy || t.done || !isUrl(l1) || !isUrl(l2) || !c.every(Boolean)} onClick={send}>
            {busy ? 'Sending…' : 'Submit test edit'}
          </button>
        </section>
      </div>
      <section className="chart-card">
        <Rubric />
        <p className="label">Tips</p>
        <ul className="ap-list">
          <li>Read the whole brief before you start. Missing an instruction costs more than a small mistake.</li>
          <li>Check audio on headphones: music should never drown out voices.</li>
          <li>Export early so you have time to watch the final file once.</li>
        </ul>
      </section>
    </div>
  )
}

function Rubric() {
  const rows = [['Cut and pacing', 25], ['Colour grading', 25], ['Audio and music', 20], ['Following the brief', 20], ['Output quality', 10]]
  return (
    <>
      <p className="label">How it's scored</p>
      <dl className="ap-dl">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
        <div><dt><b>Pass mark</b></dt><dd><b>75 / 100</b></dd></div>
      </dl>
    </>
  )
}

const DAYS = 4
const TIMES = [[10, 0], [11, 30], [15, 0], [18, 30]]
function slots() {
  const out = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  while (out.length < DAYS) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() === 0) continue
    out.push({ day: new Date(d), times: TIMES.map(([h, m]) => { const x = new Date(d); x.setHours(h, m); return x }) })
  }
  return out
}

function Interview({ app, reload }) {
  const now = useNow()
  const task = app.submit?.task
  const av = app.submit?.availability
  const [hrs, setHrs] = useState(av?.hours || '')
  const [bk, setBk] = useState(av?.backup || '')
  const [days, setDays] = useState(av?.days || [])
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const call = async (fn, body, ok) => {
    setBusy(true)
    try {
      await rest('rpc/' + fn, { method: 'POST', body })
      toast(ok)
      await reload()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }
  const left = app.task_start ? clock(new Date(app.task_start).getTime() + 6 * 3600e3 - now) : clock(6 * 3600e3)
  const noBackup = bk === 'No backup'

  return (
    <div className="stack">
      <div className="chart-card">
        <h3>Reliability check and interview</h3>
        <p className="muted">You passed the test edit. This step checks how you work on real deadlines.</p>
        <p className="ap-warn">Reply within 1 hour. During this step, our team will message you on WhatsApp. Replying within an hour is part of the check.</p>
      </div>

      <section className="chart-card">
        <h3>6-hour task</h3>
        {!app.task_start && (
          <>
            <p className="muted">A short real-style order. Start it when you have 6 free hours. If you miss the 6 hours, the application ends here.</p>
            <button className="btn btn-red" disabled={busy} onClick={() => call('app_task_start', {}, 'Task started. Good luck!')}>
              Start the 6-hour task
            </button>
          </>
        )}
        {app.task_start && !task && (
          <>
            <div className={'ap-timer' + (left.done ? ' is-late' : '')} role="timer">
              <span>Time left</span>
              <b>{left.h}<i>h</i> : {left.m}<i>m</i> : {left.s}<i>s</i></b>
            </div>
            <p className="muted">Café opening Reel: fast cuts on the beat, warm colours, the café name as a title in the first 2 seconds, captions in English. 30 seconds, 1080p, 9:16. The 4 clips (Cafe_Opening_Clips, 620 MB) were sent to your WhatsApp and email.</p>
            <Text label="Your Reel, share link" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn btn-red" disabled={busy || !isUrl(link)} onClick={() => call('app_task_submit', { p_link: link.trim() }, 'Task submitted')}>
              Submit task
            </button>
          </>
        )}
        {task && <p className="muted">{task.on_time ? 'Task submitted on time. Thanks, we will review it along with your interview.' : 'Task submitted late.'}</p>}
      </section>

      <section className="chart-card">
        <h3>Availability</h3>
        <div className="form-grid">
          <Select label="Hours per day you can commit" value={hrs} onChange={setHrs} options={['2–4 hours', '4–6 hours', '6–8 hours', '8+ hours']} />
          <Select label="Backup internet if your main line fails" value={bk} onChange={setBk} options={['Mobile hotspot', 'Second broadband line', 'No backup']} />
          {noBackup && <span className="ap-block">A backup connection is needed so a power or line cut doesn't make you miss a deadline.</span>}
          <Chips label="Days you usually work" value={days} onChange={setDays} options={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} />
        </div>
        <button className="btn btn-ghost" disabled={busy || !hrs || !bk || !days.length} onClick={() => call('app_availability', { p_data: { hours: hrs, backup: bk, days } }, 'Availability saved')}>
          Save availability
        </button>
      </section>

      <section className="chart-card">
        <h3>Book your interview</h3>
        <p className="muted">A 15-minute video call with our team. We'll talk about how you work, feedback and deadlines, and check your professional English and Hindi.</p>
        {app.interview_at && <p className="ap-ok">Booked for {fdate(app.interview_at)}. We will send the call link to your WhatsApp and email.</p>}
        {slots().map(({ day, times }) => (
          <div key={+day} className="ap-slotday">
            <p className="label">{day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <div className="ap-chips">
              {times.map((t) => {
                const on = app.interview_at && new Date(app.interview_at).getTime() === t.getTime()
                return (
                  <button key={+t} className={'ap-chip' + (on ? ' is-on' : '')} disabled={busy} onClick={() => call('app_book', { p_slot: t.toISOString() }, 'Interview booked')}>
                    {t.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {app.nda_sent_at && <Nda app={app} call={call} busy={busy} />}
    </div>
  )
}

function Nda({ app, call, busy }) {
  const [ok, setOk] = useState(false)
  return (
    <section className="chart-card">
      <h3>You passed the interview</h3>
      {app.nda_signed_at ? (
        <p className="ap-ok">Agreement accepted on {fdate(app.nda_signed_at)}. Our team will switch on your editor account shortly, and you will start your first 10 orders.</p>
      ) : (
        <>
          <p className="muted">Before you start, please read and accept the Core Team Agreement and Non-Disclosure Agreement. In short:</p>
          <ul className="ap-list">
            <li>Client footage and briefs stay inside QuiCut. Sharing them anywhere else means a permanent ban and legal liability.</li>
            <li>One person, one account. Your identity is checked with Aadhaar and PAN inside the QuiCut app, after this step.</li>
            <li>Never ask a client for a rating, and never contact clients outside QuiCut.</li>
            <li>Your first 10 orders are probation: every one is reviewed.</li>
          </ul>
          <Check checked={ok} onChange={setOk}>I have read and I accept the agreement.</Check>
          <button className="btn btn-red" disabled={!ok || busy} onClick={() => call('app_sign_nda', {}, 'Agreement accepted')}>
            Accept and continue
          </button>
        </>
      )}
    </section>
  )
}

function Probation({ app }) {
  const [p, setP] = useState(null)
  useEffect(() => {
    rest('rpc/app_probation', { method: 'POST', body: { p_user: app.user_id } }).then(setP).catch(() => setP({}))
  }, [app.id])
  const orders = p?.orders ?? 0
  const rows = [
    ['Orders finished', `${orders} of 10`, orders >= 10],
    ['Average rating', p?.avg_stars ? Number(p.avg_stars).toFixed(1) + ' ★' : '–', Number(p?.avg_stars) >= 4.5],
    ['On time', `${p?.on_time ?? 0} of ${Math.max(orders, 10)}`, (p?.on_time ?? 0) >= 9],
    ['Revisions per order', p?.revisions ?? '–', orders > 0 && Number(p?.revisions) <= 2],
  ]
  return (
    <div className="chart-card">
      <h3>Probation</h3>
      <p className="muted">Your first 10 real orders are paid like any other order, and every one is reviewed. Targets: average rating 4.5 or higher, 9 of 10 on time, 2 or fewer revisions per order, and no complaints.</p>
      <div className="ap-bar"><i style={{ width: Math.min(100, orders * 10) + '%' }} /></div>
      <dl className="ap-dl">
        {rows.map(([k, v, good]) => (
          <div key={k}><dt>{k}</dt><dd className={good ? 'ap-good' : ''}>{v}</dd></div>
        ))}
      </dl>
      <a className="btn btn-red" href="../app.html">Open the QuiCut app to take orders</a>
    </div>
  )
}

function NotSelected({ app, onReapply, canReapply }) {
  const blocked = app.status === 'blocked'
  return (
    <div className="chart-card">
      <h3>{blocked ? 'This application is closed' : 'Not selected this time'}</h3>
      {app.reject_reason && <p><b>Reason:</b> {app.reject_reason}</p>}
      {app.reject_message && <p className="muted">{app.reject_message}</p>}
      {!blocked && (
        <p className="muted">
          Thank you for the time you put in. {canReapply ? 'You can apply again now.' : `You can apply again after ${new Date(app.reapply_after).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`}
        </p>
      )}
      {canReapply && (
        <button className="btn btn-red" onClick={onReapply}>
          Apply again
        </button>
      )}
    </div>
  )
}
