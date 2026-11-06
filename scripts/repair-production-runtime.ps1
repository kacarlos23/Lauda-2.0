# One-time administrator handover of the legacy API. Does not publish artifacts,
# build, migrate, change process permissions or restart web/staging/Cloudflare.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this one-time production runtime repair in administrator PowerShell under the publisher owner account.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$queue = Join-Path $project '.lauda-publisher'
$taskName = 'Lauda-Production-API'
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$node = (Get-Command node.exe -ErrorAction Stop).Source
. (Join-Path $PSScriptRoot 'publisher\install-common.ps1')
. (Join-Path $PSScriptRoot 'publisher\staging-runtime-common.ps1')
. (Join-Path $PSScriptRoot 'publisher\production-runtime-common.ps1')
function Get-ProductionProcess {
  param([int]$ProcessId)
  $value = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
  if (-not $value) { throw 'Production process disappeared. Nothing was stopped.' }
  $owner = Invoke-CimMethod -InputObject $value -MethodName GetOwnerSid -ErrorAction Stop
  if ($owner.ReturnValue -ne 0) { throw 'Could not inspect production process ownership.' }
  return [pscustomobject]@{ ProcessId=$value.ProcessId; ParentProcessId=$value.ParentProcessId; Name=$value.Name; CommandLine=$value.CommandLine; CreationDate=$value.CreationDate; OwnerSid=$owner.Sid }
}
try {
  Assert-NoReparsePoint $queue
  Assert-NoReparsePoint (Join-Path $project 'dist')
  if (-not (Get-PublisherHeartbeat -Queue $queue -Project $project)) { throw 'Publisher must be healthy before runtime repair.' }
  Assert-PublisherRepairTask -Task (Get-ScheduledTask -TaskName 'Lauda-Publisher' -ErrorAction Stop) -OwnerSid $identity.User.Value -Project $project -Installed (Join-Path $env:ProgramData 'Lauda\Publisher') -Node $node -PowerShell $powershell
  foreach ($folder in @('processing','inbox')) {
    if (@(Get-ChildItem -LiteralPath (Join-Path $queue $folder) -Filter '*.json' -File).Count) { throw 'A publisher request is pending. Wait for its result before repair.' }
  }
  $listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($listeners.Count -ne 1) { throw 'Expected exactly one production API listener. Nothing was stopped.' }
  $api = Get-ProductionProcess -ProcessId $listeners[0]
  $parent = Get-ProductionProcess -ProcessId $api.ParentProcessId
  Assert-ProductionRuntimeApi -Api $api -Parent $parent -OwnerSid $identity.User.Value -Project $project
  $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 5
  if ($health.status -ne 'ok') { throw 'Existing production API is not healthy. Nothing was stopped.' }
  $entry = Join-Path $project 'dist\server.js'
  $beforeHash = (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash
  $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'start-production-standard.ps1') + '"'
  $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Assert-ProductionRuntimeTask -Task $existingTask -OwnerSid $identity.User.Value -Project $project -PowerShell $powershell -Arguments $arguments
  if ($existingTask -and $existingTask.State -eq 'Running') { throw 'Standard production API task is already running. Inspect publisher status; do not repeat repair.' }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $report = @{ createdAt=[DateTime]::UtcNow.ToString('o'); api=$api; parent=$parent; serverHash=$beforeHash }
  [IO.File]::WriteAllText((Join-Path $queue "production-runtime-before-$stamp.json"), ($report | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
  if ($existingTask) { Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath (Join-Path $queue "production-task-before-$stamp.xml") }
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $project
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity.Name
  Register-ScheduledTask -TaskName $taskName -Action $action -Principal $taskPrincipal -Trigger $trigger -Settings $settings -Description 'Keeps only the compiled production Lauda API under the owner standard logged-on token; publication stays with Lauda-Publisher.' -Force | Out-Null
  # Detect PID reuse or a changed launcher before the single permitted stop.
  $confirmed = Get-ProductionProcess -ProcessId $api.ProcessId
  $confirmedParent = Get-ProductionProcess -ProcessId $parent.ProcessId
  Assert-ProductionRuntimeApi -Api $confirmed -Parent $confirmedParent -OwnerSid $identity.User.Value -Project $project
  if ($confirmed.CreationDate -ne $api.CreationDate -or $confirmed.CommandLine -ne $api.CommandLine -or $confirmedParent.CreationDate -ne $parent.CreationDate -or $confirmedParent.CommandLine -ne $parent.CommandLine) { throw 'Production API or launcher changed during inspection. Nothing was stopped.' }
  Stop-Process -Id $api.ProcessId -ErrorAction Stop
  Start-ScheduledTask -TaskName $taskName
  $deadline = (Get-Date).AddSeconds(60)
  $ready = $false
  do {
    Start-Sleep -Seconds 1
    try {
      $next = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess -Unique)
      $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 3
      if ($next.Count -eq 1 -and $next[0] -ne $api.ProcessId -and $health.status -eq 'ok') { $ready = $true; break }
    } catch { }
  } while ((Get-Date) -lt $deadline)
  if (-not $ready) { throw 'Production API did not recover. Inspect production-api logs and task diagnostics; do not repeat repair blindly.' }
  if ((Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash -ne $beforeHash) { throw 'Active compiled API changed during handover. Inspect the saved report.' }
  $output = & $node (Join-Path $PSScriptRoot 'request-publication.cjs') status 2>&1
  $output | ForEach-Object { Write-Output $_ }
  if ($LASTEXITCODE -ne 0) { throw 'Publisher status failed. Inspect the saved request result.' }
  $requestId = [regex]::Match(($output -join "`n"), 'Request: ([a-f0-9-]{36})').Groups[1].Value
  if (-not $requestId) { throw 'Missing publisher status ID.' }
  $result = Get-Content -LiteralPath (Join-Path $queue "results\$requestId.json") -Raw | ConvertFrom-Json
  if (-not $result.data.services.production.processManagement -or $result.data.services.production.processManagementError) { throw 'Publisher still cannot manage production. Inspect status and logs; do not repeat repair.' }
  Write-Output 'PRODUCTION RUNTIME READY: API healthy and recognized by the publisher. No release was published; web, staging and Cloudflare were not restarted.'
} catch {
  $failure = @{ at=[DateTime]::UtcNow.ToString('o'); error=$_.Exception.Message }
  try { [IO.File]::WriteAllText((Join-Path $queue 'installation-production-runtime-failed.json'), ($failure | ConvertTo-Json), [Text.UTF8Encoding]::new($false)) } catch { }
  throw
}
