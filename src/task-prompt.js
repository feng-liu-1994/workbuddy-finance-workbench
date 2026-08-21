export const FINANCE_PROFILE = `你是用户的财务执行助理。你要在当前工作区内完成真实文件处理，而不是只给方法说明。
通用口径：金额精确到分；日期统一为 YYYY-MM-DD；百分比保留两位小数；所有计算必须可追溯到源文件、源工作表和源行；无法确认的内容标注“需人工复核”，禁止猜测。OCR 结果不得直接作为入账或付款依据。`

export const CONTROL_PROTOCOL = `【执行闭环】
1. 自动选材：先理解当前对话中的目标、期间、主体和口径；优先读取已引用文件，再扫描“财务资料”及当前工作区中与任务名称、文件名和内容相关的资料。忽略无关文件，不要求用户重复描述已有信息。若资料不足，只集中询问一次完成任务所必需的缺项。
2. 执行预览：先给出字段映射、统一口径、异常规则、计算公式、拟生成文件及保存路径；涉及口径判断时等待我确认。
3. 文件处理：确认后只处理副本；输出到当前工作区“输出/财务工作台”子目录；绝不覆盖、移动或删除原件。
4. 质量复核：完成总笔数、金额合计、勾稽关系、重复值、缺失值和异常值检查，并执行专项核查清单。
5. 交付归档：保留原始输入、执行输出、复核说明和异常明细；在回复中给出实际生成文件的相对路径。`

function asLines(value) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean)
}

export function composeFinanceTask(scenario, { includeChecklist = true } = {}) {
  if (!scenario?.title || !scenario?.prompt) throw new Error('财务模块配置不完整')
  const inputs = asLines(scenario.inputs)
  const outputs = asLines(scenario.outputs)
  const checklist = asLines(scenario.checklist)
  const sections = [
    `【财务任务包】${scenario.title}`,
    FINANCE_PROFILE,
    `【所需资料】\n${inputs.map(item => `- ${item}`).join('\n')}`,
    `【交付成果】\n${outputs.map(item => `- ${item}`).join('\n')}`,
    CONTROL_PROTOCOL,
    `【模块执行指令】\n${scenario.prompt}`,
  ]
  if (scenario.variant) sections.push(`【可选扩展指令】\n${scenario.variant}\n仅在用户明确需要此扩展时执行。`)
  if (includeChecklist) sections.push(`【专项核查清单】\n${checklist.map(item => `- [ ] ${item}`).join('\n')}`)
  sections.push('【完成回报】\n不要只回复操作建议。完成后汇报：实际读取的文件、实际生成的文件、关键合计与勾稽结果、异常/待复核项、未完成事项及原因。')
  return sections.join('\n\n')
}

export function composeFinanceLaunch(scenario, workflowRelative, matchedFiles = []) {
  if (!scenario?.title || !workflowRelative) throw new Error('财务工作流配置不完整')
  const references = [workflowRelative, ...asLines(matchedFiles).slice(0, 8)]
    .map(value => `@${value}`)
    .join(' ')
  return `${references}\n请执行“${scenario.title}”。结合当前对话和已上传资料自动处理；缺少必要资料时一次性告诉我。`
}

export function mergeFinanceLaunchDraft(current, launch) {
  const existing = String(current || '').trim()
  if (!existing) return launch
  const isGeneratedTask = /【(?:教师|财务)任务包】|@财务工作台\/内置工作流\//.test(existing)
  return isGeneratedTask ? launch : `${existing}\n\n${launch}`
}
