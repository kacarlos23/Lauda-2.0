param([Parameter(Mandatory = $true)][string]$ConfigPath)
$ErrorActionPreference = 'Stop'
$launcherLog = $null
try {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Publisher must run with a standard Windows token, not as administrator.' }
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
  $queue = Join-Path $config.projectRoot '.lauda-publisher'
  $launcherLog = Join-Path $queue 'launcher.log'
  $utf8 = [Text.UTF8Encoding]::new($false)
  [IO.File]::AppendAllText($launcherLog, "$(Get-Date -Format o) Starting publisher as $($identity.Name); launcher PID $PID.`r`n", $utf8)
  if (-not (Test-Path -LiteralPath $config.node -PathType Leaf)) { throw 'Configured Node executable is missing.' }
  $worker = Join-Path $PSScriptRoot 'worker.cjs'
  $child = Start-Process -FilePath $config.node -ArgumentList @(('"' + $worker + '"'), ('"' + $ConfigPath + '"')) -WorkingDirectory $config.projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $queue 'worker.stdout.log') -RedirectStandardError (Join-Path $queue 'worker.stderr.log')
  [IO.File]::AppendAllText($launcherLog, "$(Get-Date -Format o) Worker PID $($child.Id).`r`n", $utf8)
  $child.WaitForExit()
  $child.Refresh()
  $workerExitCode = $child.ExitCode
  if ($null -eq $workerExitCode) { $workerExitCode = 1 }
  [IO.File]::AppendAllText($launcherLog, "$(Get-Date -Format o) Worker exited with code $workerExitCode.`r`n", $utf8)
  exit $workerExitCode
} catch {
  if ($launcherLog) {
    try { [IO.File]::AppendAllText($launcherLog, "$(Get-Date -Format o) ERROR: $($_.Exception.Message)`r`n", [Text.UTF8Encoding]::new($false)) } catch { }
  }
  Write-Error $_
  exit 1
}
