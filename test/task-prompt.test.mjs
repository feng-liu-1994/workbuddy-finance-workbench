import test from 'node:test'
import assert from 'node:assert/strict'
import { composeFinanceLaunch, composeFinanceTask, mergeFinanceLaunchDraft } from '../src/task-prompt.js'

const scenario = {
  title: '银行流水与账面核对',
  inputs: ['银行流水.xlsx', '账面记录.xlsx'],
  outputs: ['银行对账结果.xlsx', '对账复核说明.md'],
  prompt: '执行唯一的一对一匹配，不能确定的记录进入疑似匹配。',
  variant: '生成按月汇总的趋势表。',
  checklist: ['每条记录最多参与一次匹配', '双方金额合计一致'],
}

test('composeFinanceTask creates an executable, evidence-backed task package', () => {
  const value = composeFinanceTask(scenario)
  assert.match(value, /【财务任务包】银行流水与账面核对/)
  assert.match(value, /【所需资料】[\s\S]*银行流水\.xlsx/)
  assert.match(value, /【交付成果】[\s\S]*银行对账结果\.xlsx/)
  assert.match(value, /当前工作区“输出\/财务工作台”子目录/)
  assert.match(value, /【模块执行指令】[\s\S]*一对一匹配/)
  assert.match(value, /【可选扩展指令】[\s\S]*按月汇总/)
  assert.match(value, /- \[ \] 每条记录最多参与一次匹配/)
  assert.match(value, /不要只回复操作建议/)
  assert.doesNotMatch(value, /第[一二三四五六七八九十]+章/)
})

test('composeFinanceTask validates incomplete module configuration', () => {
  assert.throws(() => composeFinanceTask({ title: '缺失指令' }), /配置不完整/)
})

test('composeFinanceLaunch keeps the visible request short and references hidden workflow', () => {
  const value = composeFinanceLaunch(scenario, '财务工作台/内置工作流/bank-reconcile.md', ['财务资料/银行流水.xlsx'])
  assert.match(value, /^@财务工作台\/内置工作流\/bank-reconcile\.md @财务资料\/银行流水\.xlsx/)
  assert.match(value, /请执行“银行流水与账面核对”/)
  assert.doesNotMatch(value, /【执行闭环】|【专项核查清单】|一对一匹配/)
  assert.ok(value.length < 180)
})

test('mergeFinanceLaunchDraft replaces old generated packages but keeps user notes', () => {
  const launch = '@财务工作台/内置工作流/invoice.md\n请执行“发票批量识别与报销”。'
  assert.equal(mergeFinanceLaunchDraft('【教师任务包】旧任务\n很多指令', launch), launch)
  assert.equal(mergeFinanceLaunchDraft('请重点检查三月数据', launch), `请重点检查三月数据\n\n${launch}`)
})
