function Assert-NoReparsePoint {
  param([string]$Path, [switch]$Shallow)
  $current = [IO.Path]::GetFullPath($Path)
  while ($current) {
    if ((Test-Path -LiteralPath $current -ErrorAction Stop) -and ((Get-Item -LiteralPath $current -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Reparse point refused: $current" }
    $current = [IO.Path]::GetDirectoryName($current)
  }
  if (-not $Shallow -and (Test-Path -LiteralPath $Path -ErrorAction Stop)) {
    foreach ($item in (Get-ChildItem -LiteralPath $Path -Force -Recurse -ErrorAction Stop)) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse point refused: $($item.FullName)" }
    }
  }
}

function New-PublisherInstalledAcl {
  param([Parameter(Mandatory = $true)][string]$OwnerSid, [switch]$Directory)
  $owner = [Security.Principal.SecurityIdentifier]::new($OwnerSid)
  $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
  $administrators = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
  if ($owner -eq $system -or $owner -eq $administrators) { throw 'Publisher owner must be a Windows user account.' }
  $acl = if ($Directory) { [Security.AccessControl.DirectorySecurity]::new() } else { [Security.AccessControl.FileSecurity]::new() }
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner($administrators)
  $inheritance = if ($Directory) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
  foreach ($entry in @(
    @{ Sid = $system; Rights = [Security.AccessControl.FileSystemRights]::FullControl },
    @{ Sid = $administrators; Rights = [Security.AccessControl.FileSystemRights]::FullControl },
    @{ Sid = $owner; Rights = [Security.AccessControl.FileSystemRights]::ReadAndExecute }
  )) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($entry.Sid, $entry.Rights, $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow))
  }
  return $acl
}

# Called only by the administrator installer, after checking the task's owner,
# action and working directory, heartbeat and processing queue. Never read the
# broken DACL first, and never apply directory inheritance flags to a file.
function Set-PublisherInstalledPermissions {
  param([Parameter(Mandatory = $true)][string]$Installed, [Parameter(Mandatory = $true)][string]$OwnerSid)
  Assert-NoReparsePoint -Path $Installed -Shallow
  Set-Acl -LiteralPath $Installed -AclObject (New-PublisherInstalledAcl -OwnerSid $OwnerSid -Directory) -ErrorAction Stop
  Assert-NoReparsePoint -Path $Installed
  foreach ($name in @('core.cjs', 'worker.cjs', 'processes.ps1', 'launch.ps1', 'config.json')) {
    $file = Join-Path $Installed $name
    if (Test-Path -LiteralPath $file -ErrorAction Stop) {
      if ((Get-Item -LiteralPath $file -Force -ErrorAction Stop).PSIsContainer) { throw "Expected an installed publisher file: $file" }
      Set-Acl -LiteralPath $file -AclObject (New-PublisherInstalledAcl -OwnerSid $OwnerSid) -ErrorAction Stop
    }
  }
}

function Assert-PublisherRepairTask {
  param($Task, [string]$OwnerSid, [string]$Project, [string]$Installed, [string]$Node, [string]$PowerShell)
  $existingSid = if ($Task.Principal.UserId -match '^S-1-') { $Task.Principal.UserId } else { ([Security.Principal.NTAccount]::new($Task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value }
  if ($existingSid -ne $OwnerSid) { throw 'Existing task belongs to a different account. Run repair using the original owner account.' }
  $actions = @($Task.Actions)
  $oldArguments = '"' + (Join-Path $Installed 'worker.cjs') + '" "' + (Join-Path $Installed 'config.json') + '"'
  $newArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $Installed 'launch.ps1') + '" -ConfigPath "' + (Join-Path $Installed 'config.json') + '"'
  $oldAction = $actions.Count -eq 1 -and $actions[0].Execute -eq $Node -and $actions[0].Arguments -eq $oldArguments
  $newAction = $actions.Count -eq 1 -and $actions[0].Execute -eq $PowerShell -and $actions[0].Arguments -eq $newArguments
  if (-not ($oldAction -or $newAction) -or $actions[0].WorkingDirectory -ne $Project) { throw 'Existing task has an unknown action or project directory. It will not be stopped or replaced.' }
}

function Get-PublisherHeartbeat {
  param([string]$Queue, [string]$Project)
  $file = Join-Path $Queue 'state.json'
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return $null }
  try {
    $state = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    $age = ((Get-Date).ToUniversalTime() - [datetime]::Parse($state.heartbeat).ToUniversalTime()).TotalSeconds
    if ($age -ge -30 -and $age -lt 10 -and $state.projectRoot -eq $Project -and $state.pid -gt 0) { return $state }
  } catch { }
  return $null
}

function Write-PublisherDiagnostics {
  param([string]$TaskName, [string]$Queue, [string]$Phase, [string]$Failure)
  $report = [ordered]@{ createdAt = (Get-Date).ToUniversalTime().ToString('o'); phase = $Phase }
  if ($Failure) { $report.failure = $Failure }
  try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    $info = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction Stop
    $report.state = [string]$task.State
    $report.account = $task.Principal.UserId
    $report.logonType = [string]$task.Principal.LogonType
    $report.runLevel = [string]$task.Principal.RunLevel
    $report.lastTaskResult = [long]$info.LastTaskResult
    $report.lastTaskResultHex = ('0x{0:X8}' -f [long]$info.LastTaskResult)
    $report.lastRunTime = [string]$info.LastRunTime
    $report.actions = @($task.Actions | Select-Object Execute, Arguments, WorkingDirectory)
  } catch { $report.taskInspectionError = $_.Exception.Message }
  foreach ($name in @('launcher.log', 'worker.stderr.log', 'worker.log')) {
    $file = Join-Path $Queue $name
    if (Test-Path -LiteralPath $file -PathType Leaf) { $report[$name] = @(Get-Content -LiteralPath $file -Tail 15 | ForEach-Object { "$_" }) }
  }
  $json = $report | ConvertTo-Json -Depth 5
  $destination = Join-Path $Queue ('installation-' + $Phase + '.json')
  [IO.File]::WriteAllText($destination, $json, [Text.UTF8Encoding]::new($false))
  Write-Output $json
}
