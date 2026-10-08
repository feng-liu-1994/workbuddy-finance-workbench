import test from 'node:test'
import assert from 'node:assert/strict'
import { copyText } from '../src/clipboard.js'

function fixture(t, clipboard, copied) {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  let removed = 0
  const element = { style: {}, select() {}, remove() { removed++ } }
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: { createElement: () => element, body: { appendChild() {} }, execCommand: () => copied }, configurable: true })
  t.after(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else delete globalThis.document
  })
  return { element, removed: () => removed }
}

test('modern clipboard writes the actual prompt', async t => {
  let text
  fixture(t, { writeText: async value => { text = value } }, false)
  await copyText('实际财务任务')
  assert.equal(text, '实际财务任务')
})

test('clipboard denial falls back to selection copy and cleans up its temporary field', async t => {
  const f = fixture(t, { writeText: async () => { throw new Error('denied') } }, true)
  await copyText('完整提示词')
  assert.equal(f.element.value, '完整提示词')
  assert.equal(f.removed(), 1)
})

test('failure of both clipboard methods is reported instead of claiming success', async t => {
  const f = fixture(t, undefined, false)
  await assert.rejects(copyText('未复制内容'), /剪贴板不可用/)
  assert.equal(f.removed(), 1)
})
