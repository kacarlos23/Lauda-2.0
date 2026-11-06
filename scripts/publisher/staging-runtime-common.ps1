function Test-StagingNodeCommand {
  param($Process, [string[]]$AbsoluteEntries, [string[]]$RelativeEntries)
  if ($Process.Name -ne 'node.exe' -or [string]::IsNullOrWhiteSpace($Process.CommandLine)) { return $false }
  $entries = @($AbsoluteEntries | ForEach-Object { [regex]::Escape($_).Replace('\\', '[\\/]') })
  $entries += @($RelativeEntries | ForEach-Object { '(?:\.[\\/])?' + [regex]::Escape($_).Replace('\\', '[\\/]').Replace('/', '[\\/]') })
  $entry = $entries -join '|'
  return $Process.CommandLine -match ('(?:^|\s)(?:"(?:' + $entry + ')"|(?:' + $entry + '))\s*$')
}

function Assert-StagingRuntimePair {
  param($Gateway, $Api, [string]$OwnerSid, [string]$Project, [string]$LegacyProject)
  foreach ($process in @($Gateway, $Api)) {
    if (-not $process -or $process.OwnerSid -ne $OwnerSid) { throw 'Staging process belongs to another account or could not be inspected. Nothing was stopped.' }
  }
  $gatewayEntries = @((Join-Path $Project 'scripts\serve-transfer-staging.cjs'), (Join-Path $LegacyProject 'scripts\public-test-server.cjs'))
  $apiEntries = @((Join-Path $Project 'test-results\transfer-release\backend\server.js'), (Join-Path $LegacyProject 'dist\server.js'))
  if (-not (Test-StagingNodeCommand -Process $Gateway -AbsoluteEntries $gatewayEntries -RelativeEntries @('scripts/serve-transfer-staging.cjs', 'scripts/public-test-server.cjs'))) { throw 'Unknown staging gateway. Nothing was stopped.' }
  if (-not (Test-StagingNodeCommand -Process $Api -AbsoluteEntries $apiEntries -RelativeEntries @('test-results/transfer-release/backend/server.js', 'dist/server.js'))) { throw 'Unknown staging API. Nothing was stopped.' }
  if ($Api.ParentProcessId -ne $Gateway.ProcessId) { throw 'Staging API is not a child of the recognized gateway. Nothing was stopped.' }
}

function Assert-StagingRuntimeTask {
  param($Task, [string]$OwnerSid, [string]$Project, [string]$PowerShell, [string]$Arguments)
  if (-not $Task) { return }
  $sid = if ($Task.Principal.UserId -match '^S-1-') { $Task.Principal.UserId } else { ([Security.Principal.NTAccount]::new($Task.Principal.UserId)).Translate([Security.Principal.SecurityIdentifier]).Value }
  $actions = @($Task.Actions)
  if ($sid -ne $OwnerSid -or $Task.Principal.RunLevel -ne 'Limited' -or $actions.Count -ne 1 -or $actions[0].Execute -ne $PowerShell -or $actions[0].Arguments -ne $Arguments -or $actions[0].WorkingDirectory -ne $Project) { throw 'Existing Lauda-Staging task has an unknown owner or action. Nothing was changed.' }
}
