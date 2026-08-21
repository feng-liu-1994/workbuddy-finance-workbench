import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'

test('public package contains beginner docs and agent artifacts', async () => {
  const files = [
    'README.md',
    'docs/INSTALL_DSH.md',
    'docs/INSTALL_AGENT.md',
    'agents/finance-workbench/SKILL.md',
    'agents/finance-workbench/references/workflows.json',
    'scripts/install-agent.sh',
    'scripts/install-dsh.sh',
  ]
  await Promise.all(files.map(file => access(new URL(`../${file}`, import.meta.url))))
  const catalog = JSON.parse(await readFile(new URL('../agents/finance-workbench/references/workflows.json', import.meta.url), 'utf8'))
  assert.equal(catalog.workflows.length, 25)
})

test('public defaults use generic demonstration identity', async () => {
  const dashboard = await readFile(new URL('../src/finance-dashboard.jsx', import.meta.url), 'utf8')
  const prompt = await readFile(new URL('../src/task-prompt.js', import.meta.url), 'utf8')
  assert.match(dashboard, /name: '财务伙伴'/)
  assert.match(prompt, /你是用户的财务执行助理/)
  assert.doesNotMatch(`${dashboard}\n${prompt}`, new RegExp(['永', '模'].join('')))
})
