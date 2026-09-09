import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { TYPERT_REMOTE } from './contract.js'
import { FinanceDashboard } from './finance-dashboard.jsx'
import { FINANCE_DASHBOARD_STYLES } from './finance-dashboard-styles.js'
import { WORKBENCH_POLISH_CSS } from './workflow-tools.jsx'
import { fileKind, filterFiles, matchScenarioFiles, summarizeFiles } from './ui-helpers.js'
import { composeFinanceLaunch, composeFinanceTask, mergeFinanceLaunchDraft } from './task-prompt.js'

export const inject = ['sessions', 'workspaces', 'remote', 'slots', 'locale']
const CHUNK_BYTES = 512 * 1024
const MAX_BATCH_FILES = 500
const MAX_BATCH_BYTES = 500 * 1024 * 1024

const SCENARIOS = [
  {
    id: 'invoice',
    icon: 'receipt',
    title: '发票批量识别与报销',
    tag: '票据处理',
    desc: '识别、去重、分类并复核发票，生成可交付的报销工作簿',
    keywords: ['发票', '报销', 'invoice', 'receipt'],
    fileKinds: ['image', 'document', 'sheet'],
    color: '#2563eb',
    inputs: ['发票 PDF、JPG、PNG 或扫描件', '可选：报销申请单、费用分类规则、查验结果'],
    outputs: ['发票报销明细.xlsx：明细、费用分类汇总、重复/异常清单', '发票复核说明.md：文件覆盖范围、合计、疑点和人工复核项'],
    steps: ['上传发票及报销附件', '盘点文件并预览字段映射', '确认后生成工作簿', '复核合计、重复票与异常项'],
    checklist: ['每个源文件都有明细记录或失败说明', '发票代码+号码及号码+金额组合均已查重', '不含税金额+税额与价税合计逐行勾稽', '专票、大额票和识别不清项标注需人工查验', '明细合计与分类汇总及复核说明一致'],
    prompt: '识别相关发票文件并建立来源文件索引。逐张提取发票代码、号码、开票日期、不含税金额、税额、价税合计、销售方名称及纳税人识别号、购买方名称、发票类型、商品或服务摘要。以“发票代码+发票号码”为主键，并以“发票号码+价税合计+开票日期”为辅助规则查重。生成 Excel 工作簿：工作表“发票明细”按开票日期排序，金额两位小数、千分位、末行公式合计；工作表“费用分类汇总”按差旅费、办公费、业务招待费、通讯费和其他分类汇总；工作表“异常清单”列出重复票、字段缺失、金额勾稽不一致和 OCR 低置信度项目。所有疑点保留源文件名和页码或图片名。',
    variant: '在刚才的报销明细表基础上，新增一列"费用类别"，根据发票内容判断归类为：差旅费、办公用品、业务招待费、通讯费、其他，无法判断标注"待人工分类"。同时按费用类别做一个小计汇总表放在第二个工作表中。'
  },
  {
    id: 'bank-reconcile',
    icon: 'balance',
    title: '银行流水与账面核对',
    tag: '银企对账',
    desc: '以可解释的一对一规则匹配流水与账簿，完整保留未达项',
    keywords: ['银行', '流水', '账面', '对账', 'bank'],
    fileKinds: ['sheet', 'document'],
    color: '#7c3aed',
    inputs: ['银行流水 Excel/CSV（日期、收支方向、金额、对方、摘要）', '账面记录 Excel（记账日期、借贷方向、金额、凭证号、摘要）'],
    outputs: ['银行对账结果.xlsx：已匹配、银行未达、账面未达、疑似匹配、统计摘要', '对账复核说明.md：期初/本期/期末口径、匹配率和差异金额'],
    steps: ['上传银行流水与账面记录', '预览字段映射和日期容差', '执行唯一匹配与疑似匹配', '逐笔复核未达项并核对总额'],
    checklist: ['每条记录最多参与一次匹配', '收支方向和金额符号已统一', '银行笔数=已匹配+银行未达，账面笔数=已匹配+账面未达', '已匹配双方金额合计一致', '疑似匹配与大额未达项已单列，不自动认定'],
    prompt: '读取银行流水和账面记录，先识别列名并给出字段映射。统一日期、金额、收支方向和摘要文本后，以“金额相等+方向一致+日期差不超过2天”为基础规则做一对一匹配；同金额多笔时结合对方名称、摘要和凭证号评分，不能唯一确定的放入“疑似匹配”，不得强行匹配。生成 Excel 工作簿，包含“统计摘要”“已匹配”“银行未达”“账面未达”“疑似匹配”五个工作表；每条结果保留双方源文件、源工作表、源行号、匹配依据和日期差。未达项按绝对金额从大到小排序，并在复核说明中列出匹配率、各类笔数与金额合计。'
  },
  {
    id: 'multi-table',
    icon: 'merge',
    title: '多表合并与财务比率分析',
    tag: '合并分析',
    desc: '统一主体和科目口径，生成可追溯汇总表、指标与趋势图',
    keywords: ['报表', '科目', '合并', '利润', '资产负债', '现金流'],
    fileKinds: ['sheet'],
    color: '#059669',
    inputs: ['各主体或各期间的 Excel 报表', '可选：标准科目映射表、主体清单、分析期间'],
    outputs: ['合并分析底稿.xlsx：科目映射、清洗日志、合并明细、汇总和指标', '财务趋势简报.docx：图表、客观变化和异常提示'],
    steps: ['盘点主体、期间与报表结构', '确认科目映射和去重规则', '生成可追溯合并底稿', '计算指标并形成分析简报'],
    checklist: ['主体数、期间数和源文件数与盘点一致', '每项科目映射有来源和处理说明', '分主体合计与汇总合计勾稽一致', '比率公式、分母为零和缺失期间处理已说明', '分析只陈述数据事实，原因推断单列为待确认'],
    prompt: '读取相关 Excel 报表，识别主体、期间、币种、单位和科目层级。先生成科目差异与拟映射表，列出同义科目、疑似重复、单位差异和无法映射项，等待确认后再合并。生成 Excel 底稿，至少包含“源文件索引”“科目映射”“清洗日志”“合并明细”“主体汇总”“指标分析”；每条合并数据保留源文件、工作表和源行号。计算营业收入、营业成本、毛利率、期间费用率、净利率及可用的偿债指标，明确公式、单位和分母为零处理。生成趋势图和 Word 简报，正文区分数据事实、异常提示和待管理层确认事项。'
  },
  {
    id: 'contract',
    icon: 'contract',
    title: '合同付款条款提取',
    tag: '合同台账',
    desc: '定位条款原文，形成合同主表、付款计划和到期风险清单',
    keywords: ['合同', '协议', '付款', 'contract'],
    fileKinds: ['document'],
    color: '#dc2626',
    inputs: ['合同 PDF/Word 及补充协议', '可选：已付款台账、验收节点、开票记录'],
    outputs: ['合同付款台账.xlsx：合同主表、付款计划、待办与异常清单', '条款复核索引.md：原文页码/段落、置信度和待法务确认项'],
    steps: ['上传合同及补充协议', '定位金额、付款、验收和质保条款', '生成付款台账与到期清单', '翻回原文复核高风险条款'],
    checklist: ['主合同与补充协议关联正确', '合同总额与各期金额/比例可勾稽或已解释', '付款条件未被错误转换为确定日期', '每个关键字段保留页码或段落证据', '模糊、冲突和跨境/大额条款已标注需人工复核'],
    prompt: '逐份读取合同及补充协议，提取合同编号、签订日期、甲乙方、含税/不含税金额、税率、付款方式、每期金额或比例、付款条件、账期、开票要求、验收条件、质保金和违约条款。补充协议必须关联主合同并识别变更内容。生成 Excel 工作簿，包含“合同主表”“付款计划”“未来30天待办”“异常清单”；付款计划一行一期，保留合同文件名、原文页码或段落、原文摘录、提取置信度。条件式付款节点不得臆造日期；条款模糊、金额不勾稽或文本冲突时标注“需人工复核条款原文”。'
  },
  {
    id: 'report',
    icon: 'report',
    title: '月度/季度财务分析报告',
    tag: '管理报告',
    desc: '从三大报表生成带底稿、图表和异常清单的管理层报告',
    keywords: ['财务分析', '利润表', '资产负债表', '现金流量表', '预算'],
    fileKinds: ['sheet', 'document'],
    color: '#ea580c',
    inputs: ['利润表、资产负债表、现金流量表及上期/上年同期数据', '可选：预算表、管理层模板、指标口径说明'],
    outputs: ['财务分析底稿.xlsx：取数映射、指标公式、校验与图表数据', '财务分析报告.docx 与管理层汇报.pptx'],
    steps: ['确认主体、期间、币种与单位', '建立取数映射和报表勾稽', '生成指标、图表和异常分析', '渲染检查 Word/PPT 后交付'],
    checklist: ['三大报表期间、主体、币种和单位一致', '资产=负债+所有者权益，现金变动与现金流量表勾稽', '同比/环比基期、公式和异常阈值明确', '报告、PPT、图表和底稿中的数字一致', '未经材料支持的原因判断未写成事实'],
    prompt: '基于三大报表及可用的比较数据建立分析底稿，先确认主体、期间、币种、单位和比较口径。完成资产负债表平衡、现金及现金等价物变动等基础勾稽；计算收入、成本、毛利、净利润及同比/环比，分析变动超过10%的主要费用，计算资产负债率、流动比率、速动比率和经营现金流相关指标。生成 Excel 底稿、Word 报告和管理层 PPT；图表数据必须引用底稿，报告与 PPT 数字一致。结论用“数据显示”引导，只陈述材料支持的事实；业务原因放入“待管理层确认”。报告末尾保留“财务部补充说明”。交付前渲染检查 Word 与 PPT 的分页、字体、表格和图表。'
  },
  {
    id: 'automation',
    icon: 'automation',
    title: '定时任务自动化',
    tag: '周期任务',
    desc: '把月结、付款到期和周报做成可试运行、可追溯的本地任务',
    keywords: ['月结', '付款计划', '报销', '审批', '周报', '任务'],
    fileKinds: ['sheet', 'document'],
    color: '#0891b2',
    inputs: ['月结清单、付款计划表、报销/审批台账', '运行频率、时区、提醒对象和异常阈值'],
    outputs: ['自动化配置表.xlsx 与任务说明.md', '可运行的本地任务脚本/配置、试运行结果和日志目录'],
    steps: ['确认数据源、频率与提醒边界', '生成低风险任务和日志机制', '以演练模式运行并核对结果', '确认后再启用正式调度'],
    checklist: ['任务只做读取、汇总、提醒或草稿生成', '没有自动付款、自动审批、自动删除或覆盖原件', '每次运行记录时间、输入、输出、状态和错误', '数据源缺失或格式变化时安全停止并提示', '正式启用前已经完成一次可复核试运行'],
    prompt: '将月结提醒、合同/付款到期提醒和周报汇总设计为当前电脑可运行的本地自动化。先识别可用数据源与运行环境，形成任务配置表：任务名、数据源、频率、时区、筛选规则、输出、提醒对象、失败处理。实现时默认演练模式，只读取源文件并把结果写入“输出/财务工作台/自动化”，生成结构化日志。月结任务列出待归集科目、暂估和遗留未达项；到期任务扫描付款计划并列出未来7天事项；周报任务汇总上周报销额、审批中金额和异常大额支出。完成一次实际试运行并报告结果；在我明确确认前不要启用系统级定时调度。'
  },
  {
    id: 'remote',
    icon: 'remote',
    title: '财务制度知识库与远程协同',
    tag: '制度问答',
    desc: '整理制度证据库，生成有出处的问答与受控远程处理流程',
    keywords: ['制度', '办法', '规定', '流程', 'faq', '报销标准'],
    fileKinds: ['document', 'sheet'],
    color: '#4f46e5',
    inputs: ['费用报销、差旅、采购、合同、付款等现行制度文件', '可选：历史 FAQ、审批流程、岗位权限和远程协同渠道'],
    outputs: ['财务制度索引.xlsx 与财务问答库.md', '远程协同SOP.md：权限边界、确认节点、回传与审计要求'],
    steps: ['盘点制度版本与适用范围', '切分条款并建立出处索引', '生成可追溯问答与冲突清单', '建立只读优先的远程协同流程'],
    checklist: ['每条回答都有制度名称、版本日期和条款出处', '过期、冲突或缺失制度不作确定回答', '远程请求不扩大本地权限且关键动作再次确认', '敏感文件不通过未授权渠道外发', '对外回复前复核数字、附件和收件人'],
    prompt: '读取现行财务制度文件，建立制度索引：文件名、版本日期、生效状态、适用主体、主题、条款位置和冲突/过期状态。生成财务问答库，覆盖报销标准、差旅、采购、合同、付款、发票和审批；每个答案必须引用具体制度和条款位置，材料不足时回答“制度依据不足，需财务确认”。另生成远程协同 SOP，明确可远程执行的只读查询、汇总和草稿任务，列出必须二次确认的写入/发送动作、禁止事项、身份核验、结果回传和审计留痕。不要声称已经接入任何外部聊天平台；若要配置连接，先列出所需授权和风险并等待确认。'
  },
  {
    id: 'salary',
    icon: 'salary',
    title: '工资表整理与社保核对',
    tag: '薪酬核验',
    desc: '以工号为主键核对人员、字段与基数变化，敏感数据最小化',
    keywords: ['工资', '薪酬', '社保', '个税', '考勤', '代发'],
    fileKinds: ['sheet', 'document'],
    color: '#db2777',
    inputs: ['考勤汇总、社保基数、个税扣除、银行代发名单', '可选：上期基数表、人员主数据、字段脱敏规则'],
    outputs: ['薪酬社保核对.xlsx：名单差异、字段差异、基数变化、异常清单', '敏感数据处理说明.md：读取字段、脱敏与未使用字段'],
    steps: ['确认最小必要字段和脱敏范围', '以工号核对四表人员名单', '检查姓名与基数变化', '输出异常清单并清理临时副本'],
    checklist: ['仅使用完成核对所必需的人员字段', '工号唯一性和重复工号已检查', '四表人数与差异人数可勾稽', '基数变化的前期、当期和变化率公式正确', '未把名单核对扩展为未经授权的工资计算'],
    prompt: '在最小必要原则下读取考勤、社保、个税和银行代发表，优先只使用员工工号、姓名、状态及核对所需字段；身份证号、银行卡号等字段默认不展示。检查每张表的工号唯一性，以员工工号为主键做全外连接，生成“名单差异”“姓名/状态差异”“社保基数变化”“重复与异常”工作表。名单差异注明缺失在哪些来源；姓名不一致同时保留各来源原值；社保基数变化显示前期、当期、差额和变化率，并处理前期为零或缺失的情况。不要执行工资核算、付款或外发。临时输出不得包含无关敏感字段，并在处理说明中列出实际读取字段。'
  },
]

const TYPE_LABELS = { all: '全部', document: '文档', sheet: '表格', slides: '演示', image: '图片', other: '其他' }

function Icon({ name, size = 18 }) {
  const paths = {
    receipt: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/></>,
    balance: <><path d="M12 3v18M3 7l9-4 9 4M5 11v4c0 2.2 3.6 4 7 4s7-1.8 7-4v-4"/></>,
    merge: <><path d="M8 3v6a4 4 0 0 0 8 0V3"/><path d="M4 7h4a4 4 0 0 1 0 8H4"/><path d="M20 7h-4a4 4 0 0 0 0 8h4"/><path d="M8 21v-6a4 4 0 0 1 8 0v6"/></>,
    contract: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
    automation: <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></>,
    remote: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    salary: <><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    workbench: <><path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4M8 9h8M8 12h5"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/></>,
    search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 9M6 15a7 7 0 0 0 12 2l2-2"/></>,
    download: <><path d="M12 4v11M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></>,
    folder: <><path d="M3 6h7l2 2h9v11H3z"/><path d="M3 10h18"/></>,
    pin: <><path d="M7 4h10l-1 5 3 3H5l3-3z"/><path d="M12 12v8"/></>,
    backup: <><path d="M4 7h16v13H4zM8 3h8v4"/><path d="M8 12h8M8 16h5"/></>,
    trash: <><path d="M5 7h14M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    chevron: <path d="m8 10 4 4 4-4"/>,
    check: <path d="M5 12l5 5L19 7"/>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    warning: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    arrow: <><path d="M5 12h14M12 5l7 7-7 7"/></>,
    star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>,
    workflow: <><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="5" cy="18" r="2"/><path d="M7 6h10M19 8v8M17 18H7M5 16V8"/></>,
  }
  return <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.file}</svg>
}

function UploadMenu({ onFile, onFolder, label = '上传文件或文件夹', disabled = false, compact = false }) {
  const host = useRef(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (!host.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const choose = action => { setOpen(false); action() }
  return <span ref={host} className={`dfinance_uploadMenu ${compact ? 'is-compact' : ''}`}>
    <button className="dfinance_uploadTrigger" type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><Icon name="upload" size={compact ? 16 : 18}/><span>{label}</span><Icon name="chevron" size={14}/></button>
    {open && <span className="dfinance_uploadPopover" role="menu"><button type="button" role="menuitem" onClick={() => choose(onFile)}><Icon name="file" size={17}/><span><strong>选择文件</strong><small>可一次选择多个文件</small></span></button><button type="button" role="menuitem" onClick={() => choose(onFolder)}><Icon name="folder" size={17}/><span><strong>选择文件夹</strong><small>保留内部目录层级</small></span></button></span>}
  </span>
}

function unwrap(result, action) {
  if (!result?.ok) throw new Error(result?.error?.message || `${action}失败`)
  return result.value
}

function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary)
}

function base64ToBytes(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function uploadPath(file) {
  return file.webkitRelativePath || file.name
}

function validateUploadSelection(files) {
  if (!files.length) throw new Error('没有选择可上传的文件；空文件夹无法上传')
  if (files.length > MAX_BATCH_FILES) throw new Error(`一次最多上传 ${MAX_BATCH_FILES} 个文件`)
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > MAX_BATCH_BYTES) throw new Error('一次上传总容量不能超过 500 MB')
  return total
}

function uploadReferences(uploaded, files) {
  const folderMode = files.some(file => Boolean(file.webkitRelativePath))
  if (!folderMode) return uploaded.map(item => item.relative)
  return [...new Set(uploaded.map(item => item.relative.split('/').slice(0, 2).join('/')))]
}

async function uploadOne(remote, sessionId, file, onProgress) {
  const relativePath = file.webkitRelativePath || undefined
  const begin = unwrap(await remote.beginUpload(sessionId, { name: file.name, relativePath, size: file.size }), '开始上传')
  let offset = 0
  while (offset < file.size) {
    const data = bytesToBase64(await file.slice(offset, Math.min(offset + begin.chunkBytes, file.size)).arrayBuffer())
    offset = unwrap(await remote.uploadChunk(sessionId, { uploadId: begin.uploadId, offset, data }), '上传分块').received
    onProgress?.(offset / Math.max(1, file.size))
  }
  return unwrap(await remote.finishUpload(sessionId, { uploadId: begin.uploadId }), '完成上传')
}

async function downloadOne(remote, sessionId, relative) {
  let offset = 0
  let name = relative.split('/').pop() || 'download'
  const chunks = []
  for (;;) {
    const part = unwrap(await remote.downloadChunk(sessionId, { relative, offset, length: CHUNK_BYTES }), '下载文件')
    name = part.name
    chunks.push(base64ToBytes(part.data))
    offset = part.nextOffset
    if (part.eof) break
  }
  saveBlob(new Blob(chunks, { type: 'application/octet-stream' }), name)
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function SessionBridge({ sessionId, input, inputActions, controller }) {
  useEffect(() => {
    const bridge = { sessionId, input, inputActions }
    controller.setBridge(bridge)
    return () => controller.clearBridge(bridge)
  }, [controller, sessionId, input, inputActions])
  return null
}

function FinancePanel({ sessionId, input, inputActions, remote, onClose, isOpen }) {
  const picker = useRef(null)
  const folderPicker = useRef(null)
  const [files, setFiles] = useState([])
  const [workspace, setWorkspace] = useState({ eligible: false, name: '当前工作区', path: '', canUpload: true, canDownload: true, reason: '' })
  const [status, setStatus] = useState('正在读取资料…')
  const [launching, setLaunching] = useState(false)

  useEffect(() => { setLaunching(false) }, [sessionId])

  const refresh = async () => {
    try {
      setStatus('正在读取资料…')
      const info = unwrap(await remote().workspaceInfo(sessionId), '读取工作区信息')
      setWorkspace(info)
      const value = unwrap(await remote().listFiles(sessionId), '读取文件列表')
      setFiles(value)
      setStatus(value.length ? `已找到 ${value.length} 个可用文件` : '还没有上传财务资料')
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) }
  }
  useEffect(() => { if (isOpen) void refresh() }, [sessionId, isOpen])
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('keydown', escape) }
  }, [onClose])

  const appendDraft = text => {
    const current = input?.draft?.trimEnd() || ''
    inputActions.setDraft(`${current}${current ? '\n\n' : ''}${text}`)
  }
  const uploadFiles = async selected => {
    try {
      validateUploadSelection(selected)
      for (const [index, file] of selected.entries()) {
        const label = uploadPath(file)
        setStatus(`上传 ${index + 1}/${selected.length} · ${label}`)
        await uploadOne(remote(), sessionId, file, ratio => setStatus(`上传 ${index + 1}/${selected.length} · ${Math.round(ratio * 100)}%`))
      }
      await refresh()
      setStatus(`已上传 ${selected.length} 个文件`)
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) }
  }
  const openWorkspace = async () => {
    try {
      unwrap(await remote().revealWorkspace(sessionId), '打开当前工作区')
      setStatus('已在 Finder 打开')
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) }
  }
  const launchScenario = async scenario => {
    if (launching) return
    try {
      setLaunching(true)
      setStatus('正在准备内置工作流…')
      const workflow = unwrap(await remote().prepareTask(sessionId, {
        id: scenario.id,
        title: scenario.title,
        content: composeFinanceTask(scenario),
      }), '准备内置工作流')
      const matched = matchScenarioFiles(files, scenario).map(file => file.relative)
      const launch = composeFinanceLaunch(scenario, workflow.relative, matched)
      inputActions.setDraft(mergeFinanceLaunchDraft(input?.draft, launch))
      onClose()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setLaunching(false)
    }
  }
  const referenceFile = file => { appendDraft(`@${file.relative}`); setStatus(`已引用 ${file.name}`) }
  const downloadFile = async file => { try { setStatus(`正在下载 ${file.name}…`); await downloadOne(remote(), sessionId, file.relative); setStatus(`已开始下载 ${file.name}`) } catch (error) { setStatus(error instanceof Error ? error.message : String(error)) } }

  return <>
    <FinanceDashboard sessionId={sessionId} files={files} workspace={workspace} status={status} onStatus={setStatus} onRefresh={() => void refresh()} onOpenWorkspace={() => void openWorkspace()} onChooseFiles={() => picker.current?.click()} onChooseFolder={() => folderPicker.current?.click()} onUploadFiles={selected => void uploadFiles(selected)} onReferenceFile={referenceFile} onDownloadFile={file => void downloadFile(file)} onLaunchWorkflow={scenario => void launchScenario(scenario)} launching={launching} onClose={onClose}/>
    <input ref={picker} type="file" multiple hidden onChange={event => { const selected = [...(event.target.files || [])]; event.target.value = ''; void uploadFiles(selected) }}/>
    <input ref={folderPicker} type="file" multiple webkitdirectory="" directory="" hidden onChange={event => { const selected = [...(event.target.files || [])]; event.target.value = ''; void uploadFiles(selected) }}/>
  </>
}

function createFinanceController() {
  let snapshot = { open: new URLSearchParams(window.location.search).get('workbench') === 'finance', bridge: undefined }
  const listeners = new Set()
  const publish = next => { snapshot = next; for (const listener of listeners) listener() }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    setBridge: bridge => publish({ ...snapshot, bridge }),
    clearBridge: bridge => { if (snapshot.bridge === bridge) publish({ ...snapshot, bridge: undefined }) },
    toggle: () => publish({ ...snapshot, open: !snapshot.open }),
    close: () => { if (snapshot.open) publish({ ...snapshot, open: false }) },
  }
}

function FinanceSurface({ controller, remote }) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  if (!snapshot.bridge) return <div className="dfinance_unavailable"><Icon name="workbench" size={30}/><h2>财务工作台</h2><p>请先打开一个会话或新会话，再使用财务工作台。</p><button type="button" onClick={controller.close}>返回对话</button></div>
  return <FinancePanel {...snapshot.bridge} remote={remote} onClose={controller.close} isOpen={snapshot.open}/>
}

function sidebarRoot() {
  const column = document.querySelector('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (!column) return undefined
  return column.querySelector('[class*="logoRow"]')?.parentElement || column.firstElementChild || undefined
}

function newSessionBase(root) {
  const button = root.querySelector('button[class*="newSession"]')
  if (button) return button.closest('[class*="logoRow"]') || button
  return [...root.children].find(child => child.tagName === 'BUTTON')
}

function mountSidebarEntry(controller) {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshFinanceEntry = ''
  entry.className = 'dfinance_sidebarEntry'
  entry.setAttribute('aria-label', '财务工作台')
  entry.innerHTML = '<span class="dfinance_sidebarIcon"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.5" width="12" height="9" rx="1.5"/><path d="M5 14h6M8 11.5V14M5 6h6M5 8.5h4"/></svg></span><span class="dfinance_sidebarLabel">财务工作台</span>'
  entry.addEventListener('click', controller.toggle)
  const place = () => {
    const root = sidebarRoot()
    if (!root) return
    const taskboard = root.querySelector(':scope > [data-dsh-taskboard-entry]')
    const ssh = root.querySelector(':scope > [data-dsh-ssh-entry]')
    const teacher = root.querySelector(':scope > [data-dsh-teacher-entry]')
    const base = newSessionBase(root)
    if (teacher) {
      if (teacher.nextElementSibling !== entry) teacher.after(entry)
    } else if (taskboard) {
      if (taskboard.nextElementSibling !== entry) taskboard.after(entry)
    } else if (ssh) {
      if (entry.nextElementSibling !== ssh || entry.parentElement !== root) root.insertBefore(entry, ssh)
    } else if (base && (entry.parentElement !== root || base.nextElementSibling !== entry)) {
      base.after(entry)
    }
  }
  const observer = new MutationObserver(place)
  observer.observe(document.body, { childList: true, subtree: true })
  const sync = () => { if (controller.getSnapshot().open) entry.dataset.active = 'true'; else delete entry.dataset.active }
  const unsubscribe = controller.subscribe(sync)
  place(); sync()
  return () => { observer.disconnect(); unsubscribe(); entry.remove() }
}

function mountEmbeddedView(controller, remote) {
  let container
  let root
  let suppressPanelEvent = false
  const ensure = () => {
    if (container?.isConnected) return
    const column = document.querySelector('[data-pane="conversation"], [class*="centerCol"]')
    if (!column) return
    container = document.createElement('div')
    container.dataset.dshFinanceView = ''
    column.appendChild(container)
    root = createRoot(container)
    root.render(<FinanceSurface controller={controller} remote={remote}/>)
  }
  const observer = new MutationObserver(ensure)
  observer.observe(document.body, { childList: true, subtree: true })
  const sync = () => {
    ensure()
    if (controller.getSnapshot().open) {
      suppressPanelEvent = true
      document.documentElement.removeAttribute('data-dsh-taskboard-active')
      document.documentElement.removeAttribute('data-dsh-ssh-active')
      document.documentElement.removeAttribute('data-dsh-teacher-active')
      document.documentElement.removeAttribute('data-dsh-skill-explorer-active')
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'ssh' }))
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'taskboard' }))
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'teacher' }))
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'skill-explorer' }))
      suppressPanelEvent = false
      document.documentElement.setAttribute('data-dsh-finance-active', '')
      document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'finance' }))
    } else document.documentElement.removeAttribute('data-dsh-finance-active')
  }
  const onOtherPanel = event => { if (!suppressPanelEvent && event.detail !== 'finance') controller.close() }
  const onSidebarConversation = event => {
    if (!controller.getSnapshot().open) return
    if (event.target?.closest?.('[class*="sessionRow"], [class*="projectRow"], [class*="newSession"], [class*="searchResultRow"]')) controller.close()
  }
  document.addEventListener('dsh-panel-activate', onOtherPanel)
  document.addEventListener('click', onSidebarConversation, true)
  const unsubscribe = controller.subscribe(sync)
  ensure(); sync()
  return () => {
    observer.disconnect(); unsubscribe()
    document.removeEventListener('dsh-panel-activate', onOtherPanel)
    document.removeEventListener('click', onSidebarConversation, true)
    document.documentElement.removeAttribute('data-dsh-finance-active')
    root?.unmount(); container?.remove()
  }
}

function adoptStyles() {
  if (document.querySelector('style[data-dsh-finance-workbench]')) return
  const style = document.createElement('style')
  style.dataset.dshFinanceWorkbench = '1'
  style.textContent = `
.dfinance_inlineUploads{display:inline-flex;align-items:center;gap:3px}.dfinance_inlineUpload{border:0;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);cursor:pointer;padding:6px 10px;font:600 12px/1.2 var(--dsw-font-family);display:inline-flex;align-items:center;gap:6px}.dfinance_inlineUpload:hover{color:var(--dsw-alias-label-primary)}.dfinance_inlineUpload.is-folder{padding-left:8px;padding-right:8px}.dfinance_inlineUpload:disabled{opacity:.62;cursor:wait}
.dfinance_dock{position:fixed;z-index:1000002;left:16px;top:130px;width:158px;min-height:44px;border:1px solid #ffffff6b;border-radius:14px;background:linear-gradient(135deg,#059669,#10b981);color:white;box-shadow:0 10px 28px #0596694a;display:flex;align-items:center;gap:9px;padding:7px 10px;cursor:pointer;text-align:left;transition:.2s transform,.2s box-shadow}.dfinance_dock:hover{transform:translateY(-1px);box-shadow:0 13px 34px #05966965}.dfinance_dockIcon{width:30px;height:30px;border-radius:9px;background:#ffffff26;display:grid;place-items:center}.dfinance_dock strong,.dfinance_dock small{display:block}.dfinance_dock strong{font-size:13px}.dfinance_dock small{font-size:10px;opacity:.78;margin-top:2px}
.dfinance_backdrop{position:fixed;inset:0;z-index:1000005;background:linear-gradient(115deg,#022c228f,#064e3b59);backdrop-filter:blur(9px);padding:16px;box-sizing:border-box}.dfinance_panel{position:absolute;top:16px;left:16px;width:min(1160px,calc(100vw - 32px));height:min(820px,calc(100vh - 32px));box-sizing:border-box;overflow:hidden;border:1px solid #ffffff80;border-radius:24px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,#ecfdf5);color:var(--dsw-alias-label-primary);box-shadow:0 30px 100px #022c1a70;display:flex;flex-direction:column;font-family:var(--dsw-font-family,system-ui)}
.dfinance_header{padding:18px 20px 14px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(110deg,#059669 0%,#10b981 65%,#34d399 100%);color:#fff}.dfinance_brand{display:flex;align-items:center;gap:12px}.dfinance_brand>span{width:42px;height:42px;border-radius:13px;background:#ffffff24;display:grid;place-items:center;border:1px solid #ffffff38}.dfinance_brand h2{font-size:20px;margin:0;letter-spacing:.2px}.dfinance_brand p{font-size:11px;margin:4px 0 0;opacity:.78}.dfinance_close{border:0;background:#ffffff1f;color:white;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;cursor:pointer}.dfinance_close:hover{background:#ffffff35}
.dfinance_tabs{padding:0 20px;display:flex;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}.dfinance_tabs button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:13px 16px;font-weight:650;cursor:pointer;border-bottom:2px solid transparent}.dfinance_tabs button.is-active{color:#059669;border-bottom-color:#059669}.dfinance_status{min-height:34px;padding:0 20px;display:flex;align-items:center;gap:7px;font-size:11px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}.dfinance_statusDot{width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 0 3px #10b98120;flex:none}.dfinance_statusDot.is-warning{background:#e8a126;box-shadow:0 0 0 3px #e8a12620}.dfinance_statusDot.is-neutral{background:#4e86df;box-shadow:0 0 0 3px #4e86df20}.dfinance_statusText{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dfinance_statusActions{margin-left:auto;display:flex;gap:4px}.dfinance_statusActions button{border:0;border-radius:7px;background:transparent;color:inherit;display:flex;gap:4px;align-items:center;cursor:pointer;padding:5px 7px;white-space:nowrap}.dfinance_statusActions button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.dfinance_statusActions button:disabled{opacity:.38;cursor:not-allowed}
.dfinance_body{flex:1;min-height:0;overflow:auto;padding:18px 20px}.dfinance_hero{border-radius:18px;padding:22px 24px;color:white;background:linear-gradient(115deg,#0f3d37,#0f766e 62%,#0d9488);display:flex;align-items:center;justify-content:space-between;gap:18px;overflow:hidden;position:relative}.dfinance_hero:after{content:'';position:absolute;right:-60px;top:-85px;width:230px;height:230px;border-radius:50%;background:#ffffff12}.dfinance_hero h3{font-size:22px;margin:7px 0}.dfinance_hero p{margin:0;font-size:12px;opacity:.8}.dfinance_eyebrow{font-size:11px;padding:4px 8px;background:#ffffff1f;border-radius:99px}.dfinance_heroStats{display:flex;gap:10px;z-index:1;flex-wrap:wrap;justify-content:flex-end}.dfinance_statCard{border:1px solid #ffffff30;background:#ffffff15;border-radius:12px;padding:12px 16px;text-align:center;min-width:60px}.dfinance_statCard strong{font-size:22px;display:block}.dfinance_statCard span{font-size:10px;opacity:.8;display:block;margin-top:2px}.dfinance_getStarted{display:grid;grid-template-columns:minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr) 18px minmax(0,1fr);align-items:center;margin:14px 0 12px;padding:10px 13px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}.dfinance_getStarted>div{display:flex;align-items:center;gap:9px;min-width:0}.dfinance_getStarted>div>span{width:25px;height:25px;flex:none;border-radius:8px;background:#ccfbf1;color:#0f766e;display:grid;place-items:center;font-size:10px;font-weight:750}.dfinance_getStarted p,.dfinance_getStarted strong,.dfinance_getStarted small{display:block;margin:0}.dfinance_getStarted p{min-width:0}.dfinance_getStarted strong{font-size:10px}.dfinance_getStarted small{font-size:8px;color:var(--dsw-alias-label-tertiary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dfinance_getStarted i{height:1px;background:linear-gradient(90deg,#5eead466,#5eead41a);margin:0 3px}.dfinance_scenarioGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dfinance_scenarioCard{position:relative;min-height:130px;border:1px solid var(--dsw-alias-border-l2);border-radius:15px;background:linear-gradient(145deg,var(--dsw-alias-bg-base),var(--dsw-alias-bg-layer-1));color:inherit;text-align:left;padding:14px;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;align-items:flex-start;transition:all .15s}.dfinance_scenarioCard:hover{border-color:var(--scenario-color);box-shadow:0 8px 24px color-mix(in srgb,var(--scenario-color) 16%,transparent);transform:translateY(-1px)}.dfinance_scenarioIcon{width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--scenario-color) 15%,transparent);color:var(--scenario-color);display:grid;place-items:center;flex:none}.dfinance_scenarioContent{flex:1;min-width:0;margin-top:10px}.dfinance_scenarioTag{font-size:9px;color:var(--scenario-color);background:color-mix(in srgb,var(--scenario-color) 12%,transparent);padding:3px 7px;border-radius:99px}.dfinance_scenarioCard strong,.dfinance_scenarioCard small{display:block}.dfinance_scenarioCard strong{font-size:13px;margin:6px 0 3px}.dfinance_scenarioCard small{font-size:9px;color:var(--dsw-alias-label-secondary);line-height:1.4}.dfinance_scenarioCard svg{position:absolute;right:12px;bottom:12px;opacity:.4;transition:opacity .15s,transform .15s}.dfinance_scenarioCard:hover svg{opacity:.8;transform:translateX(2px)}
.dfinance_scenarioDetail{display:flex;flex-direction:column;gap:14px}.dfinance_backBtn{border:0;background:transparent;color:#059669;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:5px;padding:0}.dfinance_backBtn:hover{text-decoration:underline}.dfinance_scenarioHeader{border-radius:16px;padding:18px 20px;color:white;display:flex;align-items:center;gap:14px}.dfinance_scenarioHeader .dfinance_scenarioIcon{background:#ffffff24;border:1px solid #ffffff38}.dfinance_scenarioHeader h3{font-size:18px;margin:6px 0 3px}.dfinance_scenarioHeader p{margin:0;font-size:11px;opacity:.8}.dfinance_scenarioBody{display:flex;flex-direction:column;gap:12px}.dfinance_section{border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-base);padding:14px 16px}.dfinance_section h4{font-size:13px;margin:0 0 10px;display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-primary)}.dfinance_section h4 svg{color:#059669}.dfinance_steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}.dfinance_steps li{display:flex;align-items:flex-start;gap:10px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}.dfinance_stepNum{width:20px;height:20px;border-radius:50%;background:#d1fae5;color:#047857;display:grid;place-items:center;font-size:9px;font-weight:700;flex:none;margin-top:1px}.dfinance_checklist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.dfinance_checklist li{display:flex;align-items:flex-start;gap:8px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}.dfinance_checklist li svg{color:#10b981;flex:none;margin-top:2px}.dfinance_promptBox{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:12px 14px;overflow-x:auto}.dfinance_promptBox pre{margin:0;font-size:10.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family,system-ui)}.dfinance_promptBox.is-variant{border-color:#05966940;background:color-mix(in srgb,#ecfdf5 50%,var(--dsw-alias-bg-layer-1))}.dfinance_scenarioActions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}.dfinance_actionBtn{border:0;border-radius:10px;padding:9px 14px;font-weight:650;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:11px;transition:all .14s}.dfinance_actionPrimary{background:#059669;color:white}.dfinance_actionPrimary:hover{background:#047857}.dfinance_actionSecondary{background:#d1fae5;color:#047857;border:1px solid #6ee7b7}.dfinance_actionSecondary:hover{background:#a7f3d0}.dfinance_actionTertiary{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2)}.dfinance_actionTertiary:hover{background:var(--dsw-alias-bg-layer-1)}
.dfinance_workspaceBanner{display:flex;align-items:center;gap:10px;border:1px solid #05966933;border-radius:12px;background:linear-gradient(120deg,#ecfdf5,var(--dsw-alias-bg-base));padding:10px 12px;margin-bottom:10px}.dfinance_workspaceBanner>span{width:34px;height:34px;border-radius:9px;background:#d1fae5;color:#047857;display:grid;place-items:center}.dfinance_workspaceBanner>div{min-width:0;flex:1}.dfinance_workspaceBanner strong,.dfinance_workspaceBanner small{display:block}.dfinance_workspaceBanner strong{font-size:12px}.dfinance_workspaceBanner small{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}.dfinance_workspaceBanner em{font-size:9px;font-style:normal;color:#33734e;background:#eaf7ef;padding:4px 7px;border-radius:99px}.dfinance_workspaceBanner button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 10px;cursor:pointer;font-size:10px}.dfinance_dropzone{border:1.5px dashed #34d399;border-radius:15px;background:#ecfdf599;padding:14px 18px;display:flex;align-items:center;gap:12px;color:#047857;transition:.15s}.dfinance_dropzone.is-dragging{background:#d1fae5;transform:scale(.997)}.dfinance_dropzone div{flex:1}.dfinance_dropzone strong,.dfinance_dropzone span{display:block}.dfinance_dropzone strong{font-size:13px}.dfinance_dropzone span{font-size:10px;margin-top:3px;opacity:.7}.dfinance_dropzone button,.dfinance_sessionCard button{border:0;border-radius:10px;background:#059669;color:white;padding:9px 13px;font-weight:650;cursor:pointer}.dfinance_filters{display:flex;gap:8px;margin:13px 0 8px}.dfinance_filters label{flex:1;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);display:flex;align-items:center;gap:8px;padding:0 11px}.dfinance_filters input{width:100%;border:0;outline:0;background:transparent;color:inherit;padding:9px 0}.dfinance_filters select{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);color:inherit;padding:0 10px;max-width:190px}.dfinance_typeFilters{display:flex;gap:6px;flex-wrap:wrap}.dfinance_typeFilters button{border:1px solid var(--dsw-alias-border-l2);border-radius:99px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);padding:6px 10px;cursor:pointer}.dfinance_typeFilters button.is-active{background:#059669;color:white;border-color:#059669}.dfinance_typeFilters small{margin-left:5px;opacity:.7}.dfinance_fileHeading{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:var(--dsw-alias-label-tertiary);margin:10px 2px 6px}.dfinance_fileList{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:auto;background:var(--dsw-alias-bg-base)}.dfinance_fileRow{display:flex;align-items:center;gap:9px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);transition:background .14s}.dfinance_fileRow:hover{background:var(--dsw-alias-bg-layer-1)}.dfinance_fileRow:last-child{border-bottom:0}.dfinance_fileType{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#d1fae5;color:#047857}.dfinance_fileType.is-sheet{background:#e8f8ef;color:#24905a}.dfinance_fileType.is-slides{background:#fff0e8;color:#d66c25}.dfinance_fileType.is-image{background:#f5ebff;color:#8b4dc0}.dfinance_fileText{min-width:0;flex:1}.dfinance_fileText strong,.dfinance_fileText small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dfinance_fileText strong{font-size:11px}.dfinance_fileText small{font-size:9px;color:var(--dsw-alias-label-tertiary);margin-top:2px}.dfinance_fileRow button{border:0;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:inherit;padding:6px 8px;display:flex;align-items:center;gap:4px;cursor:pointer;font-size:10px}.dfinance_empty{padding:30px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}.dfinance_guard{max-width:620px;margin:8vh auto;text-align:center;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-base);padding:38px 28px}.dfinance_guard>span{width:58px;height:58px;border-radius:17px;background:#fff3dc;color:#c47d16;display:grid;place-items:center;margin:0 auto}.dfinance_guard h3{margin:16px 0 7px;font-size:18px}.dfinance_guard p{margin:0 auto 18px;max-width:480px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.7}
.dfinance_guide{display:flex;flex-direction:column;gap:14px}.dfinance_guideHero{display:flex;align-items:center;gap:14px;border-radius:16px;padding:18px 20px;color:white;background:linear-gradient(115deg,#047857,#10b981)}.dfinance_guideHero>div:first-child{width:48px;height:48px;border-radius:14px;background:#ffffff24;display:grid;place-items:center;flex:none}.dfinance_guideHero h3{font-size:17px;margin:5px 0 2px}.dfinance_guideHero p{margin:0;font-size:11px;opacity:.8}.dfinance_guideSection{border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:var(--dsw-alias-bg-base);padding:14px 16px}.dfinance_guideSection h4{font-size:13px;margin:0 0 10px;display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-primary)}.dfinance_guideSection h4 svg{color:#059669}.dfinance_guideSection ul,.dfinance_guideSection ol{margin:0;padding:0 0 0 18px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.8}.dfinance_guideSection li{margin-bottom:4px}.dfinance_guideSection strong{color:var(--dsw-alias-label-primary)}.dfinance_warningBox{display:flex;align-items:flex-start;gap:10px;border:1px solid #fbbf2440;border-radius:10px;background:#fffbeb;padding:12px 14px;margin-top:4px}.dfinance_warningBox svg{color:#f59e0b;flex:none;margin-top:1px}.dfinance_warningBox strong{display:block;font-size:11px;color:#92400e;margin-bottom:4px}.dfinance_warningBox p{margin:0;font-size:10px;color:#92400e;line-height:1.5}.dfinance_ruleGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dfinance_ruleCard{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}.dfinance_ruleCard strong{display:block;font-size:11px;color:#047857;margin-bottom:3px}.dfinance_ruleCard span{display:block;font-size:9px;color:var(--dsw-alias-label-tertiary);line-height:1.4}.dfinance_skillGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.dfinance_skillCard{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px 12px;background:var(--dsw-alias-bg-layer-1)}.dfinance_skillCard strong{display:block;font-size:11px;color:#047857;margin-bottom:3px}.dfinance_skillCard span{display:block;font-size:9px;color:var(--dsw-alias-label-tertiary);line-height:1.4}
.dfinance_uploadMenu{position:relative;display:inline-flex;z-index:70;font-family:var(--dsw-font-family,system-ui)}.dfinance_uploadTrigger{min-height:32px;border:1px solid transparent;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);cursor:pointer;padding:6px 10px;font:600 12px/1.2 var(--dsw-font-family,system-ui);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .14s,color .14s,border-color .14s}.dfinance_uploadTrigger:hover,.dfinance_uploadTrigger[aria-expanded='true']{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}.dfinance_uploadTrigger:disabled{opacity:.58;cursor:wait}.dfinance_uploadMenu.is-compact .dfinance_uploadTrigger{min-height:30px;padding:5px 9px;font-size:11px}.dfinance_uploadPopover{position:absolute;right:0;top:calc(100% + 7px);z-index:10000;width:218px;box-sizing:border-box;padding:6px;display:grid!important;gap:3px;border:1px solid var(--dsw-alias-border-l2)!important;border-radius:12px!important;background:var(--dsw-alias-bg-base)!important;color:var(--dsw-alias-label-primary)!important;box-shadow:0 14px 38px #022c1a2b,0 2px 8px #022c1a12!important;margin:0!important;opacity:1!important}.dfinance_uploadMenu.is-compact .dfinance_uploadPopover{top:auto;bottom:calc(100% + 7px);width:210px}.dfinance_uploadPopover>button{appearance:none;width:100%!important;min-height:48px!important;box-sizing:border-box;border:0!important;border-radius:9px!important;background:transparent!important;color:inherit!important;padding:8px 9px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;text-align:left!important;cursor:pointer!important;font:inherit!important;box-shadow:none!important}.dfinance_uploadPopover>button:hover{background:var(--dsw-alias-interactive-bg-hover)!important}.dfinance_uploadPopover>button>svg{flex:none;color:#059669}.dfinance_uploadPopover>button>span{display:block!important;min-width:0!important;margin:0!important;opacity:1!important}.dfinance_uploadPopover strong,.dfinance_uploadPopover small{display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.dfinance_uploadPopover strong{font-size:12px!important;line-height:1.35!important;font-weight:650!important;color:var(--dsw-alias-label-primary)!important}.dfinance_uploadPopover small{font-size:10px!important;line-height:1.35!important;font-weight:400!important;color:var(--dsw-alias-label-tertiary)!important;margin:2px 0 0!important}
.dfinance_sessionPage{display:grid;gap:11px;max-width:820px}.dfinance_sessionCard{border:1px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-base);padding:16px;display:flex;align-items:center;gap:14px}.dfinance_sessionCard>span{width:44px;height:44px;border-radius:13px;background:#eef2f8;color:#637083;display:grid;place-items:center}.dfinance_sessionCard>span.is-blue{background:#d1fae5;color:#047857}.dfinance_sessionCard>div{flex:1}.dfinance_sessionCard h3{font-size:14px;margin:0}.dfinance_sessionCard p{font-size:10px;color:var(--dsw-alias-label-secondary);margin:4px 0 0}.dfinance_sessionCard.is-danger{border-color:#e36b6b66}.dfinance_sessionCard.is-danger>span{background:#fff0f0;color:#c74242}.dfinance_sessionCard.is-danger button{background:#c94040}.dfinance_safety{border-radius:12px;background:#edf7f1;color:#287448;padding:11px 14px;font-size:10px}.dfinance_safety strong{margin-right:10px}.dfinance_footer{padding:8px 20px;border-top:1px solid var(--dsw-alias-border-l1);font-size:9px;color:var(--dsw-alias-label-tertiary);display:flex;justify-content:space-between;background:var(--dsw-alias-bg-layer-1)}
.dfinance_simpleHero{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding:16px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}.dfinance_simpleHero h3{margin:0;font-size:18px}.dfinance_simpleHero p{margin:5px 0 0;font-size:11px;color:var(--dsw-alias-label-secondary)}.dfinance_simpleHero button{border:0;border-radius:9px;background:#059669;color:white;padding:9px 12px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:650;cursor:pointer;white-space:nowrap}
.dfinance_simpleGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dfinance_simpleGrid .dfinance_scenarioCard{min-height:76px;padding:12px;display:grid;grid-template-columns:38px minmax(0,1fr) 18px;align-items:center;gap:11px;background:var(--dsw-alias-bg-base)}.dfinance_simpleGrid .dfinance_scenarioCard svg{position:static;right:auto;bottom:auto;opacity:1;transform:none}.dfinance_simpleGrid .dfinance_scenarioCard>svg{opacity:.35}.dfinance_simpleGrid .dfinance_scenarioCard:hover>svg{opacity:.8;transform:translateX(2px)}.dfinance_simpleGrid .dfinance_scenarioIcon{width:38px;height:38px}.dfinance_simpleGrid .dfinance_scenarioContent{margin:0}.dfinance_simpleGrid .dfinance_scenarioContent strong{font-size:12px;line-height:1.35;margin:0}.dfinance_simpleGrid .dfinance_scenarioContent small{margin-top:4px;color:var(--scenario-color);font-size:9px}
.dfinance_simpleDetail{max-width:720px;margin:4px auto;display:flex;flex-direction:column;gap:13px}.dfinance_simpleDetail .dfinance_backBtn svg{transform:rotate(90deg)}.dfinance_taskCard{display:flex;align-items:center;gap:14px;padding:18px;border:1px solid var(--dsw-alias-border-l2);border-radius:15px;background:var(--dsw-alias-bg-base);box-shadow:0 10px 30px #031b1010}.dfinance_taskIcon{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;flex:none;background:color-mix(in srgb,var(--scenario-color) 14%,transparent);color:var(--scenario-color)}.dfinance_taskCard span{font-size:9px;color:var(--scenario-color);font-weight:650}.dfinance_taskCard h3{font-size:18px;margin:4px 0}.dfinance_taskCard p{font-size:10px;color:var(--dsw-alias-label-secondary);margin:0;line-height:1.5}
.dfinance_autoSource{padding:15px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1)}.dfinance_autoSourceHead{display:flex;align-items:center;gap:10px}.dfinance_autoSourceHead>span{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#d1fae5;color:#047857}.dfinance_autoSourceHead strong,.dfinance_autoSourceHead small{display:block}.dfinance_autoSourceHead strong{font-size:12px}.dfinance_autoSourceHead small{font-size:9px;color:var(--dsw-alias-label-tertiary);margin-top:2px}.dfinance_matchList{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.dfinance_matchList span{display:inline-flex;align-items:center;gap:4px;max-width:190px;border-radius:99px;padding:5px 8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dfinance_matchList span svg{flex:none;color:#059669}.dfinance_matchList>small{align-self:center;color:var(--dsw-alias-label-tertiary);font-size:9px}.dfinance_noMatch{margin:12px 0 0;font-size:10px;color:var(--dsw-alias-label-secondary)}
.dfinance_simpleActions{display:flex;align-items:center;gap:9px}.dfinance_simpleActions .dfinance_actionPrimary{min-width:132px;min-height:38px;justify-content:center}.dfinance_simpleActions .dfinance_actionPrimary:disabled{opacity:.58;cursor:wait}.dfinance_embeddedNote{margin:0;display:flex;align-items:center;gap:6px;font-size:9px;color:var(--dsw-alias-label-tertiary)}.dfinance_embeddedNote svg{color:#059669;flex:none}
.dfinance_unavailable{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary)}.dfinance_unavailable h2{color:var(--dsw-alias-label-primary);margin:10px 0 4px}.dfinance_unavailable p{font-size:12px}.dfinance_unavailable button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;padding:7px 12px;cursor:pointer}
@media(max-width:900px){.dfinance_panel{width:calc(100vw - 24px);height:calc(100vh - 24px);top:12px;left:12px}.dfinance_scenarioGrid{grid-template-columns:repeat(2,1fr)}.dfinance_ruleGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.dfinance_backdrop{padding:0}.dfinance_panel{inset:0;width:100vw;height:100vh;border-radius:0;border:0}.dfinance_dock{left:10px;top:116px;width:44px;height:44px;padding:6px}.dfinance_dock>span:last-child{display:none}.dfinance_header{padding:13px}.dfinance_brand h2{font-size:17px}.dfinance_tabs{padding:0 8px}.dfinance_tabs button{flex:1;padding:11px 4px;font-size:12px}.dfinance_body{padding:12px}.dfinance_hero{align-items:flex-start;padding:17px}.dfinance_hero h3{font-size:17px}.dfinance_hero button{padding:9px}.dfinance_stats{gap:7px}.dfinance_stats button{padding:10px}.dfinance_quickTemplates,.dfinance_templateGrid{grid-template-columns:1fr}.dfinance_dropzone{align-items:flex-start}.dfinance_dropzone>svg{display:none}.dfinance_filters{flex-direction:column}.dfinance_filters select{min-height:38px}.dfinance_fileRow button span{display:none}.dfinance_fileRow button{padding:7px}.dfinance_sessionCard{align-items:flex-start;flex-wrap:wrap}.dfinance_sessionCard>div{min-width:calc(100% - 65px)}.dfinance_sessionCard>button{margin-left:58px}.dfinance_footer{display:none}.dfinance_guideHero{flex-direction:column;text-align:center}.dfinance_guideHero>div:first-child{margin:0 auto}.dfinance_ruleGrid{grid-template-columns:1fr}.dfinance_skillGrid{grid-template-columns:1fr}.dfinance_scenarioActions{flex-direction:column}.dfinance_scenarioActions button{width:100%;justify-content:center}}
[data-pane='conversation'],[class*='centerCol']{position:relative}
[data-dsh-finance-view]{position:absolute;inset:0;display:none;z-index:65;background:var(--dsw-alias-bg-base)}
html[data-dsh-finance-active] [data-dsh-finance-view]{display:block}
html[data-dsh-finance-active] [data-pane='conversation']>:not([data-dsh-finance-view]),html[data-dsh-finance-active] [class*='centerCol']>:not([data-dsh-finance-view]){display:none!important}
.dfinance_sidebarEntry{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 12px;background:transparent;border:0;border-radius:8px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:13px/1 var(--dsw-font-family);white-space:nowrap}.dfinance_sidebarEntry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.dfinance_sidebarEntry[data-active]{background:var(--dsw-specific-sidebar-nav-item-active);color:var(--dsw-alias-label-primary);font-weight:600}.dfinance_sidebarIcon{display:inline-flex;align-items:center;justify-content:center;flex:none}.dfinance_sidebarLabel{overflow:hidden;text-overflow:ellipsis}
[data-dsh-frame][data-sidebar-collapsed] .dfinance_sidebarEntry{justify-content:center;padding:0}[data-dsh-frame][data-sidebar-collapsed] .dfinance_sidebarLabel{display:none}
.dfinance_panel.dfinance_embedded{position:relative;inset:auto;width:100%;height:100%;border:0;border-radius:0;box-shadow:none;background:var(--dsw-alias-bg-base)}
.dfinance_embedded .dfinance_header{min-height:48px;box-sizing:border-box;padding:8px 16px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-bottom:1px solid var(--dsw-alias-border-l1)}.dfinance_embedded .dfinance_brand{gap:9px}.dfinance_embedded .dfinance_brand>span{width:30px;height:30px;border:0;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dfinance_embedded .dfinance_brand h2{font-size:16px}.dfinance_embedded .dfinance_brand p{font-size:10px;color:var(--dsw-alias-label-tertiary);opacity:1;margin-top:2px}.dfinance_embedded .dfinance_close{width:auto;height:30px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);display:flex;gap:5px;padding:0 10px;font-size:11px}.dfinance_embedded .dfinance_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dfinance_embedded .dfinance_tabs{padding:0 16px}.dfinance_embedded .dfinance_tabs button{padding:10px 13px;font-size:12px}.dfinance_embedded .dfinance_status{min-height:30px;padding:0 16px;background:var(--dsw-alias-bg-base)}.dfinance_embedded .dfinance_body{padding:14px 16px}.dfinance_embedded .dfinance_hero{padding:16px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dfinance_embedded .dfinance_hero:after{display:none}.dfinance_embedded .dfinance_hero h3{font-size:17px;margin:5px 0}.dfinance_embedded .dfinance_hero p{color:var(--dsw-alias-label-secondary);opacity:1}.dfinance_embedded .dfinance_eyebrow{padding:0;background:transparent;color:var(--dsw-alias-label-tertiary)}.dfinance_embedded .dfinance_hero button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:8px 11px}.dfinance_embedded .dfinance_guideHero{padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}.dfinance_embedded .dfinance_guideHero>div:first-child{background:var(--dsw-alias-bg-hover);color:#059669}.dfinance_embedded .dfinance_guideHero h3{font-size:15px}.dfinance_embedded .dfinance_guideSection{border-radius:12px}.dfinance_embedded .dfinance_footer{padding:6px 16px}
.dfinance-panel button:focus-visible,.dfinance_sidebarEntry:focus-visible{outline:2px solid #10b981;outline-offset:2px}
.dfinance_panel.dfinance_embedded{container-type:inline-size;container-name:finance-workbench}
@container finance-workbench (max-width:760px){.dfinance_scenarioGrid{grid-template-columns:repeat(2,1fr)}.dfinance_getStarted{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dfinance_getStarted i{display:none}.dfinance_ruleGrid{grid-template-columns:1fr}.dfinance_skillGrid{grid-template-columns:1fr}.dfinance_hero{align-items:flex-start;flex-wrap:wrap}.dfinance_heroStats{width:100%}.dfinance_scenarioActions{flex-direction:column}.dfinance_scenarioActions button{width:100%;justify-content:center}}
@container finance-workbench (max-width:500px){.dfinance_embedded .dfinance_header{padding:7px 10px}.dfinance_embedded .dfinance_brand p,.dfinance_embedded .dfinance_close span{display:none}.dfinance_embedded .dfinance_close{width:30px;padding:0;justify-content:center}.dfinance_embedded .dfinance_tabs{padding:0 6px}.dfinance_embedded .dfinance_tabs button{flex:1;padding:9px 3px;font-size:10px}.dfinance_embedded .dfinance_status{padding:0 9px}.dfinance_embedded .dfinance_statusActions button{font-size:0;padding:5px}.dfinance_embedded .dfinance_body{padding:10px}.dfinance_embedded .dfinance_hero{padding:12px}.dfinance_embedded .dfinance_hero h3{font-size:14px}.dfinance_getStarted{grid-template-columns:1fr}.dfinance_scenarioGrid{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.dfinance_panel *,.dfinance_sidebarEntry{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`
  style.textContent += FINANCE_DASHBOARD_STYLES
  style.textContent += WORKBENCH_POLISH_CSS
  document.head.appendChild(style)
}

export function apply(ctx) {
  adoptStyles()
  const controller = createFinanceController()
  let financeFiles
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(TYPERT_REMOTE)
    financeFiles = ctx.reflect.get('remote.financeFiles')
    if (!financeFiles) throw new Error('dsh-finance-workbench: remote namespace not mounted')
    return () => { financeFiles = undefined; void dispose() }
  }, 'dsh-finance-workbench: remote')
  const remote = () => {
    if (!financeFiles) throw new Error('财务文件中心尚未准备好，请稍后再试')
    return financeFiles
  }
  ctx.effect(() => {
    const disposeEntry = mountSidebarEntry(controller)
    const disposeView = mountEmbeddedView(controller, remote)
    return () => { disposeView(); disposeEntry() }
  }, 'dsh-finance-workbench: embedded surfaces')
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'finance-tools', order: 13,
    inject: () => ({ remote, controller }),
  }, SessionBridge))
}
