import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCE_MODULES, FINANCE_WORKFLOWS, NAV_GROUPS, NAV_ITEMS, SOP_STEPS } from '../src/finance-data.js'

test('finance catalog contains all 22 SOP scenarios plus three professional extensions', () => {
  assert.equal(FINANCE_WORKFLOWS.length, 25)
  assert.deepEqual(FINANCE_WORKFLOWS.slice(0, 22).map(item => item.number), Array.from({ length: 22 }, (_, index) => String(index + 1).padStart(2, '0')))
  assert.equal(new Set(FINANCE_WORKFLOWS.map(item => item.id)).size, 25)
  assert.equal(FINANCE_WORKFLOWS.filter(item => !item.number).length, 3)
})

test('every workflow is executable and includes controls, steps and deliverables', () => {
  for (const item of FINANCE_WORKFLOWS) {
    assert.ok(item.title && item.role && item.desc)
    assert.ok(item.inputs.length >= 3, item.title)
    assert.ok(item.rules.length >= 4, item.title)
    assert.equal(item.steps.length, 7, item.title)
    assert.ok(item.outputs.includes('处理日志与规则版本'), item.title)
    assert.ok(item.checklist.length >= 4, item.title)
    assert.match(item.prompt, /先输出字段映射|处理目标/)
  }
})

test('the standard SOP has eight controlled implementation steps', () => {
  assert.equal(SOP_STEPS.length, 8)
  assert.deepEqual(SOP_STEPS.map(item => item[0]), ['01', '02', '03', '04', '05', '06', '07', '08'])
})

test('management desk exposes the 19 requested modules in grouped navigation', () => {
  assert.equal(NAV_ITEMS.length, 19)
  assert.deepEqual(NAV_ITEMS.map(item => item[1]), ['财务总览', '收入管理', '应收账款', '应付账款', '费用报销', '资金管理', '预算管理', '固定资产', '税务管理', '发票管理', '工资管理', '银行对账', '成本核算', '财务报表', '财务分析', '投资管理', '审计日志', '数据备份', '系统设置'])
  assert.deepEqual(NAV_GROUPS.filter(group => group.label).map(group => group.label), ['经营与往来', '核算与合规', '报告与决策', '治理与系统'])
})

test('each professional module has a complete process and valid workflow links', () => {
  assert.equal(Object.keys(FINANCE_MODULES).length, 16)
  const workflowIds = new Set(FINANCE_WORKFLOWS.map(item => item.id))
  for (const module of Object.values(FINANCE_MODULES)) {
    assert.equal(module.process.length, 4, module.title)
    assert.ok(module.controls.length >= 4, module.title)
    assert.ok(module.deliverables.length >= 3, module.title)
    assert.ok(module.workflowIds.length >= 2, module.title)
    for (const workflowId of module.workflowIds) assert.ok(workflowIds.has(workflowId), `${module.title}: ${workflowId}`)
  }
})
