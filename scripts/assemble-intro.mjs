// Rebuilds public/intro.mp4 from the base64 text parts in assets-src/intro/.
// The parts exist because the repo is edited through a text-only connector.
// If the checksum doesn't match, the video is skipped and the site uses the 3D intro.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const SHA256 = 'c039d9e977f7c48072a6abcd987560e1f54a8f5005b447a306a44875c7277c8c'
const dir = 'assets-src/intro'
const out = 'public/intro.mp4'

if (!existsSync(dir)) process.exit(0)
const b64 = readdirSync(dir)
  .filter((f) => f.endsWith('.txt'))
  .sort()
  .map((f) => readFileSync(`${dir}/${f}`, 'utf8'))
  .join('')
  .replace(/\s+/g, '')
const buf = Buffer.from(b64, 'base64')
const sum = createHash('sha256').update(buf).digest('hex')
if (sum !== SHA256) {
  console.warn(`intro.mp4 checksum mismatch (${sum}); skipping the intro video`)
  process.exit(0)
}
writeFileSync(out, buf)
console.log(`intro.mp4 rebuilt (${buf.length} bytes)`)
