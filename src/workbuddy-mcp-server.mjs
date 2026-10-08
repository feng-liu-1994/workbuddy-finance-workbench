import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { VERSION } from './version.js'

const APP_URI = 'ui://workbuddy-finance-workbench/dashboard'
const APP_MIME = 'text/html;profile=mcp-app'
const currentDirectory = dirname(fileURLToPath(import.meta.url))
const widgetHtml = readFileSync(join(currentDirectory, 'widget.html'), 'utf8')

const server = new McpServer({ name: 'workbuddy-finance-workbench', version: VERSION })

server.registerTool('show_finance_workbench', {
  title: '打开 WorkBuddy 财务工作台',
  description: '打开完整的交互式财务工作台，包含总览、往来、核算、异常、月结、资料索引、备份和 25 个财务工作流。用户说“打开财务工作台”或需要财务控制面板时使用。',
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  _meta: { ui: { resourceUri: APP_URI } },
}, async () => ({
  content: [{ type: 'text', text: 'WorkBuddy 财务工作台已打开。终端环境会自动降级为本段文字；Web UI 会渲染完整交互界面。' }],
  structuredContent: { version: VERSION, modules: 20, workflows: 25, prompts: 25, mode: 'interactive-widget' },
  _meta: { ui: { resourceUri: APP_URI } },
}))

server.registerResource('finance-workbench-dashboard', APP_URI, {
  title: 'WorkBuddy 财务工作台',
  description: '本机运行的交互式财务工作台 Widget',
  mimeType: APP_MIME,
  _meta: {
    ui: {
      prefersBorder: false,
      permissions: {},
      csp: { resourceDomains: [], connectDomains: [] },
    },
  },
}, async () => ({
  contents: [{
    uri: APP_URI,
    text: widgetHtml,
    mimeType: APP_MIME,
    _meta: {
      ui: {
        prefersBorder: false,
        permissions: {},
        csp: { resourceDomains: [], connectDomains: [] },
      },
    },
  }],
}))

await server.connect(new StdioServerTransport())
