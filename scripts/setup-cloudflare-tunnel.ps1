param(
  [string]$TunnelName = "laudaapp-local",
  [string]$Domain = "laudaapp.com",
  [int]$FrontendPort = 8081,
  [int]$BackendPort = 3000
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Require-Command {
  param([string]$Command)
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "$Command nao encontrado no PATH."
  }
}

function Invoke-Cloudflared {
  param([string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & cloudflared @Arguments
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Invoke-CloudflaredOutput {
  param([string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & cloudflared @Arguments 2>$null
    if ($LASTEXITCODE -ne 0) {
      return $null
    }
    return ($output -join "`n")
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Get-TunnelId {
  param([string]$Name)

  $json = Invoke-CloudflaredOutput -Arguments @("tunnel", "list", "--output", "json")
  if ([string]::IsNullOrWhiteSpace($json)) {
    return $null
  }

  $tunnels = $json | ConvertFrom-Json
  $tunnel = $tunnels | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if (-not $tunnel) {
    return $null
  }

  return $tunnel.id
}

function Ensure-OriginCert {
  $certPath = Join-Path $env:USERPROFILE ".cloudflared\cert.pem"
  if (Test-Path $certPath) {
    Write-Ok "Certificado Cloudflare encontrado: $certPath"
    return
  }

  Write-Warn "Certificado Cloudflare nao encontrado. O login vai abrir o navegador."
  Write-Warn "Escolha a conta Cloudflare que possui o dominio $Domain."
  $loginExitCode = Invoke-Cloudflared -Arguments @("tunnel", "login")
  if ($loginExitCode -ne 0) {
    throw "Falha no login do Cloudflare."
  }

  if (-not (Test-Path $certPath)) {
    throw "Login concluido sem gerar cert.pem em $certPath. Verifique a autenticacao do Cloudflare."
  }

  Write-Ok "Certificado Cloudflare criado: $certPath"
}

function Ensure-Tunnel {
  param([string]$Name)

  $existingTunnelId = Get-TunnelId -Name $Name
  if ($existingTunnelId) {
    Write-Ok "Tunnel existente encontrado: $Name ($existingTunnelId)"
    return $existingTunnelId
  }

  Write-Step "Criando tunnel $Name"
  $createExitCode = Invoke-Cloudflared -Arguments @("tunnel", "create", $Name)
  if ($createExitCode -ne 0) {
    $existingAfterCreate = Get-TunnelId -Name $Name
    if ($existingAfterCreate) {
      Write-Warn "cloudflared retornou falha ao criar, mas o tunnel ja existe: $Name ($existingAfterCreate)"
      return $existingAfterCreate
    }
    throw "Falha ao criar tunnel $Name."
  }

  $createdTunnelId = Get-TunnelId -Name $Name
  if (-not $createdTunnelId) {
    throw "Tunnel criado, mas nao foi possivel obter o ID pelo comando cloudflared tunnel list."
  }

  Write-Ok "Tunnel criado: $Name ($createdTunnelId)"
  return $createdTunnelId
}

function Write-TunnelConfig {
  param(
    [string]$TunnelId,
    [string]$Name,
    [string]$BaseDomain,
    [int]$WebPort,
    [int]$ApiPort
  )

  $cloudflaredDir = Join-Path $env:USERPROFILE ".cloudflared"
  $credentialsFile = Join-Path $cloudflaredDir "$TunnelId.json"
  $configFile = Join-Path $cloudflaredDir "$Name.yml"

  if (-not (Test-Path $credentialsFile)) {
    throw "Arquivo de credenciais nao encontrado: $credentialsFile"
  }

  $escapedCredentialsFile = $credentialsFile.Replace("\", "\\")
  $config = @"
tunnel: $TunnelId
credentials-file: $escapedCredentialsFile

ingress:
  - hostname: $BaseDomain
    service: http://localhost:$WebPort
  - hostname: www.$BaseDomain
    service: http://localhost:$WebPort
  - hostname: api.$BaseDomain
    service: http://localhost:$ApiPort
  - service: http_status:404
"@

  Set-Content -Path $configFile -Value $config -Encoding UTF8
  Write-Ok "Config gerada: $configFile"
  return $configFile
}

function Ensure-DnsRoute {
  param(
    [string]$Name,
    [string]$Hostname
  )

  Write-Step "Configurando DNS: $Hostname"
  $routeExitCode = Invoke-Cloudflared -Arguments @("tunnel", "route", "dns", "--overwrite-dns", $Name, $Hostname)
  if ($routeExitCode -ne 0) {
    throw "Falha ao configurar DNS para $Hostname."
  }
  Write-Ok "DNS configurado: $Hostname"
}

Require-Command "cloudflared"

Write-Step "Validando autenticacao Cloudflare"
Ensure-OriginCert

Write-Step "Validando tunnel"
$tunnelId = Ensure-Tunnel -Name $TunnelName

Write-Step "Gerando config local"
$configPath = Write-TunnelConfig -TunnelId $tunnelId -Name $TunnelName -BaseDomain $Domain -WebPort $FrontendPort -ApiPort $BackendPort

Ensure-DnsRoute -Name $TunnelName -Hostname $Domain
Ensure-DnsRoute -Name $TunnelName -Hostname "www.$Domain"
Ensure-DnsRoute -Name $TunnelName -Hostname "api.$Domain"

Write-Step "Resumo"
Write-Ok "Tunnel pronto: $TunnelName ($tunnelId)"
Write-Ok "Frontend publico: https://$Domain"
Write-Ok "Frontend publico www: https://www.$Domain"
Write-Ok "Backend publico: https://api.$Domain"
Write-Host ""
Write-Host "Para iniciar o projeto apontando para a API publica:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/start-project.ps1 -PublicApiUrl https://api.$Domain/api"
Write-Host ""
Write-Host "Para iniciar o tunnel:" -ForegroundColor Cyan
Write-Host "  cloudflared tunnel --config `"$configPath`" run $TunnelName"
