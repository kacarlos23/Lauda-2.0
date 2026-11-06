function Assert-ProductionRuntimeApi {
  param($Api, $Parent, [string]$OwnerSid, [string]$Project)
  if (-not $Api -or $Api.OwnerSid -ne $OwnerSid) { throw 'Production API belongs to another account. Nothing was stopped.' }
  if (-not (Test-StagingNodeCommand -Process $Api -AbsoluteEntries @((Join-Path $Project 'dist\server.js'), (Join-Path $Project 'scripts\start-production.cjs')) -RelativeEntries @('dist/server.js', 'scripts/start-production.cjs'))) { throw 'Unknown production API. Nothing was stopped.' }
  if (-not $Parent -or $Parent.ProcessId -ne $Api.ParentProcessId -or $Parent.OwnerSid -ne $OwnerSid -or $Parent.Name -ne 'cmd.exe' -or $Parent.CommandLine.IndexOf($Project + '\', [StringComparison]::OrdinalIgnoreCase) -lt 0 -or $Parent.CommandLine -notmatch 'node\s+dist[\\/]server\.js') { throw 'Production API launcher does not identify this project. Nothing was stopped.' }
}

function Assert-ProductionRuntimeTask {
  param($Task, [string]$OwnerSid, [string]$Project, [string]$PowerShell, [string]$Arguments)
  if (-not $Task) { return }
  $sid = if ($Task.Principal.UserId -match '^S-1-') { $Task.Principal.UserId } else { ([Security.Principal.NTAccount]::new($Task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value }
  $actions = @($Task.Actions)
  if ($sid -ne $OwnerSid -or $Task.Principal.RunLevel -ne 'Limited' -or $actions.Count -ne 1 -or $actions[0].Execute -ne $PowerShell -or $actions[0].Arguments -ne $Arguments -or $actions[0].WorkingDirectory -ne $Project) { throw 'Existing production API task has an unknown owner or action. Nothing was changed.' }
}
