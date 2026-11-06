$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Join-Path $project 'mobile/web-build/transfer-staging/release.json'
if (-not (Test-Path -LiteralPath $release)) { throw 'Build de testes ausente.' }
$metadata = Get-Content -LiteralPath $release -Raw | ConvertFrom-Json
if ($metadata.environment -ne 'staging' -or $metadata.apiUrl -ne 'https://testes.laudaapp.com/api') { throw 'Ambiente incorreto.' }
& node (Join-Path $PSScriptRoot 'validate-frontend-api.cjs') --dist (Join-Path $project 'mobile/web-build/transfer-staging') --expected-api-url https://testes.laudaapp.com/api
if ($LASTEXITCODE -ne 0) { throw 'Validacao da API falhou.' }
if (-not (Test-Path -LiteralPath (Join-Path $project 'test-results/transfer-release/backend/server.js'))) { throw 'Build da API ausente.' }

# Inspect both listeners before stopping either one. Production ports are excluded.
$targets = @()
foreach ($port in @(8095, 3020)) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  if (-not $listener) { continue }
  $processId = @($listener.OwningProcess | Select-Object -Unique)
  if ($processId.Count -ne 1) { throw "Mais de um processo na porta $port." }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($processId[0])"
  $expected = if ($port -eq 8095) { 'public-test-server\.cjs|serve-transfer-staging\.cjs' } else { 'public-test-environment.*dist[\\/]server\.js|transfer-release[\\/]backend[\\/]server\.js' }
  if ($process.Name -ne 'node.exe' -or $process.CommandLine -notmatch $expected) { throw "Processo inesperado na porta $port. Nenhuma troca foi iniciada." }
  $targets += $processId[0]
}
foreach ($processId in $targets) { Stop-Process -Id $processId -ErrorAction Stop }
$env:LAUDA_STAGING_GATEWAY_PORT = '8095'
$env:LAUDA_STAGING_BACKEND_PORT = '3020'
$logs = Join-Path $project 'test-results/transfer-release'
Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('scripts/serve-transfer-staging.cjs') -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'gateway-8095.log') -RedirectStandardError (Join-Path $logs 'gateway-8095.err.log') | Out-Null
for ($attempt = 0; $attempt -lt 15; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $live = Invoke-RestMethod 'http://127.0.0.1:8095/release.json' -TimeoutSec 3
    $health = Invoke-RestMethod 'http://127.0.0.1:8095/health' -TimeoutSec 3
    if ($live.builtAt -eq $metadata.builtAt -and $health.status -eq 'ok') {
      Write-Output 'Versao publicada no gateway de testes (8095). Confira https://testes.laudaapp.com.'
      exit 0
    }
  } catch { }
}
throw 'A nova versao nao respondeu. Confira test-results/transfer-release/gateway-8095.err.log.'
