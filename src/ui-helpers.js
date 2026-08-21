const TYPES = {
  document: new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'pages']),
  sheet: new Set(['xls', 'xlsx', 'csv', 'numbers']),
  slides: new Set(['ppt', 'pptx', 'key']),
  image: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic']),
}

export const DEFAULT_PIN_NAMES = [
  'AGENTS.md',
  '财务工作台-使用说明.md',
  '财务工作流导航.md',
  '字段字典.xlsx',
  '财务规则表.xlsx',
  '月结清单.xlsx',
]

export function fileKind(path) {
  const extension = String(path).split('.').pop()?.toLowerCase() || ''
  for (const [kind, extensions] of Object.entries(TYPES)) if (extensions.has(extension)) return kind
  return 'other'
}

export function topFolder(path) {
  const parts = String(path).split('/').filter(Boolean)
  return parts.length > 1 ? parts[0] : '根目录'
}

export function filterFiles(files, query = '', kind = 'all', folder = 'all') {
  const needle = String(query).trim().toLocaleLowerCase('zh-CN')
  return files.filter(file => {
    if (kind !== 'all' && fileKind(file.relative) !== kind) return false
    if (folder !== 'all' && topFolder(file.relative) !== folder) return false
    return !needle || `${file.name} ${file.relative}`.toLocaleLowerCase('zh-CN').includes(needle)
  })
}

export function defaultPinnedPaths(files) {
  const priority = new Map(DEFAULT_PIN_NAMES.map((name, index) => [name, index]))
  return files
    .filter(file => priority.has(file.name))
    .sort((a, b) => priority.get(a.name) - priority.get(b.name))
    .map(file => file.relative)
}

export function orderFiles(files, pinnedPaths = [], order = 'recent') {
  const pins = new Set(pinnedPaths)
  const compare = order === 'name'
    ? (a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true })
    : order === 'size'
      ? (a, b) => b.size - a.size || b.modifiedAt - a.modifiedAt
      : (a, b) => b.modifiedAt - a.modifiedAt
  return [...files].sort((a, b) => {
    const pinDelta = Number(pins.has(b.relative)) - Number(pins.has(a.relative))
    return pinDelta || compare(a, b)
  })
}

export function summarizeFiles(files) {
  const summary = { total: files.length, bytes: 0, document: 0, sheet: 0, slides: 0, image: 0, other: 0 }
  for (const file of files) {
    summary.bytes += Number(file.size) || 0
    summary[fileKind(file.relative)] += 1
  }
  return summary
}

export function matchScenarioFiles(files, scenario, limit = 8) {
  const keywords = (scenario?.keywords || []).map(value => String(value).toLocaleLowerCase('zh-CN')).filter(Boolean)
  const acceptedKinds = new Set(scenario?.fileKinds || [])
  return files
    .map(file => {
      const haystack = `${file.name} ${file.relative}`.toLocaleLowerCase('zh-CN')
      const keywordHits = keywords.reduce((count, keyword) => count + Number(haystack.includes(keyword)), 0)
      const kindHit = acceptedKinds.has(fileKind(file.relative)) ? 1 : 0
      return { file, score: keywordHits * 10 + kindHit }
    })
    .filter(item => keywords.length ? item.score >= 10 : item.score > 0)
    .sort((a, b) => b.score - a.score || b.file.modifiedAt - a.file.modifiedAt)
    .slice(0, limit)
    .map(item => item.file)
}
