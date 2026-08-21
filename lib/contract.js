import { z } from 'zod'

const sessionIdSchema = z.string().min(1)
const relativeSchema = z.string().min(1).max(2000)
const fileInfoSchema = z.object({
  relative: relativeSchema,
  name: z.string().min(1),
  size: z.number().nonnegative(),
  modifiedAt: z.number().nonnegative(),
}).readonly()

const beginRequestSchema = z.object({
  name: z.string().min(1).max(255),
  relativePath: z.string().min(1).max(2000).optional(),
  size: z.number().int().nonnegative().max(50 * 1024 * 1024),
}).readonly()
const beginResultSchema = z.object({
  uploadId: z.string().min(8).max(100),
  relative: relativeSchema,
  chunkBytes: z.number().int().positive(),
}).readonly()
const chunkRequestSchema = z.object({
  uploadId: z.string().min(8).max(100),
  offset: z.number().int().nonnegative(),
  data: z.string().max(800000),
}).readonly()
const chunkResultSchema = z.object({ received: z.number().int().nonnegative() }).readonly()
const finishRequestSchema = z.object({ uploadId: z.string().min(8).max(100) }).readonly()
const listResultSchema = z.array(fileInfoSchema)
const downloadRequestSchema = z.object({
  relative: relativeSchema,
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive().max(512 * 1024),
}).readonly()
const downloadResultSchema = z.object({
  name: z.string().min(1),
  data: z.string(),
  total: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative(),
  eof: z.boolean(),
}).readonly()
const workspaceInfoSchema = z.object({
  eligible: z.boolean(),
  name: z.string().min(1),
  path: z.string().min(1),
  canUpload: z.literal(true),
  canDownload: z.literal(true),
  reason: z.string(),
}).readonly()
const revealWorkspaceResultSchema = z.object({
  opened: z.literal(true),
  path: z.string().min(1),
}).readonly()
const prepareTaskRequestSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).max(64),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(30000),
}).readonly()
const prepareTaskResultSchema = z.object({
  relative: relativeSchema,
  updatedAt: z.number().nonnegative(),
}).readonly()

function agentParameter() {
  return {
    name: 'agent',
    wire: 'agentId',
    source: 'lookup',
    lookup: 'agent',
    codec: {
      mode: 'strict',
      typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
      schema: sessionIdSchema,
    },
  }
}

function jsonParameter(name, schema, typeSymbol) {
  return {
    name,
    wire: name,
    source: 'json',
    codec: { mode: 'strict', typeSymbol, schema },
  }
}

function descriptor(method, requestSchema, resultSchema, resultSymbol) {
  const parameters = [agentParameter()]
  if (requestSchema) parameters.push(jsonParameter('request', requestSchema, `dsh-finance-workbench#${method}Request`))
  return {
    id: `dsh-finance-workbench#financeFiles/${method}`,
    service: 'financeFiles',
    namespace: 'financeFiles',
    method,
    invocation: { kind: 'direct' },
    parameters,
    result: { mode: 'strict', typeSymbol: resultSymbol, schema: resultSchema },
  }
}

export const FINANCE_FILE_INVOCATIONS = [
  descriptor('beginUpload', beginRequestSchema, beginResultSchema, 'dsh-finance-workbench#BeginUploadResult'),
  descriptor('uploadChunk', chunkRequestSchema, chunkResultSchema, 'dsh-finance-workbench#UploadChunkResult'),
  descriptor('finishUpload', finishRequestSchema, fileInfoSchema, 'dsh-finance-workbench#FileInfo'),
  descriptor('listFiles', null, listResultSchema, 'dsh-finance-workbench#FileInfo[]'),
  descriptor('workspaceInfo', null, workspaceInfoSchema, 'dsh-finance-workbench#WorkspaceInfo'),
  descriptor('revealWorkspace', null, revealWorkspaceResultSchema, 'dsh-finance-workbench#RevealWorkspaceResult'),
  descriptor('prepareTask', prepareTaskRequestSchema, prepareTaskResultSchema, 'dsh-finance-workbench#PrepareTaskResult'),
  descriptor('downloadChunk', downloadRequestSchema, downloadResultSchema, 'dsh-finance-workbench#DownloadChunkResult'),
]

export const TYPERT_REMOTE = {
  package: 'dsh-finance-workbench',
  descriptors: FINANCE_FILE_INVOCATIONS,
}
