export const BRIEF_FIELDS = [
  ['subject', '处理对象', '单位 / 账套 / 项目'],
  ['period', '时间范围', '会计期间 / 截止日期'],
  ['goal', '本次想完成什么', '例如：核对银行流水，输出差异与复核清单'],
  ['requirements', '特别要求', '格式、字数、口径、输出文件和需要避开的事项'],
]
export function formatTaskBrief(brief = {}) {
  const rows = BRIEF_FIELDS.map(([key, label]) => [label, typeof brief?.[key] === 'string' ? brief[key].trim().slice(0, 2000) : '']).filter(([, value]) => value)
  return rows.length ? '【本次填写的任务要求】\n' + rows.map(([label, value]) => label + '：' + value).join('\n') : ''
}
export function recentWorkflowIds(current, id) {
  return [id, ...(Array.isArray(current) ? current : [])].filter((item, index, rows) => typeof item === 'string' && rows.indexOf(item) === index).slice(0, 8)
}
function matchesWorkflowNeedle(haystack, needle) {
  if (haystack.includes(needle)) return true
  if (!/^[\p{Script=Han}]{4,}$/u.test(needle)) return false
  const middle = Math.ceil([...needle].length / 2)
  const chars = [...needle]
  return [chars.slice(0, middle).join(''), chars.slice(middle).join('')].every(part => haystack.includes(part))
}
export function filterWorkflowList(rows, { query = '', filter = 'all', favorites = [], recent = [] } = {}) {
  const needles = String(query).trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean)
  const fav = Array.isArray(favorites) ? favorites : [], seen = Array.isArray(recent) ? recent : []
  return rows.filter(item => {
    const haystack = [item.title, item.desc, item.tag, item.role, item.group, ...(item.keywords || []), ...(item.inputs || []), ...(item.outputs || [])].join(' ').toLocaleLowerCase('zh-CN')
    return (filter !== 'favorites' || fav.includes(item.id)) && (filter !== 'recent' || seen.includes(item.id)) && needles.every(word => matchesWorkflowNeedle(haystack, word))
  }).sort((a, b) => filter === 'recent' ? seen.indexOf(a.id) - seen.indexOf(b.id) : Number(fav.includes(b.id)) - Number(fav.includes(a.id)))
}
