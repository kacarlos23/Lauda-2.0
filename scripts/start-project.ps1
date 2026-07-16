param(
  [int]$BackendPort = 3000,
  [int]$FrontendPort = 8081,
  [string]$PublicApiUrl,
  [ValidateRange(0, 10)]
  [int]$TrustProxyHops = 0,
  [switch]$Production,
  [switch]$RestartBackend,
  [switch]$SkipMigrations
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$MobileRoot = Join-Path $ProjectRoot "mobile"
$BackendUrl = "http://localhost:$BackendPort"
$FrontendUrl = "http://localhost:$FrontendPort"
$ApiUrl = if ([string]::IsNullOrWhiteSpace($PublicApiUrl)) { "$BackendUrl/api" } else { $PublicApiUrl.TrimEnd("/") }
$DbHost = "localhost"
$DbPort = 5434
$DbName = "lauda2"
$DbUser = "postgres"

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

function Write-Fail {
  param([string]$Message)
  Write-Host "[ERRO] $Message" -ForegroundColor Red
}

function Test-CommandExists {
  param([string]$Command)
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Test-DockerDaemon {
  docker info *> $null
  return $LASTEXITCODE -eq 0
}

function Start-DockerDesktopIfAvailable {
  $dockerDesktopPaths = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "$env:LocalAppData\Docker\Docker Desktop.exe"
  )

  foreach ($path in $dockerDesktopPaths) {
    if (Test-Path $path) {
      Write-Warn "Docker daemon nao esta ativo. Abrindo Docker Desktop: $path"
      Start-Process -FilePath $path | Out-Null
      return $true
    }
  }

  return $false
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 1000
  )

  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $connect = $client.BeginConnect($HostName, $Port, $null, $null)
    $success = $connect.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
    if (-not $success) {
      $client.Close()
      return $false
    }
    $client.EndConnect($connect)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Get-PortProcess {
  param([int]$Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $connection) {
    return $null
  }

  try {
    return Get-Process -Id $connection.OwningProcess -ErrorAction Stop
  } catch {
    return [pscustomobject]@{
      Id = $connection.OwningProcess
      ProcessName = "desconhecido"
      Path = $null
    }
  }
}

function Test-BackendHealth {
  try {
    $response = Invoke-RestMethod -Uri "$BackendUrl/health" -TimeoutSec 3
    return $response.status -eq "ok"
  } catch {
    return $false
  }
}

function Test-FrontendHealth {
  try {
    $response = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -Method Head -TimeoutSec 3
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [string]$Name,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (& $Condition) {
      Write-Ok "$Name esta respondendo."
      return $true
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)

  Write-Fail "$Name nao respondeu dentro de $TimeoutSeconds segundos."
  return $false
}

function Invoke-LoggedCommand {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory
  )

  $process = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -PassThru

  return $process
}

function Start-Backend {
  $mode = if ($Production) { "prod" } else { "dev" }
  $outLog = Join-Path $ProjectRoot "backend.$mode.out.log"
  $errLog = Join-Path $ProjectRoot "backend.$mode.err.log"
  $runCommand = if ($Production) { "npm start" } else { "npm run dev" }
  $productionEnvironment = if ($Production) { "set NODE_ENV=production&& set HOST=127.0.0.1&& set TRUST_PROXY_HOPS=$TrustProxyHops&& " } else { "" }
  $command = "${productionEnvironment}set PORT=$BackendPort&& set DATABASE_URL=postgresql://postgres:postgres@localhost:$DbPort/$DbName&& ($runCommand) >> `"$outLog`" 2>> `"$errLog`""

  $process = Invoke-LoggedCommand -FilePath "cmd.exe" -ArgumentList @("/d", "/s", "/c", $command) -WorkingDirectory $ProjectRoot
  Write-Ok "Backend $mode iniciado em background. PID do launcher: $($process.Id). Logs: backend.$mode.out.log / backend.$mode.err.log"
}

function Build-ProductionBackend {
  Write-Step "Gerando backend de producao atualizado"
  Push-Location $ProjectRoot
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Build do backend de producao falhou."
    }
    Write-Ok "Backend de producao atualizado em dist."
  } finally {
    Pop-Location
  }
}

function Start-Frontend {
  $mode = if ($Production) { "prod" } else { "dev" }
  $outLog = Join-Path $ProjectRoot "frontend.$mode.out.log"
  $errLog = Join-Path $ProjectRoot "frontend.$mode.err.log"
  $runCommand = if ($Production) {
    "npm run serve:web -- --listen $FrontendPort"
  } else {
    "npm run web -- --port $FrontendPort"
  }
  $command = "set EXPO_PUBLIC_API_URL=$ApiUrl&& ($runCommand) >> `"$outLog`" 2>> `"$errLog`""

  $process = Invoke-LoggedCommand -FilePath "cmd.exe" -ArgumentList @("/d", "/s", "/c", $command) -WorkingDirectory $MobileRoot
  Write-Ok "Frontend $mode iniciado em background. PID do launcher: $($process.Id). Logs: frontend.$mode.out.log / frontend.$mode.err.log"
}

function Build-ProductionFrontend {
  Write-Step "Gerando frontend de producao atualizado"
  $hadApiUrl = Test-Path Env:EXPO_PUBLIC_API_URL
  $previousApiUrl = $env:EXPO_PUBLIC_API_URL

  Push-Location $MobileRoot
  try {
    $env:EXPO_PUBLIC_API_URL = $ApiUrl
    npm run build:web
    if ($LASTEXITCODE -ne 0) {
      throw "Build do frontend de producao falhou."
    }
    Write-Ok "Bundle de producao atualizado em mobile/dist."
  } finally {
    Pop-Location
    if ($hadApiUrl) {
      $env:EXPO_PUBLIC_API_URL = $previousApiUrl
    } else {
      Remove-Item Env:EXPO_PUBLIC_API_URL -ErrorAction SilentlyContinue
    }
  }
}

Write-Step "Validando pre-requisitos"
if (-not (Test-CommandExists "docker")) {
  throw "Docker nao foi encontrado no PATH. Inicie/instale o Docker Desktop antes de rodar este script."
}
if (-not (Test-CommandExists "npm")) {
  throw "npm nao foi encontrado no PATH. Instale Node.js/npm antes de rodar este script."
}
Write-Ok "Docker e npm encontrados."

if (-not (Test-DockerDaemon)) {
  $dockerStarted = Start-DockerDesktopIfAvailable
  if ($dockerStarted) {
    $dockerReady = Wait-Until -Name "Docker daemon" -TimeoutSeconds 120 -Condition { Test-DockerDaemon }
    if (-not $dockerReady) {
      throw "Docker Desktop foi aberto, mas o daemon nao ficou pronto. Verifique o Docker Desktop e rode o script novamente."
    }
  } else {
    throw "Docker daemon nao esta ativo e o Docker Desktop nao foi encontrado nos caminhos padrao. Abra o Docker Desktop e rode o script novamente."
  }
}
Write-Ok "Docker daemon esta ativo."

Write-Step "Verificando DB PostgreSQL"
if (-not (Test-TcpPort -HostName $DbHost -Port $DbPort)) {
  Write-Warn "PostgreSQL nao esta respondendo em ${DbHost}:${DbPort}. Subindo container via docker compose."
  Push-Location $ProjectRoot
  try {
    docker compose up -d postgres
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose up -d postgres falhou."
    }
  } finally {
    Pop-Location
  }
} else {
  Write-Ok "Porta do PostgreSQL ja esta aberta em ${DbHost}:${DbPort}."
}

$dbReady = Wait-Until -Name "PostgreSQL" -TimeoutSeconds 60 -Condition {
  docker compose exec -T postgres pg_isready -U $DbUser -d $DbName | Out-Null
  return $LASTEXITCODE -eq 0
}

if (-not $dbReady) {
  throw "DB nao ficou pronto. Veja o status com: docker compose ps"
}

if (-not $SkipMigrations) {
  Write-Step "Conferindo/aplicando migrations do Prisma"
  Push-Location $ProjectRoot
  try {
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
      throw "Prisma migrate deploy falhou."
    }
    Write-Ok "Migrations conferidas/aplicadas."
  } finally {
    Pop-Location
  }
} else {
  Write-Warn "Migrations ignoradas por parametro -SkipMigrations."
}

if ($Production) {
  Build-ProductionBackend
  Build-ProductionFrontend
}

Write-Step "Verificando backend"
if ($RestartBackend -and (Test-BackendHealth)) {
  $backendProcess = Get-PortProcess -Port $BackendPort
  if ($backendProcess) {
    Write-Warn "Reiniciando backend para carregar o build atualizado (PID $($backendProcess.Id))."
    Stop-Process -Id $backendProcess.Id -Force
    $deadline = (Get-Date).AddSeconds(15)
    while ((Test-TcpPort -HostName $DbHost -Port $BackendPort) -and (Get-Date) -lt $deadline) {
      Start-Sleep -Milliseconds 250
    }
    if (Test-TcpPort -HostName $DbHost -Port $BackendPort) {
      throw "A porta $BackendPort nao foi liberada apos reiniciar o backend."
    }
  }
}

if (Test-BackendHealth) {
  Write-Ok "Backend ja esta saudavel em $BackendUrl/health."
} else {
  $backendProcess = Get-PortProcess -Port $BackendPort
  if ($backendProcess) {
    Write-Fail "A porta $BackendPort esta ocupada, mas nao respondeu como backend saudavel."
    Write-Warn "Processo encontrado: PID $($backendProcess.Id), nome $($backendProcess.ProcessName), caminho $($backendProcess.Path)"
    throw "Libere a porta $BackendPort ou ajuste -BackendPort antes de iniciar o backend."
  }

  Start-Backend
  $backendReady = Wait-Until -Name "Backend" -TimeoutSeconds 60 -Condition { Test-BackendHealth }
  if (-not $backendReady) {
    throw "Backend nao ficou saudavel. Verifique backend.dev.err.log."
  }
}

Write-Step "Verificando frontend"
if (Test-FrontendHealth) {
  Write-Ok "Frontend ja esta respondendo em $FrontendUrl."
} else {
  $frontendProcess = Get-PortProcess -Port $FrontendPort
  if ($frontendProcess) {
    Write-Fail "A porta $FrontendPort esta ocupada, mas nao respondeu como frontend saudavel."
    Write-Warn "Processo encontrado: PID $($frontendProcess.Id), nome $($frontendProcess.ProcessName), caminho $($frontendProcess.Path)"
    throw "Libere a porta $FrontendPort ou ajuste -FrontendPort antes de iniciar o frontend."
  }

  Start-Frontend
  $frontendTimeout = if ($Production) { 180 } else { 90 }
  $frontendReady = Wait-Until -Name "Frontend" -TimeoutSeconds $frontendTimeout -Condition { Test-FrontendHealth }
  if (-not $frontendReady) {
    throw "Frontend nao ficou saudavel. Verifique frontend.dev.err.log."
  }
}

Write-Step "Resumo"
Write-Ok "DB conectado e respondendo em ${DbHost}:${DbPort} ($DbName)."
Write-Ok "Backend OK: $BackendUrl/health"
Write-Ok "Frontend OK: $FrontendUrl"
Write-Host ""
Write-Host "Para rodar novamente:" -ForegroundColor Cyan
Write-Host "  .\scripts\start-project.ps1"
Write-Host "  npm run dev:full"
