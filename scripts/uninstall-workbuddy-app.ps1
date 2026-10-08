param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCommand) { throw '请先安装 Node.js 20+：https://nodejs.org/' }
$Arguments = @((Join-Path $PSScriptRoot 'workbuddy-install.mjs'), 'uninstall')
if ($DryRun) { $Arguments += '--dry-run' }
& $NodeCommand.Source @Arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
