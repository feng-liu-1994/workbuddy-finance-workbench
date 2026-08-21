# AI Agent 安装指南

本指南适用于 WorkBuddy、Codex、Claude Code 以及能够读取本地技能目录的其他智能体。

## 安装前准备

- 已安装 Git。
- 能正常启动目标 AI Agent。
- 先用演示数据试跑，不要直接拿真实银行流水测试。

## WorkBuddy 安装

### macOS / Linux

```bash
git clone https://github.com/feng-liu-1994/workbuddy-finance-workbench.git
cd workbuddy-finance-workbench
./scripts/install-agent.sh workbuddy
```

脚本会安装到 `~/.workbuddy/skills/finance-workbench/`。如果已经存在旧版，会先移动到带时间戳的备份目录。

### Windows PowerShell

```powershell
git clone https://github.com/feng-liu-1994/workbuddy-finance-workbench.git
cd workbuddy-finance-workbench
.\scripts\install-agent.ps1 workbuddy
```

默认安装到 `$HOME\.workbuddy\skills\finance-workbench`。

### 验证

重新打开 WorkBuddy，然后输入：

```text
请使用 finance-workbench，列出银行流水与账务明细核对所需的输入、规则、输出和人工复核点。暂时不要处理真实文件。
```

正确结果应包含字段统一、唯一匹配、疑似匹配、金额校验、异常清单和人工确认。

## Codex 安装

```bash
./scripts/install-agent.sh codex
```

默认安装到 `${CODEX_HOME:-~/.codex}/skills/finance-workbench/`。重新启动 Codex 任务后，可以说：

```text
使用 finance-workbench 分析 examples/demo 下的虚构对账数据，先给执行预览，不要修改源文件。
```

## Claude Code 安装

```bash
./scripts/install-agent.sh claude
```

默认安装到 `${CLAUDE_HOME:-~/.claude}/skills/finance-workbench/`。

## 自定义 Agent 目录

```bash
./scripts/install-agent.sh custom /你的/Agent/skills目录
```

如果智能体没有 Skill 目录，让它直接读取：

```text
请完整阅读 agents/finance-workbench/SKILL.md，按其中的安全边界和执行闭环完成任务。
```

## 手动安装

把 `agents/finance-workbench` 整个目录复制到目标 Agent 的技能目录，文件夹名称保持为 `finance-workbench`。不要只复制 `SKILL.md`，因为工作流目录、规则和任务模板也需要一起保留。

## 卸载与恢复

macOS / Linux：

```bash
./scripts/uninstall-agent.sh workbuddy
```

卸载脚本不会直接删除技能，而是把它移动到备份目录。若要恢复，把备份文件夹改回 `finance-workbench` 即可。

## 能力差异

| 能力 | DeepSeek Harness UI | AI Agent Skill |
|---|---:|---:|
| 25 个工作流 | ✓ | ✓ |
| 规则、输出和验收清单 | ✓ | ✓ |
| 文件处理和结果生成 | 取决于 Agent 权限 | 取决于 Agent 权限 |
| 可视化首页与左侧导航 | ✓ | — |
| 资料库置顶、引用和下载 | ✓ | 由 Agent 自身能力决定 |
| 人工复核红线 | ✓ | ✓ |

Agent Skill 不会帮你配置模型账号，也不会读取 API Key。请在目标软件自己的设置页面中完成模型配置。
