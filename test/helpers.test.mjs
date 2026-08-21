import test from 'node:test'
import assert from 'node:assert/strict'
import { isFinanceFile, isInside, safeUploadName, safeUploadRelativePath, safeWorkflowId } from '../src/index.js'

test('safeUploadName keeps Chinese names and removes unsafe separators', () => {
  assert.equal(safeUploadName(' 银行 流水.xlsx '), '_银行_流水.xlsx_')
  assert.equal(safeUploadName('../../报销明细.xlsx'), '报销明细.xlsx')
})

test('safeUploadRelativePath preserves safe folders and blocks traversal', () => {
  assert.equal(safeUploadRelativePath('2026年/发票/差旅 01.pdf', 'ignored.pdf'), '2026年/发票/差旅_01.pdf')
  assert.equal(safeUploadRelativePath('', '合同 台账.xlsx'), '合同_台账.xlsx')
  assert.throws(() => safeUploadRelativePath('../工资表/明细.xlsx', '明细.xlsx'), /无效目录/)
  assert.throws(() => safeUploadRelativePath('/绝对路径/文件.pdf', '文件.pdf'), /上传路径无效/)
})

test('isInside rejects traversal and accepts descendants', () => {
  assert.equal(isInside('/tmp/work', '/tmp/work/财务资料/a.xlsx'), true)
  assert.equal(isInside('/tmp/work', '/tmp/other/a.xlsx'), false)
})

test('isFinanceFile accepts supported finance artifacts only', () => {
  assert.equal(isFinanceFile('银行流水.XLSX'), true)
  assert.equal(isFinanceFile('合同.pdf'), true)
  assert.equal(isFinanceFile('说明.md'), true)
  assert.equal(isFinanceFile('plugin.js'), false)
  assert.equal(isFinanceFile('密钥.env'), false)
})

test('safeWorkflowId only accepts deterministic internal names', () => {
  assert.equal(safeWorkflowId('Bank-Reconcile'), 'bank-reconcile')
  assert.throws(() => safeWorkflowId('../invoice'), /无效/)
  assert.throws(() => safeWorkflowId('发票'), /无效/)
})
