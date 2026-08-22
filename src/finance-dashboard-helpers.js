export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(value, days) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function normalizeTodo(item, fallbackDate = localDateKey()) {
  return {
    id: String(item?.id || `todo-${Date.now().toString(36)}`),
    text: String(item?.text || '').trim(),
    category: String(item?.category || '通用'),
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.due || '')) ? String(item.due) : fallbackDate,
    priority: ['高', '中', '低'].includes(item?.priority) ? item.priority : '中',
    done: Boolean(item?.done),
  }
}

export function closeProgress(tasks) {
  const rows = Array.isArray(tasks) ? tasks : []
  if (!rows.length) return { done: 0, total: 0, percent: 0 }
  const done = rows.filter(item => item.done).length
  return { done, total: rows.length, percent: Math.round(done / rows.length * 100) }
}

export function dueLabel(value, today = localDateKey()) {
  if (value === today) return '今天'
  if (value === shiftDate(today, 1)) return '明天'
  const distance = Math.round((new Date(`${value}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
  if (distance < 0) return `逾期 ${Math.abs(distance)} 天`
  return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`
}

export function buildFinanceBackup(state) {
  return {
    product: 'dsh-finance-workbench',
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: state.profile,
    todos: state.todos,
    closeTasks: state.closeTasks,
    favorites: state.favorites,
    fieldDictionary: state.fieldDictionary,
    settings: state.settings,
    snapshots: Array.isArray(state.snapshots) ? state.snapshots : [],
    auditLog: Array.isArray(state.auditLog) ? state.auditLog : [],
    exceptions: Array.isArray(state.exceptions) ? state.exceptions : [],
    theme: String(state.theme || 'indigo'),
  }
}

export function parseFinanceBackup(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value
  if (!data || data.product !== 'dsh-finance-workbench' || Number(data.version) !== 2) throw new Error('不是有效的财务工作台 v2 备份')
  if (!Array.isArray(data.todos) || !Array.isArray(data.closeTasks) || !Array.isArray(data.favorites) || !Array.isArray(data.fieldDictionary)) throw new Error('财务工作台备份内容不完整')
  return data
}

export const EXCEPTION_STATUSES = ['未处理', '处理中', '待业务确认', '已关闭']

export function normalizeFinanceException(item, fallbackDate = localDateKey()) {
  const amount = Number(item?.amount)
  const now = new Date().toISOString()
  return {
    id: String(item?.id || `exception-${Date.now().toString(36)}`),
    title: String(item?.title || '').trim().slice(0, 120),
    category: String(item?.category || '通用').trim().slice(0, 30),
    severity: ['高', '中', '低'].includes(item?.severity) ? item.severity : '中',
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    owner: String(item?.owner || '待明确').trim().slice(0, 40) || '待明确',
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(item?.due || '')) ? String(item.due) : fallbackDate,
    status: EXCEPTION_STATUSES.includes(item?.status) ? item.status : '未处理',
    source: String(item?.source || '').trim().slice(0, 180),
    evidence: String(item?.evidence || '').trim().slice(0, 300),
    createdAt: String(item?.createdAt || now),
    updatedAt: String(item?.updatedAt || item?.createdAt || now),
  }
}

export function financeExceptionRisk(item, settings = {}, today = localDateKey()) {
  const row = normalizeFinanceException(item, today)
  if (row.status === '已关闭') return 0
  let score = { 高: 60, 中: 35, 低: 15 }[row.severity]
  if (row.due < today) score += 25
  if (Number(settings.largeAmount) > 0 && row.amount >= Number(settings.largeAmount)) score += 15
  if (row.status === '待业务确认') score += 5
  return Math.min(100, score)
}

export function summarizeFinanceExceptions(items, settings = {}, today = localDateKey()) {
  const rows = (Array.isArray(items) ? items : []).map(item => normalizeFinanceException(item, today))
  const open = rows.filter(item => item.status !== '已关闭')
  return {
    open: open.length,
    high: open.filter(item => financeExceptionRisk(item, settings, today) >= 60).length,
    overdue: open.filter(item => item.due < today).length,
    waiting: open.filter(item => item.status === '待业务确认').length,
    amount: open.reduce((sum, item) => sum + item.amount, 0),
    closed: rows.length - open.length,
  }
}

export function canCloseFinanceException(item) {
  return String(item?.evidence || '').trim().length >= 4
}

export function financeExceptionsToCsv(items) {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
  const header = ['异常事项', '业务模块', '风险等级', '金额影响', '责任人', '截止日期', '状态', '来源依据', '处置证据']
  const rows = (Array.isArray(items) ? items : []).map(item => {
    const row = normalizeFinanceException(item)
    return [row.title, row.category, row.severity, row.amount, row.owner, row.due, row.status, row.source, row.evidence]
  })
  return `\uFEFF${[header, ...rows].map(row => row.map(quote).join(',')).join('\r\n')}`
}

export function emptyFinanceSnapshot(period = localDateKey().slice(0, 7)) {
  return { period, income: '', expense: '', cash: '', receivable: '', payable: '', budget: '', note: '' }
}

export function snapshotProfit(snapshot) {
  const income = Number(snapshot?.income)
  const expense = Number(snapshot?.expense)
  if (snapshot?.income === '' || snapshot?.expense === '' || !Number.isFinite(income) || !Number.isFinite(expense)) return null
  return income - expense
}

export function normalizeFinanceSnapshot(snapshot, fallbackPeriod = localDateKey().slice(0, 7)) {
  const result = emptyFinanceSnapshot(/^\d{4}-\d{2}$/.test(String(snapshot?.period || '')) ? String(snapshot.period) : fallbackPeriod)
  for (const key of ['income', 'expense', 'cash', 'receivable', 'payable', 'budget']) {
    if (snapshot?.[key] === '' || snapshot?.[key] === null || snapshot?.[key] === undefined) continue
    const value = Number(snapshot[key])
    result[key] = Number.isFinite(value) && value >= 0 ? value : ''
  }
  result.note = String(snapshot?.note || '').trim().slice(0, 300)
  return result
}

export function workflowsForView(workflows, view) {
  const rules = {
    reconcile: item => ['data', 'reconcile', 'expense'].includes(item.group),
    tax: item => ['tax', 'expense'].includes(item.group),
    settlement: item => item.group === 'settlement' || ['order-cash-invoice', 'contract-terms'].includes(item.id),
    capital: item => ['ap-schedule', 'budget-variance', 'cashflow-forecast', 'contract-terms'].includes(item.id),
    analysis: item => item.group === 'analysis',
    close: item => ['close', 'controls'].includes(item.group),
  }
  return (workflows || []).filter(rules[view] || (() => true))
}
