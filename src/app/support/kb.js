// Knowledge base for the creator and editor support agents.
// The agent pulls the few entries that match the question and answers from them, so replies stay accurate.
// Prices come from config/pricing.js, so this never goes out of date.
import { EDIT_TYPES, ADDONS, CREDIT_PACKS, PAYOUTS, packTotal } from '../config/pricing.js'

const types = EDIT_TYPES.map((t) => `${t.name} ${t.credits} QC (${t.delivery}, ${t.output})`).join('; ')
const adds = ADDONS.map((a) => `${a.name} +${a.credits} QC`).join('; ')
const packs = CREDIT_PACKS.map((p) => `${p.name} ₹${p.priceInr} gives ${packTotal(p)} QC${p.period ? ' per month' : ''}`).join('; ')
const pays = EDIT_TYPES.map((t) => `${t.name} ₹${t.editorPayInr}`).join('; ')

// role: 'creator' | 'editor' | 'both'. go: the bottom tab to open (matches the tab label).
const KB = [
  { role: 'both', title: 'What QuiCut is', tags: 'quicut what how works marketplace', a: 'QuiCut connects creators with verified video editors. Creators upload footage and a brief (Telugu, Hindi or English), and an editor delivers a finished edit, most within 24 hours.' },
  { role: 'both', title: 'KYC', tags: 'kyc verify verification aadhaar pan selfie passport id identity approve pending rejected', a: 'KYC is required before money moves. Go to Profile, start KYC, and add your ID and a selfie (editors also add PAN and UPI). Review usually takes a few hours. If it is rejected, the reason is shown on Profile and you can resubmit.', go: 'Profile', goLabel: 'Open Profile' },
  { role: 'both', title: 'Delete account', tags: 'delete account remove data privacy dpdp', a: 'You can request account deletion from Profile. Your data and footage are removed within 30 days, as required by the DPDP Act.', go: 'Profile', goLabel: 'Open Profile' },
  { role: 'both', title: 'Talk to a human', tags: 'human person agent call complain complaint problem issue bug not working stuck angry', a: 'If this needs a person, send a request and the QuiCut team replies in the Help section.' },
  { role: 'creator', title: 'Credits', tags: 'credit credits qc balance buy topup top wallet', a: 'QuiCut Credits (QC) pay for edits, 1 QC = ₹1. Buy a pack in Wallet. India: UPI, cards, netbanking. Outside India: Apple Pay, Google Pay, cards. Bigger packs include bonus credits.', go: 'Wallet', goLabel: 'Open Wallet' },
  { role: 'creator', title: 'Credit packs', tags: 'pack packs value best cheap pro starter studio creator plan monthly subscription bonus', a: `Packs: ${packs}. QuiCut Pro is monthly and includes a priority queue.`, go: 'Wallet', goLabel: 'See packs' },
  { role: 'creator', title: 'Edit prices and delivery', tags: 'price cost how much tier reel vlog gaming cinematic wedding delivery time hours long which pick choose', a: `Edits: ${types}. Add-ons: ${adds}.`, go: 'New edit', goLabel: 'Start a new edit' },
  { role: 'creator', title: 'Placing an order', tags: 'order place new upload footage brief start create how', a: 'Open New edit, choose the edit type and add-ons, upload or link your footage, write the brief in any language, then pay with credits. The brief helper can turn a rough note into a checklist for the editor.', go: 'New edit', goLabel: 'Start a new edit' },
  { role: 'creator', title: 'Revisions', tags: 'revision change fix redo edit again correction changes feedback', a: `Every order includes one free revision. Open the order, write exactly what to change and send it. More revisions cost ${ADDONS.find((a) => a.id === 'revision').credits} QC (Extra revision).`, go: 'Orders', goLabel: 'Open Orders' },
  { role: 'creator', title: 'Order status and delays', tags: 'where order status late delay waiting editor assigned review delivered track deadline', a: 'Order stages: Paid (waiting for an editor), Editing, Ready to review, Delivered. Your due time is shown on the order. If an order is late, message the editor in the order chat or send a support request.', go: 'Orders', goLabel: 'Open Orders' },
  { role: 'creator', title: 'Approving delivery', tags: 'approve accept delivery rating stars review download final file', a: 'When an order is Ready to review, check the video, then approve it and rate the editor, or ask for your free revision. Approving completes the order.', go: 'Orders', goLabel: 'Open Orders' },
  { role: 'creator', title: 'Payment problems and refunds', tags: 'payment failed deducted money refund charged razorpay stripe upi card declined paid not credited', a: 'If money was deducted but credits did not arrive, wait a few minutes, then send a support request with the payment time and amount. Refund requests are reviewed by the QuiCut team, so I will raise it for you.' },
  { role: 'editor', title: 'Payouts', tags: 'payout paid payment money earn earnings upi monday withdraw balance when', a: `Editors are paid ${PAYOUTS.schedule.toLowerCase()} by ${PAYOUTS.method}, once the available balance is at least ₹${PAYOUTS.minimumInr}. Request a payout from Earnings. Your UPI id and KYC must be set.`, go: 'Earnings', goLabel: 'Open Earnings' },
  { role: 'editor', title: 'Pay per video', tags: 'pay rate earn per video how much price editor share 80 percent', a: `You earn a fixed amount per video (80% of the price): ${pays}. Add-ons pay extra.`, go: 'Earnings', goLabel: 'Open Earnings' },
  { role: 'editor', title: 'TDS and tax', tags: 'tds tax 194 pan form 16a deduction income', a: `TDS of 10% usually applies once your yearly earnings pass ₹${PAYOUTS.tdsThresholdInrPerYear.toLocaleString('en-IN')}. Keep your PAN updated in Profile. For your exact tax, check with a CA.`, go: 'Profile', goLabel: 'Open Profile' },
  { role: 'editor', title: 'Taking jobs', tags: 'job jobs take accept claim open new work find start assign', a: 'Open jobs are in New jobs. Tap a job to read the brief and take it. Your active jobs are in My work. KYC must be verified before you can take jobs.', go: 'New jobs', goLabel: 'Open New jobs' },
  { role: 'editor', title: 'Delivering and revisions', tags: 'deliver delivery upload link drive submit revision changes feedback creator complaint late deadline', a: 'Finish the checklist in My work, upload to Drive or R2, and submit the delivery link before the deadline. If the creator asks for a revision, the note shows on the job; fix it and deliver again. Late or poor deliveries affect your rating.', go: 'My work', goLabel: 'Open My work' },
  { role: 'editor', title: 'Briefs in Telugu or Hindi', tags: 'brief language telugu hindi understand explain translate unclear', a: 'On a job, use the explain helper to get the brief in simple English with steps and things to watch for. If it is still unclear, message the creator in the order chat before you start.', go: 'My work', goLabel: 'Open My work' },
  { role: 'editor', title: 'Rating and status', tags: 'rating stars status paused active suspended score low ban', a: 'Your rating is the average of creator ratings on delivered work. Admins can pause an editor for repeated late or poor work. If you think a status is wrong, send a support request.' },
]

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿఀ-౿ ]/g, ' ')

/** Top matching knowledge entries for this role and question. */
export function retrieve(role, question, n = 3) {
  const q = norm(question).split(/\s+/).filter((w) => w.length > 2)
  if (!q.length) return []
  return KB.filter((e) => e.role === 'both' || e.role === role)
    .map((e) => {
      const t = norm(e.tags + ' ' + e.title).split(/\s+/)
      let score = 0
      for (const w of q) if (t.some((x) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x))))) score += 1
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.e)
}

export const HUMAN = KB.find((e) => e.title === 'Talk to a human')
