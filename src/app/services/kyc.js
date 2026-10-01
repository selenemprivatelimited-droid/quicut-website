// ─────────────────────────────────────────────────────────────────────────────
// KYC: every creator and every editor is verified before money moves.
//
//   Creators  must be verified before buying credits or placing orders.
//   Editors   must be verified before accepting jobs or receiving payouts.
//
// What we collect
//   Creator (India)   phone OTP · full name · PAN or Aadhaar (via DigiLocker) · selfie
//   Creator (abroad)  email · full name · government ID (passport / licence) · selfie
//   Editor (India)    phone OTP · PAN (needed for TDS) · Aadhaar via DigiLocker · selfie ·
//                     UPI / bank verified by penny-drop · signed NDA
//
// Privacy (DPDP Act 2023): the app never keeps full ID numbers. The KYC provider holds the
// documents; QuiCut stores only status, document type, the last 4 characters and the provider
// reference. Account deletion removes KYC data within 30 days (Operational SOP).
//
// Providers to plug in when going live (pick one per region)
//   India:  DigiLocker / Aadhaar + PAN verify + bank penny-drop + face match — e.g. HyperVerge,
//           IDfy, Signzy, Cashfree Verification Suite, or Razorpay/RazorpayX verification APIs
//   Global: Stripe Identity (document + selfie), fits the Stripe checkout used abroad
// ─────────────────────────────────────────────────────────────────────────────

export const KYC_MODE = 'demo' // 'live' once a provider is connected

export const KYC_STEPS = {
  creator: [
    { id: 'phone', label: 'Phone number verified by OTP' },
    { id: 'id', label: 'Government ID (PAN or Aadhaar via DigiLocker; passport abroad)' },
    { id: 'selfie', label: 'Selfie match' },
  ],
  editor: [
    { id: 'phone', label: 'Phone number verified by OTP' },
    { id: 'pan', label: 'PAN card (required for TDS on payouts)' },
    { id: 'id', label: 'Aadhaar via DigiLocker' },
    { id: 'selfie', label: 'Selfie match' },
    { id: 'upi', label: 'UPI or bank account verified with ₹1 test credit' },
    { id: 'nda', label: 'Signed footage NDA' },
  ],
}

export const DOC_TYPES = {
  IN: ['PAN card', 'Aadhaar (DigiLocker)'],
  GLOBAL: ['Passport', 'Driving licence', 'National ID card'],
}

/** Keep only the last 4 characters of an ID number. */
export const maskId = (value) => {
  const v = String(value || '').replace(/\s+/g, '').toUpperCase()
  return v.length >= 4 ? '••••' + v.slice(-4) : ''
}

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const UPI_RE = /^[a-z0-9.\-_]{2,}@[a-z]{2,}$/i

/** Basic format checks before handing off to the provider. Returns an error message or ''. */
export function checkFields(role, f) {
  if (!f.legalName || f.legalName.trim().length < 3) return 'Enter your full name as on your ID.'
  if (!f.docType) return 'Choose an ID document.'
  if (!f.docNumber || f.docNumber.replace(/\s/g, '').length < 6) return 'Enter your ID number.'
  if (role === 'editor') {
    if (!PAN_RE.test((f.pan || '').toUpperCase())) return 'Enter a valid PAN, like ABCDE1234F.'
    if (!UPI_RE.test(f.upi || '')) return 'Enter a valid UPI ID, like name@okicici.'
    if (!f.nda) return 'Accept the footage NDA to continue.'
  }
  if (!f.selfie) return 'Add a selfie for the face match.'
  return ''
}

/** Submit to the KYC provider. Demo: always goes to manual review. */
export async function submitKyc(role, fields) {
  if (KYC_MODE === 'demo') {
    await new Promise((r) => setTimeout(r, 700))
    return { ok: true, providerRef: `kyc_demo_${Date.now().toString(36)}`, status: 'pending' }
  }
  const r = await fetch('/api/kyc/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, ...fields }),
  })
  return r.json()
}
