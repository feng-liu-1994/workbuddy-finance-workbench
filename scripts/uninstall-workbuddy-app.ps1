$ErrorActionPreference = 'Stop'
$WorkBuddyHome = if ($env:WORKBUDDY_HOME) { $env:WORKBUDDY_HOME } else { Join-Path $env:USERPROFILE '.workbuddy' }
$AppRoot = Join-Path $WorkBuddyHome 'apps\finance-workbench'
$SkillRoot = Join-Path $WorkBuddyHome 'skills\finance-workbench'
$ConfigFile = Join-Path $WorkBuddyHome '.mcp.json'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (Test-Path $ConfigFile) {
  Copy-Item $ConfigFile "$ConfigFile.finance-workbench-uninstall-backup-$Stamp"
  $Config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
  if ($Config.mcpServers) { $Config.mcpServers.PSObject.Properties.Remove('finance-workbench') }
  $Config | ConvertTo-Json -Depth 20 | Set-Content $ConfigFile -Encoding utf8
}
foreach ($Target in @($AppRoot, $SkillRoot)) {
  if (Test-Path $Target) {
    Move-Item $Target "$Target.uninstalled-$Stamp"
    Write-Host "已移出并保留可恢复副本：$Target.uninstalled-$Stamp"
  }
}
Write-Host '卸载完成。保存当前工作后重启 WorkBuddy 即可生效。'
