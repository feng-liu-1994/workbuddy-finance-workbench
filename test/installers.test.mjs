import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const run = promisify(execFile)
const script = fileURLToPath(new URL('../scripts/workbuddy-install.mjs', import.meta.url))

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'installer-test-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const app = join(home, 'apps', 'finance-workbench'), skill = join(home, 'skills', 'finance-workbench')
  for (const directory of [app, skill]) { await mkdir(directory, { recursive: true }); await writeFile(join(directory, 'user-note.txt'), '用户原资料') }
  const execute = (...args) => run(process.execPath, [script, ...args], { env: { ...process.env, WORKBUDDY_HOME: home } })
  return { home, app, skill, config: join(home, '.mcp.json'), execute }
}

test('malformed config aborts both installation and removal without changing user data', async t => {
  const f = await fixture(t)
  for (const config of ['{broken', '[]', '{"mcpServers":[]}']) {
    await writeFile(f.config, config)
    for (const action of ['install', 'uninstall']) {
      await assert.rejects(f.execute(action), /配置/)
      assert.equal(await readFile(f.config, 'utf8'), config)
      for (const directory of [f.app, f.skill]) assert.equal(await readFile(join(directory, 'user-note.txt'), 'utf8'), '用户原资料')
    }
  }
})

test('updates preserve unrelated config, custom finance settings and distinct recoverable backups', async t => {
  const f = await fixture(t)
  const config = { marker: 'keep', mcpServers: { other: { command: 'fixture' }, 'finance-workbench': { disabled: false, env: { USER_SETTING: 'keep' } } } }
  await writeFile(f.config, '\uFEFF' + JSON.stringify(config))
  await f.execute('install', '--dry-run')
  assert.equal(await readFile(join(f.app, 'user-note.txt'), 'utf8'), '用户原资料')
  await f.execute('install')
  await f.execute('install')
  const installed = JSON.parse(await readFile(f.config, 'utf8'))
  assert.equal(installed.marker, 'keep')
  assert.deepEqual(installed.mcpServers.other, config.mcpServers.other)
  assert.equal(installed.mcpServers['finance-workbench'].env.USER_SETTING, 'keep')
  const backups = (await readdir(join(f.home, 'apps'))).filter(name => name.startsWith('finance-workbench.backup-'))
  assert.equal(backups.length, 2)
  const retained = await Promise.all(backups.map(name => readFile(join(f.home, 'apps', name, 'user-note.txt'), 'utf8').catch(() => '')))
  assert.ok(retained.includes('用户原资料'))
  await f.execute('uninstall')
  const removed = JSON.parse(await readFile(f.config, 'utf8'))
  assert.equal(removed.mcpServers['finance-workbench'], undefined)
  assert.deepEqual(removed.mcpServers.other, config.mcpServers.other)
  assert.ok((await readdir(join(f.home, 'apps'))).some(name => name.startsWith('finance-workbench.uninstalled-')))
})

test('native Shell or PowerShell wrapper invokes the shared installer and propagates failure', async t => {
  const f = await fixture(t)
  const windows = process.platform === 'win32'
  const wrapper = fileURLToPath(new URL(`../scripts/install-workbuddy-app.${windows ? 'ps1' : 'sh'}`, import.meta.url))
  const command = windows ? 'powershell.exe' : 'bash'
  const args = windows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapper, '-DryRun'] : [wrapper, '--dry-run']
  const env = { ...process.env, WORKBUDDY_HOME: f.home }
  assert.match((await run(command, args, { env })).stdout, /预检通过/)
  await writeFile(f.config, '{broken')
  await assert.rejects(run(command, args, { env }))
})
