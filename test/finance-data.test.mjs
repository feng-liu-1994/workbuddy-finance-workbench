import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCE_WORKFLOWS, SOP_STEPS } from '../src/finance-data.js'

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
