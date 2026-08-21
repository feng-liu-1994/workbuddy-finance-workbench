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
  }
}

export function parseFinanceBackup(value) {
  const data = typeof value === 'string' ? JSON.parse(value) : value
  if (!data || data.product !== 'dsh-finance-workbench' || Number(data.version) !== 2) throw new Error('不是有效的财务工作台 v2 备份')
  if (!Array.isArray(data.todos) || !Array.isArray(data.closeTasks) || !Array.isArray(data.favorites) || !Array.isArray(data.fieldDictionary)) throw new Error('财务工作台备份内容不完整')
  return data
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
