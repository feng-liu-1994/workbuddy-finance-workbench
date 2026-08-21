import test from 'node:test'
import assert from 'node:assert/strict'
import { fileKind, filterFiles, matchScenarioFiles, summarizeFiles } from '../src/ui-helpers.js'

const files = [
  { name: '合同.pdf', relative: '财务资料/合同.pdf', size: 100 },
  { name: '流水.xlsx', relative: '财务资料/流水.xlsx', size: 200 },
  { name: '发票.png', relative: '财务资料/发票.png', size: 300 },
]

test('fileKind classifies common finance files', () => {
  assert.equal(fileKind('a.pdf'), 'document')
  assert.equal(fileKind('a.xlsx'), 'sheet')
  assert.equal(fileKind('a.pptx'), 'slides')
  assert.equal(fileKind('a.png'), 'image')
})

test('filterFiles combines query and kind', () => {
  assert.equal(filterFiles(files, '合同', 'all', 'all').length, 1)
  assert.equal(filterFiles(files, '', 'sheet', 'all')[0].name, '流水.xlsx')
  assert.equal(filterFiles(files, '', 'document', 'all').length, 1)
})

test('summarizeFiles totals counts and bytes', () => {
  assert.deepEqual(summarizeFiles(files), { total: 3, bytes: 600, document: 1, sheet: 1, slides: 0, image: 1, other: 0 })
})

test('matchScenarioFiles prefers filename relevance and limits noise', () => {
  const matched = matchScenarioFiles(files, { keywords: ['发票', '报销'], fileKinds: ['image', 'document'] })
  assert.deepEqual(matched.map(file => file.name), ['发票.png'])
  assert.deepEqual(matchScenarioFiles(files, { keywords: ['流水'], fileKinds: [] }).map(file => file.name), ['流水.xlsx'])
})
