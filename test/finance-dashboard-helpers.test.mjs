import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFinanceBackup, canCloseFinanceException, closeProgress, dueLabel, emptyFinanceSnapshot, financeExceptionRisk, financeExceptionsToCsv, greetingFor, localDateKey, normalizeFinanceException, normalizeFinanceSnapshot, normalizeTodo, parseFinanceBackup, shiftDate, snapshotProfit, summarizeFinanceExceptions, workflowsForView } from '../src/finance-dashboard-helpers.js'

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
  const backup = buildFinanceBackup({ profile: {}, todos: [], closeTasks: [], favorites: [], fieldDictionary: [], settings: {}, exceptions: [], theme: 'sand' })
  assert.equal(parseFinanceBackup(JSON.stringify(backup)).product, 'dsh-finance-workbench')
  assert.equal(backup.theme, 'sand')
  assert.deepEqual(backup.exceptions, [])
  assert.throws(() => parseFinanceBackup('{"product":"other","version":2}'), /不是有效/)
  assert.throws(() => parseFinanceBackup({ product: 'dsh-finance-workbench', version: 2, todos: [] }), /内容不完整/)
})

test('finance exceptions normalize, score and summarize material risks', () => {
  const today = '2026-08-22'
  const high = normalizeFinanceException({ title: '  未达账项待确认  ', category: '对账', severity: '高', amount: '150000', owner: '总账会计', due: '2026-08-21' }, today)
  const closed = normalizeFinanceException({ title: '已核销', severity: '高', amount: 500000, due: '2026-08-20', status: '已关闭', evidence: '凭证 001 已复核' }, today)
  assert.equal(high.title, '未达账项待确认')
  assert.equal(financeExceptionRisk(high, { largeAmount: 100000 }, today), 100)
  assert.equal(financeExceptionRisk(closed, { largeAmount: 100000 }, today), 0)
  assert.deepEqual(summarizeFinanceExceptions([high, closed], { largeAmount: 100000 }, today), { open: 1, high: 1, overdue: 1, waiting: 0, amount: 150000, closed: 1 })
})

test('finance exception closure requires evidence and CSV remains Excel friendly', () => {
  assert.equal(canCloseFinanceException({ evidence: '凭证已核销' }), true)
  assert.equal(canCloseFinanceException({ evidence: '无' }), false)
  const csv = financeExceptionsToCsv([{ title: '金额,日期差异', category: '对账', severity: '中', amount: 200, owner: '复核岗', due: '2026-08-22', source: '流水第2行', evidence: '凭证号 A-01' }])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.match(csv, /"金额,日期差异"/)
  assert.match(csv, /"凭证号 A-01"/)
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

test('backup validation rejects malformed rows, duplicate IDs and invalid calendar dates before restore', () => {
  const empty = () => buildFinanceBackup({ profile: { period: '2026-10' }, settings: {}, todos: [], closeTasks: [], favorites: [], fieldDictionary: [] })
  const todo = { id: 'todo-1', text: '核对流水', category: '对账', due: '2026-10-08', priority: '中', done: false }
  for (const todos of [[null], [{ ...todo, due: '2026-02-30' }], [{ ...todo, done: 'false' }], [todo, todo]]) {
    assert.throws(() => parseFinanceBackup({ ...empty(), todos }), /备份/)
  }
  assert.throws(() => parseFinanceBackup({ ...empty(), profile: { period: '2026-13' } }), /期间/)
  assert.throws(() => parseFinanceBackup({ ...empty(), auditLog: [{ id: 'a', at: 'not-a-date' }] }), /时间/)
  assert.throws(() => parseFinanceBackup({ ...empty(), favorites: [{}] }), /收藏/)
  assert.throws(() => parseFinanceBackup({ ...empty(), settings: { dateTolerance: 32 } }), /容差/)
  assert.throws(() => parseFinanceBackup({ ...empty(), exceptions: [{ ...normalizeFinanceException({ title: '待核', due: '2026-10-08' }), status: '已关闭', evidence: '' }] }), /处置证据/)
  const valid = { ...empty(), todos: [{ ...todo, due: '2028-02-29' }], pinnedFiles: ['财务资料/字段字典.xlsx'], recentWorkflows: ['bank-reconcile'] }
  assert.deepEqual(parseFinanceBackup(valid).pinnedFiles, valid.pinnedFiles)
  // Legacy v2 exports without the newly added collections stay readable.
  delete valid.pinnedFiles; delete valid.recentWorkflows
  assert.equal(parseFinanceBackup(valid).todos.length, 1)
})

test('cent precision, invalid dates and missing closure evidence cannot corrupt finance totals', () => {
  assert.equal(snapshotProfit({ income: 0.3, expense: 0.2 }), 0.1)
  assert.equal(summarizeFinanceExceptions([{ amount: 0.1 }, { amount: 0.2 }]).amount, 0.3)
  assert.equal(normalizeTodo({ due: '2026-02-30' }, '2026-10-08').due, '2026-10-08')
  assert.equal(normalizeFinanceSnapshot({ period: '2026-13' }, '2026-10').period, '2026-10')
  assert.equal(normalizeFinanceException({ status: '已关闭', evidence: '' }).status, '未处理')
})

test('CSV export neutralizes formula cells while retaining ordinary Chinese text', () => {
  const csv = financeExceptionsToCsv([{ title: '=1+1', owner: '\t=1+1', source: '@SUM(A1)', evidence: '+危险公式', category: '对账' }])
  for (const value of ["'=1+1", "'=1+1", "'@SUM(A1)", "'+危险公式"]) assert.ok(csv.includes(value))
  assert.ok(csv.includes('"对账"'))
})
