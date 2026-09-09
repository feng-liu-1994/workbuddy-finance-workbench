import test from 'node:test'
import assert from 'node:assert/strict'
import { filterWorkflowList, recentWorkflowIds, formatTaskBrief } from '../src/workflow-tools.js'
import { composeFinanceTask } from '../src/task-prompt.js'

test('task brief is bounded, optional and included in the actual full prompt', () => {
  const item = { title: '测试任务', prompt: '只读原件', inputs: [], output: '', outputs: [], checks: [], checklist: [], taskBrief: { subject: '示例对象', period: '2026-09', goal: '生成检查表', requirements: '脱敏' } }
  const prompt = composeFinanceTask(item)
  assert.ok(prompt.includes(formatTaskBrief(item.taskBrief)))
  assert.ok(prompt.includes('生成检查表'))
  assert.equal(formatTaskBrief(null), '')
  assert.ok(formatTaskBrief({ subject: 'x'.repeat(5000) }).length < 2100)
})
test('search, favorites and recent ordering compose without mutating catalog', () => {
  const rows = [{id:'a',title:'教学 财务',keywords:['报销']},{id:'b',title:'财务报表',keywords:[]}]
  assert.deepEqual(filterWorkflowList(rows,{query:'教学 报销'}).map(x=>x.id),['a'])
  assert.deepEqual(filterWorkflowList([{id:'bank',title:'银行流水与账务明细核对',keywords:['对账']}],{query:'银行对账'}).map(x=>x.id),['bank'])
  assert.deepEqual(filterWorkflowList(rows,{filter:'favorites',favorites:['b']}).map(x=>x.id),['b'])
  assert.deepEqual(filterWorkflowList(rows,{filter:'recent',recent:['b','a']}).map(x=>x.id),['b','a'])
  assert.deepEqual(rows.map(x=>x.id),['a','b'])
  assert.deepEqual(recentWorkflowIds(['a','b','a'],'b'),['b','a'])
  assert.equal(recentWorkflowIds(Array.from({length:20},(_,i)=>String(i)),'new').length,8)
})
