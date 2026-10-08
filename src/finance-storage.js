import { validateFinanceState } from './finance-dashboard-helpers.js'

export const STORE_PREFIX = 'dshFinance:desk:v2:'
const issues = new Map()
const listeners = new Set()

function report(key, message) {
  if (message) issues.set(key, message)
  else issues.delete(key)
  for (const listener of listeners) listener()
}

export const storageIssueSnapshot = () => [...new Set(issues.values())].join('；')
export function subscribeStorageIssues(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function readFinanceStore(key, fallback, storage) {
  try {
    storage ??= globalThis.localStorage
    const raw = storage.getItem(`${STORE_PREFIX}${key}`)
    if (raw === null) return structuredClone(fallback)
    const value = JSON.parse(raw)
    validateFinanceState({ todos: [], closeTasks: [], favorites: [], fieldDictionary: [], [key]: value })
    return ['profile', 'settings'].includes(key) ? { ...fallback, ...value } : value
  } catch {
    report(key, '部分本机数据无法读取，原存储已保留。请先导出备份，再检查或恢复历史备份')
    return structuredClone(fallback)
  }
}

export function writeFinanceStore(key, value, storage) {
  try {
    storage ??= globalThis.localStorage
    storage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(value))
    report(key, '')
    return true
  } catch {
    report(key, '本机保存未完成，刷新或退出可能丢失本次修改。请立即导出 JSON 备份')
    return false
  }
}

// Keep a complete rollback copy and roll back every affected key on write failure.
export function commitFinanceRestore(current, restored, storage) {
  const keys = ['profile', 'todos', 'closeTasks', 'favorites', 'fieldDictionary', 'settings', 'snapshots', 'auditLog', 'exceptions', 'theme', 'pinnedFiles', 'recentWorkflows']
  let originals
  try {
    storage ??= globalThis.localStorage
    originals = keys.map(key => [key, storage.getItem(`${STORE_PREFIX}${key}`)])
    storage.setItem(`${STORE_PREFIX}beforeRestore`, JSON.stringify(current))
  } catch { throw new Error('无法保留恢复前副本，请先导出当前 JSON 备份并检查本机存储权限或空间') }
  const written = []
  try {
    for (const key of keys) {
      storage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(restored[key]))
      written.push(key)
    }
  } catch {
    let rollbackFailed = false
    for (const key of written) {
      try { storage.removeItem(`${STORE_PREFIX}${key}`) } catch { rollbackFailed = true }
    }
    for (const [key, raw] of originals) if (written.includes(key) && raw !== null) {
      try { storage.setItem(`${STORE_PREFIX}${key}`, raw) } catch { rollbackFailed = true }
    }
    if (rollbackFailed) {
      report('restore', '恢复被存储权限中断，恢复前副本已保留；请重新允许存储后下载并恢复该副本')
      throw new Error(storageIssueSnapshot())
    }
    throw new Error('备份恢复未完成：本机存储不可写或空间不足，原数据已保留')
  }
  report('restore', '')
  for (const key of keys) report(key, '')
}
