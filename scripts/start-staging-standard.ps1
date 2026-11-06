$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'The staging gateway must run with a standard Windows token.' }
$project = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logs = Join-Path $project 'test-results\transfer-release'
$env:LAUDA_STAGING_GATEWAY_PORT = '8095'
$env:LAUDA_STAGING_BACKEND_PORT = '3020'
$child = Start-Process -FilePath (Get-Command node.exe -ErrorAction Stop).Source -ArgumentList ('"' + (Join-Path $PSScriptRoot 'serve-transfer-staging.cjs') + '"') -WorkingDirectory $project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs 'gateway-standard.log') -RedirectStandardError (Join-Path $logs 'gateway-standard.err.log')
$child.WaitForExit()
$child.Refresh()
if ($null -eq $child.ExitCode) { exit 1 }
exit $child.ExitCode
