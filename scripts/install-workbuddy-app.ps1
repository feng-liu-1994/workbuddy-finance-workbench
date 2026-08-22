param([switch]$DryRun)
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$WorkBuddyHome = if ($env:WORKBUDDY_HOME) { $env:WORKBUDDY_HOME } else { Join-Path $env:USERPROFILE '.workbuddy' }
$AppRoot = Join-Path $WorkBuddyHome 'apps\finance-workbench'
$SkillRoot = Join-Path $WorkBuddyHome 'skills\finance-workbench'
$ConfigFile = Join-Path $WorkBuddyHome '.mcp.json'
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $Node) { throw '请先安装 Node.js 20 或更高版本：https://nodejs.org/' }
$Major = [int]((& $Node -p "process.versions.node.split('.')[0]").Trim())
if ($Major -lt 20) { throw "Node.js 版本过低，需要 20+。" }
$ServerSource = Join-Path $RepoRoot 'workbuddy\server.mjs'
$WidgetSource = Join-Path $RepoRoot 'workbuddy\widget.html'
$SkillSource = Join-Path $RepoRoot 'agents\finance-workbench'
if (!(Test-Path $ServerSource) -or !(Test-Path $WidgetSource) -or !(Test-Path (Join-Path $SkillSource 'SKILL.md'))) {
  throw '安装包不完整，请重新下载发布版 ZIP。'
}

Write-Host "WorkBuddy 目录：$WorkBuddyHome"
Write-Host "图形工作台：$AppRoot"
if ($DryRun) { Write-Host '预检通过；未修改任何文件。'; exit 0 }

New-Item -ItemType Directory -Force -Path (Split-Path $AppRoot), (Split-Path $SkillRoot) | Out-Null
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (Test-Path $AppRoot) { Move-Item $AppRoot "$AppRoot.backup-$Stamp" }
if (Test-Path $SkillRoot) { Move-Item $SkillRoot "$SkillRoot.backup-$Stamp" }
New-Item -ItemType Directory -Force -Path $AppRoot | Out-Null
Copy-Item $ServerSource, $WidgetSource -Destination $AppRoot
Copy-Item $SkillSource -Destination $SkillRoot -Recurse

if (Test-Path $ConfigFile) {
  Copy-Item $ConfigFile "$ConfigFile.finance-workbench-backup-$Stamp"
  $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
} else {
  $Config = [pscustomobject]@{ mcpServers = [pscustomobject]@{} }
}
if ($null -eq $Config.mcpServers) { $Config | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) -Force }
$ServerEntry = [pscustomobject]@{
  command = $Node
  args = @((Join-Path $AppRoot 'server.mjs'))
  env = [pscustomobject]@{ WORKBUDDY_FINANCE_WORKBENCH = '1' }
}
$Config.mcpServers | Add-Member -NotePropertyName 'finance-workbench' -NotePropertyValue $ServerEntry -Force
$Config | ConvertTo-Json -Depth 20 | Set-Content $ConfigFile -Encoding utf8
& $Node --check (Join-Path $AppRoot 'server.mjs')

Write-Host ''
Write-Host '安装完成。请先保存 WorkBuddy 中正在编辑的内容，然后完全退出并重新打开。'
Write-Host '重新打开后输入：打开财务工作台'
Write-Host '安装器没有读取或上传你的财务数据，也没有替你重启 WorkBuddy。'
