import { readFile, writeFile } from 'node:fs/promises'
const root = new URL('../', import.meta.url)
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
await writeFile(new URL('src/version.js', root), `// Generated from package.json by scripts/sync-version.mjs.\nexport const VERSION = '${pkg.version}'\n`)
const pluginFile = new URL('.codebuddy-plugin/plugin.json', root)
const plugin = JSON.parse(await readFile(pluginFile, 'utf8'))
plugin.version = pkg.version
await writeFile(pluginFile, `${JSON.stringify(plugin, null, 2)}\n`)
const skillFile = new URL('agents/finance-workbench/SKILL.md', root)
const skill = await readFile(skillFile, 'utf8')
await writeFile(skillFile, skill.replace(/version: "[^"]+"/, `version: "${pkg.version}"`))
