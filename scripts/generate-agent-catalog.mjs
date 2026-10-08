import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { FINANCE_WORKFLOWS, SOP_STEPS } from '../src/finance-data.js'
import { composeFinanceTask } from '../src/task-prompt.js'

const root = new URL('../agents/finance-workbench/references/', import.meta.url)
const promptRoot = new URL('./prompts/', root)
await mkdir(root, { recursive: true })
await mkdir(promptRoot, { recursive: true })

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const catalog = {
  product: 'workbuddy-finance-workbench',
  version: 2,
  productVersion: pkg.version,
  generatedAt: pkg.releaseDate,
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
    `- 新手最少先准备：${item.minimumInputs.join('；')}`,
    `- 关键规则：${item.rules.join('；')}`,
    `- 输出：${item.outputs.join('；')}`,
    `- 验收：${item.checklist.join('；')}`,
    `- [查看并复制完整提示词](prompts/${item.number}-${item.id}.md)`,
    '',
  ]),
]
await writeFile(new URL('workflows.md', root), `${markdown.join('\n').trimEnd()}\n`)

const promptIndex = ['# 25 个财务工作流提示词', '', '每份提示词都可直接复制到 WorkBuddy、Codex、Claude Code 或其他支持文件处理的 AI 工具。新手填写区不清楚的项可留空，AI 会先识别现有资料并一次列出必需缺项。', '']
for (const item of FINANCE_WORKFLOWS) {
  const filename = `${item.number}-${item.id}.md`
  promptIndex.push(`- [${item.number} · ${item.title}](${filename}) — ${item.desc}`)
  const content = [
    `# ${item.number} · ${item.title}`,
    '',
    `适用岗位：${item.role}`,
    '',
    `新手起步：${item.beginnerTip}`,
    '',
    '复制以下全部内容到 AI 对话中：',
    '',
    '```text',
    composeFinanceTask(item),
    '```',
    '',
  ].join('\n')
  await writeFile(new URL(filename, promptRoot), content)
}
await writeFile(new URL('README.md', promptRoot), `${promptIndex.join('\n').trimEnd()}\n`)

console.log(`generated ${FINANCE_WORKFLOWS.length} agent workflows and ${FINANCE_WORKFLOWS.length} copy-ready prompts`)
