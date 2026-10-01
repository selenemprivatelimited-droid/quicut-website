# QuiCut website

The 3D marketing site for **QuiCut**, India's video editing marketplace for creators.
Built with [React Three Fiber](https://github.com/pmndrs/react-three-fiber) + three.js + Vite.

## What's on the page

- Intro reel (your logo animation, `public/intro.mp4`) that hands off to a live 3D scene
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

## Intro reel

`public/intro.mp4` plays as a splash on first visit, then hands off to the 3D Q.
If the file is missing the splash is skipped automatically.

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
public/              favicon.svg, intro.mp4 (logo reel)
scripts/build-preview.mjs   no-install single-page preview build (bun + jsDelivr import map)
```

© 2026 Runovah Technologies Pvt Ltd
