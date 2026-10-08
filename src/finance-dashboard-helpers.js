export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function isValidPeriod(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) > 0
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
    due: isValidDateKey(item?.due) ? item.due : fallbackDate,
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
    pinnedFiles: Array.isArray(state.pinnedFiles) ? state.pinnedFiles : [],
    recentWorkflows: Array.isArray(state.recentWorkflows) ? state.recentWorkflows : [],
  }
}

export function parseFinanceBackup(value) {
  if (typeof value === 'string' && value.length > 5 * 1024 * 1024) throw new Error('备份超过 5 MB，请拆分或整理后重试')
  const data = typeof value === 'string' ? JSON.parse(value) : value
  if (!data || data.product !== 'dsh-finance-workbench' || Number(data.version) !== 2) throw new Error('不是有效的财务工作台 v2 备份')
  if (!Array.isArray(data.todos) || !Array.isArray(data.closeTasks) || !Array.isArray(data.favorites) || !Array.isArray(data.fieldDictionary)) throw new Error('财务工作台备份内容不完整')
  validateFinanceState(data)
  return data
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`备份中的${label}格式无效`)
}

function textField(row, key, label, max = 2000, required = false) {
  const value = row[key]
  if (value === undefined && !required) return
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`备份中的${label}格式无效`)
}

function collection(data, key, label, validate, optional = false) {
  if (data[key] === undefined && optional) return
  if (!Array.isArray(data[key]) || data[key].length > 10000) throw new Error(`备份中的${label}格式无效或条目过多`)
  const ids = new Set()
  for (const row of data[key]) {
    record(row, label)
    textField(row, 'id', `${label}标识`, 200, true)
    if (ids.has(row.id)) throw new Error(`备份中的${label}包含重复标识`)
    ids.add(row.id)
    validate(row)
  }
}

function stringList(data, key, label, optional = false) {
  if (data[key] === undefined && optional) return
  if (!Array.isArray(data[key]) || data[key].length > 10000 || data[key].some(item => typeof item !== 'string' || item.length > 1200)) throw new Error(`备份中的${label}格式无效`)
}

function amountField(row, key, label, empty = false) {
  const value = row[key]
  if (value === undefined || (empty && value === '')) return
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new Error(`备份中的${label}金额无效`)
}

export function validateFinanceState(data) {
  for (const key of ['profile', 'settings']) if (data[key] !== undefined) record(data[key], key === 'profile' ? '主体设置' : '阈值设置')
  for (const key of ['name', 'entity', 'role']) textField(data.profile || {}, key, '主体设置')
  if (data.profile?.period !== undefined && !isValidPeriod(data.profile.period)) throw new Error('备份中的主体期间无效')
  for (const key of ['largeAmount', 'dateTolerance', 'varianceRate']) amountField(data.settings || {}, key, '阈值设置')
  if (data.settings?.dateTolerance !== undefined && (!Number.isInteger(data.settings.dateTolerance) || data.settings.dateTolerance > 31)) throw new Error('备份中的日期容差无效')
  collection(data, 'todos', '待办', row => {
    textField(row, 'text', '待办内容', 2000, true)
    textField(row, 'category', '待办分类')
    if (!isValidDateKey(row.due) || typeof row.done !== 'boolean' || !['高', '中', '低'].includes(row.priority)) throw new Error('备份中的待办日期或状态无效')
  })
  collection(data, 'closeTasks', '月结任务', row => {
    for (const key of ['title', 'owner', 'evidence']) textField(row, key, '月结任务', 2000, key === 'title')
    if (typeof row.done !== 'boolean') throw new Error('备份中的月结状态无效')
  })
  collection(data, 'fieldDictionary', '字段字典', row => {
    for (const key of ['name', 'type', 'rule']) textField(row, key, '字段字典', 5000, true)
  })
  stringList(data, 'favorites', '工作流收藏')
  stringList(data, 'pinnedFiles', '资料置顶', true)
  stringList(data, 'recentWorkflows', '最近工作流', true)
  collection(data, 'exceptions', '异常台账', row => {
    for (const key of ['title', 'category', 'owner', 'source', 'evidence']) textField(row, key, '异常台账', 2000, key === 'title')
    amountField(row, 'amount', '异常台账')
    if (!isValidDateKey(row.due) || !['高', '中', '低'].includes(row.severity) || !EXCEPTION_STATUSES.includes(row.status)) throw new Error('备份中的异常日期或状态无效')
    if (row.status === '已关闭' && !canCloseFinanceException(row)) throw new Error('备份中存在没有处置证据的已关闭异常')
    for (const key of ['createdAt', 'updatedAt']) if (row[key] !== undefined && (typeof row[key] !== 'string' || !Number.isFinite(Date.parse(row[key])))) throw new Error('备份中的异常时间无效')
  }, true)
  collection(data, 'auditLog', '审计日志', row => {
    for (const key of ['type', 'action', 'detail']) textField(row, key, '审计日志')
    if (typeof row.at !== 'string' || !Number.isFinite(Date.parse(row.at))) throw new Error('备份中的日志时间无效')
  }, true)
  if (data.snapshots !== undefined) {
    if (!Array.isArray(data.snapshots) || data.snapshots.length > 10000) throw new Error('备份中的经营快照格式无效')
    const periods = new Set()
    for (const row of data.snapshots) {
      record(row, '经营快照')
      if (!isValidPeriod(row.period) || periods.has(row.period)) throw new Error('备份中的经营期间无效或重复')
      periods.add(row.period)
      for (const key of ['income', 'expense', 'cash', 'receivable', 'payable', 'budget']) amountField(row, key, '经营快照', true)
      textField(row, 'note', '经营快照备注')
    }
  }
  if (data.theme !== undefined && !['indigo', 'jade', 'sand', 'night'].includes(data.theme)) throw new Error('备份中的主题无效')
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
    amount: Number.isFinite(amount) && amount >= 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0,
    owner: String(item?.owner || '待明确').trim().slice(0, 40) || '待明确',
    due: isValidDateKey(item?.due) ? item.due : fallbackDate,
    status: item?.status === '已关闭' && !canCloseFinanceException(item) ? '未处理' : EXCEPTION_STATUSES.includes(item?.status) ? item.status : '未处理',
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
    amount: open.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,
    closed: rows.length - open.length,
  }
}

export function canCloseFinanceException(item) {
  return String(item?.evidence || '').trim().length >= 4
}

export function financeExceptionsToCsv(items) {
  const quote = value => {
    const text = String(value ?? '')
    const safe = typeof value === 'string' && /^(\s*[=+\-@]|[\t\r\n])/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
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
  return (Math.round(income * 100) - Math.round(expense * 100)) / 100
}

export function normalizeFinanceSnapshot(snapshot, fallbackPeriod = localDateKey().slice(0, 7)) {
  const result = emptyFinanceSnapshot(isValidPeriod(snapshot?.period) ? snapshot.period : fallbackPeriod)
  for (const key of ['income', 'expense', 'cash', 'receivable', 'payable', 'budget']) {
    if (snapshot?.[key] === '' || snapshot?.[key] === null || snapshot?.[key] === undefined) continue
    const value = Number(snapshot[key])
    result[key] = Number.isFinite(value) && value >= 0 ? Math.round((value + Number.EPSILON) * 100) / 100 : ''
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
