param(
  [Parameter(Mandatory = $true)][ValidateSet('Inspect', 'Restart', 'PauseWeb', 'ResumeWeb')][string]$Operation,
  [Parameter(Mandatory = $true)][ValidateSet('staging', 'production')][string]$Environment,
  [Parameter(Mandatory = $true)][string]$ProjectRoot
)
$ErrorActionPreference = 'Stop'
function Test-ProductionWebCommand {
  param([string]$CommandLine, [string]$Project)
  $normalized = $CommandLine.Replace('\', '/') -replace '/+', '/'
  $moduleRoot = [regex]::Escape(($Project.TrimEnd('\', '/').Replace('\', '/') + '/mobile/node_modules/'))
  $entry = $moduleRoot + '(?:\.bin/\.\./)?serve/build/main\.js'
  $executable = '(?:"[^"]*node(?:\.exe)?"|node(?:\.exe)?)'
  return $normalized -match ('^' + $executable + '\s+"?' + $entry + '"?\s+"?dist"?\s+--config\s+"?\.\./serve\.json"?\s+--listen\s+8081(?:\s+--no-clipboard)?\s*$')
}
if ($Operation -in @('PauseWeb', 'ResumeWeb')) {
  if ($Environment -ne 'production') { throw 'Web pause is restricted to production.' }
  $webListeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($webListeners.Count -gt 1 -or ($Operation -eq 'PauseWeb' -and $webListeners.Count -ne 1)) { throw 'Expected exactly one production web listener.' }
  if ($webListeners.Count -eq 1) {
    $web = Get-CimInstance Win32_Process -Filter "ProcessId = $($webListeners[0])" -ErrorAction Stop
    $webOwner = Invoke-CimMethod -InputObject $web -MethodName GetOwnerSid -ErrorAction Stop
    $ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    if ($webOwner.ReturnValue -ne 0 -or $webOwner.Sid -ne $ownerSid -or $web.Name -ne 'node.exe' -or -not (Test-ProductionWebCommand -CommandLine $web.CommandLine -Project $ProjectRoot)) { throw 'Unknown production web process or owner.' }
    if ($Operation -eq 'ResumeWeb') { Write-Output 'Recognized production web server already running.'; exit 0 }
    $confirmedWeb = Get-CimInstance Win32_Process -Filter "ProcessId = $($web.ProcessId)" -ErrorAction Stop
    if (-not $confirmedWeb -or $confirmedWeb.CreationDate -ne $web.CreationDate -or $confirmedWeb.CommandLine -ne $web.CommandLine) { throw 'Production web process changed during validation.' }
    Stop-Process -Id $web.ProcessId -ErrorAction Stop
    Wait-Process -Id $web.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
    Write-Output 'Production web server paused for artifact activation.'
    exit 0
  }
  $mobile = Join-Path $ProjectRoot 'mobile'
  $serve = Join-Path $mobile 'node_modules\serve\build\main.js'
  if (-not (Test-Path -LiteralPath $serve -PathType Leaf)) { throw 'Production static server entry is missing.' }
  $stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
  $queue = Join-Path $ProjectRoot '.lauda-publisher'
  Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList @(('"{0}"' -f $serve), 'dist', '--config', '../serve.json', '--listen', '8081', '--no-clipboard') -WorkingDirectory $mobile -WindowStyle Hidden -RedirectStandardOutput (Join-Path $queue "production-web-$stamp.out.log") -RedirectStandardError (Join-Path $queue "production-web-$stamp.err.log") | Out-Null
  $webDeadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 250
    try {
      $response = Invoke-WebRequest 'http://127.0.0.1:8081/' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { Write-Output 'Production web server resumed and healthy.'; exit 0 }
    } catch { }
  } while ((Get-Date) -lt $webDeadline)
  throw 'Production web server did not recover. Inspect production-web logs.'
}
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
