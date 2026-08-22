# DeepSeek Harness 完整工作台安装

该方式安装完整的可视化财务工作台。开始前请确认 DeepSeek Harness 已能正常打开。

## 一键安装

```bash
git clone https://github.com/feng-liu-1994/workbuddy-finance-workbench.git
cd workbuddy-finance-workbench
./scripts/install-dsh.sh
```

安装脚本会：

1. 检查 Node.js、npm、pnpm 和 DeepSeek Harness `web` profile。
2. 运行自动化测试和生产构建。
3. 备份 profile 的 `package.json`。
4. 把当前仓库作为本地插件依赖加入 profile。
5. 在 `dsh.profile.bundles` 中注册 `dsh-finance-workbench`。
6. 执行 `pnpm install`。

脚本不会删除已有插件，也不会自动清理财务资料。

## 安装前预检

只检查，不修改：

```bash
./scripts/install-dsh.sh --dry-run
```

指定其他 profile：

```bash
./scripts/install-dsh.sh --profile my-profile
```

## 让新插件生效

若 DeepSeek Harness 正在运行，先保存当前会话，再按你原来的方式重启服务。打开页面后，左侧应出现“财务工作台”。

> 安装脚本不会强制重启，避免中断正在进行的工作。

## 验证清单

- 页面能正常打开，浏览器控制台没有财务工作台相关错误。
- 左侧出现“财务工作台”。
- 顶部可以切换 4 套主题，刷新页面后仍保留选择。
- 首页显示 25 个专业工作流。
- 首页“今日财务节奏”能显示异常、待办、月结和经营数据完整度。
- “异常控制台”可登记来源、金额、责任人和截止日；未填处置证据时不能关闭异常。
- 业务模块能显示与场景对应的财务复核断言。
- 待办可新增、完成和恢复。
- 财务资料库可搜索、筛选、引用和下载。
- 月结清单可勾选并计算完成度。
- 设置可以导出 JSON 备份。
- 390px 窄窗口下没有横向溢出。

## 更新

```bash
cd workbuddy-finance-workbench
git pull --ff-only
npm ci
npm run check
```

然后保存工作并重启 DeepSeek Harness。

## 恢复旧配置

安装脚本会在 profile 目录生成类似文件：

```text
package.json.finance-workbench-backup-20260821-120000
```

如需恢复，先停止 DeepSeek Harness，把备份文件复制回 `package.json`，再在该 profile 目录执行 `pnpm install`。恢复前请保留当前配置副本。

## 从 GitHub Release 安装

Releases 提供 `dsh-finance-workbench-2.3.0.tgz`。这是构建完成的 npm 安装包，适合不想在目标机器编译源码的用户。下载后可在 profile 目录安装：

```bash
pnpm add /下载目录/dsh-finance-workbench-2.3.0.tgz
```

还需要确认 profile 的 `dsh.profile.bundles` 中包含 `dsh-finance-workbench`。新手建议优先使用一键安装脚本。
