import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { execFile } from 'node:child_process'
import { copyFile, lstat, mkdir, open, opendir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { FINANCE_FILE_INVOCATIONS } from './contract.js'

export const name = 'dsh-finance-workbench'
export const inject = ['typert']
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const CHUNK_BYTES = 512 * 1024
export const MAX_UPLOAD_DEPTH = 20
const MAX_LIST_FILES = 500
const MAX_LIST_DEPTH = 6
const SKIP_DIRS = new Set([
  'upgrade-backups', 'upgrade-staging', 'desktop-launcher',
  '.git', '.svn', '.hg', '.dsh', '.next', '.cache', '.trash',
  'node_modules', '__pycache__', 'dist', 'build', 'Backups',
  'finance-workbench-plugin', 'teacher-workbench-plugin', 'dsh-plugins', 'dsh-skin',
])
const FINANCE_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.rtf', '.txt', '.md',
  '.xls', '.xlsx', '.csv', '.numbers',
  '.ppt', '.pptx', '.key',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic',
])
const execFileAsync = promisify(execFile)

export function safeUploadName(input) {
  const base = basename(String(input)).normalize('NFC')
  const cleaned = base.replace(/[\u0000-\u001f\u007f/\\:]/g, '_').replace(/\s+/g, '_').replace(/^\.+/, '').slice(0, 180)
  if (!cleaned || cleaned === '.' || cleaned === '..') throw new Error('文件名无效')
  return cleaned
}

export function safeUploadRelativePath(input, fallbackName) {
  const source = String(input || fallbackName || '').normalize('NFC').replaceAll('\\', '/')
  if (!source || source.startsWith('/') || source.includes('\u0000')) throw new Error('上传路径无效')
  const segments = source.split('/')
  if (segments.length > MAX_UPLOAD_DEPTH) throw new Error(`文件夹层级不能超过 ${MAX_UPLOAD_DEPTH} 层`)
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) throw new Error('上传路径包含无效目录')
  const cleaned = segments.map(safeUploadName)
  const value = cleaned.join('/')
  if (value.length > 1200) throw new Error('上传路径过长')
  return value
}

export function isInside(root, candidate) {
  const rel = relative(root, candidate)
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

export function isFinanceFile(path) {
  return FINANCE_EXTENSIONS.has(extname(String(path)).toLocaleLowerCase('en-US'))
}

export function safeWorkflowId(input) {
  const value = String(input || '').toLocaleLowerCase('en-US')
  if (!/^[a-z0-9-]{1,64}$/.test(value)) throw new Error('工作流标识无效')
  return value
}

export function workflowSnapshotName(id) {
  return `${safeWorkflowId(id)}-${randomUUID()}.md`
}

async function workspaceRoot(agent) {
  const cwd = agent?.session?.header?.cwd
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new Error('当前会话没有有效工作区')
  return realpath(cwd)
}

async function checkedDirectory(root, directory, create = false) {
  if (!isInside(root, directory)) throw new Error('路径超出当前工作区')
  let current = root
  for (const segment of relative(root, directory).split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (create) {
      try { await mkdir(current) } catch (error) { if (error?.code !== 'EEXIST') throw error }
    }
    const info = await lstat(current)
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('目标目录包含符号链接或不是普通目录')
    if (!isInside(root, await realpath(current))) throw new Error('目录指向工作区之外')
  }
  return directory
}

async function checkedUpload(upload) {
  await checkedDirectory(upload.root, dirname(upload.temp))
  const info = await lstat(upload.temp)
  if (info.isSymbolicLink() || !info.isFile()) throw new Error('上传临时文件无效')
  await checkedDirectory(upload.root, dirname(upload.destination))
}

async function publishUpload(temp, directory, name) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  for (let index = 0; index < 1000; index += 1) {
    const candidate = join(directory, index === 0 ? name : `${stem}_${index}${ext}`)
    try {
      // Exclusive creation preserves files even when two uploads finish together.
      await copyFile(temp, candidate, constants.COPYFILE_EXCL)
      return candidate
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
    }
  }
  throw new Error('同名文件过多，请先整理财务资料目录')
}

async function resolvedWorkspaceFile(root, requested) {
  if (isAbsolute(requested) || requested.includes('\u0000')) throw new Error('只允许工作区相对路径')
  const candidate = resolve(root, requested)
  if (!isInside(root, candidate)) throw new Error('路径超出当前工作区')
  const actual = await realpath(candidate)
  if (!isInside(root, actual)) throw new Error('符号链接指向工作区之外')
  const info = await stat(actual)
  if (!info.isFile()) throw new Error('目标不是普通文件')
  if (info.size > MAX_FILE_BYTES) throw new Error('文件超过 50 MB，不能通过网页下载')
  return { actual, info }
}

export class FinanceFilesService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'financeFiles')
    this.uploads = new Map()
  }

  purgeExpired() {
    const deadline = Date.now() - 15 * 60 * 1000
    for (const [id, upload] of this.uploads) {
      if (upload.busy || (upload.updatedAt || upload.createdAt) >= deadline) continue
      this.uploads.delete(id)
      void checkedUpload(upload).then(() => unlink(upload.temp)).catch(() => {})
    }
  }

  async beginUpload(agent, request) {
    this.purgeExpired()
    if (this.uploads.size >= 32) throw new Error('未完成上传过多，请稍后重试')
    const root = await workspaceRoot(agent)
    const relativeName = safeUploadRelativePath(request.relativePath, request.name)
    if (!Number.isSafeInteger(request.size) || request.size < 0) throw new Error('文件大小无效')
    if (request.size > MAX_FILE_BYTES) throw new Error('单个文件不能超过 50 MB')
    const uploadDirectory = join(root, '财务资料')
    await checkedDirectory(root, uploadDirectory, true)
    const requestedDestination = resolve(uploadDirectory, relativeName)
    if (!isInside(uploadDirectory, requestedDestination)) throw new Error('上传路径超出财务资料目录')
    await checkedDirectory(root, dirname(requestedDestination), true)
    const destination = requestedDestination
    const uploadId = randomUUID()
    const temp = join(uploadDirectory, `.dsh-finance-upload-${uploadId}.part`)
    const handle = await open(temp, 'wx', 0o600)
    await handle.close()
    const rel = relative(root, destination).split(sep).join('/')
    this.uploads.set(uploadId, { root, destination, temp, size: request.size, received: 0, createdAt: Date.now(), busy: false })
    return { uploadId, relative: rel, chunkBytes: CHUNK_BYTES }
  }

  async uploadChunk(agent, request) {
    this.purgeExpired()
    const root = await workspaceRoot(agent)
    const upload = this.uploads.get(request.uploadId)
    if (!upload || upload.root !== root) throw new Error('上传任务已失效，请重新选择文件')
    if (upload.busy) throw new Error('上传任务正忙，请稍候重试')
    if (!Number.isSafeInteger(request.offset) || request.offset < 0) throw new Error('上传偏移无效')
    if (request.offset !== upload.received) throw new Error('上传分块顺序不正确')
    if (typeof request.data !== 'string' || request.data.length > Math.ceil(CHUNK_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(request.data) || request.data.length % 4 !== 0) throw new Error('上传分块编码无效')
    const bytes = Buffer.from(request.data, 'base64')
    if (bytes.toString('base64') !== request.data) throw new Error('上传分块编码无效')
    if (bytes.length > CHUNK_BYTES) throw new Error('上传分块过大')
    if (upload.received + bytes.length > upload.size || upload.received + bytes.length > MAX_FILE_BYTES) throw new Error('上传大小与声明不一致')
    upload.busy = true
    try {
      await checkedUpload(upload)
      const handle = await open(upload.temp, constants.O_WRONLY | constants.O_APPEND | (constants.O_NOFOLLOW || 0))
      try { await handle.writeFile(bytes) } finally { await handle.close() }
      upload.received += bytes.length
      upload.updatedAt = Date.now()
      return { received: upload.received }
    } finally {
      upload.busy = false
    }
  }

  async finishUpload(agent, request) {
    this.purgeExpired()
    const root = await workspaceRoot(agent)
    const upload = this.uploads.get(request.uploadId)
    if (!upload || upload.root !== root) throw new Error('上传任务已失效，请重新选择文件')
    if (upload.busy) throw new Error('文件仍在写入，请稍候重试')
    if (upload.received !== upload.size) throw new Error(`文件尚未上传完整：${upload.received}/${upload.size}`)
    upload.busy = true
    try {
      await checkedUpload(upload)
      const destination = await publishUpload(upload.temp, dirname(upload.destination), basename(upload.destination))
      this.uploads.delete(request.uploadId)
      // Cleanup failure must not turn a successful upload into a retry/duplicate.
      await unlink(upload.temp).catch(() => {})
      const info = await stat(destination)
      return {
        relative: relative(root, destination).split(sep).join('/'),
        name: basename(destination),
        size: info.size,
        modifiedAt: info.mtimeMs,
      }
    } finally {
      upload.busy = false
    }
  }

  async listFiles(agent) {
    const root = await workspaceRoot(agent)
    const rows = []
    const queue = [{ directory: root, depth: 0 }]
    while (queue.length && rows.length < MAX_LIST_FILES) {
      const { directory, depth } = queue.shift()
      try {
        const handle = await opendir(directory)
        for await (const entry of handle) {
          if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue
          const path = join(directory, entry.name)
          if (entry.isDirectory()) {
            const isInternalWorkflow = depth === 0 && entry.name === '财务工作台'
            if (depth < MAX_LIST_DEPTH && !isInternalWorkflow && !SKIP_DIRS.has(entry.name)) queue.push({ directory: path, depth: depth + 1 })
          } else if (entry.isFile() && isFinanceFile(entry.name)) {
            const info = await stat(path)
            rows.push({
              relative: relative(root, path).split(sep).join('/'),
              name: entry.name,
              size: info.size,
              modifiedAt: info.mtimeMs,
            })
            if (rows.length >= MAX_LIST_FILES) break
          }
        }
      } catch (error) {
        if (error?.code !== 'EACCES' && error?.code !== 'EPERM') throw error
      }
    }
    return rows.sort((a, b) => b.modifiedAt - a.modifiedAt)
  }

  async downloadChunk(agent, request) {
    if (!Number.isSafeInteger(request.offset) || request.offset < 0 || !Number.isSafeInteger(request.length) || request.length < 1) throw new Error('下载偏移或长度无效')
    const root = await workspaceRoot(agent)
    const { actual, info } = await resolvedWorkspaceFile(root, request.relative)
    const start = Math.min(request.offset, info.size)
    const length = Math.min(request.length, CHUNK_BYTES, info.size - start)
    const handle = await open(actual, constants.O_RDONLY | (constants.O_NOFOLLOW || 0))
    try {
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buffer, 0, length, start)
      const nextOffset = start + bytesRead
      return {
        name: basename(actual),
        data: buffer.subarray(0, bytesRead).toString('base64'),
        total: info.size,
        nextOffset,
        eof: nextOffset >= info.size,
      }
    } finally {
      await handle.close()
    }
  }

  async workspaceInfo(agent) {
    const root = await workspaceRoot(agent)
    return {
      eligible: true,
      name: basename(root) || '当前工作区',
      path: root,
      canUpload: true,
      canDownload: true,
      reason: '财务资料与输出均限定在当前会话工作区内',
    }
  }

  async prepareTask(agent, request) {
    const root = await workspaceRoot(agent)
    const id = safeWorkflowId(request.id)
    const directory = join(root, '财务工作台', '内置工作流')
    const destination = join(directory, workflowSnapshotName(id))
    if (!isInside(root, destination)) throw new Error('工作流路径超出当前工作区')
    await checkedDirectory(root, directory, true)
    const temp = join(directory, `.${id}-${randomUUID()}.tmp`)
    const content = `# ${request.title}\n\n${request.content.trim()}\n`
    await writeFile(temp, content, { encoding: 'utf8', mode: 0o600 })
    try {
      await rename(temp, destination)
    } catch (error) {
      await unlink(temp).catch(() => {})
      throw error
    }
    const info = await stat(destination)
    return {
      relative: relative(root, destination).split(sep).join('/'),
      updatedAt: info.mtimeMs,
    }
  }

  async revealWorkspace(agent) {
    const root = await workspaceRoot(agent)
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open'
    await execFileAsync(command, [root], { timeout: 5000, windowsHide: true })
    return { opened: true, path: root }
  }
}

export function apply(ctx) {
  new FinanceFilesService(ctx)
  const manifest = {
    package: 'dsh-finance-workbench',
    face: 'host',
    schemas: [],
    model: {
      services: [{
        key: 'financeFiles',
        exportName: 'FinanceFilesService',
        description: 'Workspace-confined finance document upload, listing, reveal, and download service.',
        tags: [],
        members: FINANCE_FILE_INVOCATIONS.map(item => ({ kind: 'method', name: item.method, signature: `${item.method}(...)` })),
        types: [],
      }],
      events: [],
      objects: [],
    },
    invocations: FINANCE_FILE_INVOCATIONS,
  }
  ctx.effect(() => {
    const dispose = ctx.typert.register(manifest)
    return () => { void dispose() }
  }, 'dsh-finance-workbench: remote manifest')
}
