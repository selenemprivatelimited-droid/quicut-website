import { useEffect, useMemo, useState } from 'react'
import { rest } from '../app/services/supa.js'
import { toast, ago, Empty } from '../app/ui.jsx'
import './vetting.css'

// Editor vetting console: the team side of the five-step selection (see /apply/ for the applicant side).
// Stage 1 screening, 2 portfolio, 3 blind test edit, 4 reliability + interview, 5 probation.
// Decisions are recorded by database functions that check the caller's admin role, not by this page.

const STAGE = ['', 'Screening', 'Portfolio review', 'Test edit', 'Reliability and interview', 'Probation', 'Verified']
const TEST_CRIT = [
  ['cut', 'Cut and pacing', 25, 15],
  ['colour', 'Colour grading', 25, 15],
  ['audio', 'Audio and music', 20, 12],
  ['brief', 'Brief compliance', 20, 12],
  ['output', 'Output quality', 10, 8],
]
const PORT_CRIT = [
  ['colour', 'Colour consistency and natural skin tones'],
  ['transitions', 'Transitions serve the story'],
  ['cuts', 'Cuts land on the beat, no audio drift'],
  ['titles', 'Titles and subtitles readable and well timed'],
]
const INTERVIEW = [
  ['task', '6-hour task quality is acceptable'],
  ['comm', 'Communicates clearly and professionally'],
  ['english', 'Professional English'],
  ['hindi', 'Professional Hindi'],
  ['feedback', 'Handles critical feedback and revisions well'],
  ['avail', 'Availability is realistic for 24-hour deadlines'],
]
const RED_LINES = [
  ['Stolen portfolio', "Someone else's videos submitted as their own. Checked by reverse video search."],
  ['AI-only editing', 'Only CapCut auto-edit or AI tools with no real editing. The test footage is designed to catch this.'],
  ['Sharing client footage', 'Any client footage outside QuiCut. Permanent ban and liability under the NDA.'],
  ['Fake identity', 'Aadhaar and PAN verified at onboarding. More than one account per person means a permanent ban.'],
  ['Rating manipulation', 'Asking clients for 5 stars or fake reviews means immediate removal.'],
]
const hoursAgo = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5))
const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0)

const mk = (i, stage, name, extra = {}) => ({
  id: 'demo-' + i, code: 'QV-' + (1040 + i), user_id: 'demo', stage, status: 'active', stage_at: new Date(Date.now() - i * 5e6).toISOString(), created_at: new Date(Date.now() - i * 9e7).toISOString(),
  submit: {}, review: {},
  form: {
    full_name: name, city: 'Hyderabad', state: 'Telangana', langs: ['తెలుగు', 'English'], types: ['Vlog', 'Food'], years: '2–4 years', software: 'DaVinci Resolve', device: 'Windows laptop or desktop',
    ram: '32 GB or more', cpu: 'AMD Ryzen 5 or newer', gpu: 'Built-in graphics only', storage: '100–250 GB', upload_mbps: 48, hours: '6–8 hours', turnaround: '6–10 hours',
    speed_link: 'https://example.com/speed.png', setup_link: 'https://example.com/setup', portfolio_link: 'https://example.com/portfolio',
    samples: [{ link: 'https://example.com/1', type: 'Food' }, { link: 'https://example.com/2', type: 'Vlog' }, { link: 'https://example.com/3', type: 'Reel or Short' }],
  },
  ...extra,
})
const DEMO = [mk(1, 1, 'Ramya Krishnan'), mk(2, 2, 'Sana Begum'), mk(3, 3, 'Divya Rao', { submit: { test: { vlog: 'https://example.com/v', reel: 'https://example.com/r', at: new Date().toISOString() } } }), mk(4, 4, 'Kiran Reddy', { submit: { task: { minutes: 292, on_time: true }, availability: { hours: '4–6 hours', backup: 'Mobile hotspot', days: ['Mon', 'Tue', 'Wed'] } } }), mk(5, 5, 'Lakshmi P.')]

function Reject({ onSend, onCancel, blockOption }) {
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  const [block, setBlock] = useState(false)
  return (
    <div className="chart-card vt-reject">
      <h4>Reject this applicant?</h4>
      <label className="field">
        <span className="label">Reason</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short reason for the team" />
      </label>
      <label className="field">
        <span className="label">Message to the applicant</span>
        <textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Be specific and kind. They will read this." />
      </label>
      {blockOption && (
        <label className="vt-check">
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} /> Block this person permanently (red-line violation)
        </label>
      )}
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-red" disabled={!reason.trim() || !msg.trim()} onClick={() => onSend({ reason: reason.trim(), message: msg.trim(), block })}>
          Send and close
        </button>
      </div>
    </div>
  )
}

function YesNo({ label, value, onChange, yes = 'Yes', no = 'No' }) {
  return (
    <div className="vt-yn">
      <span>{label}</span>
      <div className="vt-seg" role="group" aria-label={label}>
        <button className={value === true ? 'is-on' : ''} onClick={() => onChange(true)}>{yes}</button>
        <button className={value === false ? 'is-on bad' : ''} onClick={() => onChange(false)}>{no}</button>
      </div>
    </div>
  )
}
const Row = ({ k, v, bad }) => (
  <div className="vt-kv"><span>{k}</span><b className={bad ? 'bad' : ''}>{v || '–'}</b></div>
)
const Link = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">{children}</a>
)

function Screening({ a, decide }) {
  const f = a.form || {}
  const [ev, setEv] = useState({ speed: null, ram: null, soft: null })
  const [rej, setRej] = useState(false)
  const all = ev.speed !== null && ev.ram !== null && ev.soft !== null
  const pass = all && ev.speed && ev.ram && ev.soft
  return (
    <>
      <div className="chart-card">
        <h4>Automatic checks</h4>
        <p className="muted small">From the application form. The form already blocks applicants below the minimums.</p>
        <Row k="Editing experience" v={f.years} />
        <Row k="Main software" v={f.software} />
        <Row k="Device" v={f.device} />
        <Row k="RAM" v={f.ram} />
        <Row k="Processor" v={f.cpu} />
        <Row k="Graphics card (recommended)" v={f.gpu} bad={f.gpu === 'Built-in graphics only'} />
        <Row k="Free storage" v={f.storage} />
        <Row k="Upload speed" v={f.upload_mbps ? f.upload_mbps + ' Mbps' : ''} />
        <Row k="Hours per day" v={f.hours} />
        <Row k="10-min vlog turnaround" v={f.turnaround} />
        <Row k="Portfolio and 3 samples" v={(f.samples || []).map((s) => s.type).join(', ')} />
      </div>
      <div className="chart-card">
        <h4>Verify the evidence</h4>
        <p className="muted small">Claims only count if the files back them up. Any “No” means reject.</p>
        <div className="btn-row">
          {f.speed_link && <Link href={f.speed_link}>Open speed test</Link>}
          {f.setup_link && <Link href={f.setup_link}>Open setup recording</Link>}
        </div>
        <YesNo label="Speed test shows 20 Mbps or more upload" value={ev.speed} onChange={(v) => setEv({ ...ev, speed: v })} />
        <YesNo label="Screen recording shows the stated RAM and processor" value={ev.ram} onChange={(v) => setEv({ ...ev, ram: v })} />
        <YesNo label="Screen recording shows Premiere, DaVinci or Final Cut open" value={ev.soft} onChange={(v) => setEv({ ...ev, soft: v })} />
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setRej(true)}>Reject</button>
          <button className="btn btn-red" disabled={!pass} onClick={() => decide('pass', { evidence: ev })}>Pass to portfolio review</button>
        </div>
        {all && !pass && <p className="ap-block">Something did not check out. Reject with a clear reason.</p>}
      </div>
      {rej && <Reject onCancel={() => setRej(false)} onSend={(d) => decide('reject', { ...d, evidence: ev })} />}
    </>
  )
}

function Portfolio({ a, decide }) {
  const f = a.form || {}
  const samples = f.samples || []
  const [orig, setOrig] = useState([null, null, null])
  const [hd, setHd] = useState(null)
  const [sc, setSc] = useState({ colour: 7, transitions: 7, cuts: 7, titles: 7 })
  const [rej, setRej] = useState(false)
  const avg = Math.round((Object.values(sc).reduce((x, y) => x + y, 0) / 4) * 10) / 10
  const stolen = orig.some((o) => o === false)
  const types = new Set(samples.map((s) => s.type)).size === 3
  const ready = orig.every((o) => o === true) && hd === true && types
  return (
    <>
      <div className="chart-card">
        <h4>Samples and originality</h4>
        <p className="muted small">Run a reverse video search on each sample. Someone else's work is an instant disqualification.</p>
        {samples.map((s, i) => (
          <div key={i} className="vt-sample">
            <div><b>Sample {i + 1}</b> <span className="muted small">{s.type}</span></div>
            <Link href={s.link}>Open</Link>
            <YesNo label="Originality" value={orig[i]} onChange={(v) => setOrig(orig.map((x, j) => (j === i ? v : x)))} yes="Original" no="Found elsewhere" />
          </div>
        ))}
        {f.portfolio_link && <Link href={f.portfolio_link}>Open portfolio</Link>}
        {stolen && <p className="ap-block">Red line: stolen portfolio. Reject and block this applicant. Note the original link in the reason.</p>}
      </div>
      <div className="chart-card">
        <h4>Quality scores</h4>
        <p className="muted small">Score across all three samples, 1 to 10. Pass needs an average of 7.</p>
        <YesNo label="All three samples are at least 1080p" value={hd} onChange={setHd} />
        <Row k="Three different types of edits" v={types ? 'Yes' : 'No'} bad={!types} />
        {PORT_CRIT.map(([k, label]) => (
          <label className="vt-range" key={k}>
            <span>{label}</span>
            <input type="range" min="1" max="10" value={sc[k]} onChange={(e) => setSc({ ...sc, [k]: Number(e.target.value) })} />
            <b>{sc[k]}</b>
          </label>
        ))}
        <div className="vt-total"><span>Average</span><b className={avg >= 7 ? 'ap-good' : 'bad'}>{avg.toFixed(1)}</b></div>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setRej(true)}>Reject</button>
          <button className="btn btn-red" disabled={!ready || avg < 7} onClick={() => decide('pass', { originality: orig, scores: sc, average: avg })}>Pass to test edit</button>
        </div>
      </div>
      {rej && <Reject blockOption onCancel={() => setRej(false)} onSend={(d) => decide('reject', { ...d, scores: sc, average: avg })} />}
    </>
  )
}

function TestEdit({ a, decide }) {
  const t = a.submit?.test
  const [sc, setSc] = useState({ cut: 0, colour: 0, audio: 0, brief: 0, output: 0 })
  const [fb, setFb] = useState('')
  const [rej, setRej] = useState(false)
  const total = Object.values(sc).reduce((x, y) => x + y, 0)
  const mins = TEST_CRIT.every(([k, , , min]) => sc[k] >= min)
  return (
    <>
      <div className="chart-card">
        <h4>Blind scoring · candidate {a.code}</h4>
        {t ? (
          <>
            <p className="muted small">Submitted {ago(t.at)}. The name is revealed only after you submit a decision, so the score isn't influenced by who made the edit.</p>
            <div className="btn-row">
              <Link href={t.vlog}>Open travel vlog</Link>
              <Link href={t.reel}>Open reel</Link>
            </div>
          </>
        ) : (
          <p className="muted">Nothing submitted yet. {a.test_due ? 'Due ' + new Date(a.test_due).toLocaleString('en-IN') + '. If it passes without a submission the application is closed automatically on reject.' : ''}</p>
        )}
        <p className="label">Brief checklist</p>
        <ul className="ap-list">
          <li>6–8 minutes, 1080p MP4, under 2 GB</li>
          <li>Telugu and English captions</li>
          <li>Waterfall scene kept in full</li>
          <li>Dead silences removed</li>
          <li>30-second vertical Reel (9:16) specialisation</li>
        </ul>
      </div>
      <div className="chart-card">
        <h4>Score the edit</h4>
        {TEST_CRIT.map(([k, label, max, min]) => (
          <label className="vt-range" key={k}>
            <span>{label} <small className="muted">/{max} · pass {min}+</small></span>
            <input type="range" min="0" max={max} value={sc[k]} onChange={(e) => setSc({ ...sc, [k]: Number(e.target.value) })} />
            <b className={sc[k] >= min ? '' : 'bad'}>{sc[k]}</b>
          </label>
        ))}
        <div className="vt-total"><span>Total · pass mark 75</span><b className={total >= 75 && mins ? 'ap-good' : 'bad'}>{total} / 100</b></div>
        <label className="field">
          <span className="label">Feedback for the candidate</span>
          <textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Shown to the candidate if they're not selected. Be specific and kind." />
        </label>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setRej(true)}>Not selected</button>
          <button className="btn btn-red" disabled={!t || total < 75 || !mins || !fb.trim()} onClick={() => decide('pass', { scores: sc, total, feedback: fb.trim() })}>Pass to stage 4</button>
        </div>
        {!mins && total >= 75 && <p className="ap-block">One criterion is below its minimum. Every criterion must reach its pass mark.</p>}
      </div>
      {rej && <Reject onCancel={() => setRej(false)} onSend={(d) => decide('reject', { ...d, message: d.message || fb, scores: sc, total, feedback: fb })} />}
    </>
  )
}

function Interview({ a, decide, call }) {
  const f = a.form || {}
  const t = a.submit?.task
  const av = a.submit?.availability
  const [as, setAs] = useState({})
  const [notes, setNotes] = useState('')
  const [rej, setRej] = useState(false)
  const n = words(notes)
  const allPass = INTERVIEW.every(([k]) => as[k] === true)
  if (a.nda_sent_at) {
    return (
      <div className="chart-card">
        <h4>Agreement</h4>
        <Row k="Agreement sent" v={ago(a.nda_sent_at)} />
        <Row k="Agreement accepted" v={a.nda_signed_at ? ago(a.nda_signed_at) : 'Waiting for the applicant'} />
        <p className="muted small">When the applicant has accepted, switch on their editor account. Check their Aadhaar and PAN under KYC first.</p>
        <button className="btn btn-red" disabled={!a.nda_signed_at} onClick={() => call('app_start_probation', { p_id: a.id }, 'Probation started')}>Start probation</button>
      </div>
    )
  }
  return (
    <>
      <div className="chart-card">
        <h4>Reliability results</h4>
        <Row k="6-hour task" v={t ? (t.on_time ? 'Delivered in ' + Math.floor(t.minutes / 60) + ' h ' + (t.minutes % 60) + ' m' : 'Late') : a.task_start ? 'Started ' + ago(a.task_start) : 'Not started'} bad={t && !t.on_time} />
        <Row k="Backup internet" v={av?.backup} bad={av?.backup === 'No backup'} />
        <Row k="Availability" v={av ? av.hours + ' · ' + (av.days || []).join(', ') : ''} />
        <Row k="Interview" v={a.interview_at ? new Date(a.interview_at).toLocaleString('en-IN') : 'Not booked yet'} />
        <Row k="Test edit" v={a.review?.s3?.total ? a.review.s3.total + ' / 100' : ''} />
        <p className="muted small">Name: {f.full_name} · {f.city}, {f.state} · WhatsApp {f.whatsapp ? '••••• ••' + String(f.whatsapp).slice(-3) : ''}</p>
      </div>
      <div className="chart-card">
        <h4>Interview assessment</h4>
        <p className="muted small">Any “Fail” means reject.</p>
        {INTERVIEW.map(([k, label]) => (
          <YesNo key={k} label={label} value={as[k] ?? null} onChange={(v) => setAs({ ...as, [k]: v })} yes="Pass" no="Fail" />
        ))}
        <label className="field">
          <span className="label">Interview notes</span>
          <textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="At least 200 words with a clear recommendation (Core Team Agreement)." />
          <span className={'small ' + (n >= 200 ? 'ap-good' : 'muted')}>{n} / 200 words</span>
        </label>
        <div className="btn-row">
          <button className="btn btn-ghost" onClick={() => setRej(true)}>Reject</button>
          <button className="btn btn-red" disabled={!allPass || n < 200 || !t?.on_time || !a.interview_at} onClick={() => decide('pass', { assessment: as, notes })}>Approve and send agreement</button>
        </div>
      </div>
      <div className="chart-card">
        <h4>Prepare</h4>
        <ul className="ap-list">
          <li>Ask them to explain how they'd handle a brief they disagree with.</li>
          <li>Ask: “How do you respond to critical feedback?”</li>
          <li>Confirm they can meet a 24-hour deadline on a weekday.</li>
          <li>Switch to Hindi for part of the call.</li>
        </ul>
      </div>
      {rej && <Reject onCancel={() => setRej(false)} onSend={(d) => decide('reject', { ...d, assessment: as, notes })} />}
    </>
  )
}

function Probation({ a, call, live }) {
  const [p, setP] = useState(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!live) return setP({ orders: 10, avg_stars: 4.7, on_time: 9, revisions: 1.2 })
    rest('rpc/app_probation', { method: 'POST', body: { p_user: a.user_id } }).then(setP).catch(() => setP({}))
  }, [a.id, live])
  const o = p?.orders ?? 0
  const t = [
    ['Orders finished', o + ' of 10', o >= 10],
    ['Average rating (4.5 or higher)', p?.avg_stars ? Number(p.avg_stars).toFixed(1) + ' ★' : '–', Number(p?.avg_stars) >= 4.5],
    ['On time (9 of 10)', (p?.on_time ?? 0) + ' of ' + Math.max(o, 10), (p?.on_time ?? 0) >= 9],
    ['Revisions per order (2 or fewer)', p?.revisions ?? '–', o > 0 && Number(p?.revisions) <= 2],
  ]
  const met = t.every((x) => x[2])
  return (
    <div className="chart-card">
      <h4>Probation</h4>
      <p className="muted small">First 10 real orders, every one reviewed. Verify when all four targets are met. Any complaint triggers a review, so check Support first.</p>
      {t.map(([k, v, g]) => <Row key={k} k={k} v={String(v)} bad={!g} />)}
      <label className="field">
        <span className="label">Decision note</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note for the record" />
      </label>
      <div className="btn-row">
        <button className="btn btn-ghost" disabled={!note.trim()} onClick={() => call('app_verify', { p_id: a.id, p_ok: false, p_note: note }, 'Probation closed')}>Targets not met</button>
        <button className="btn btn-red" disabled={!met} onClick={() => call('app_verify', { p_id: a.id, p_ok: true, p_note: note }, 'Editor verified')}>Verify editor</button>
      </div>
    </div>
  )
}

function Rules() {
  return (
    <div className="stack">
      <div className="chart-card">
        <h3>Red lines: instant disqualification</h3>
        {RED_LINES.map(([k, v]) => <Row key={k} k={k} v={v} />)}
      </div>
      <div className="chart-card">
        <h3>Test edit rubric</h3>
        {TEST_CRIT.map(([, k, max, min]) => <Row key={k} k={k} v={max + ' · pass ' + min + '+'} />)}
        <Row k="Pass mark" v="75 / 100" />
        <p className="muted small">No retakes. Not selected candidates can reapply after 60 days.</p>
      </div>
      <div className="chart-card">
        <h3>Minimum setup</h3>
        <Row k="RAM" v="16 GB" /><Row k="Processor" v="Intel i5 8th gen / Ryzen 5 / Apple M1" /><Row k="GPU (recommended)" v="GTX 1060 / RX 580" />
        <Row k="Free storage" v="100 GB" /><Row k="Upload speed" v="20 Mbps" /><Row k="Software" v="Premiere Pro / DaVinci / FCP" />
        <p className="muted small">Mobile-only editors are rejected at stage 1.</p>
      </div>
      <div className="chart-card">
        <h3>Pass marks</h3>
        <Row k="Portfolio" v="7 / 10 average" /><Row k="Test edit" v="75 / 100" /><Row k="6-hour task" v="On time" /><Row k="Probation" v="4.5★ · 9/10 on time" />
      </div>
    </div>
  )
}

export default function Vetting({ live }) {
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('pipeline')
  const [filter, setFilter] = useState(0)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!live) return setRows(DEMO)
    setRows(await rest('editor_applications?select=*&order=created_at.desc&limit=300'))
  }
  useEffect(() => {
    load().catch((e) => toast(e.message))
  }, [live])

  const call = async (fn, body, ok) => {
    if (!live) return toast('Demo mode: sign in as an admin to decide on real applicants')
    setBusy(true)
    try {
      await rest('rpc/' + fn, { method: 'POST', body })
      toast(ok)
      setOpen(null)
      await load()
    } catch (e) {
      toast(e.message)
    }
    setBusy(false)
  }

  const act = useMemo(() => rows?.filter((r) => r.status === 'active') || [], [rows])
  const month = new Date().toISOString().slice(0, 7)
  const stats = {
    month: (rows || []).filter((r) => r.created_at?.startsWith(month)).length,
    progress: act.length,
    verified: (rows || []).filter((r) => r.status === 'verified' && r.updated_at?.startsWith(month)).length,
    no: (rows || []).filter((r) => r.status === 'not_selected' || r.status === 'blocked').length,
  }
  const by = (s) => act.filter((r) => r.stage === s).length
  const cur = rows?.find((r) => r.id === open)
  const list = act.filter((r) => !filter || r.stage === filter)
  const todo = [
    [by(1), 'screenings to check', 1],
    [by(2), 'portfolios to review', 2],
    [act.filter((r) => r.stage === 3 && r.submit?.test).length, 'test edits to score', 3],
    [act.filter((r) => r.stage === 4 && !r.nda_sent_at && r.submit?.task).length, 'interviews to assess', 4],
    [by(5), 'in probation', 5],
  ].filter((x) => x[0])

  if (cur) {
    const decide = (action, data) => call('app_decide', { p_id: cur.id, p_action: action, p_data: data }, action === 'pass' ? 'Moved to the next step' : 'Applicant notified')
    const blind = cur.stage === 3
    return (
      <div className="stack">
        <div className="btn-row">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Back to pipeline</button>
        </div>
        <div className="chart-card">
          <p className="muted small">Stage {cur.stage} · {STAGE[cur.stage]} · {cur.code}</p>
          <h3>{blind ? 'Candidate ' + cur.code : cur.form?.full_name}</h3>
          {!blind && <p className="muted small">{cur.form?.city}, {cur.form?.state} · {(cur.form?.langs || []).join(', ')} · {(cur.form?.types || []).join(', ')}</p>}
        </div>
        <fieldset disabled={busy} className="vt-fs">
          {cur.stage === 1 && <Screening a={cur} decide={decide} />}
          {cur.stage === 2 && <Portfolio a={cur} decide={decide} />}
          {cur.stage === 3 && <TestEdit a={cur} decide={decide} />}
          {cur.stage === 4 && <Interview a={cur} decide={decide} call={call} />}
          {cur.stage === 5 && <Probation a={cur} call={call} live={live} />}
        </fieldset>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="vt-tabs" role="tablist">
        <button className={tab === 'pipeline' ? 'is-on' : ''} onClick={() => setTab('pipeline')}>Pipeline</button>
        <button className={tab === 'rules' ? 'is-on' : ''} onClick={() => setTab('rules')}>Rules and rubric</button>
      </div>
      {tab === 'rules' && <Rules />}
      {tab === 'pipeline' && (
        <>
          {!live && <p className="muted small">Demo data. Sign in as an admin (add ?signin to the address) to see real applicants.</p>}
          <div className="vt-stats">
            {[['Applications this month', stats.month], ['In progress', stats.progress], ['Verified this month', stats.verified], ['Not selected', stats.no]].map(([k, v]) => (
              <div className="chart-card" key={k}><span className="muted small">{k}</span><b className="vt-big">{rows ? v : '…'}</b></div>
            ))}
          </div>
          <div className="chart-card">
            <h3>Where applicants are now</h3>
            <div className="vt-funnel">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} className={'vt-stage' + (filter === s ? ' is-on' : '')} onClick={() => setFilter(filter === s ? 0 : s)}>
                  <span>{s} · {STAGE[s]}</span><b>{by(s)}</b>
                </button>
              ))}
            </div>
          </div>
          {todo.length > 0 && (
            <div className="chart-card">
              <h3>Needs you today</h3>
              {todo.map(([n, label, s]) => (
                <div className="row" key={s}>
                  <div className="row-main"><div className="row-title">{n} {label}</div></div>
                  <div className="row-side"><button className="btn btn-ghost btn-sm" onClick={() => setFilter(s)}>Show</button></div>
                </div>
              ))}
            </div>
          )}
          <div className="chart-card">
            <h3>Applicants {filter ? '· ' + STAGE[filter] : ''}</h3>
            {rows && list.length === 0 && <Empty title="No applicants here">New applications appear when someone applies at quicutapp.com/apply/</Empty>}
            <div className="list">
              {list.map((r) => (
                <div className="row" key={r.id}>
                  <div className="row-main">
                    <div className="row-title">{r.stage === 3 ? 'Candidate ' + r.code : r.form?.full_name || r.email}</div>
                    <div className="row-meta">{r.code} · {(r.form?.langs || []).join(', ')} · {(r.form?.types || []).slice(0, 3).join(', ')}</div>
                  </div>
                  <div className="row-side">
                    <span className="pill pill-blue">{r.stage} · {STAGE[r.stage]}</span>
                    <span className="muted small">{hoursAgo(r.stage_at)} h</span>
                    <button className="btn btn-red btn-sm" onClick={() => setOpen(r.id)}>Open</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-card">
            <h3>Pass marks</h3>
            <div className="vt-stats">
              {[['Portfolio', '7 / 10 average'], ['Test edit', '75 / 100'], ['6-hour task', 'On time'], ['Probation', '4.5★ · 9/10 on time']].map(([k, v]) => (
                <div key={k}><span className="muted small">{k}</span><b>{v}</b></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
