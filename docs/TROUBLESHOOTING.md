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

只接受本项目导出的 v2 JSON 设置备份。它应包含 `product: dsh-finance-workbench`、待办、月结清单、收藏和字段字典。

## Agent 直接给结论，没有执行文件处理

补充以下要求：

```text
先列执行预览与缺失资料；确认后处理副本；输出主结果、异常明细、金额校验和处理日志；所有无法确认的项目标注需人工复核。
```

## 安全提醒

遇到付款、入账、申报、会计政策或重大估计问题时，不要要求 Agent 自动确认。真实凭据或财务资料不要贴到公开 Issue。
