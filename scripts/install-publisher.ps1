param([switch]$Repair)
$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Open PowerShell as administrator and run this installer again. No changes were made.'
}
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$installed = Join-Path $env:ProgramData 'Lauda\Publisher'
$queue = Join-Path $project '.lauda-publisher'
$taskName = 'Lauda-Publisher'
. (Join-Path $PSScriptRoot 'publisher\install-common.ps1')
try {
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask -and -not $Repair) { throw 'Publisher is already registered. To repair a failed installation, run this installer with -Repair.' }
if ($Repair -and -not $existingTask) { throw 'There is no existing publisher task to repair. Run the installer without -Repair.' }
if ($existingTask) {
  Assert-PublisherRepairTask -Task $existingTask -OwnerSid $identity.User.Value -Project $project -Installed $installed -Node $node -PowerShell $powershell
}
# All file operations stay in these explicitly named directories. No recursive deletion.
Assert-NoReparsePoint $queue
New-Item -ItemType Directory -Path $queue -Force | Out-Null
foreach ($folder in @('inbox', 'processing', 'results')) {
  $target = Join-Path $queue $folder
  Assert-NoReparsePoint $target
  New-Item -ItemType Directory -Path $target -Force | Out-Null
}
if ($existingTask) {
  Write-PublisherDiagnostics -TaskName $taskName -Queue $queue -Phase 'before-repair'
  $state = Get-PublisherHeartbeat -Queue $queue -Project $project
  if ($state) { Write-Output 'Publisher already responding; repair was not needed.'; exit 0 }
  if (@(Get-ChildItem -LiteralPath (Join-Path $queue 'processing') -Filter '*.json' -File).Count -gt 0) { throw 'A publication may be interrupted. Inspect processing and active releases before repairing.' }
  $taskBackup = Join-Path $queue ('task-before-repair-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
  [IO.File]::WriteAllText($taskBackup, (Export-ScheduledTask -TaskName $taskName), [Text.UTF8Encoding]::new($false))
  Stop-ScheduledTask -TaskName $taskName
  $stopDeadline = (Get-Date).AddSeconds(10)
  while ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running') {
    if ((Get-Date) -gt $stopDeadline) { throw 'Publisher task did not stop. No installed files were replaced.' }
    Start-Sleep -Milliseconds 250
  }
}
Assert-NoReparsePoint -Path $installed -Shallow
if (-not (Test-Path -LiteralPath $installed)) { New-Item -ItemType Directory -Path $installed -Force | Out-Null }
# Restore only this publisher's installed files BEFORE reading config.json.
# Use complete, explicit file/directory DACLs so a previous failed installation
# cannot leave config unreadable or retain an unintended inherited grant.
Set-PublisherInstalledPermissions -Installed $installed -OwnerSid $identity.User.Value
if ($existingTask) {
  $existingConfig = Get-Content -LiteralPath (Join-Path $installed 'config.json') -Raw | ConvertFrom-Json
  if ($existingConfig.projectRoot -ne $project) { throw 'Existing task is configured for a different project. Installed content was not replaced.' }
}
foreach ($file in @('core.cjs', 'worker.cjs', 'processes.ps1', 'launch.ps1')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "publisher\$file") -Destination (Join-Path $installed $file) -Force
}
$utf8 = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $installed 'config.json'), (@{ projectRoot = $project; powershell = $powershell; node = $node } | ConvertTo-Json), $utf8)
# The worker uses the owner's STANDARD token, never SYSTEM or an elevated token.
# The writable repository/artifacts therefore never execute as administrator.
Set-PublisherInstalledPermissions -Installed $installed -OwnerSid $identity.User.Value
# Fail during installation if the installed configuration is still unreadable.
$null = Get-Content -LiteralPath (Join-Path $installed 'config.json') -Raw | ConvertFrom-Json
$requesterSids = @($identity.User.Value)
foreach ($account in @('CodexSandboxOffline', 'CodexSandboxOnline')) {
  try { $requesterSids += ([Security.Principal.NTAccount]::new($env:COMPUTERNAME, $account)).Translate([Security.Principal.SecurityIdentifier]).Value }
  catch { Write-Output "Optional sandbox account not found: $account" }
}
foreach ($sid in ($requesterSids | Select-Object -Unique)) {
  & icacls.exe $queue /grant:r "*${sid}:(OI)(CI)M" /T /Q | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to grant publication queue access to SID $sid" }
}
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $installed 'launch.ps1') + '" -ConfigPath "' + (Join-Path $installed 'config.json') + '"'
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $project
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $identity.Name -LogonType Interactive -RunLevel Limited
$triggers = @((New-ScheduledTaskTrigger -AtLogOn -User $identity.Name))
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $taskPrincipal -Trigger $triggers -Settings $settings -Description 'Processes fixed Lauda publication requests in the owner logged-on standard Windows session. No administrator execution.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
$deadline = (Get-Date).AddSeconds(25)
do {
  Start-Sleep -Milliseconds 500
  $state = Get-PublisherHeartbeat -Queue $queue -Project $project
  if ($state) {
      Write-Output "Publisher installed and responding as $($state.account). No application was restarted."
      & $node (Join-Path $PSScriptRoot 'request-publication.cjs') status
      if ($LASTEXITCODE -ne 0) { throw 'Publisher installed but status request failed. Check .lauda-publisher and Task Scheduler.' }
      exit 0
  }
} while ((Get-Date) -lt $deadline)
Write-PublisherDiagnostics -TaskName $taskName -Queue $queue -Phase 'startup-failed'
throw 'Publisher did not start. Scheduler result and startup logs were saved to .lauda-publisher/installation-startup-failed.json. Do not repeat the installer; inspect this report.'
} catch {
  $installationFailure = $_
  try {
    if (Test-Path -LiteralPath $queue -PathType Container) { Write-PublisherDiagnostics -TaskName $taskName -Queue $queue -Phase 'failed' -Failure $installationFailure.Exception.Message }
  } catch { Write-Warning "Could not save publisher diagnostics: $($_.Exception.Message)" }
  throw $installationFailure
}
