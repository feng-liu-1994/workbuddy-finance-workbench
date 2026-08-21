import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_CLOSE_TASKS, DEFAULT_FIELD_DICTIONARY, FINANCE_WORKFLOWS, NAV_ITEMS, SOP_STEPS, WORKFLOW_GROUPS, defaultFinanceTodos } from './finance-data.js'
import { buildFinanceBackup, closeProgress, dueLabel, greetingFor, localDateKey, normalizeTodo, parseFinanceBackup, workflowsForView } from './finance-dashboard-helpers.js'
import { defaultPinnedPaths, fileKind, filterFiles, matchScenarioFiles, orderFiles, summarizeFiles, topFolder } from './ui-helpers.js'

const STORE_PREFIX = 'dshFinance:desk:v2:'
const TYPE_LABELS = { all: '全部类型', document: '文档', sheet: '表格', slides: '演示', image: '图片', other: '其他' }
const PROFILE_DEFAULT = { name: '财务伙伴', entity: '示例财务工作区', role: '财务自动化与管理分析', period: localDateKey().slice(0, 7) }
const SETTINGS_DEFAULT = { largeAmount: 100000, dateTolerance: 3, varianceRate: 10 }
const PAGE_META = {
  home: ['工作台首页', '本期财务工作总览'], todos: ['待办中心', '责任、截止与完成留痕'], workflows: ['自动化场景', '22 个 SOP 场景与专业扩展'],
  reconcile: ['对账中心', '数据治理、费用检查与多表核销'], tax: ['发票与税务', '票据台账、付款匹配与申报前核对'],
  settlement: ['应收应付', '账龄、催收、付款排期与合同节点'], capital: ['资金与预算', '付款约束、预算偏差与滚动现金流'],
  analysis: ['经营分析', '经营报表、降本分析与管理摘要'], close: ['月结与内控', '完成证据、异常责任与风险复核'],
  files: ['财务资料库', '上传、搜索、引用、下载与置顶'], settings: ['SOP 与设置', '字段字典、规则边界与数据备份'],
}
const MODULE_COPY = {
  reconcile: ['对账必须可解释', '先统一字段与方向，再做唯一匹配；疑似项只给候选，不强行核销。'],
  tax: ['票、款、税形成证据链', '识别结果不能直接作为入账或申报依据，红字、作废、跨期和异常税率必须单列。'],
  settlement: ['往来风险按责任推进', '到期日、争议状态、合同节点和资料完整性同时进入判断。'],
  capital: ['先看约束，再做排期', '明确预算版本、资金情景和假设，付款与融资动作始终由授权人员确认。'],
  analysis: ['事实、假设、建议分开', '指标口径固定，先呈现数据变化，再由业务确认原因和行动。'],
  close: ['完成必须有证据', '每个结账事项都要有责任人、完成证据、差异状态和预计完成时间。'],
}

function clone(value) { return JSON.parse(JSON.stringify(value)) }
function readStore(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(`${STORE_PREFIX}${key}`)); return value ?? clone(fallback) }
  catch { return clone(fallback) }
}
function useStoredState(key, fallback) {
  const initial = typeof fallback === 'function' ? fallback() : fallback
  const [value, setValue] = useState(() => readStore(key, initial))
  useEffect(() => { try { localStorage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(value)) } catch {} }, [key, value])
  return [value, setValue]
}
function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }
function downloadJson(value, name) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function formatDate(value) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

function Panel({ title, note, action, className = '', children }) {
  return <section className={`fdDesk_panel ${className}`}><header className="fdDesk_panelHead"><div><h3>{title}</h3>{note && <p>{note}</p>}</div>{action}</header>{children}</section>
}

function WorkflowCards({ workflows, favorites, onSelect }) {
  if (!workflows.length) return <div className="fdDesk_empty">没有符合条件的工作流</div>
  return <div className="fdDesk_workflowGrid">{workflows.map(item => <button type="button" key={item.id} onClick={() => onSelect(item)}>
    <span>{item.number || '扩展'} · {item.role}</span><strong>{item.title}</strong><small>{item.desc}</small><i>{favorites.includes(item.id) ? '★' : '☆'}</i>
  </button>)}</div>
}

function WorkflowDetail({ workflow, files, favorites, launching, onBack, onFavorite, onLaunch, onChooseFiles, onChooseFolder }) {
  const matched = useMemo(() => matchScenarioFiles(files, workflow), [files, workflow])
  return <div className="fdDesk_page fdDesk_detail">
    <button className="fdDesk_textButton" type="button" onClick={onBack}>← 返回工作流</button>
    <div className="fdDesk_detailHero"><div><small>{workflow.number ? `SOP ${workflow.number}` : '专业扩展'} · {workflow.role}</small><h1>{workflow.title}</h1><p>{workflow.desc}</p></div><span>人工复核</span></div>
    <div className="fdDesk_detailGrid">
      <Panel title="输入材料" note="先确认版本、期间、主体和字段"><ul className="fdDesk_list">{workflow.inputs.map(item => <li key={item}>{item}</li>)}</ul></Panel>
      <Panel title="关键规则" note="规则不清楚时先诊断，不直接跑全量"><ul className="fdDesk_list is-rules">{workflow.rules.map(item => <li key={item}>{item}</li>)}</ul></Panel>
    </div>
    <Panel title="7 步执行路径" note="先方案、再小样本、后全量、最后固化"><ol className="fdDesk_steps">{workflow.steps.map((item, index) => <li key={item}><span>{index + 1}</span><strong>{item}</strong></li>)}</ol></Panel>
    <div className="fdDesk_detailGrid">
      <Panel title="固定输出包" note="所有结果都要有来源与校验"><div className="fdDesk_outputPills">{workflow.outputs.map(item => <span key={item}>{item}</span>)}</div></Panel>
      <Panel title="验收清单" note="通过后才能进入正式复核"><ul className="fdDesk_checkList">{workflow.checklist.map(item => <li key={item}>□ {item}</li>)}</ul></Panel>
    </div>
    <Panel title="自动匹配资料" note={matched.length ? `已找到 ${matched.length} 份相关文件` : '暂未找到明显相关文件，可先上传或直接开始后补充'} action={<div className="fdDesk_inlineActions"><button type="button" onClick={onChooseFiles}>上传文件</button><button type="button" onClick={onChooseFolder}>上传文件夹</button></div>}>
      {matched.length ? <div className="fdDesk_matchFiles">{matched.map(file => <span key={file.relative}>{file.name}</span>)}</div> : <div className="fdDesk_empty is-compact">系统还会结合当前对话理解任务范围。</div>}
    </Panel>
    <div className="fdDesk_launchBar"><div><strong>安全执行边界</strong><span>只处理副本 · 不覆盖源文件 · 异常不等于结论 · 付款/入账/申报由人工确认</span></div><button type="button" disabled={launching} onClick={() => onLaunch(workflow)}>{launching ? '正在准备…' : '开始处理'}</button><button type="button" className="is-secondary" onClick={() => onFavorite(workflow.id)}>{favorites.includes(workflow.id) ? '取消收藏' : '收藏'}</button></div>
  </div>
}

function ModulePage({ view, workflows, favorites, onSelect }) {
  const [title, note] = MODULE_COPY[view]
  return <div className="fdDesk_page"><div className="fdDesk_moduleHero"><div><small>CONTROLLED FINANCE FLOW</small><h1>{title}</h1><p>{note}</p></div><span>{workflows.length}<small>个适用场景</small></span></div><WorkflowCards workflows={workflows} favorites={favorites} onSelect={onSelect}/></div>
}

function FileLibrary({ files, workspace, onOpenWorkspace, onChooseFiles, onChooseFolder, onUploadFiles, onReferenceFile, onDownloadFile, onStatus }) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [folder, setFolder] = useState('all')
  const [order, setOrder] = useState('recent')
  const [dragging, setDragging] = useState(false)
  const [pinned, setPinned] = useStoredState('pinnedFiles', [])
  useEffect(() => {
    if (!files.length || pinned.length) return
    const defaults = defaultPinnedPaths(files)
    if (defaults.length) setPinned(defaults)
  }, [files.length])
  const summary = useMemo(() => summarizeFiles(files), [files])
  const folders = useMemo(() => [...new Set(files.map(file => topFolder(file.relative)))].sort((a, b) => a.localeCompare(b, 'zh-CN')), [files])
  const visible = useMemo(() => orderFiles(filterFiles(files, query, kind, folder), pinned, order), [files, query, kind, folder, pinned, order])
  const togglePin = path => { setPinned(current => current.includes(path) ? current.filter(item => item !== path) : [...current, path]); onStatus('资料库置顶已更新') }
  return <div className="fdDesk_page">
    <div className="fdDesk_directory"><span>库</span><div><small>当前财务资料目录</small><strong>{workspace.name}</strong><em title={workspace.path}>{workspace.path || '等待工作区准备'}</em></div><button type="button" onClick={onOpenWorkspace}>在 Finder 打开</button></div>
    <div className={`fdDesk_dropzone ${dragging ? 'is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={event => { event.preventDefault(); setDragging(false); onUploadFiles([...event.dataTransfer.files]) }}>
      <span>＋</span><div><strong>上传并存档财务资料</strong><small>支持文件、文件夹和拖放；原始文件不会被覆盖。</small></div><button type="button" onClick={onChooseFiles}>选择文件</button><button type="button" onClick={onChooseFolder}>选择文件夹</button>
    </div>
    <div className="fdDesk_fileStats">{[['文件', summary.total], ['表格', summary.sheet], ['文档', summary.document], ['图片', summary.image], ['总大小', formatSize(summary.bytes)]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="fdDesk_fileFilters"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索文件名或目录"/><select value={kind} onChange={event => setKind(event.target.value)}>{Object.entries(TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><select value={folder} onChange={event => setFolder(event.target.value)}><option value="all">全部目录</option>{folders.map(item => <option key={item} value={item}>{item}</option>)}</select><select value={order} onChange={event => setOrder(event.target.value)}><option value="recent">最近更新</option><option value="name">按名称</option><option value="size">按大小</option></select></div>
    <div className="fdDesk_fileHeading"><span>{visible.length} 个结果</span><span>置顶文件优先显示</span></div>
    <div className="fdDesk_fileList">{visible.slice(0, 300).map(file => <article key={file.relative} className={pinned.includes(file.relative) ? 'is-pinned' : ''}><button type="button" className="fdDesk_pin" aria-label={pinned.includes(file.relative) ? `取消置顶${file.name}` : `置顶${file.name}`} onClick={() => togglePin(file.relative)}>{pinned.includes(file.relative) ? '★' : '☆'}</button><span className={`is-${fileKind(file.relative)}`}>{fileKind(file.relative).slice(0, 1).toUpperCase()}</span><div title={file.relative}><strong>{file.name}</strong><small>{file.relative} · {formatSize(file.size)} · {formatDate(file.modifiedAt)}</small></div><button type="button" onClick={() => onReferenceFile(file)}>引用</button><button type="button" onClick={() => onDownloadFile(file)}>下载</button></article>)}{!visible.length && <div className="fdDesk_empty">没有符合条件的文件</div>}</div>
  </div>
}

export function FinanceDashboard({ sessionId, files, workspace, status, onStatus, onRefresh, onOpenWorkspace, onChooseFiles, onChooseFolder, onUploadFiles, onReferenceFile, onDownloadFile, onLaunchWorkflow, launching, onClose }) {
  const today = localDateKey()
  const [view, setView] = useState('home')
  const [mobileNav, setMobileNav] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [profile, setProfile] = useStoredState('profile', PROFILE_DEFAULT)
  const [todosRaw, setTodos] = useStoredState('todos', () => defaultFinanceTodos(today))
  const todos = useMemo(() => todosRaw.map(item => normalizeTodo(item, today)), [todosRaw, today])
  const [closeTasks, setCloseTasks] = useStoredState('closeTasks', DEFAULT_CLOSE_TASKS)
  const [favorites, setFavorites] = useStoredState('favorites', ['bank-reconcile', 'invoice-ledger', 'month-close-completeness', 'budget-variance'])
  const [fieldDictionary, setFieldDictionary] = useStoredState('fieldDictionary', DEFAULT_FIELD_DICTIONARY)
  const [settings, setSettings] = useStoredState('settings', SETTINGS_DEFAULT)
  const [workflowQuery, setWorkflowQuery] = useState('')
  const [workflowGroup, setWorkflowGroup] = useState('all')
  const [newTodo, setNewTodo] = useState({ text: '', category: '通用', due: today, priority: '中' })
  const [newField, setNewField] = useState({ name: '', type: '文本', rule: '' })
  const importPicker = useRef(null)
  const summary = useMemo(() => summarizeFiles(files), [files])
  const progress = useMemo(() => closeProgress(closeTasks), [closeTasks])
  const activeTodos = todos.filter(item => !item.done).sort((a, b) => a.due.localeCompare(b.due) || ['高', '中', '低'].indexOf(a.priority) - ['高', '中', '低'].indexOf(b.priority))
  const filteredWorkflows = useMemo(() => {
    const needle = workflowQuery.trim().toLocaleLowerCase('zh-CN')
    return FINANCE_WORKFLOWS.filter(item => (workflowGroup === 'all' || item.group === workflowGroup) && (!needle || `${item.title} ${item.role} ${item.desc} ${item.keywords.join(' ')}`.toLocaleLowerCase('zh-CN').includes(needle)))
  }, [workflowQuery, workflowGroup])
  const moduleWorkflows = useMemo(() => workflowsForView(FINANCE_WORKFLOWS, view), [view])
  const featured = favorites.map(id => FINANCE_WORKFLOWS.find(item => item.id === id)).filter(Boolean).slice(0, 4)

  useEffect(() => { setView('home'); setSelectedWorkflow(null); setMobileNav(false) }, [sessionId])
  const changeView = next => { setView(next); setSelectedWorkflow(null); setMobileNav(false) }
  const toggleFavorite = workflowId => setFavorites(current => current.includes(workflowId) ? current.filter(item => item !== workflowId) : [...current, workflowId])
  const addTodo = event => { event.preventDefault(); if (!newTodo.text.trim()) return; setTodos(current => [...current, normalizeTodo({ ...newTodo, id: makeId('todo') }, today)]); setNewTodo(current => ({ ...current, text: '' })); onStatus('待办已添加') }
  const exportData = () => { downloadJson(buildFinanceBackup({ profile, todos, closeTasks, favorites, fieldDictionary, settings }), `DeepSeek-Harness-财务工作台-${today}.json`); onStatus('财务工作台 JSON 备份已导出') }
  const importData = file => { const reader = new FileReader(); reader.onload = () => { try { const data = parseFinanceBackup(reader.result); setProfile({ ...PROFILE_DEFAULT, ...data.profile }); setTodos(data.todos.map(item => normalizeTodo(item, today))); setCloseTasks(data.closeTasks); setFavorites(data.favorites); setFieldDictionary(data.fieldDictionary); setSettings({ ...SETTINGS_DEFAULT, ...data.settings }); onStatus('财务工作台备份已恢复') } catch (error) { onStatus(error instanceof Error ? error.message : String(error)) } }; reader.readAsText(file) }

  if (selectedWorkflow) return <FinanceDashboardFrame view={view} profile={profile} status={status} mobileNav={mobileNav} setMobileNav={setMobileNav} changeView={changeView} onRefresh={onRefresh} onOpenWorkspace={onOpenWorkspace} onClose={onClose}><WorkflowDetail workflow={selectedWorkflow} files={files} favorites={favorites} launching={launching} onBack={() => setSelectedWorkflow(null)} onFavorite={toggleFavorite} onLaunch={onLaunchWorkflow} onChooseFiles={onChooseFiles} onChooseFolder={onChooseFolder}/></FinanceDashboardFrame>

  let content
  if (view === 'home') content = <div className="fdDesk_page">
    <div className="fdDesk_greeting"><div><small>FINANCE CONTROL DESK</small><h1>{greetingFor()}，{profile.name}</h1><p>{profile.period} · {profile.entity} · 让每个结果可追溯、可复核、可交付。</p></div><button type="button" onClick={() => changeView('workflows')}>开始一项财务工作</button></div>
    <div className="fdDesk_stats">{[[activeTodos.length, '待办未完成', 'todos'], [FINANCE_WORKFLOWS.length, '专业工作流', 'workflows'], [summary.total, '资料库文件', 'files'], [`${progress.percent}%`, '月结完成度', 'close'], [favorites.length, '收藏场景', 'workflows'], [settings.largeAmount.toLocaleString('zh-CN'), '大额提醒阈值', 'settings']].map(([value, label, target]) => <button type="button" key={label} onClick={() => changeView(target)}><strong>{value}</strong><span>{label}</span></button>)}</div>
    <Panel title="8 步标准执行链路" note="来自《财务人 WorkBuddy 自动化工作流 SOP 手册》"><div className="fdDesk_sopStrip">{SOP_STEPS.map(([no, title, note]) => <button type="button" key={no} onClick={() => changeView('settings')}><span>{no}</span><strong>{title}</strong><small>{note}</small></button>)}</div></Panel>
    <div className="fdDesk_homeGrid"><Panel title="本期待办" note={`${activeTodos.length} 项待处理`} action={<button className="fdDesk_textButton" type="button" onClick={() => changeView('todos')}>查看全部 →</button>}><div className="fdDesk_todoPreview">{activeTodos.slice(0, 5).map(item => <article key={item.id}><i className={`is-${item.priority}`}/><div><strong>{item.text}</strong><small>{item.category} · {dueLabel(item.due, today)}</small></div><button type="button" onClick={() => setTodos(current => current.map(row => row.id === item.id ? { ...row, done: true } : row))}>完成</button></article>)}{!activeTodos.length && <div className="fdDesk_empty">本期待办已完成</div>}</div></Panel><Panel title="月结与内控" note={`${progress.done}/${progress.total} 项有完成证据`} action={<strong className="fdDesk_percent">{progress.percent}%</strong>}><div className="fdDesk_progress"><i style={{ width: `${progress.percent}%` }}/></div><div className="fdDesk_closePreview">{closeTasks.filter(item => !item.done).slice(0, 4).map(item => <button type="button" key={item.id} onClick={() => changeView('close')}><span>待核</span><div><strong>{item.title}</strong><small>{item.owner}</small></div></button>)}</div></Panel></div>
    <Panel title="常用工作流" note="按你的收藏优先展示" action={<button className="fdDesk_textButton" type="button" onClick={() => changeView('workflows')}>25 个场景 →</button>}><WorkflowCards workflows={featured.length ? featured : FINANCE_WORKFLOWS.slice(0, 4)} favorites={favorites} onSelect={setSelectedWorkflow}/></Panel>
    <div className="fdDesk_boundary"><strong>人工复核红线</strong><span>入账</span><span>付款</span><span>纳税申报</span><span>会计政策与重大估计</span><p>工作台负责重复处理、核对、汇总和初稿；最终判断仍由对应财务岗位完成。</p></div>
  </div>
  else if (view === 'todos') content = <div className="fdDesk_page"><Panel title="新增待办" note="明确责任、优先级与截止日期"><form className="fdDesk_todoForm" onSubmit={addTodo}><input value={newTodo.text} onChange={event => setNewTodo(current => ({ ...current, text: event.target.value }))} placeholder="例如：复核本周大额付款资料"/><select value={newTodo.category} onChange={event => setNewTodo(current => ({ ...current, category: event.target.value }))}>{['通用', '对账', '税务', '往来', '资金', '预算', '月结', '分析'].map(item => <option key={item}>{item}</option>)}</select><input type="date" value={newTodo.due} onChange={event => setNewTodo(current => ({ ...current, due: event.target.value }))}/><select value={newTodo.priority} onChange={event => setNewTodo(current => ({ ...current, priority: event.target.value }))}>{['高', '中', '低'].map(item => <option key={item}>{item}</option>)}</select><button type="submit">添加</button></form></Panel><div className="fdDesk_twoCol"><Panel title="待办" note={`${activeTodos.length} 项`}><div className="fdDesk_tasks">{activeTodos.map(item => <article key={item.id}><button type="button" className="fdDesk_check" onClick={() => setTodos(current => current.map(row => row.id === item.id ? { ...row, done: true } : row))}/><div><strong>{item.text}</strong><small><span>{item.priority}优先</span>{item.category} · {dueLabel(item.due, today)}</small></div><button type="button" onClick={() => setTodos(current => current.filter(row => row.id !== item.id))}>×</button></article>)}{!activeTodos.length && <div className="fdDesk_empty">暂无待办</div>}</div></Panel><Panel title="已完成" note={`${todos.filter(item => item.done).length} 项`}><div className="fdDesk_tasks">{todos.filter(item => item.done).map(item => <article className="is-done" key={item.id}><button type="button" className="fdDesk_check" onClick={() => setTodos(current => current.map(row => row.id === item.id ? { ...row, done: false } : row))}>✓</button><div><strong>{item.text}</strong><small>{item.category} · {item.due}</small></div><button type="button" onClick={() => setTodos(current => current.filter(row => row.id !== item.id))}>×</button></article>)}</div></Panel></div></div>
  else if (view === 'workflows') content = <div className="fdDesk_page"><div className="fdDesk_workflowTools"><input value={workflowQuery} onChange={event => setWorkflowQuery(event.target.value)} placeholder="搜索场景、岗位、业务关键词"/><div>{WORKFLOW_GROUPS.map(([id, label]) => <button type="button" key={id} className={workflowGroup === id ? 'is-active' : ''} onClick={() => setWorkflowGroup(id)}>{label}</button>)}</div></div><WorkflowCards workflows={filteredWorkflows} favorites={favorites} onSelect={setSelectedWorkflow}/></div>
  else if (['reconcile', 'tax', 'settlement', 'capital', 'analysis'].includes(view)) content = <ModulePage view={view} workflows={moduleWorkflows} favorites={favorites} onSelect={setSelectedWorkflow}/>
  else if (view === 'close') content = <div className="fdDesk_page"><div className="fdDesk_moduleHero"><div><small>MONTH-END CONTROL</small><h1>月结不是“做完”，而是“有证据地完成”</h1><p>逐项确认责任人、证据、差异状态与预计完成时间。</p></div><span>{progress.percent}%<small>完成度</small></span></div><div className="fdDesk_closeGrid"><Panel title="月结任务清单" note="勾选表示已取得完成证据"><div className="fdDesk_closeTasks">{closeTasks.map(item => <label key={item.id} className={item.done ? 'is-done' : ''}><input type="checkbox" checked={item.done} onChange={() => setCloseTasks(current => current.map(row => row.id === item.id ? { ...row, done: !row.done } : row))}/><span><strong>{item.title}</strong><small>{item.owner} · 证据：{item.evidence}</small></span></label>)}</div></Panel><Panel title="适用工作流" note="异常检查、资料完整性和归档"><WorkflowCards workflows={moduleWorkflows} favorites={favorites} onSelect={setSelectedWorkflow}/></Panel></div></div>
  else if (view === 'files') content = <FileLibrary files={files} workspace={workspace} onOpenWorkspace={onOpenWorkspace} onChooseFiles={onChooseFiles} onChooseFolder={onChooseFolder} onUploadFiles={onUploadFiles} onReferenceFile={onReferenceFile} onDownloadFile={onDownloadFile} onStatus={onStatus}/>
  else content = <div className="fdDesk_page"><Panel title="8 步搭建法" note="先诊断、后执行；先小样本、后全量"><div className="fdDesk_sopGrid">{SOP_STEPS.map(([no, title, note]) => <article key={no}><span>{no}</span><div><strong>{title}</strong><small>{note}</small></div></article>)}</div></Panel><div className="fdDesk_settingsGrid"><Panel title="个人与期间设置" note="用于工作台显示，不上传到外部"><div className="fdDesk_settingsForm"><label>称呼<input value={profile.name} onChange={event => setProfile(current => ({ ...current, name: event.target.value }))}/></label><label>主体 / 工作区<input value={profile.entity} onChange={event => setProfile(current => ({ ...current, entity: event.target.value }))}/></label><label>岗位定位<input value={profile.role} onChange={event => setProfile(current => ({ ...current, role: event.target.value }))}/></label><label>当前期间<input type="month" value={profile.period} onChange={event => setProfile(current => ({ ...current, period: event.target.value }))}/></label></div></Panel><Panel title="关键阈值" note="阈值只用于筛选和排序，不替代财务判断"><div className="fdDesk_settingsForm"><label>大额提醒（元）<input type="number" min="0" value={settings.largeAmount} onChange={event => setSettings(current => ({ ...current, largeAmount: Number(event.target.value) }))}/></label><label>对账日期容差（天）<input type="number" min="0" max="31" value={settings.dateTolerance} onChange={event => setSettings(current => ({ ...current, dateTolerance: Number(event.target.value) }))}/></label><label>异常变化阈值（%）<input type="number" min="0" value={settings.varianceRate} onChange={event => setSettings(current => ({ ...current, varianceRate: Number(event.target.value) }))}/></label></div></Panel></div><Panel title="字段字典" note="把口头经验写成可重复使用的字段规则"><div className="fdDesk_dictionary">{fieldDictionary.map(item => <article key={item.id}><div><strong>{item.name}</strong><small>{item.type}</small></div><p>{item.rule}</p><button type="button" onClick={() => setFieldDictionary(current => current.filter(row => row.id !== item.id))}>×</button></article>)}</div><form className="fdDesk_fieldForm" onSubmit={event => { event.preventDefault(); if (!newField.name.trim() || !newField.rule.trim()) return; setFieldDictionary(current => [...current, { ...newField, id: makeId('field') }]); setNewField({ name: '', type: '文本', rule: '' }); onStatus('字段规则已添加') }}><input value={newField.name} onChange={event => setNewField(current => ({ ...current, name: event.target.value }))} placeholder="字段名称"/><select value={newField.type} onChange={event => setNewField(current => ({ ...current, type: event.target.value }))}>{['文本', '数值', '日期', '枚举', '布尔'].map(item => <option key={item}>{item}</option>)}</select><input value={newField.rule} onChange={event => setNewField(current => ({ ...current, rule: event.target.value }))} placeholder="口径、必填、唯一性或取值规则"/><button type="submit">添加字段</button></form></Panel><Panel title="本机数据备份" note="备份待办、关账清单、收藏、字段字典与阈值设置"><div className="fdDesk_backup"><button type="button" onClick={exportData}>导出 JSON 备份</button><button type="button" onClick={() => importPicker.current?.click()}>恢复 JSON 备份</button><span>财务原始资料仍保存在工作区目录，不会打包进设置备份。</span></div></Panel><div className="fdDesk_boundary"><strong>长期可用的财务工作流</strong><span>稳定输入</span><span>清楚字段</span><span>明确规则</span><span>固定输出</span><span>人工复核</span><span>处理留痕</span></div><input ref={importPicker} hidden type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) importData(file) }}/></div>

  return <FinanceDashboardFrame view={view} profile={profile} status={status} mobileNav={mobileNav} setMobileNav={setMobileNav} changeView={changeView} onRefresh={onRefresh} onOpenWorkspace={onOpenWorkspace} onClose={onClose}>{content}</FinanceDashboardFrame>
}

function FinanceDashboardFrame({ view, profile, status, mobileNav, setMobileNav, changeView, onRefresh, onOpenWorkspace, onClose, children }) {
  return <section className="dfinance_panel dfinance_embedded fdDesk_root" aria-label="财务工作台"><aside className={`fdDesk_sidebar ${mobileNav ? 'is-open' : ''}`}><div className="fdDesk_identity"><span>财</span><div><strong>财务工作台</strong><small>{profile.entity}</small></div><button type="button" onClick={() => setMobileNav(false)} aria-label="关闭导航">×</button></div><nav aria-label="财务工作台导航">{NAV_ITEMS.map(([key, label, icon]) => <button type="button" key={key} className={view === key ? 'is-active' : ''} onClick={() => changeView(key)}><span>{icon}</span><strong>{label}</strong></button>)}</nav><footer><strong>{profile.period}</strong><span><i/>数据与设置保存在本机</span></footer></aside>{mobileNav && <button type="button" className="fdDesk_mobileMask" aria-label="关闭导航蒙层" onClick={() => setMobileNav(false)}/>}<div className="fdDesk_main"><header className="fdDesk_topbar"><button type="button" className="fdDesk_menu" onClick={() => setMobileNav(true)} aria-label="打开导航">☰</button><div><h2>{PAGE_META[view][0]}</h2><p>{PAGE_META[view][1]}</p></div><span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span><button type="button" className="fdDesk_return" onClick={onClose}>返回对话</button></header><div className="fdDesk_status"><i/><span>{status}</span><button type="button" onClick={onOpenWorkspace}>打开目录</button><button type="button" onClick={onRefresh}>刷新</button></div><main className="fdDesk_content">{children}</main></div></section>
}
