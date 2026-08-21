import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('.', import.meta.url)
const esbuild = await import('esbuild')

await mkdir(new URL('./lib/', root), { recursive: true })
await writeFile(new URL('./lib/index.js', root), await readFile(new URL('./src/index.js', root), 'utf8'))
await writeFile(new URL('./lib/contract.js', root), await readFile(new URL('./src/contract.js', root), 'utf8'))

const built = await esbuild.build({
  entryPoints: [fileURLToPath(new URL('./src/client.jsx', root))],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'cjs',
  target: ['chrome120'],
  jsx: 'automatic',
  external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/*'],
})
const code = new TextDecoder().decode(built.outputFiles[0].contents)
const wrapped = `window.__ModuleLoader__.load({ id: 'dsh-finance-workbench', factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;\n${code}\nreturn module.exports;\n} });\n`
await writeFile(new URL('./lib/client.js', root), wrapped.replace(/[ \t]+$/gm, ''))
console.log('built dsh-finance-workbench')
