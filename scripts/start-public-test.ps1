$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logs = Join-Path $project 'test-results/public-test'
$config = Join-Path $env:USERPROFILE '.cloudflared/laudaapp-testes.yml'
$cloudflared = Join-Path $env:LOCALAPPDATA 'LaudaApp/cloudflared/cloudflared.exe'
if (-not (Test-Path -LiteralPath $cloudflared)) { $cloudflared = (Get-Command cloudflared.exe).Source }
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$mutex = [Threading.Mutex]::new($false, 'Local\LaudaPublicTestSupervisor')
$ownsMutex = $false
try {
  try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (-not $ownsMutex) { exit 0 }
  while ($true) {
    try {
      & node (Join-Path $PSScriptRoot 'check-public-test-config.cjs')
      if ($LASTEXITCODE -ne 0) { throw 'Isolated configuration rejected' }
      $database = (docker inspect lauda-public-test-db | ConvertFrom-Json)[0]
      if ($LASTEXITCODE -ne 0) { throw 'Test database unavailable' }
      if ($database.Config.Env -notcontains 'POSTGRES_DB=lauda_public_test' -or $database.HostConfig.PortBindings.'5432/tcp'[0].HostPort -ne '5436') { throw 'Wrong database container' }
      if (-not $database.State.Running) { docker start lauda-public-test-db | Out-Null }
      $gateway = Get-NetTCPConnection -State Listen -LocalPort 8095 -ErrorAction SilentlyContinue
      if (-not $gateway) {
        Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('scripts/public-test-server.cjs') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'gateway.log') -RedirectStandardError (Join-Path $logs 'gateway.error.log') | Out-Null
      }
      $tunnel = Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" | Where-Object { $_.CommandLine -like '*laudaapp-testes*' }
      if (-not $tunnel) {
        & $cloudflared tunnel --config $config ingress validate
        if ($LASTEXITCODE -ne 0) { throw 'Invalid test tunnel configuration' }
        Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--protocol', 'http2', '--config', $config, 'run', 'laudaapp-testes') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'tunnel.log') -RedirectStandardError (Join-Path $logs 'tunnel.error.log') | Out-Null
      }
    } catch { Add-Content -LiteralPath (Join-Path $logs 'supervisor.log') -Value "$(Get-Date -Format o) $($_.Exception.Message)" }
    Start-Sleep -Seconds 20
  }
} finally { if ($ownsMutex) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
