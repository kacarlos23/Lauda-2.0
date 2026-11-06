param(
  [Parameter(Mandatory = $true)][ValidateSet('Inspect', 'Restart')][string]$Operation,
  [Parameter(Mandatory = $true)][ValidateSet('staging', 'production')][string]$Environment,
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)
$ErrorActionPreference = 'Stop'
$port = if ($Environment -eq 'staging') { 3020 } else { 3000 }
$healthPort = if ($Environment -eq 'staging') { 8095 } else { 3000 }
$listeners = @(netstat -ano -p tcp | ForEach-Object {
  if ($_ -match "^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):$port\s+\S+\s+LISTENING\s+(\d+)\s*$") { [int]$Matches[1] }
} | Select-Object -Unique)
if ($listeners.Count -ne 1) { throw "Expected one API listener on port $port. No process was stopped." }
$target = Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0])"
$owner = Invoke-CimMethod -InputObject $target -MethodName GetOwnerSid
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($owner.ReturnValue -ne 0 -or $owner.Sid -ne $currentSid) { throw 'The API belongs to another Windows account. Initial administrator intervention is required.' }
$entry = if ($Environment -eq 'staging') { 'test-results[\\/]transfer-release[\\/]backend[\\/]server\.js' } else { '(?:dist[\\/]server\.js|scripts[\\/]start-production\.cjs)' }
$rootPattern = [regex]::Escape($ProjectRoot.TrimEnd('\', '/')) + '[\\/]'
$argumentPattern = '(?:^|\s)(?:"' + $rootPattern + $entry + '"|' + $rootPattern + $entry + '|"' + $entry + '"|' + $entry + ')\s*$'
if ($target.Name -ne 'node.exe' -or $target.CommandLine -notmatch $argumentPattern) { throw "Unknown API process on port $port. No process was stopped." }
if ($Operation -eq 'Inspect') { Write-Output "Recognized $Environment API owned by the publisher account on port $port."; exit 0 }
# Re-resolve immediately before stopping to protect against PID reuse.
$confirmed = Get-CimInstance Win32_Process -Filter "ProcessId = $($target.ProcessId)"
if (-not $confirmed -or $confirmed.CreationDate -ne $target.CreationDate -or $confirmed.CommandLine -ne $target.CommandLine) { throw 'API process changed during validation.' }
Stop-Process -Id $target.ProcessId -ErrorAction Stop
# The existing staging gateway or production supervisor restarts its own API.
$deadline = (Get-Date).AddSeconds(115)
do {
  Start-Sleep -Seconds 2
  try {
    $next = @(netstat -ano -p tcp | ForEach-Object {
      if ($_ -match "^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):$port\s+\S+\s+LISTENING\s+(\d+)\s*$") { [int]$Matches[1] }
    } | Select-Object -Unique)
    if ($next.Count -eq 1 -and $next[0] -ne $target.ProcessId) {
      $health = Invoke-RestMethod "http://127.0.0.1:$healthPort/health" -TimeoutSec 3
      if ($health.status -eq 'ok') { Write-Output "$Environment API restarted and healthy."; exit 0 }
    }
  } catch { }
} while ((Get-Date) -lt $deadline)
throw 'API did not recover. Check the gateway/supervisor; do not repeat publication blindly.'
