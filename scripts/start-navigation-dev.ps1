param()

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvironmentFile = Join-Path $ProjectRoot ".env"
$ExpectedBackendPort = 3010
$ExpectedFrontendPort = 8090
$ExpectedDatabasePort = 5435
$ExpectedDatabaseName = "lauda2_navigation"
$ComposeProjectName = "lauda-navigation-dev"

function Get-DotEnvValue {
  param([string]$Name)

  $line = Get-Content -LiteralPath $EnvironmentFile |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -First 1
  if (-not $line) {
    return $null
  }

  $value = ($line -split "=", 2)[1].Trim()
  if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    return $value.Substring(1, $value.Length - 2)
  }
  return $value
}

if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
  throw "Arquivo .env isolado ausente. Copie .env.navigation.example para .env e defina uma senha local."
}

$databaseUrlValue = Get-DotEnvValue -Name "DATABASE_URL"
if ([string]::IsNullOrWhiteSpace($databaseUrlValue)) {
  throw "DATABASE_URL deve existir no .env isolado."
}

try {
  $databaseUri = [Uri]$databaseUrlValue
} catch {
  throw "DATABASE_URL isolada e invalida."
}

$databaseName = $databaseUri.AbsolutePath.Trim("/")
$isLoopback = $databaseUri.Host -in @("localhost", "127.0.0.1", "::1")
if (-not $isLoopback -or $databaseUri.Port -ne $ExpectedDatabasePort -or $databaseName -ne $ExpectedDatabaseName) {
  throw "Ambiente recusado: DATABASE_URL deve apontar exclusivamente para 127.0.0.1:${ExpectedDatabasePort}/${ExpectedDatabaseName}."
}

if ($databaseUri.Port -eq 5434 -or $databaseName -eq "lauda2") {
  throw "Ambiente recusado: a base de producao local nao pode ser usada."
}

$inviteBaseUrl = Get-DotEnvValue -Name "MEMBER_INVITE_BASE_URL"
if ($inviteBaseUrl -ne "http://127.0.0.1:${ExpectedFrontendPort}/convite") {
  throw "MEMBER_INVITE_BASE_URL deve apontar para o frontend isolado em 127.0.0.1:${ExpectedFrontendPort}."
}

$frontendApiUrl = Get-DotEnvValue -Name "EXPO_PUBLIC_API_URL"
$expectedFrontendApiUrl = "http://127.0.0.1:${ExpectedBackendPort}/api"
if (-not [string]::IsNullOrWhiteSpace($frontendApiUrl) -and $frontendApiUrl -ne $expectedFrontendApiUrl) {
  throw "EXPO_PUBLIC_API_URL deve apontar para o backend isolado em $expectedFrontendApiUrl."
}

$rateLimitStore = Get-DotEnvValue -Name "RATE_LIMIT_STORE"
if ($rateLimitStore -ne "memory") {
  throw "RATE_LIMIT_STORE deve ser memory no ambiente isolado."
}

if ($ExpectedBackendPort -in @(3000, 8081, 5434) -or $ExpectedFrontendPort -in @(3000, 8081, 5434)) {
  throw "As portas de desenvolvimento colidem com portas protegidas."
}

$env:POSTGRES_HOST_PORT = [string]$ExpectedDatabasePort
$env:POSTGRES_DB = $ExpectedDatabaseName
$env:POSTGRES_USER = Get-DotEnvValue -Name "POSTGRES_USER"
if ([string]::IsNullOrWhiteSpace($env:POSTGRES_USER)) {
  throw "POSTGRES_USER deve existir no .env isolado."
}

& (Join-Path $PSScriptRoot "start-project.ps1") `
  -BackendPort $ExpectedBackendPort `
  -FrontendPort $ExpectedFrontendPort `
  -DatabasePort $ExpectedDatabasePort `
  -DatabaseName $ExpectedDatabaseName `
  -DatabaseUser $env:POSTGRES_USER `
  -ComposeProjectName $ComposeProjectName `
  -LocalhostOnly

if ($LASTEXITCODE -ne 0) {
  throw "Falha ao iniciar o ambiente de navegacao isolado."
}
