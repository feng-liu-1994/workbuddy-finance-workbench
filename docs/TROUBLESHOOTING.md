# 常见问题与排障

## WorkBuddy 没有识别技能

1. 确认目录为 `~/.workbuddy/skills/finance-workbench/SKILL.md`。
2. 确认复制的是整个目录，不只是一个文件。
3. 完全退出并重新打开 WorkBuddy。
4. 明确说“请使用 finance-workbench”。

## DeepSeek Harness 没有出现入口

```bash
cd workbuddy-finance-workbench
npm run check
./scripts/install-dsh.sh --dry-run
```

检查 profile 的 `package.json`：

- `dependencies` 中有 `dsh-finance-workbench`。
- `dsh.profile.bundles` 中有 `dsh-finance-workbench`。

保存工作后再重启 DeepSeek Harness。

## 页面显示旧版本

重新执行 `npm run build`，再刷新页面。仍未更新时，保存当前工作后重启服务。

## 文件无法上传

- 检查文件格式是否受支持。
- 检查工作区是否可写。
- 避免文件名包含路径分隔符或 `..`。
- 不要把密码保护或来源不明的文件直接交给 Agent。

## JSON 备份无法恢复

只接受本项目导出的 v2 JSON 备份，单份上限 5 MB。系统会逐项检查主体期间、待办日期、记录标识、金额、日志时间和异常处置证据。请按界面中的错误位置检查备份，原数据不会因为校验失败被替换。

旧 v2 备份仍可导入；没有资料置顶或最近工作流字段时，保留当前对应记录。恢复前自动保留一份完整副本，可在“数据备份”中点击“下载恢复前副本”。

## 出现“本机保存未完成”

当前修改仍在界面内，刷新或退出可能丢失。立即点击“导出 JSON 备份”，检查浏览器 / Widget 是否允许本机存储，以及空间是否充足。数据无法读取时不会自动覆盖损坏的存储。

## 工作流复制失败

先点击“复制完整提示词”。若仍提示复制受限，展开提示词并手动全选复制。Widget 不会把发送和复制失败显示为成功。

## 只想本机预览

```bash
npm ci
npm run preview
```

打开 http://127.0.0.1:4173。财务台账和设置只保存在该预览来源的本机存储，工作流指令由你粘贴到 AI 对话执行。不同宿主 / 端口之间通过 JSON 备份迁移数据。

## Agent 直接给结论，没有执行文件处理

补充以下要求：

```text
先列执行预览与缺失资料；确认后处理副本；输出主结果、异常明细、金额校验和处理日志；所有无法确认的项目标注需人工复核。
```

## 安全提醒

遇到付款、入账、申报、会计政策或重大估计问题时，不要要求 Agent 自动确认。真实凭据或财务资料不要贴到公开 Issue。
