param([switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$projectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& (Join-Path $PSScriptRoot "start-worship-development.ps1")
if (-not $SkipBuild) { & (Join-Path $PSScriptRoot "build-worship-test.ps1") }
Push-Location $projectPath
try {
  # Always validate, including when reusing an already exported build.
  & node scripts/validate-frontend-api.cjs --dist mobile/web-build/worship-test --expected-api-url "http://127.0.0.1:3010/api"
  if ($LASTEXITCODE -ne 0) { throw "Build de testes invalido. Nenhum servidor estatico sera iniciado." }
  $listener = Get-NetTCPConnection -State Listen -LocalPort 8093 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($process.CommandLine -notmatch 'worship-test' -or $process.CommandLine -notmatch '8093') {
      throw "A porta 8093 esta ocupada por outro servico."
    }
  } else {
    $staticPath = Join-Path $projectPath "mobile\web-build\worship-test"
    $serveConfig = Join-Path $PSScriptRoot "worship-test.serve.json"
    $process = Start-Process -FilePath (Get-Command node).Source -ArgumentList @("mobile/node_modules/serve/build/main.js", ('"{0}"' -f $staticPath), "--config", ('"{0}"' -f $serveConfig), "--listen", "tcp://127.0.0.1:8093") -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectPath "frontend.worship-test.out.log") -RedirectStandardError (Join-Path $projectPath "frontend.worship-test.err.log")
    Write-Output "Frontend de homologacao iniciado (PID $($process.Id))."
  }
  Write-Output "Homologacao: http://127.0.0.1:8093/schedules/worship-order?date=2026-10-19"
} finally { Pop-Location }
