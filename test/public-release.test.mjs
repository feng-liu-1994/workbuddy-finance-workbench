import test from 'node:test'
import assert from 'node:assert/strict'
import { access, readFile, readdir } from 'node:fs/promises'

test('public package contains beginner docs and agent artifacts', async () => {
  const files = [
    'README.md',
    'docs/INSTALL_DSH.md',
    'docs/INSTALL_AGENT.md',
    'docs/INSTALL_WORKBUDDY.md',
    'docs/images/readme-hero.png',
    'docs/images/dashboard-desktop.png',
    'docs/images/dashboard-mobile.png',
    'docs/images/exception-control.png',
    'docs/images/theme-night.png',
    'agents/finance-workbench/SKILL.md',
    'agents/finance-workbench/references/workflows.json',
    'agents/finance-workbench/references/prompts/README.md',
    'scripts/install-agent.sh',
    'scripts/install-dsh.sh',
    'scripts/install-workbuddy-app.sh',
    'workbuddy/widget.html',
  ]
  await Promise.all(files.map(file => access(new URL(`../${file}`, import.meta.url))))
  const catalog = JSON.parse(await readFile(new URL('../agents/finance-workbench/references/workflows.json', import.meta.url), 'utf8'))
  assert.equal(catalog.workflows.length, 25)
  assert.equal(catalog.productVersion, JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version)
  const promptFiles = (await readdir(new URL('../agents/finance-workbench/references/prompts/', import.meta.url))).filter(file => /^\d{2}-.+\.md$/.test(file))
  assert.equal(promptFiles.length, 25)
  for (const workflow of catalog.workflows) {
    const filename = `${workflow.number}-${workflow.id}.md`
    assert.ok(promptFiles.includes(filename), filename)
    const prompt = await readFile(new URL(`../agents/finance-workbench/references/prompts/${filename}`, import.meta.url), 'utf8')
    assert.match(prompt, new RegExp(`【财务任务包】${workflow.title}`))
    assert.match(prompt, /【新手填写区/)
  }
})

test('public defaults use generic demonstration identity', async () => {
  const dashboard = await readFile(new URL('../src/finance-dashboard.jsx', import.meta.url), 'utf8')
  const prompt = await readFile(new URL('../src/task-prompt.js', import.meta.url), 'utf8')
  assert.match(dashboard, /name: '财务伙伴'/)
  assert.match(dashboard, /雾光靛蓝/)
  assert.match(dashboard, /松石墨绿/)
  assert.match(dashboard, /暖砂棕金/)
  assert.match(dashboard, /夜航深色/)
  assert.match(dashboard, /data-theme=\{theme\}/)
  assert.match(dashboard, /异常要有主人，也要有退出条件/)
  assert.match(dashboard, /25 个财务工作流，每个都有完整提示词/)
  assert.match(dashboard, /复制完整提示词/)
  assert.match(dashboard, /canCloseFinanceException/)
  assert.match(prompt, /你是用户的财务执行助理/)
  assert.doesNotMatch(`${dashboard}\n${prompt}`, new RegExp(['永', '模'].join('')))
})

test('package, lock, MCP App, plugin metadata and Skill share the same version', async () => {
  const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  const pkg = JSON.parse(await read('package.json'))
  const lock = JSON.parse(await read('package-lock.json'))
  const plugin = JSON.parse(await read('.codebuddy-plugin/plugin.json'))
  const { VERSION } = await import('../src/version.js')
  assert.equal(lock.version, pkg.version)
  assert.equal(lock.packages[''].version, pkg.version)
  assert.equal(plugin.version, pkg.version)
  assert.equal(VERSION, pkg.version)
  assert.ok((await read('agents/finance-workbench/SKILL.md')).includes(`version: "${pkg.version}"`))
  for (const file of ['scripts/workbuddy-install.mjs', 'scripts/uninstall-workbuddy-app.sh', 'scripts/uninstall-workbuddy-app.ps1']) assert.ok(pkg.files.includes(file))
})
