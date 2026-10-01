// Builds a no-install, single-page preview (preview/index.html) that loads
// React, three and React Three Fiber from jsDelivr through an import map.
// Usage: node scripts/build-preview.mjs   (needs bun for JSX bundling)
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs'

const CDN = 'https://cdn.jsdelivr.net/npm'
const ext = ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'three', 'three/addons/*', '@react-three/fiber']
mkdirSync('preview', { recursive: true })
execSync(
  `bun build src/main.jsx --format esm --target browser --minify ${ext.map((e) => `--external '${e}'`).join(' ')} ` +
    `--define 'process.env.NODE_ENV="production"' --outfile preview/app.js`,
  { stdio: 'inherit' }
)
const app = readFileSync('preview/app.js', 'utf8')
const css = readFileSync('src/styles.css', 'utf8')
const fonts = readFileSync('index.html', 'utf8').match(/<link href="https:\/\/fonts\.googleapis[^>]+>/)[0]
const importmap = {
  imports: {
    react: `${CDN}/react@18.3.1/+esm`,
    'react/jsx-runtime': `${CDN}/react@18.3.1/jsx-runtime/+esm`,
    'react-dom/client': `${CDN}/react-dom@18.3.1/client/+esm`,
    three: `${CDN}/three@0.169.0/+esm`,
    'three/addons/': `${CDN}/three@0.169.0/examples/jsm/`,
    '@react-three/fiber': `${CDN}/@react-three/fiber@8.17.10/+esm`,
  },
}
const html = `<title>QuiCut</title>
<meta name="description" content="QuiCut: video editing for Indian creators. 24-hour delivery, fixed prices from ₹299.">
<meta name="theme-color" content="#050507">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
${fonts}
<style>${css}</style>
<script type="importmap">${JSON.stringify(importmap)}</script>
<script>window.QUICUT_WAITLIST_ENDPOINT = ''</script>
<div id="root"></div>
<script type="module">${app.replace(/<\/script/g, '<\\/script')}</script>
`
writeFileSync('preview/index.html', html)
for (const f of ['favicon.svg']) copyFileSync('public/' + f, 'preview/' + f)
console.log('preview/index.html', html.length, 'bytes')
