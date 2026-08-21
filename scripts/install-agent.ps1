param(
  [ValidateSet("workbuddy", "codex", "claude", "custom")]
  [string]$Target = "workbuddy",
  [string]$CustomRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Source = Join-Path $RepoRoot "agents/finance-workbench"

switch ($Target) {
  "workbuddy" { $DestinationRoot = Join-Path $HOME ".workbuddy/skills" }
  "codex" { $DestinationRoot = Join-Path $HOME ".codex/skills" }
  "claude" { $DestinationRoot = Join-Path $HOME ".claude/skills" }
  "custom" {
    if ([string]::IsNullOrWhiteSpace($CustomRoot)) { throw "custom 模式需要提供目标 skills 目录" }
    $DestinationRoot = $CustomRoot
  }
}

if (-not (Test-Path (Join-Path $Source "SKILL.md"))) { throw "未找到 Agent Skill: $Source" }
New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
$Destination = Join-Path $DestinationRoot "finance-workbench"

if (Test-Path $Destination) {
  $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $Backup = Join-Path $DestinationRoot "finance-workbench.backup-$Timestamp"
  Move-Item $Destination $Backup
  Write-Host "旧版已备份到: $Backup"
}

Copy-Item -Recurse $Source $Destination
if (-not (Test-Path (Join-Path $Destination "references/workflows.json"))) { throw "安装校验失败" }
Write-Host "安装完成: $Destination"
Write-Host "请重新打开 $Target，然后明确说：请使用 finance-workbench。"
