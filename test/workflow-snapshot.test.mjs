import test from 'node:test'
import assert from 'node:assert/strict'
import { workflowSnapshotName } from '../src/index.js'

test('task snapshots stay independent and reject unsafe names', () => {
  const first = workflowSnapshotName('bank-reconcile')
  assert.match(first, /^bank-reconcile-[a-f0-9-]+\.md$/)
  assert.notEqual(first, workflowSnapshotName('bank-reconcile'))
  assert.throws(() => workflowSnapshotName('../invoice'), /无效/)
})
