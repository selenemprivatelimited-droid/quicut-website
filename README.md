# QuiCut website + app

The 3D marketing site, the web app (creator and editor) and the private admin panel for **QuiCut**, India's video editing marketplace for creators.
Built with [React Three Fiber](https://github.com/pmndrs/react-three-fiber) + three.js + Vite.

## What's on the page

- Animated intro (code-drawn, plays on the website and the app) that hands off to a live 3D scene
- 3D extruded **Q** that the blade cuts into two halves (click it to cut again), red bloom glow, sparkles,
  and film-strip rings that orbit the logo as you scroll; the Q glides to the free side of each section
- How it works (4 steps + order tracking stages)
- India creator data (Kofluence / BCG / DataReportal 2025)
- Pricing: 5 tiers + 6 add-ons with a live order builder (total, delivery time, editor's 80%)
- Brief-in-your-language demo (reads a Telugu/Hindi/English brief into an editor checklist)
- For editors: per-order earnings table, weekly UPI payouts
- FAQ and waitlist form

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

## Intro

`src/intro/intro.js` draws the intro on a canvas: quick cuts (SHOOT IT. / SEND IT. / DONE.), the Q
assembling from blade-cut shards, the slash with sparks, UICUT slicing in, a light sweep and the
tagline. It plays once per browser session on both `index.html` and `app.html`, has a Skip button,
and is skipped for people who prefer reduced motion. `drawIntro(ctx, t, w, h)` is a pure function of
time, so the same code also renders the MP4 versions of the intro frame by frame.

## Web app (`/app.html`)

Creator and editor app with QuiCut Credits, per-video editor pay, KYC and payouts. On phones it uses
a native-style bottom tab bar (iOS safe areas, 44px touch targets) and can be added to the home screen.
Dashboards: creators see credits spent per day and edits by type; editors see earnings, jobs and a
7-day rating trend (7/14/30 day ranges). Charts are plain SVG in `src/app/charts.jsx`.
Runs in demo mode (data in the browser). Prices and credit packs: `src/app/config/pricing.js`.
Payments (Razorpay for India, Stripe with Apple Pay / Google Pay for global): `src/app/services/payments.js`.
KYC: `src/app/services/kyc.js`.

## Admin panel (`/admin/`, admins only)

Not linked from the app. Admins sign in with an email link (Supabase Auth), and the panel opens only
for emails in the `public.admins` table (add or remove admins there, 1 to 10 people).
Sections: Overview (cash, GMV, revenue, orders, payouts per day), **Data Analyst** agent, Creators &
editors, **Errors & speed**, Orders, KYC, Payouts, Accounts, Pricing. On `localhost` it opens with demo data.

**Data Analyst** (`src/admin/Analyst.jsx`, `src/app/services/analyst.js`): ask in plain language; the
agent plans a structured query (never code), runs it on the admin tables, retries once if the query is
invalid, then charts and explains the result, with CSV export.

**Errors & speed** (`src/monitor.jsx`, `src/admin/Monitor.jsx`): Sentry-style tracking on our own
Supabase. Every page reports crashes, unhandled promise errors, `console.error`, failed or slow API
calls, React render crashes (with a recovery screen) and Core Web Vitals (LCP, INP, CLS, FCP, TTFB)
to `public.monitor_events`. Browsers can only insert; only admins can read. Issues are grouped by
fingerprint; events older than 30 days are deleted nightly.

## Data (Supabase, Mumbai)

Tables: `profiles`, `orders`, `payments`, `credit_ledger`, `payouts`, `admins`, `monitor_events`, view
`credit_balances`. Row-level security everywhere: people read only their own rows, admins read all.
Money and credit changes are written only by the server (payment webhooks with the secret key).
Footage goes to Cloudflare R2; KYC documents stay with the KYC provider.

## QuiCut AI

- **Creator:** AI brief agent (reads Telugu / Hindi / English briefs, writes the editor checklist, suggests tier and add-ons), voice input, and an assistant chat.
- **Editor:** "Explain this job" plan with tick-off steps and progress, the creator's AI checklist, order messages with an AI reply drafter.
- **Admin:** AI ops brief (follows the SOPs, items open the right tab), "Ask your data" and the Data Analyst agent.
- Every role has the floating **Ask QuiCut AI** assistant.

The AI runs on a Cloudflare Worker with Workers AI (Llama 3.3 70B) at `https://api.quicutapp.com`
(source: `workers/ai/worker.js`, no API keys). The app calls it through `src/app/services/ai.js`;
if it can't be reached, every feature falls back to built-in rules.

## Edit content

All copy, prices and numbers are in `src/content.js`. Prices follow the Final Pricing Model v2.0.

## Waitlist form

The form needs somewhere to send sign-ups. Set `window.QUICUT_WAITLIST_ENDPOINT` in `index.html`
to any URL that accepts a JSON POST (Formspree, a Supabase edge function, Google Apps Script…).
Until then the form runs in preview mode and tells visitors their sign-up wasn't sent.

Payload: `{ name, handle, phone, lang, role: "creator" | "editor", at }`

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repo (branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. The workflow in `.github/workflows/deploy.yml` builds and publishes on every push.

Vercel / Netlify also work: build command `npm run build`, output folder `dist`.

## Files

```
src/
  App.jsx            page sections
  content.js         all text, prices, stats
  styles.css         design tokens + layout
  store.js           shared state between page and 3D scene
  scene/Scene.jsx    R3F canvas: Q logo, blade, ribbons, sparkles, bloom, scroll choreography
  scene/geometry.js  Q / blade shapes, film-strip + glow textures
  Logo.jsx           QuiCut wordmark as inline SVG
  intro/             animated intro (canvas) shared by site and app
  app/               web app: views, services (store, payments, KYC, AI, metrics, Supabase), charts, pricing config
  admin/             private admin panel: sign-in gate, dashboards, Data Analyst, Errors & speed
  monitor.jsx        error tracking + Web Vitals reporter, used by every page
admin/index.html     admin entry page (noindex)
workers/ai/          Cloudflare Worker behind api.quicutapp.com (Workers AI)
public/              favicon.svg, manifest.webmanifest
scripts/build-preview.mjs   no-install single-page preview build (bun + jsDelivr import map)
```

© 2026 Runovah Technologies Pvt Ltd
