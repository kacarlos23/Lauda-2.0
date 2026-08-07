param(
  [string]$TunnelName = "laudaapp-local",
  [string]$ConfigPath = (Join-Path $env:USERPROFILE ".cloudflared\laudaapp-local.yml"),
  [int]$StartupTimeoutSeconds = 15
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Get-TunnelProcess {
  return Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$TunnelName*" } |
    Select-Object -First 1
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  throw "cloudflared nao foi encontrado no PATH."
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Configuracao do Cloudflare Tunnel nao encontrada: $ConfigPath"
}

& $cloudflared.Source tunnel --config $ConfigPath ingress validate
if ($LASTEXITCODE -ne 0) {
  throw "A configuracao do Cloudflare Tunnel e invalida."
}

$existingProcess = Get-TunnelProcess
if ($existingProcess) {
  Write-Host "[OK] Cloudflare Tunnel ja esta rodando em background. PID: $($existingProcess.ProcessId)" -ForegroundColor Green
  exit 0
}

$outLog = Join-Path $ProjectRoot "cloudflare-tunnel.out.log"
$errLog = Join-Path $ProjectRoot "cloudflare-tunnel.err.log"
$quotedConfigPath = '"' + $ConfigPath.Replace('"', '\"') + '"'

$process = Start-Process `
  -FilePath $cloudflared.Source `
  -ArgumentList @("tunnel", "--config", $quotedConfigPath, "run", $TunnelName) `
  -WorkingDirectory $ProjectRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

$deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
do {
  Start-Sleep -Milliseconds 500
  $runningProcess = Get-TunnelProcess
  if ($runningProcess) {
    Write-Host "[OK] Cloudflare Tunnel iniciado em background. PID: $($runningProcess.ProcessId)" -ForegroundColor Green
    Write-Host "Logs: cloudflare-tunnel.out.log / cloudflare-tunnel.err.log"
    exit 0
  }
} while ((Get-Date) -lt $deadline -and -not $process.HasExited)

$errorTail = if (Test-Path -LiteralPath $errLog) { (Get-Content -LiteralPath $errLog -Tail 10) -join [Environment]::NewLine } else { "sem log de erro" }
throw "O Cloudflare Tunnel nao permaneceu em execucao. Ultimas mensagens: $errorTail"
