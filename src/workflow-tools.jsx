import React from 'react'
import { BRIEF_FIELDS } from './workflow-tools.js'

export function TaskBrief({ value, onChange }) {
  return <section className="wbPro_brief" aria-label="填写本次任务要求">
    <header><div><small>TASK BRIEF · 任务准备</small><h3>把这次要做的事，说清楚</h3><p>选填即可。填写内容同步到完整提示词；准备好后带入对话，由你确认发送。</p></div><button type="button" onClick={() => onChange({})}>清空填写</button></header>
    <div className="wbPro_briefGrid">{BRIEF_FIELDS.map(([key, label, placeholder]) => <label key={key} className={key === 'goal' || key === 'requirements' ? 'is-wide' : ''}>{label}{key === 'requirements' ? <textarea aria-label={label} value={value[key] || ''} maxLength={2000} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })}/> : <input aria-label={label} value={value[key] || ''} maxLength={500} placeholder={placeholder} onChange={event => onChange({ ...value, [key]: event.target.value })}/>}</label>)}</div>
    <footer>仅用于本次任务 · 原始文件保持不变 · 切换工作流后清空填写</footer>
  </section>
}
export function WorkflowFilter({ value, onChange }) {
  return <div className="wbPro_filters" role="group" aria-label="工作流筛选">{[['all', '全部场景'], ['favorites', '我的收藏'], ['recent', '最近查看']].map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{label}</button>)}</div>
}
export function WorkbenchPolish() {
  return null
}
export const WORKBENCH_POLISH_CSS = `
.dshDesk_root{--wb-accent:var(--desk-accent-strong);--wb-line:var(--desk-line);--wb-panel:var(--desk-panel);--wb-muted:var(--desk-muted);--wb-soft:var(--desk-soft)}
.fdDesk_root{--wb-accent:var(--fin-accent-strong);--wb-line:var(--fin-line);--wb-panel:var(--fin-panel);--wb-muted:var(--fin-muted);--wb-soft:var(--fin-soft)}
.dshDesk_root[data-theme=night]{--desk-accent:#91a6ff;--desk-accent-strong:#acbaff;--desk-soft:#26354d;--desk-bg:#111b2a;--desk-panel:#1a273a;--desk-ink:#e9eef7;--desk-muted:#aebed1;--desk-line:#34465f;color:var(--desk-ink);background:var(--desk-bg);color-scheme:dark}
.dshDesk_root[data-theme=night] :is(.dshDesk_sidebar,.dshDesk_topbar,.dshDesk_sidebar footer){background:var(--desk-panel);color:var(--desk-ink);border-color:var(--desk-line)}
.dshDesk_root[data-theme=night] :is(input,textarea,select){background:var(--desk-panel);color:var(--desk-ink);border-color:var(--desk-line)}
.dshDesk_root .dshDesk_workflowGrid,.fdDesk_root .fdDesk_workflowGrid{grid-template-columns:repeat(auto-fit,minmax(min(225px,100%),1fr));gap:12px}
.dshDesk_root .dshDesk_workflowGrid strong,.fdDesk_root .fdDesk_workflowGrid strong{font-size:14px;line-height:1.55}.dshDesk_root .dshDesk_workflowGrid small,.fdDesk_root .fdDesk_workflowGrid small{font-size:12px;line-height:1.65}.dshDesk_root .dshDesk_workflowGrid button>span,.fdDesk_root .fdDesk_workflowGrid button>span{font-size:11px}
.dshDesk_root .dshDesk_panelHead h3,.fdDesk_root .fdDesk_panelHead h3{font-size:16px}.dshDesk_root .dshDesk_panelHead p,.fdDesk_root .fdDesk_panelHead p{font-size:12px;line-height:1.6}
.wbPro_brief{border:1px solid var(--wb-line);border-left:3px solid var(--wb-accent);background:var(--wb-panel);border-radius:14px;padding:20px;margin:14px 0;min-width:0}
.wbPro_brief header{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}.wbPro_brief header small{font-size:10px;letter-spacing:1px;color:var(--wb-accent);font-weight:700}.wbPro_brief h3{font-size:18px!important;margin:5px 0!important}.wbPro_brief p,.wbPro_brief footer{font-size:12px!important;line-height:1.7;color:var(--wb-muted)}.wbPro_brief p{margin:0 0 12px}.wbPro_brief footer{margin-top:12px}
.wbPro_briefGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.wbPro_briefGrid label{display:grid;gap:7px;font-size:12px;font-weight:600;min-width:0}.wbPro_briefGrid .is-wide{grid-column:1/-1}.wbPro_briefGrid input,.wbPro_briefGrid textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--wb-line);background:var(--wb-panel);border-radius:8px;padding:10px 12px;font:inherit;font-size:13px;color:inherit;outline:none}.wbPro_briefGrid textarea{min-height:88px;resize:vertical}.wbPro_briefGrid :is(input,textarea):focus{border-color:var(--wb-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--wb-accent) 12%,transparent)}
.wbPro_brief header button,.wbPro_filters button{border:1px solid var(--wb-line);border-radius:8px;padding:8px 12px;font-size:12px!important;background:var(--wb-panel);color:inherit;white-space:nowrap;cursor:pointer}.wbPro_filters{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.wbPro_filters button[aria-pressed=true]{background:var(--wb-soft);border-color:var(--wb-accent);color:var(--wb-accent);font-weight:700}.wbPro_search{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 0}.wbPro_search input{flex:1;min-width:120px;border:1px solid var(--wb-line);border-radius:9px;padding:11px 12px;background:var(--wb-panel);color:inherit;font-size:13px}.wbPro_search small{font-size:12px;color:var(--wb-muted)}
.dshDesk_root :focus-visible,.fdDesk_root :focus-visible{outline:2px solid var(--wb-accent);outline-offset:3px}
.dshDesk_root .dshDesk_workflowGrid button,.fdDesk_root .fdDesk_workflowGrid button{transition:transform .15s,border-color .15s;min-height:116px}.dshDesk_root .dshDesk_workflowGrid button:hover,.fdDesk_root .fdDesk_workflowGrid button:hover{transform:translateY(-2px);border-color:var(--wb-accent)}
.dshDesk_root .dshDesk_promptBlock pre,.fdDesk_root .fdDesk_promptPreview{font-size:13px;line-height:1.85;max-height:480px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
@container teacher-workbench (max-width:600px){.wbPro_briefGrid{grid-template-columns:1fr}.wbPro_brief{padding:14px}.wbPro_brief header{flex-wrap:wrap}}
@container finance-workbench (max-width:600px){.wbPro_briefGrid{grid-template-columns:1fr}.wbPro_brief{padding:14px}.wbPro_brief header{flex-wrap:wrap}}
@media(prefers-reduced-motion:reduce){.dshDesk_root *,.fdDesk_root *{transition:none!important;animation:none!important}}
`
