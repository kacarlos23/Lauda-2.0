# Administrator maintenance of a healthy publisher, separate from publication.
# No application process, release, database, task definition or ACL is changed.
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run publisher maintenance in administrator PowerShell under the original owner account.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$queue = Join-Path $project '.lauda-publisher'
$installed = Join-Path $env:ProgramData 'Lauda\Publisher'
$taskName = 'Lauda-Publisher'
$node = (Get-Command node.exe -ErrorAction Stop).Source
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
. (Join-Path $PSScriptRoot 'publisher\install-common.ps1')
try {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  Assert-PublisherRepairTask -Task $task -OwnerSid $identity.User.Value -Project $project -Installed $installed -Node $node -PowerShell $powershell
  if ($task.Principal.RunLevel -ne 'Limited' -or $task.Principal.LogonType -ne 'Interactive') { throw 'Publisher must already use the owner standard interactive token. No task definition was changed.' }
  Assert-PublisherQueueIdle -Queue $queue
  $before = Get-PublisherHeartbeat -Queue $queue -Project $project
  if (-not $before) { throw 'Publisher is not healthy. Inspect startup diagnostics and the documented repair procedure instead of updating.' }
  Assert-NoReparsePoint -Path $installed
  $config = Get-Content -LiteralPath (Join-Path $installed 'config.json') -Raw | ConvertFrom-Json
  if ($config.projectRoot -ne $project -or $config.node -ne $node -or $config.powershell -ne $powershell) { throw 'Installed publisher configuration does not match this project. No installed files were replaced.' }
  $worker = Get-VerifiedPublisherWorker -ProcessId $before.pid -OwnerSid $identity.User.Value -Node $node -Installed $installed
  if (-not $worker) { throw 'The publisher worker exited before maintenance. Inspect its status.' }
  $files = @('core.cjs','worker.cjs','processes.ps1','launch.ps1')
  $hashes = @{}
  foreach ($name in $files) {
    $source = Join-Path $PSScriptRoot "publisher\$name"
    Assert-NoReparsePoint $source
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing publisher source: $name" }
    if (-not (Test-Path -LiteralPath (Join-Path $installed $name) -PathType Leaf)) { throw "Missing installed publisher file: $name" }
    $hashes[$name] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
  }
  $backup = Join-Path $queue ('publisher-before-update-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))
  Assert-NoReparsePoint $backup
  New-Item -ItemType Directory -Path $backup | Out-Null
  foreach ($name in $files) { Copy-Item -LiteralPath (Join-Path $installed $name) -Destination (Join-Path $backup $name) }
  Export-ScheduledTask -TaskName $taskName | Set-Content -LiteralPath (Join-Path $backup 'task.xml')
  $before | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'state.json')
  Assert-PublisherQueueIdle -Queue $queue
  if ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running') {
    Stop-ScheduledTask -TaskName $taskName
  }
  $stopDeadline = (Get-Date).AddSeconds(12)
  while ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running') {
    if ((Get-Date) -gt $stopDeadline) { throw 'Publisher did not stop completely. No installed files were replaced. Inspect the saved worker PID and task diagnostics.' }
    Start-Sleep -Milliseconds 250
  }
  # Task Scheduler can stop the PowerShell launcher and leave its Node child alive.
  $remaining = Get-Process -Id $worker.ProcessId -ErrorAction SilentlyContinue
  if ($remaining) {
    try {
      $null = $remaining.Handle
      $verified = Get-VerifiedPublisherWorker -ProcessId $worker.ProcessId -OwnerSid $identity.User.Value -Node $node -Installed $installed
      # CIM reports microseconds, while Process.StartTime retains 100 ns ticks.
      if (-not $verified -or $verified.CreationDate -ne $worker.CreationDate -or [Math]::Abs(($remaining.StartTime - $verified.CreationDate).Ticks) -ge 10) {
        throw 'The publisher worker identity changed during maintenance.'
      }
      Assert-PublisherQueueIdle -Queue $queue
      $remaining.Kill()
      if (-not $remaining.WaitForExit(5000)) { throw 'The verified publisher worker did not exit.' }
    } finally { $remaining.Dispose() }
  }
  Assert-PublisherQueueIdle -Queue $queue
  foreach ($name in $files) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot "publisher\$name") -Destination (Join-Path $installed $name) -Force
    if ((Get-FileHash -LiteralPath (Join-Path $installed $name) -Algorithm SHA256).Hash -ne $hashes[$name]) { throw "Installed publisher hash mismatch: $name. Previous files are in $backup" }
  }
  Start-ScheduledTask -TaskName $taskName
  $deadline = (Get-Date).AddSeconds(25)
  do {
    Start-Sleep -Milliseconds 500
    $after = Get-PublisherHeartbeat -Queue $queue -Project $project
    if ($after -and $after.pid -ne $before.pid) {
      & $node (Join-Path $PSScriptRoot 'request-publication.cjs') status
      if ($LASTEXITCODE -ne 0) { throw 'Publisher restarted but its status request failed. Inspect the request result before another action.' }
      Write-Output "PUBLISHER UPDATED: healthy owner-standard worker; previous code saved in $backup. No application was restarted or published."
      exit 0
    }
  } while ((Get-Date) -lt $deadline)
  throw 'Updated publisher has no new heartbeat. Inspect task diagnostics and launcher logs; do not repeat this update blindly.'
} catch {
  $failure = $_
  try { Write-PublisherDiagnostics -TaskName $taskName -Queue $queue -Phase 'update-failed' -Failure $failure.Exception.Message } catch { }
  throw $failure
}
