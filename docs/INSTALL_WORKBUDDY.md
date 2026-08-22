# WorkBuddy 完整财务工作台安装指南

本指南安装的是 **可在 WorkBuddy 内打开的完整图形工作台**，同时安装配套的 `finance-workbench` Skill。只想给其他 AI Agent 安装规则库，请看 [通用 Skill 安装](INSTALL_AGENT.md)。

![安装完成后打开的财务工作台](images/readme-hero.png)

## 你最终会得到什么

| 内容 | 用途 | 默认位置 |
|---|---|---|
| WorkBuddy MCP App | 在对话中打开完整图形工作台 | `~/.workbuddy/apps/finance-workbench/` |
| finance-workbench Skill | 让 AI 理解财务规则、输入输出和复核边界 | `~/.workbuddy/skills/finance-workbench/` |
| MCP 配置项 | 告诉 WorkBuddy 如何启动图形应用 | `~/.workbuddy/.mcp.json` 中的 `finance-workbench` |

安装过程只有四步：

```mermaid
flowchart LR
  A[下载发布包] --> B[运行安装器]
  B --> C[保存并重开 WorkBuddy]
  C --> D[输入“打开财务工作台”]
```

## 安装前准备

- WorkBuddy 可以正常打开。
- 安装 [Node.js 20 或更高版本](https://nodejs.org/zh-cn/download)，终端执行 `node --version` 能看到版本号。
- 保存 WorkBuddy 中正在编辑但尚未发送的内容。

### 不知道是否安装了 Node.js

macOS 打开“终端”，Windows 打开 PowerShell，输入：

```text
node --version
```

- 看到 `v20.x.x`、`v22.x.x` 或更高版本：可以继续。
- 提示找不到 `node`：打开 [Node.js 下载页](https://nodejs.org/zh-cn/download)，安装 LTS 版本后关闭并重新打开终端。
- 看到 `v18.x.x` 或更低：升级 Node.js 后再安装。

## macOS：双击安装

1. 打开 [最新发布页](https://github.com/feng-liu-1994/workbuddy-finance-workbench/releases/latest)。
2. 下载 `workbuddy-finance-workbench-macos.zip` 并解压。
3. 双击 `安装 WorkBuddy 财务工作台.command`。
4. 看到“安装完成”后，完全退出 WorkBuddy，再重新打开。
5. 输入 `打开财务工作台`。

如果 macOS 第一次阻止打开脚本，请右键该文件，选择“打开”，再确认一次。

安装窗口末尾应看到类似文字：

```text
安装完成。请先保存 WorkBuddy 中正在编辑的内容，然后完全退出并重新打开 WorkBuddy。
重新打开后输入：打开财务工作台
```

看到这两行才表示文件与配置已经写入完成。不要在安装脚本仍运行时关闭窗口。

## Windows：PowerShell 安装

1. 下载并解压 `workbuddy-finance-workbench-windows.zip`。
2. 在解压目录空白处按住 Shift 并右键，选择“在此处打开 PowerShell”。
3. 执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-workbuddy-app.ps1
```

4. 完全退出并重新打开 WorkBuddy，输入 `打开财务工作台`。

如果 PowerShell 提示脚本执行受到限制，请确认使用的是上面包含 `-ExecutionPolicy Bypass` 的完整命令；它只对本次命令生效，不会永久修改系统策略。

## macOS / Linux：命令行安装

```bash
git clone https://github.com/feng-liu-1994/workbuddy-finance-workbench.git
cd workbuddy-finance-workbench
./scripts/install-workbuddy-app.sh
```

只做检查、不修改文件：

```bash
./scripts/install-workbuddy-app.sh --dry-run
```

## 安装器具体做了什么

1. 检查 Node.js 版本和安装包完整性。
2. 把图形应用复制到 `~/.workbuddy/apps/finance-workbench/`。
3. 把 Skill 复制到 `~/.workbuddy/skills/finance-workbench/`。
4. 备份已有 `~/.workbuddy/.mcp.json`。
5. 只向 `mcpServers` 新增或更新 `finance-workbench` 一项。
6. 校验 MCP Server 文件语法。

安装器不会读取财务资料或密钥，也不会删除其他 MCP 配置，更不会强制重启 WorkBuddy。

### 为什么需要完全退出再打开

WorkBuddy 通常在启动时读取 MCP 配置。只关闭当前对话或窗口可能不会重新加载服务。请先保存未发送内容，再从菜单完全退出应用，然后重新打开。安装器刻意不替你执行这一步，避免打断正在进行的工作。

## 安装后验证

在 WorkBuddy 输入：

```text
打开财务工作台
```

正确结果应同时满足：

- 出现可操作的财务工作台，而不是只有一段文字说明。
- 左侧可访问 20 个模块，顶部可进入待办、月结、资料库和工作流。
- 可切换 4 套主题，正文和按钮字号清晰。
- 点击工作流“开始处理”后，结构化指令进入 WorkBuddy 输入框；发送前可以核对附件。

### 推荐的第一次练习

1. 先不要上传真实资料。
2. 输入 `打开财务工作台`，进入“工作流”。
3. 选择“银行流水与账务明细核对”。
4. 查看输入材料、关键规则、7 步路径、固定输出包和验收清单。
5. 点击“开始处理”，确认 WorkBuddy 输入框出现结构化任务；此时仍由你决定是否发送。
6. 需要练习文件时，使用仓库 `examples/demo/` 中的虚构数据。

## 更新

下载新版安装包后，重新运行安装脚本即可。旧应用、Skill 和 MCP 配置都会保留带时间戳的备份。

更新后请重新打开 WorkBuddy，并在“系统设置”或发布页确认版本。台账与设置升级前建议先在“数据备份”导出 JSON。

## 卸载

macOS 双击 `卸载 WorkBuddy 财务工作台.command`，或执行：

```bash
./scripts/uninstall-workbuddy-app.sh
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-workbuddy-app.ps1
```

卸载只移除 `.mcp.json` 中的 `finance-workbench` 项；应用和 Skill 会移动到 `.uninstalled-时间戳` 目录，方便恢复。

### 恢复卸载前版本

1. 完全退出 WorkBuddy。
2. 在 `~/.workbuddy/` 中找到 `.mcp.json.finance-workbench-uninstall-backup-时间戳`。
3. 先给当前 `.mcp.json` 再留一份副本，然后把备份复制回 `.mcp.json`。
4. 把对应的 `finance-workbench.uninstalled-时间戳` 文件夹改名为 `finance-workbench`。
5. 重新打开 WorkBuddy。

不熟悉文件恢复时，建议保留这些备份并在 GitHub Issue 中附上**脱敏后的报错文字**；不要上传完整 `.mcp.json`，其中可能包含其他服务配置。

## 常见问题

### 输入“打开财务工作台”后只有文字

先确认 WorkBuddy 已完全退出并重新打开，再检查 `~/.workbuddy/.mcp.json` 中是否有 `finance-workbench`。如果终端提示 Node.js 版本过低，请升级到 20+ 后重新安装。

macOS 可在 Finder 按 `Command + Shift + G`，输入 `~/.workbuddy/` 后回车。Windows 可在文件资源管理器地址栏输入 `%USERPROFILE%\.workbuddy`。查看配置时只确认是否存在 `finance-workbench` 字样，不要把完整文件发到公开网络。

### 双击 `.command` 后窗口立即关闭

常见原因是 Node.js 未安装或安装包不完整。打开终端，进入解压目录后执行：

```bash
./scripts/install-workbuddy-app.sh --dry-run
```

预检会直接说明缺少的项目，并且不会修改配置。

### 页面空白或提示资源加载失败

重新下载最新发布包并再安装一次。发布包内必须同时包含 `workbuddy/server.mjs` 和 `workbuddy/widget.html`；不要只复制 `.command` 文件。

### 工作流按钮没有直接发送

这是有意的人工确认步骤。按钮只把任务填入输入框，方便你核对任务范围、期间和附件后再发送。

### 数据保存在哪里

工作台台账与设置默认在 WorkBuddy Widget 的浏览器本机存储中。建议定期从“数据备份”导出 JSON；原始附件不写入该备份。

## 寻求帮助时请提供什么

- 操作系统和版本，例如 macOS 15 或 Windows 11。
- WorkBuddy 版本。
- `node --version` 输出。
- 你执行到哪一步、屏幕上出现的完整错误文字。
- 是否已经完全退出并重新打开 WorkBuddy。

请先遮盖姓名、公司名、本机用户名、文件路径、Token、Cookie、银行账号和任何真实财务数据，再提交到 [GitHub Issues](https://github.com/feng-liu-1994/workbuddy-finance-workbench/issues)。
