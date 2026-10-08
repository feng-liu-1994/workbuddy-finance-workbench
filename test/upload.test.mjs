import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, rename, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FinanceFilesService } from '../src/index.js'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'upload-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const service = Object.create(FinanceFilesService.prototype)
  service.uploads = new Map()
  const agent = { session: { header: { cwd: root } } }
  const begin = (name, text) => service.beginUpload(agent, { name, size: Buffer.byteLength(text) })
  const chunk = (upload, text) => service.uploadChunk(agent, { uploadId: upload.uploadId, offset: 0, data: Buffer.from(text).toString('base64') })
  const finish = upload => service.finishUpload(agent, { uploadId: upload.uploadId })
  return { root, service, agent, begin, chunk, finish }
}

test('concurrent same-name uploads and an existing file all survive intact', async t => {
  const f = await fixture(t)
  await mkdir(join(f.root, '财务资料'))
  await writeFile(join(f.root, '财务资料', '资料.txt'), 'original')
  const uploads = await Promise.all(['first', 'second'].map(text => f.begin('资料.txt', text)))
  await Promise.all(uploads.map((u, i) => f.chunk(u, ['first', 'second'][i])))
  const results = await Promise.all(uploads.map(f.finish))
  assert.equal(new Set(results.map(r => r.relative)).size, 2)
  assert.deepEqual(await Promise.all(results.map(r => readFile(join(f.root, r.relative), 'utf8'))), ['first', 'second'])
  assert.equal(await readFile(join(f.root, '财务资料', '资料.txt'), 'utf8'), 'original')
  assert.equal((await readdir(join(f.root, '财务资料'))).some(n => n.endsWith('.part')), false)
})

test('a file created after beginUpload is preserved', async t => {
  const f = await fixture(t)
  const u = await f.begin('资料.txt', 'new')
  await f.chunk(u, 'new')
  await writeFile(join(f.root, u.relative), 'created meanwhile')
  const result = await f.finish(u)
  assert.notEqual(result.relative, u.relative)
  assert.equal(await readFile(join(f.root, u.relative), 'utf8'), 'created meanwhile')
})

test('double finish commits exactly once', async t => {
  const f = await fixture(t)
  const u = await f.begin('资料.txt', 'new')
  await f.chunk(u, 'new')
  const results = await Promise.allSettled([f.finish(u), f.finish(u)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal((await readdir(join(f.root, '财务资料'))).length, 1)
})

test('incomplete upload remains resumable and invalid sizes are rejected', async t => {
  const f = await fixture(t)
  const u = await f.begin('资料.txt', 'new')
  await assert.rejects(f.finish(u), /尚未上传完整/)
  await f.chunk(u, 'new')
  assert.equal((await f.finish(u)).size, 3)
  for (const size of [-1, 0.5, NaN, Infinity]) {
    await assert.rejects(f.service.beginUpload(f.agent, { name: 'invalid.txt', size }), /文件大小无效/)
  }
})

test('empty files can be uploaded', async t => {
  const f = await fixture(t)
  assert.equal((await f.finish(await f.begin('empty.txt', ''))).size, 0)
})

test('upload and task writes reject directory symlinks, including changes after upload begins', async t => {
  const f = await fixture(t)
  const outside = await mkdtemp(join(tmpdir(), 'outside-test-'))
  t.after(() => rm(outside, { recursive: true, force: true }))
  const link = (target, path) => symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir')
  await link(outside, join(f.root, '财务资料'))
  await assert.rejects(f.begin('资料.txt', 'new'), /符号链接/)
  assert.deepEqual(await readdir(outside), [])
  await rm(join(f.root, '财务资料'), { recursive: true, force: true })
  const u = await f.begin('资料.txt', 'new')
  await f.chunk(u, 'new')
  await rename(join(f.root, '财务资料'), join(f.root, '原财务资料'))
  await link(outside, join(f.root, '财务资料'))
  await assert.rejects(f.finish(u), /符号链接/)
  assert.deepEqual(await readdir(outside), [])
  await link(outside, join(f.root, '财务工作台'))
  await assert.rejects(f.service.prepareTask(f.agent, { id: 'bank-reconcile', title: '对账', content: '核对样本' }), /符号链接/)
  assert.deepEqual(await readdir(outside), [])
})

test('invalid chunks, cross-workspace IDs, traversal and download offsets are rejected', async t => {
  const f = await fixture(t)
  const u = await f.begin('资料.txt', 'new')
  for (const data of ['%%%=', 'a', 'bmV3===', 'bmV3\n']) await assert.rejects(f.service.uploadChunk(f.agent, { uploadId: u.uploadId, offset: 0, data }), /编码无效/)
  const other = await fixture(t)
  await assert.rejects(f.service.finishUpload(other.agent, { uploadId: u.uploadId }), /已失效/)
  await f.chunk(u, 'new')
  const result = await f.finish(u)
  const downloaded = await f.service.downloadChunk(f.agent, { relative: result.relative, offset: 0, length: 100 })
  assert.equal(Buffer.from(downloaded.data, 'base64').toString(), 'new')
  await assert.rejects(f.service.downloadChunk(f.agent, { relative: '../outside.txt', offset: 0, length: 1 }), /超出/)
  await assert.rejects(f.service.downloadChunk(f.agent, { relative: result.relative, offset: -1, length: 1 }), /偏移/)
  await assert.rejects(f.service.downloadChunk(f.agent, { relative: result.relative, offset: 0, length: 0 }), /长度/)
})
