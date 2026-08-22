import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinanceBackup, closeProgress, dueLabel, emptyFinanceSnapshot, greetingFor, localDateKey, normalizeFinanceSnapshot, normalizeTodo, parseFinanceBackup, shiftDate, snapshotProfit, workflowsForView } from '../src/finance-dashboard-helpers.js'

test('date helpers use local dates and stable due labels', () => {
  const date = new Date(2026, 7, 21, 9, 0, 0)
  assert.equal(localDateKey(date), '2026-08-21')
  assert.equal(shiftDate('2026-08-21', 1), '2026-08-22')
  assert.equal(dueLabel('2026-08-20', '2026-08-21'), '逾期 1 天')
  assert.equal(dueLabel('2026-08-22', '2026-08-21'), '明天')
  assert.equal(greetingFor(date), '早上好')
})

test('todo normalization and close progress remain deterministic', () => {
  assert.deepEqual(normalizeTodo({ id: 'a', text: '  核对 ', priority: '未知', done: 1 }, '2026-08-21'), { id: 'a', text: '核对', category: '通用', due: '2026-08-21', priority: '中', done: true })
  assert.deepEqual(closeProgress([{ done: true }, { done: false }, { done: true }]), { done: 2, total: 3, percent: 67 })
})

test('backup round trip validates product, version and required collections', () => {
  const backup = buildFinanceBackup({ profile: {}, todos: [], closeTasks: [], favorites: [], fieldDictionary: [], settings: {} })
  assert.equal(parseFinanceBackup(JSON.stringify(backup)).product, 'dsh-finance-workbench')
  assert.throws(() => parseFinanceBackup('{"product":"other","version":2}'), /不是有效/)
  assert.throws(() => parseFinanceBackup({ product: 'dsh-finance-workbench', version: 2, todos: [] }), /内容不完整/)
})

test('finance snapshots normalize numbers and calculate profit safely', () => {
  assert.deepEqual(emptyFinanceSnapshot('2026-08'), { period: '2026-08', income: '', expense: '', cash: '', receivable: '', payable: '', budget: '', note: '' })
  const snapshot = normalizeFinanceSnapshot({ period: '2026-08', income: '1540000', expense: 980000, cash: -1, note: '  已复核  ' })
  assert.equal(snapshot.income, 1540000)
  assert.equal(snapshot.cash, '')
  assert.equal(snapshot.note, '已复核')
  assert.equal(snapshotProfit(snapshot), 560000)
  assert.equal(snapshotProfit({ income: '', expense: 10 }), null)
})

test('module routing exposes focused finance workflows', () => {
  const workflows = [{ id: 'a', group: 'data' }, { id: 'b', group: 'tax' }, { id: 'budget-variance', group: 'analysis' }, { id: 'month', group: 'close' }]
  assert.deepEqual(workflowsForView(workflows, 'reconcile').map(item => item.id), ['a'])
  assert.deepEqual(workflowsForView(workflows, 'tax').map(item => item.id), ['b'])
  assert.deepEqual(workflowsForView(workflows, 'capital').map(item => item.id), ['budget-variance'])
  assert.deepEqual(workflowsForView(workflows, 'close').map(item => item.id), ['month'])
})
