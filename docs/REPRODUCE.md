# 财务工作台：源码与 AI 复刻指南

## 先选一种方式

1. **最推荐：源码 + 总提示词。** 用 GitHub 的 Code → Download ZIP 下载并解压整个仓库，把文件夹交给 Codex / Claude Code 等能读文件的 AI，再复制 [总提示词](reproduce/MASTER_PROMPT.md)。
2. **一键复制。** 下载 [离线提示词中心](reproduce/index.html)：打开 GitHub 文件页，选择 Download raw file，保存为 index.html 后双击。页面提供总提示词、总提示词加全部源码、25 套完整工作流提示词的复制按钮和搜索。
3. **AI 只支持附件。** 上传 [源码上下文](reproduce/source-context.md) 和 [完整性清单](reproduce/manifest.json)，再粘贴总提示词。文件较大，若超出上下文，请让 AI 分批读取本地目录，不要截断源码后要求精确复刻。

财务仓库为公开开源项目。本次在原仓库上增量优化，保留既有安装方式、历史与通用 Agent Skill。

## 一段可以直接复制给 AI 的启动指令

```text
请读取我提供的整个工作台仓库。
先完整执行 docs/reproduce/MASTER_PROMPT.md，
以 src/ 和 package-lock.json 为精确复刻基准。
不要重新设计界面或省略任何模块。
完成构建、测试、中文安装指南和桌面/窄屏实际验证；
缺少宿主环境的验收项单独列出，保留我的原始文件与配置。
```

## 准备材料

- 本仓库全部文件（不要只下载 README 或一张截图）。
- Node.js 20 或以上，以及 npm。
- DeepSeek Harness 或 WorkBuddy；选择对应安装文档，不要把通用 Skill 当作完整图形界面。
- 合成或脱敏的验收样例；请勿把学生信息、真实票据、客户账目与登录凭据提交到仓库。
- 若要与原界面严格对照，提供相同窗口尺寸、系统字体、主题和宿主版本。

## 源码定位

| 文件或目录 | 作用 |
| --- | --- |
| src/client.jsx | DSH 客户端入口、宿主集成、资料与工作流交互 |
| src/finance-dashboard.jsx | 工作台布局、模块和界面行为 |
| src/finance-data.js | 25 套工作流数据源 |
| src/task-prompt.js | 完整提示词组合规则，不应手工缩写 |
| src/workflow-tools.js | 任务信息、资料匹配等工作流辅助规则 |
| src/index.js / src/contract.js | 后端注册与协议 |
| build.mjs / cordis.patch.yml | 构建与 DSH 插件注册 |
| package-lock.json | 依赖锁文件，复现时使用 npm ci |
| test/ | 回归测试 |
| scripts/generate-reproduction.mjs | 从实际源码生成本复刻包 |
| src/workbuddy-widget.jsx / src/workbuddy-mcp-server.mjs | WorkBuddy 图形界面和 MCP 服务 |

## 本地构建与文档更新

```bash
git clone https://github.com/feng-liu-1994/workbuddy-finance-workbench.git
cd workbuddy-finance-workbench
npm ci
npm run verify:release
node scripts/generate-reproduction.mjs
```

完整提示词来自与界面相同的组合函数，因此角色、输入材料、执行约束、输出要求和验收标准保持一致。修改源码后重新运行生成器；manifest.json 的 SHA-256 校验的是 UTF-8 文件原文。生成物不包含 node_modules、宿主会话、真实业务资料或登录凭据。

## 安装、使用与验收

按 [DSH 安装指南](INSTALL_DSH.md)、[WorkBuddy 安装指南](INSTALL_WORKBUDDY.md) 或 [通用 Agent 安装指南](INSTALL_AGENT.md) 选择入口。

1. 安装前备份原插件与配置；退出宿主前保存工作。
2. 使用示例数据打开全部模块，检查主题、滚动、表单及 390px 窄屏布局。
3. 创建并完成一条示例待办；检查刷新后的持久化。
4. 上传一个合成文件，检查搜索、引用、下载及同名上传不覆盖。
5. 对每个工作流检查完整提示词；至少实际触发一次 AI 任务。
6. 验证备份与恢复。AI 只应生成待复核成果，付款、入账和申报仍由人确认。
7. 报告已完成项、失败项、宿主依赖和可恢复步骤。

## 常见问题

**GitHub 页面里的复制按钮在哪里？** GitHub 预览不执行 HTML。先下载 index.html 再用浏览器打开；Markdown 提示词也可直接选中复制。

**复制按钮没有成功？** 页面优先使用系统剪贴板，失败时尝试兼容方式；仍失败会显示可手动复制的文本框。仅在复制成功后提示“已复制”。

**源码包太长？** 让能读本地文件的 AI 直接使用仓库；只复制总提示词即可。不要为了长度删掉源码文件。

**能保证任意 AI 从一句话画出完全相同的界面吗？** 精确复刻依赖同一份源码和锁文件；自由重写不保证相同。保留原源码构建最可靠，宿主版本和系统字体仍可能造成显示差异。

**与原先发布版有什么区别？** 本次同步本地 2.6.0 源码、任务工作流增强和并发同名上传保护，新增完整复刻包；README 中已有截图/旧 Release 不自动代表本次源码版本。获取本次内容请下载默认分支源码。
