import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const ignored = new Set(['.git', 'node_modules', 'output', 'release', '.playwright-cli'])
const textExtensions = new Set(['', '.js', '.jsx', '.mjs', '.cjs', '.html', '.command', '.json', '.md', '.yml', '.yaml', '.sh', '.ps1', '.csv', '.txt'])
const forbidden = [
  ['private macOS home path', new RegExp(`/${'Users'}/`)],
  ['private account name', new RegExp(['liu', 'yong', 'mo'].join(''), 'i')],
  ['private display name', new RegExp(['永', '模'].join(''))],
  ['GitHub OAuth token', new RegExp(`g${'ho'}_[A-Za-z0-9]{20,}`)],
  ['common secret key', new RegExp(`s${'k'}-[A-Za-z0-9_-]{20,}`)],
  ['private property reference', new RegExp(['荣安', '华府'].join(''))],
]

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (textExtensions.has(extname(entry.name).toLowerCase())) files.push(full)
  }
  return files
}

const findings = []
for (const file of await walk(root)) {
  const content = await readFile(file, 'utf8')
  for (const [label, pattern] of forbidden) {
    if (pattern.test(content)) findings.push(`${relative(root, file)}: ${label}`)
  }
}

if (findings.length) {
  console.error('public release security scan failed:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}
console.log('public release security scan passed')
