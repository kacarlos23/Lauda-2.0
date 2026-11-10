[CmdletBinding()]
param([switch]$Run)

$ErrorActionPreference = 'Stop'
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$name = 'Lauda-Staging-Deploy'
$directory = Join-Path $project 'test-results\staging-deploy'

if ($Run) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $log = Join-Path $directory 'task.log'
  if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 1048576) {
    Move-Item -LiteralPath $log -Destination (Join-Path $directory 'task.previous.log') -Force
  }
  Push-Location -LiteralPath $project
  try {
    $ErrorActionPreference = 'Continue'
    & $node (Join-Path $PSScriptRoot 'run.cjs') 2>&1 | Out-File -LiteralPath $log -Encoding utf8 -Append
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
  throw 'The staging deployment task already exists. Inspect it before making changes.'
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Run'
$action = New-ScheduledTaskAction -Execute (Join-Path $PSHOME 'powershell.exe') -Argument $arguments -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes 2)
$logon = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $name -Action $action -Trigger @($trigger, $logon) -Principal $principal -Settings $settings -Description 'Aplica releases aprovados da branch staging do Lauda.' | Out-Null
Write-Output 'Lauda-Staging-Deploy registered.'
