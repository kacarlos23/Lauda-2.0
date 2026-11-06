# One-time owner intervention for legacy processes. Routine publications and
# API restarts continue to use the dedicated publisher's fixed queue actions.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this one-time staging runtime repair in an administrator PowerShell under the publisher owner account.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$legacyProject = Join-Path $env:USERPROFILE '.codex\worktrees\public-test-environment\Lauda 2.0'
$queue = Join-Path $project '.lauda-publisher'
$taskName = 'Lauda-Staging'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$node = (Get-Command node.exe -ErrorAction Stop).Source
. (Join-Path $PSScriptRoot 'publisher\install-common.ps1')
. (Join-Path $PSScriptRoot 'publisher\staging-runtime-common.ps1')

function Get-StagingListenerProcess {
  param([ValidateSet(8095, 3020)][int]$Port)
  $listeners = @(netstat -ano -p tcp | ForEach-Object {
    if ($_ -match "^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { [int]$Matches[1] }
  } | Select-Object -Unique)
  if ($listeners.Count -ne 1) { throw "Expected one staging listener on port $Port. Nothing was stopped." }
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0])" -ErrorAction Stop
  $owner = Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
  if ($owner.ReturnValue -ne 0) { throw 'Could not inspect staging process ownership.' }
  return [pscustomobject]@{ ProcessId = $process.ProcessId; ParentProcessId = $process.ParentProcessId; Name = $process.Name; CommandLine = $process.CommandLine; CreationDate = $process.CreationDate; OwnerSid = $owner.Sid }
}

try {
  Assert-NoReparsePoint $queue
  if (-not (Get-PublisherHeartbeat -Queue $queue -Project $project)) { throw 'The dedicated publisher must be running before this one-time repair.' }
  $publisherTask = Get-ScheduledTask -TaskName 'Lauda-Publisher' -ErrorAction Stop
  Assert-PublisherRepairTask -Task $publisherTask -OwnerSid $identity.User.Value -Project $project -Installed (Join-Path $env:ProgramData 'Lauda\Publisher') -Node $node -PowerShell $powershell
  foreach ($folder in @('processing', 'inbox')) {
    if (@(Get-ChildItem -LiteralPath (Join-Path $queue $folder) -Filter '*.json' -File).Count) { throw 'A publisher request is pending or processing. Wait for its result before runtime repair.' }
  }
  $web = Join-Path $project 'mobile\web-build\transfer-staging'
  $api = Join-Path $project 'test-results\transfer-release\backend'
  foreach ($path in @($web, $api)) { Assert-NoReparsePoint $path }
  $release = Get-Content -LiteralPath (Join-Path $web 'release.json') -Raw | ConvertFrom-Json
  $backendRelease = Get-Content -LiteralPath (Join-Path $api 'release.json') -Raw | ConvertFrom-Json
  if ($release.environment -ne 'staging' -or $backendRelease.environment -ne 'staging' -or $release.apiUrl -ne 'https://testes.laudaapp.com/api' -or $release.sourceHash -notmatch '^[a-f0-9]{64}$' -or $release.sourceHash -ne $backendRelease.sourceHash) { throw 'Active staging artifacts do not match. Nothing was stopped.' }
  if (-not (Test-Path -LiteralPath (Join-Path $api 'server.js') -PathType Leaf)) { throw 'Compiled staging API is missing.' }
  & $node (Join-Path $PSScriptRoot 'validate-frontend-api.cjs') --dist $web --expected-api-url https://testes.laudaapp.com/api
  if ($LASTEXITCODE -ne 0) { throw 'Staging frontend validation failed. Nothing was stopped.' }
  $response = Invoke-WebRequest 'http://127.0.0.1:8095/release.json' -UseBasicParsing -TimeoutSec 5
  $served = $response.Content | ConvertFrom-Json
  if ($response.Headers['X-Lauda-Environment'] -ne 'staging' -or $served.sourceHash -ne $release.sourceHash) { throw 'The staging gateway is serving an unexpected release.' }
  $gateway = Get-StagingListenerProcess -Port 8095
  $backend = Get-StagingListenerProcess -Port 3020
  Assert-StagingRuntimePair -Gateway $gateway -Api $backend -OwnerSid $identity.User.Value -Project $project -LegacyProject $legacyProject
  $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'start-staging-standard.ps1') + '"'
  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Assert-StagingRuntimeTask -Task $existingTask -OwnerSid $identity.User.Value -Project $project -PowerShell $powershell -Arguments $arguments
  if ($existingTask -and $existingTask.State -eq 'Running') { throw 'The standard staging task is already running. Inspect publisher status and saved results instead of repeating runtime repair.' }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $report = @{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); gateway = $gateway; api = $backend; sourceHash = $release.sourceHash }
  [IO.File]::WriteAllText((Join-Path $queue ('staging-runtime-before-' + $stamp + '.json')), ($report | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
  if ($existingTask) { [IO.File]::WriteAllText((Join-Path $queue ('staging-task-before-' + $stamp + '.xml')), (Export-ScheduledTask -TaskName $taskName), [Text.UTF8Encoding]::new($false)) }
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $project
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
  Register-ScheduledTask -TaskName $taskName -Action $action -Principal $taskPrincipal -Trigger $trigger -Settings $settings -Description 'Runs only the isolated Lauda staging gateway and API using the owner standard logged-on token.' -Force | Out-Null
  # Recheck both identities immediately before stopping either process.
  $currentGateway = Get-StagingListenerProcess -Port 8095
  $currentBackend = Get-StagingListenerProcess -Port 3020
  foreach ($pair in @(@($gateway, $currentGateway), @($backend, $currentBackend))) {
    if ($pair[0].ProcessId -ne $pair[1].ProcessId -or $pair[0].CreationDate -ne $pair[1].CreationDate -or $pair[0].CommandLine -ne $pair[1].CommandLine -or $pair[0].OwnerSid -ne $pair[1].OwnerSid) { throw 'Staging process changed during inspection. Nothing was stopped.' }
  }
  Stop-Process -Id $gateway.ProcessId -ErrorAction Stop
  $remainingBackend = Get-CimInstance Win32_Process -Filter "ProcessId = $($backend.ProcessId)" -ErrorAction Stop
  if ($remainingBackend) {
    if ($remainingBackend.CreationDate -ne $backend.CreationDate -or $remainingBackend.CommandLine -ne $backend.CommandLine) { throw 'Staging API changed before stopping. Inspect the saved runtime report.' }
    Stop-Process -Id $backend.ProcessId -ErrorAction Stop
  }
  Start-ScheduledTask -TaskName $taskName
  $deadline = (Get-Date).AddSeconds(60)
  $ready = $false
  do {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod 'http://127.0.0.1:8095/health' -TimeoutSec 3
      $live = Invoke-RestMethod 'http://127.0.0.1:8095/release.json' -TimeoutSec 3
      if ($health.status -eq 'ok' -and $live.sourceHash -eq $release.sourceHash) { $ready = $true; break }
    } catch { }
  } while ((Get-Date) -lt $deadline)
  if (-not $ready) { throw 'Standard staging gateway did not recover. Inspect gateway-standard.err.log and Lauda-Staging in Task Scheduler. Do not repeat repair automatically.' }
  $newGateway = Get-StagingListenerProcess -Port 8095
  $newBackend = Get-StagingListenerProcess -Port 3020
  Assert-StagingRuntimePair -Gateway $newGateway -Api $newBackend -OwnerSid $identity.User.Value -Project $project -LegacyProject $legacyProject
  $statusOutput = @(& $node (Join-Path $PSScriptRoot 'request-publication.cjs') status)
  $statusOutput | ForEach-Object { Write-Output $_ }
  if ($LASTEXITCODE -ne 0) { throw 'Staging recovered but publisher status failed. Inspect the result before any further action.' }
  $statusRequestId = $null
  foreach ($line in $statusOutput) { if ($line -match '^Request: ([0-9a-f-]{36})$') { $statusRequestId = $Matches[1] } }
  if (-not $statusRequestId) { throw 'Could not identify the publisher status request. Inspect the queue before sending anything else.' }
  $statusResult = Get-Content -LiteralPath (Join-Path $queue ('results\' + $statusRequestId + '.json')) -Raw | ConvertFrom-Json
  if ($statusResult.status -ne 'completed' -or -not $statusResult.data.services.staging.processManagement) { throw 'Staging recovered but the publisher still cannot recognize its API. Inspect the status result; no restart was requested.' }
  $after = @{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); gateway = $newGateway; api = $newBackend; sourceHash = $release.sourceHash; publisherStatusId = $statusRequestId; taskRunLevel = 'Limited' }
  [IO.File]::WriteAllText((Join-Path $queue 'staging-runtime-after.json'), ($after | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
  Write-Output 'STAGING_RUNTIME_READY: the current API is healthy and the publisher recognizes it. Production and release files were not changed.'
} catch {
  $runtimeFailure = $_
  try { Write-PublisherDiagnostics -TaskName $taskName -Queue $queue -Phase 'staging-runtime-failed' -Failure $runtimeFailure.Exception.Message } catch { }
  throw $runtimeFailure
}
