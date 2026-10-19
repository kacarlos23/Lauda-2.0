param()

$ErrorActionPreference = "Stop"
$projectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envPath = Join-Path $projectPath ".env.worship-development"
$containerName = "lauda-worship-development-db"
$databaseName = "lauda2_worship_development"
$backendPort = 3010
$frontendPort = 8090
$databasePort = 5435

if (-not (Test-Path -LiteralPath $envPath)) {
  $databasePassword = [Guid]::NewGuid().ToString("N")
  $jwtSecret = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  $refreshSecret = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
  @"
NODE_ENV=development
DEPLOYMENT_ENVIRONMENT=development
DOTENV_CONFIG_PATH=$envPath
DATABASE_URL=postgresql://postgres:${databasePassword}@127.0.0.1:${databasePort}/${databaseName}
POSTGRES_DB=$databaseName
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$databasePassword
JWT_SECRET=$jwtSecret
REFRESH_JWT_SECRET=$refreshSecret
JWT_ISSUER=lauda-worship-development
HOST=127.0.0.1
PORT=$backendPort
TRUST_PROXY_HOPS=0
RATE_LIMIT_STORE=memory
REALTIME_ENABLED=false
PUSH_NOTIFICATIONS_ENABLED=false
PASSWORD_RESET_DELIVERY_MODE=disabled
MEMBER_INVITE_BASE_URL=http://127.0.0.1:${frontendPort}/convite
EXPO_PUBLIC_API_URL=http://127.0.0.1:${backendPort}/api
EXPO_NO_DOTENV=1
EXPO_OFFLINE=1
EXPO_OVERRIDE_METRO_CONFIG=$(Join-Path $projectPath "mobile\metro.worship-test.config.cjs")
"@ | Set-Content -LiteralPath $envPath -Encoding utf8
}

foreach ($line in Get-Content -LiteralPath $envPath) {
  if ($line -match '^([A-Z_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process") }
}
$env:EXPO_OVERRIDE_METRO_CONFIG = Join-Path $projectPath "mobile\metro.worship-test.config.cjs"
$databaseUri = [Uri]$env:DATABASE_URL
if ($databaseUri.Host -ne "127.0.0.1" -or $databaseUri.Port -ne $databasePort -or $databaseUri.AbsolutePath -ne "/$databaseName") {
  throw "Recusado: DATABASE_URL deve apontar exclusivamente para o banco isolado de desenvolvimento."
}
if ($env:NODE_ENV -ne "development" -or $env:PORT -ne "$backendPort" -or $env:EXPO_PUBLIC_API_URL -ne "http://127.0.0.1:${backendPort}/api") {
  throw "Configuracao de desenvolvimento invalida."
}

$exists = docker ps -a --filter "name=^/${containerName}$" --format '{{.Names}}'
if (-not $exists) {
  docker run --detach --name $containerName --restart unless-stopped --publish "127.0.0.1:${databasePort}:5432" --env-file $envPath --mount "type=volume,source=lauda-worship-development-data,target=/var/lib/postgresql/data" postgres:15 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o PostgreSQL de desenvolvimento." }
} else {
  $info = (docker inspect $containerName | ConvertFrom-Json)[0]
  $binding = $info.HostConfig.PortBindings.'5432/tcp'[0]
  if ($binding.HostIp -ne "127.0.0.1" -or $binding.HostPort -ne "$databasePort" -or $info.Config.Env -notcontains "POSTGRES_DB=$databaseName") {
    throw "O container existente nao corresponde ao banco isolado esperado."
  }
  docker start $containerName | Out-Null
}
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  docker exec $containerName pg_isready -U postgres -d $databaseName 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
}
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL de desenvolvimento indisponivel." }

Push-Location $projectPath
try {
  & node node_modules/prisma/build/index.js migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "Falha nas migrations do banco isolado." }

  if (-not (Get-NetTCPConnection -State Listen -LocalPort $backendPort -ErrorAction SilentlyContinue)) {
    $backendProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @("scripts/start-development.cjs") -WorkingDirectory $projectPath -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectPath "backend.worship-development.out.log") -RedirectStandardError (Join-Path $projectPath "backend.worship-development.err.log")
    Write-Output "Backend de desenvolvimento iniciado (PID $($backendProcess.Id))."
  }
  if (-not (Get-NetTCPConnection -State Listen -LocalPort $frontendPort -ErrorAction SilentlyContinue)) {
    $frontendProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList @("node_modules/expo/bin/cli", "start", "--web", "--localhost", "--port", "$frontendPort") -WorkingDirectory (Join-Path $projectPath "mobile") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectPath "frontend.worship-development.out.log") -RedirectStandardError (Join-Path $projectPath "frontend.worship-development.err.log")
    Write-Output "Frontend de desenvolvimento iniciado (PID $($frontendProcess.Id))."
  }
  Write-Output "Desenvolvimento: http://127.0.0.1:${frontendPort}/schedules/worship-order"
} finally { Pop-Location }
