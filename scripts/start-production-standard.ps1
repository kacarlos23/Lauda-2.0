# The existing supervisor continues monitoring the web, API, database and tunnel.
# This owner-session task keeps the compiled API restartable by the publisher.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Production API must run with the standard owner token, never elevated.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$queue = Join-Path $project '.lauda-publisher'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$entry = Join-Path $project 'dist\server.js'
Set-Location -LiteralPath $project
# Match the existing supervisor's compiled-API launch environment. The .env and
# Windows-provided application settings are left intact, including credentials.
$env:HOST = '0.0.0.0'
$env:PORT = '3000'
$env:TRUST_PROXY_HOPS = '1'
$env:RATE_LIMIT_STORE = 'redis'
$env:RATE_LIMIT_REDIS_URL = 'redis://127.0.0.1:6379'
$env:REALTIME_REDIS_URL = 'redis://127.0.0.1:6379'
while ($true) {
  # Never stop or replace another listener, including a supervisor recovery.
  $occupied = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  if ($occupied.Count) { Start-Sleep -Seconds 2; continue }
  if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Compiled production API is missing.' }
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
  $api = Start-Process -FilePath $node -ArgumentList @(('"{0}"' -f $entry)) -WorkingDirectory $project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $queue "production-api-$stamp.out.log") -RedirectStandardError (Join-Path $queue "production-api-$stamp.err.log")
  $api.WaitForExit()
  Start-Sleep -Seconds 2
}
