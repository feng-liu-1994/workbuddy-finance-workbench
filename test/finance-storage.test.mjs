import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinanceBackup } from '../src/finance-dashboard-helpers.js'
import { STORE_PREFIX, readFinanceStore, writeFinanceStore, storageIssueSnapshot, commitFinanceRestore } from '../src/finance-storage.js'

function fixture() {
  const map = new Map()
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) }
}

test('blocked localStorage access leaves the dashboard usable and restore fails safely', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('storage blocked') } })
  try {
    assert.deepEqual(readFinanceStore('favorites', []), [])
    assert.equal(writeFinanceStore('favorites', []), false)
    assert.throws(() => commitFinanceRestore({}, {}), /无法保留恢复前副本/)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else delete globalThis.localStorage
    writeFinanceStore('favorites', [], fixture())
  }
})

test('corrupt local state is preserved and storage denial is visible to the user', () => {
  const store = fixture()
  store.setItem(`${STORE_PREFIX}todos`, '{broken')
  assert.deepEqual(readFinanceStore('todos', [], store), [])
  assert.equal(store.getItem(`${STORE_PREFIX}todos`), '{broken')
  assert.match(storageIssueSnapshot(), /原存储已保留/)
  assert.equal(writeFinanceStore('todos', [], { setItem() { throw new Error('quota') } }), false)
  assert.match(storageIssueSnapshot(), /保存未完成/)
  assert.equal(writeFinanceStore('todos', [], store), true)
  assert.equal(storageIssueSnapshot(), '')
})

test('restore keeps a complete rollback copy including pins and recent workflows', () => {
  const store = fixture()
  const current = buildFinanceBackup({ profile: { name: '原主体' }, settings: {}, todos: [], closeTasks: [], favorites: [], fieldDictionary: [], pinnedFiles: ['原资料.xlsx'], recentWorkflows: ['bank-reconcile'] })
  const restored = { ...current, profile: { name: '新主体' }, pinnedFiles: ['新资料.xlsx'] }
  commitFinanceRestore(current, restored, store)
  assert.deepEqual(JSON.parse(store.getItem(`${STORE_PREFIX}beforeRestore`)), current)
  assert.deepEqual(JSON.parse(store.getItem(`${STORE_PREFIX}pinnedFiles`)), ['新资料.xlsx'])
  assert.deepEqual(JSON.parse(store.getItem(`${STORE_PREFIX}recentWorkflows`)), ['bank-reconcile'])
})

test('partial restore write failure rolls back every already changed storage key', () => {
  const store = fixture()
  const original = JSON.stringify({ name: '原主体' })
  store.setItem(`${STORE_PREFIX}profile`, original)
  const realSet = store.setItem
  let failing = true
  store.setItem = (key, value) => {
    if (key === `${STORE_PREFIX}closeTasks` && failing) { failing = false; throw new Error('quota') }
    realSet(key, value)
  }
  const current = buildFinanceBackup({ profile: { name: '原主体' }, settings: {}, todos: [], closeTasks: [], favorites: [], fieldDictionary: [] })
  assert.throws(() => commitFinanceRestore(current, { ...current, profile: { name: '新主体' } }, store), /原数据已保留/)
  assert.equal(store.getItem(`${STORE_PREFIX}profile`), original)
  assert.equal(store.getItem(`${STORE_PREFIX}todos`), null)
  assert.deepEqual(JSON.parse(store.getItem(`${STORE_PREFIX}beforeRestore`)), current)
})
