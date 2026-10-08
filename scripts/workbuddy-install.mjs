import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { access, cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [action, ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')
if (!['install', 'uninstall'].includes(action) || flags.some(flag => flag !== '--dry-run')) {
  console.error('用法：node scripts/workbuddy-install.mjs install|uninstall [--dry-run]')
  process.exit(2)
}

async function exists(path) {
  try { await lstat(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}

async function run() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('需要 Node.js 20 或更高版本')
  const home = process.env.WORKBUDDY_HOME || join(process.env.HOME || process.env.USERPROFILE || '', '.workbuddy')
  if (!isAbsolute(home)) throw new Error('WorkBuddy 目录必须是绝对路径')
  const configPath = join(home, '.mcp.json')
  const appPath = join(home, 'apps', 'finance-workbench')
  const skillPath = join(home, 'skills', 'finance-workbench')
  const hasConfig = await exists(configPath)
  let originalConfig
  let config = { mcpServers: {} }
  if (hasConfig) {
    if ((await lstat(configPath)).isSymbolicLink()) throw new Error('MCP 配置是符号链接，请先改用普通配置文件')
    originalConfig = await readFile(configPath)
    try { config = JSON.parse(originalConfig.toString('utf8').replace(/^\uFEFF/, '')) } catch { throw new Error('MCP 配置不是有效 JSON；原应用、Skill 和配置均未修改') }
    if (!config || typeof config !== 'object' || Array.isArray(config) || (config.mcpServers !== undefined && (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)))) throw new Error('MCP 配置结构无效；原应用、Skill 和配置均未修改')
    config.mcpServers ||= {}
  }
  if (action === 'install') {
    await Promise.all(['workbuddy/server.mjs', 'workbuddy/widget.html', 'agents/finance-workbench/SKILL.md'].map(file => access(join(repo, file))))
    execFileSync(process.execPath, ['--check', join(repo, 'workbuddy/server.mjs')], { stdio: 'pipe' })
    const oldEntry = config.mcpServers['finance-workbench']
    if (oldEntry !== undefined && (!oldEntry || typeof oldEntry !== 'object' || Array.isArray(oldEntry))) throw new Error('原财务工作台 MCP 配置结构无效')
    if (oldEntry?.env !== undefined && (!oldEntry.env || typeof oldEntry.env !== 'object' || Array.isArray(oldEntry.env))) throw new Error('原财务工作台环境配置结构无效')
    config.mcpServers['finance-workbench'] = {
      ...oldEntry, command: process.execPath, args: [join(appPath, 'server.mjs')],
      env: { ...oldEntry?.env, WORKBUDDY_FINANCE_WORKBENCH: '1' },
    }
  } else delete config.mcpServers['finance-workbench']
  console.log(`WorkBuddy 目录：${home}`)
  if (dryRun) { console.log('预检通过；未修改任何文件。'); return }

  await mkdir(home, { recursive: true })
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`
  const stage = await mkdtemp(join(home, '.finance-workbench-stage-'))
  const moved = []
  const installed = []
  let configChanged = false
  try {
    if (action === 'install') {
      await mkdir(join(stage, 'app'))
      for (const file of ['server.mjs', 'widget.html']) await cp(join(repo, 'workbuddy', file), join(stage, 'app', file))
      await cp(join(repo, 'agents', 'finance-workbench'), join(stage, 'skill'), { recursive: true })
      await mkdir(dirname(appPath), { recursive: true })
      await mkdir(dirname(skillPath), { recursive: true })
    }
    await writeFile(join(stage, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    if (hasConfig) await writeFile(`${configPath}.finance-workbench-${action}-backup-${stamp}`, originalConfig, { mode: 0o600 })
    for (const target of [appPath, skillPath]) {
      if (await exists(target)) {
        const backup = `${target}.${action === 'install' ? 'backup' : 'uninstalled'}-${stamp}`
        await rename(target, backup)
        moved.push([target, backup])
      }
    }
    if (action === 'install') {
      for (const [source, target] of [[join(stage, 'app'), appPath], [join(stage, 'skill'), skillPath]]) {
        await rename(source, target)
        installed.push(target)
      }
    }
    // Refuse to overwrite another process's concurrent configuration edit.
    if (hasConfig ? !(await readFile(configPath)).equals(originalConfig) : await exists(configPath)) throw new Error('安装期间 MCP 配置已被其他程序修改，请稍后重试')
    if (action === 'install' || hasConfig) {
      await rename(join(stage, 'config.json'), configPath)
      configChanged = true
    }
  } catch (error) {
    for (const target of installed.reverse()) await rm(target, { recursive: true, force: true })
    for (const [target, backup] of moved.reverse()) await rename(backup, target)
    if (configChanged) {
      if (hasConfig) await writeFile(configPath, originalConfig, { mode: 0o600 })
      else await rm(configPath, { force: true })
    }
    throw error
  } finally { await rm(stage, { recursive: true, force: true }) }
  for (const [, backup] of moved) console.log(`已保留可恢复副本：${backup}`)
  console.log(action === 'install' ? '安装完成。保存当前工作，完全退出并重新打开 WorkBuddy 后，输入：打开财务工作台' : '卸载完成。应用和 Skill 已保留可恢复副本；保存工作后重启 WorkBuddy 生效。')
}

run().catch(error => { console.error(error.message); process.exitCode = 1 })
