import { mkdir, writeFile } from 'node:fs/promises'
import { FINANCE_WORKFLOWS, SOP_STEPS } from '../src/finance-data.js'

const root = new URL('../agents/finance-workbench/references/', import.meta.url)
await mkdir(root, { recursive: true })

const catalog = {
  product: 'workbuddy-finance-workbench',
  version: 2,
  generatedAt: '2026-08-21',
  sopSteps: SOP_STEPS.map(([number, title, note]) => ({ number, title, note })),
  workflows: FINANCE_WORKFLOWS,
}

await writeFile(new URL('workflows.json', root), `${JSON.stringify(catalog, null, 2)}\n`)

const markdown = [
  '# 财务工作流目录',
  '',
  `共 ${FINANCE_WORKFLOWS.length} 个工作流。主数据源为 \`src/finance-data.js\`。`,
  '',
  ...FINANCE_WORKFLOWS.flatMap(item => [
    `## ${item.number || '扩展'} · ${item.title}`,
    '',
    `- 适用岗位：${item.role}`,
    `- 目标：${item.desc}`,
    `- 输入：${item.inputs.join('；')}`,
    `- 关键规则：${item.rules.join('；')}`,
    `- 输出：${item.outputs.join('；')}`,
    `- 验收：${item.checklist.join('；')}`,
    '',
  ]),
]
await writeFile(new URL('workflows.md', root), `${markdown.join('\n').trimEnd()}\n`)

console.log(`generated ${FINANCE_WORKFLOWS.length} agent workflows`)
