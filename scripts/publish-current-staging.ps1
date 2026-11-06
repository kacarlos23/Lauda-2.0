$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$web = Join-Path $project 'mobile/web-build/transfer-staging'
$nextWeb = Join-Path $project 'mobile/web-build/transfer-staging-next'
$api = Join-Path $project 'test-results/transfer-release/backend'
$nextApi = Join-Path $project 'test-results/transfer-release/backend-next'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$webBackup = "$web-before-$stamp"
$apiBackup = "$api-before-$stamp"
foreach ($target in @($web, $nextWeb, $api, $nextApi, $webBackup, $apiBackup)) {
  if (-not [IO.Path]::GetFullPath($target).StartsWith($project + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Publication path is outside the project.' }
}
$live = Invoke-WebRequest 'http://127.0.0.1:8095/release.json' -UseBasicParsing -TimeoutSec 10
if ($live.Headers['X-Lauda-Environment'] -ne 'staging') { throw 'The listener is not the isolated staging gateway.' }
if (Test-Path -LiteralPath $nextWeb) {
  $release = Get-Content -LiteralPath (Join-Path $nextWeb 'release.json') -Raw | ConvertFrom-Json
  if ($release.environment -ne 'staging' -or $release.apiUrl -ne 'https://testes.laudaapp.com/api') { throw 'Invalid staging release.' }
  if (-not (Test-Path -LiteralPath (Join-Path $nextApi 'server.js'))) { throw 'Missing candidate API.' }
  & node (Join-Path $PSScriptRoot 'validate-frontend-api.cjs') --dist $nextWeb --expected-api-url https://testes.laudaapp.com/api
  if ($LASTEXITCODE -ne 0) { throw 'Frontend API validation failed.' }
  Rename-Item -LiteralPath $api -NewName ([IO.Path]::GetFileName($apiBackup))
  try { Rename-Item -LiteralPath $nextApi -NewName 'backend' } catch { Rename-Item -LiteralPath $apiBackup -NewName 'backend'; throw }
  Rename-Item -LiteralPath $web -NewName ([IO.Path]::GetFileName($webBackup))
  try { Rename-Item -LiteralPath $nextWeb -NewName 'transfer-staging' } catch { Rename-Item -LiteralPath $webBackup -NewName 'transfer-staging'; throw }
  Write-Output 'Current staging frontend published; previous release retained.'
}
$expected = Get-Content -LiteralPath (Join-Path $web 'release.json') -Raw | ConvertFrom-Json
$served = Invoke-RestMethod 'http://127.0.0.1:8095/release.json' -TimeoutSec 10
if ($served.sourceHash -ne $expected.sourceHash) { throw 'The gateway did not serve the published version.' }
# Resolve exactly the isolated API listener; production listeners are never targeted.
$listeners = @(netstat -ano -p tcp | ForEach-Object { if ($_ -match '^\s*TCP\s+127\.0\.0\.1:3020\s+\S+\s+LISTENING\s+(\d+)\s*$') { [int]$Matches[1] } } | Select-Object -Unique)
if ($listeners.Count -ne 1) { throw 'Expected exactly one staging API listener on port 3020.' }
$apiProcess = Get-Process -Id $listeners[0] -ErrorAction Stop
if ($apiProcess.ProcessName -ne 'node') { throw 'Unexpected staging API process.' }
$health = Invoke-RestMethod 'http://127.0.0.1:3020/health' -TimeoutSec 10
if ($health.status -ne 'ok') { throw 'Staging API health check failed.' }
try {
  Stop-Process -Id $apiProcess.Id -ErrorAction Stop
} catch {
  Write-Output 'FRONTEND_PUBLISHED_BACKEND_RESTART_PENDING'
  Write-Output $_.Exception.Message
  exit 2
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod 'http://127.0.0.1:8095/health' -TimeoutSec 3
    if ($health.status -eq 'ok') { Write-Output 'STAGING_UPDATE_COMPLETE'; exit 0 }
  } catch { }
}
throw 'Staging API did not recover. The previous build is retained beside the active build.'
