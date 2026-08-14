param(
  [int]$HealthCheckIntervalSeconds = 30,
  [int]$RetryDelaySeconds = 15
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StartProjectScript = Join-Path $PSScriptRoot "start-project.ps1"
$TunnelName = "laudaapp-local"
$TunnelConfig = Join-Path $env:USERPROFILE ".cloudflared\laudaapp-local.yml"
$PublicApiUrl = "https://api.laudaapp.com/api"
$DatabaseHost = "127.0.0.1"
$DatabasePort = 5434
$RedisHost = "127.0.0.1"
$RedisPort = 6379
$SupervisorLog = Join-Path $ProjectRoot "laudaapp-supervisor.log"
$TunnelOutLog = Join-Path $ProjectRoot "cloudflare-tunnel.out.log"
$TunnelErrLog = Join-Path $ProjectRoot "cloudflare-tunnel.err.log"
$MutexName = "Local\LaudaAppSupervisor"
$script:LastStatus = $null

function Rotate-LogIfNeeded {
  param([string]$Path)

  if ((Test-Path -LiteralPath $Path) -and (Get-Item -LiteralPath $Path).Length -gt 10MB) {
    $archivePath = "$Path.previous"
    Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $Path -Destination $archivePath -Force
  }
}

function Write-Log {
  param(
    [string]$Message,
    [ValidateSet("INFO", "OK", "AVISO", "ERRO")]
    [string]$Level = "INFO"
  )

  $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
  $written = $false
  for ($attempt = 1; $attempt -le 10 -and -not $written; $attempt++) {
    try {
      [IO.File]::AppendAllText(
        $SupervisorLog,
        $line + [Environment]::NewLine,
        [Text.UTF8Encoding]::new($false)
      )
      $written = $true
    } catch {
      Start-Sleep -Milliseconds 100
    }
  }
  Write-Host $line
}

function Wait-ForCommand {
  param([string]$Name)

  $lastMessage = [datetime]::MinValue
  while (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    if (((Get-Date) - $lastMessage).TotalSeconds -ge 60) {
      Write-Log "Aguardando o comando $Name ficar disponivel no sistema." "AVISO"
      $lastMessage = Get-Date
    }
    Start-Sleep -Seconds 5
  }
}

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMilliseconds = 1500
  )

  $client = [Net.Sockets.TcpClient]::new()
  try {
    $connectTask = $client.ConnectAsync($HostName, $Port)
    return $connectTask.Wait($TimeoutMilliseconds) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-PostgresHealth {
  return Test-TcpPort -HostName $DatabaseHost -Port $DatabasePort
}

function Test-RedisHealth {
  return Test-TcpPort -HostName $RedisHost -Port $RedisPort
}

function Test-BackendHealth {
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -TimeoutSec 5
    return $response.status -eq "ok"
  } catch {
    return $false
  }
}

function Test-FrontendHealth {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8081" -UseBasicParsing -Method Get -TimeoutSec 10
    return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Test-PublicApiHealth {
  try {
    $response = Invoke-RestMethod -Uri "https://api.laudaapp.com/health" -TimeoutSec 15
    return $response.status -eq "ok"
  } catch {
    return $false
  }
}

function Get-LaudaTunnelProcess {
  Get-CimInstance Win32_Process -Filter "name = 'cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine.IndexOf($TunnelConfig, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $_.CommandLine.IndexOf($TunnelName, [StringComparison]::OrdinalIgnoreCase) -ge 0
      )
    } |
    Select-Object -First 1
}

function Wait-Until {
  param(
    [scriptblock]$Condition,
    [string]$Name,
    [int]$IntervalSeconds = 3
  )

  $lastMessage = [datetime]::MinValue
  while (-not (& $Condition)) {
    if (((Get-Date) - $lastMessage).TotalSeconds -ge 60) {
      Write-Log "Aguardando $Name. O supervisor continuara tentando sem prazo limite." "AVISO"
      $lastMessage = Get-Date
    }
    Start-Sleep -Seconds $IntervalSeconds
  }
  Write-Log "$Name esta pronto." "OK"
}

function Start-LaudaTunnel {
  Wait-ForCommand "cloudflared.exe"
  while (-not (Test-Path -LiteralPath $TunnelConfig)) {
    Write-Log "Configuracao do tunnel ausente. Executando a configuracao assistida." "AVISO"
    try {
      & (Join-Path $PSScriptRoot "setup-cloudflare-tunnel.ps1") |
        ForEach-Object { Write-Log ([string]$_) }
    } catch {
      Write-Log "Configuracao do tunnel falhou: $($_.Exception.Message). Nova tentativa em $RetryDelaySeconds segundos." "ERRO"
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }

  $cloudflaredPath = (Get-Command "cloudflared.exe" -ErrorAction Stop).Source
  while ($true) {
    $existing = Get-LaudaTunnelProcess
    if ($existing) {
      Write-Log "Cloudflare Tunnel esta rodando em background (PID $($existing.ProcessId))." "OK"
      return
    }

    & $cloudflaredPath tunnel --config $TunnelConfig ingress validate |
      ForEach-Object { Write-Log ([string]$_) }
    if ($LASTEXITCODE -ne 0) {
      Write-Log "A configuracao do Cloudflare Tunnel e invalida. Nova tentativa em $RetryDelaySeconds segundos." "ERRO"
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }

    Write-Log "Iniciando Cloudflare Tunnel oculto e com logs redirecionados."
    Start-Process `
      -FilePath $cloudflaredPath `
      -ArgumentList @("tunnel", "--config", $TunnelConfig, "run", $TunnelName) `
      -WorkingDirectory $ProjectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $TunnelOutLog `
      -RedirectStandardError $TunnelErrLog | Out-Null

    Start-Sleep -Seconds 3
    $started = Get-LaudaTunnelProcess
    if ($started) {
      Write-Log "Processo do Cloudflare Tunnel iniciado (PID $($started.ProcessId))." "OK"
      return
    }

    Write-Log "O Cloudflare Tunnel encerrou logo apos iniciar. Nova tentativa em $RetryDelaySeconds segundos." "ERRO"
    Start-Sleep -Seconds $RetryDelaySeconds
  }
}

function Restart-LaudaTunnel {
  $process = Get-LaudaTunnelProcess
  if ($process) {
    Write-Log "Reiniciando Cloudflare Tunnel (PID $($process.ProcessId))." "AVISO"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  Start-LaudaTunnel
}

function Invoke-ProjectStartup {
  param([switch]$RestartBackend)

  $arguments = @{
    DatabasePort = $DatabasePort
    RedisPort = $RedisPort
    PublicApiUrl = $PublicApiUrl
    TrustProxyHops = 1
    StaticFrontend = $true
    WaitIndefinitely = $true
    RecoverUnhealthyPorts = $true
  }
  if ($RestartBackend) {
    $arguments.RestartBackend = $true
  }

  Write-Log "Iniciando/verificando PostgreSQL, Redis, backend e frontend."
  & $StartProjectScript @arguments | ForEach-Object { Write-Log ([string]$_) }
  Write-Log "PostgreSQL, Redis, backend e frontend foram validados." "OK"
}

function Invoke-FinalValidation {
  Wait-Until -Name "PostgreSQL local" -Condition { Test-PostgresHealth }
  Wait-Until -Name "Redis local" -Condition { Test-RedisHealth }
  Wait-Until -Name "backend local" -Condition { Test-BackendHealth }
  Wait-Until -Name "frontend local" -Condition { Test-FrontendHealth }
  Wait-Until -Name "API publica pelo Cloudflare Tunnel" -IntervalSeconds 5 -Condition {
    if (-not (Get-LaudaTunnelProcess)) {
      Start-LaudaTunnel
    }
    Test-PublicApiHealth
  }

  while ($true) {
    & node (Join-Path $PSScriptRoot "validate-frontend-api.cjs") `
      --site-url "https://laudaapp.com" `
      --expected-api-url $PublicApiUrl `
      --retries 3 `
      --retry-delay-ms 5000 | ForEach-Object { Write-Log ([string]$_) }
    if ($LASTEXITCODE -eq 0) {
      Write-Log "Validacao final concluida: frontend e API publicos estao corretos." "OK"
      return
    }
    Write-Log "Frontend publico ainda nao passou na validacao. Nova tentativa em $RetryDelaySeconds segundos." "AVISO"
    Start-Sleep -Seconds $RetryDelaySeconds
  }
}

function Set-Status {
  param([string]$Status)

  if ($script:LastStatus -ne $Status) {
    Write-Log $Status
    $script:LastStatus = $Status
  }
}

Rotate-LogIfNeeded -Path $SupervisorLog
Rotate-LogIfNeeded -Path $TunnelOutLog
Rotate-LogIfNeeded -Path $TunnelErrLog

$mutex = [Threading.Mutex]::new($false, $MutexName)
$hasMutex = $false
try {
  try {
    $hasMutex = $mutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $hasMutex = $true
  }

  if (-not $hasMutex) {
    Write-Log "Ja existe um supervisor do Lauda App em execucao; esta instancia sera encerrada." "AVISO"
    exit 0
  }

  Write-Log "Supervisor do Lauda App iniciado (PID $PID)."
  Set-Location -LiteralPath $ProjectRoot

  foreach ($command in @("node.exe", "npm.cmd", "docker.exe", "cloudflared.exe")) {
    Wait-ForCommand $command
  }

  $firstInitialization = $true
  while ($true) {
    try {
      Invoke-ProjectStartup -RestartBackend:$firstInitialization
      $firstInitialization = $false
      Start-LaudaTunnel
      Invoke-FinalValidation

      $consecutiveLocalFailures = 0
      $consecutivePublicFailures = 0
      while ($true) {
        Start-Sleep -Seconds $HealthCheckIntervalSeconds

        if (-not (Get-LaudaTunnelProcess)) {
          Write-Log "Cloudflare Tunnel parou; reiniciando agora." "AVISO"
          Start-LaudaTunnel
        }

        $databaseOk = Test-PostgresHealth
        $redisOk = Test-RedisHealth
        $backendOk = Test-BackendHealth
        $frontendOk = Test-FrontendHealth
        $localServicesOk = $databaseOk -and $redisOk -and $backendOk -and $frontendOk
        if ($localServicesOk) {
          $consecutiveLocalFailures = 0
        } else {
          $consecutiveLocalFailures++
          Write-Log "Falha de saude local ($consecutiveLocalFailures/3): PostgreSQL=$databaseOk, Redis=$redisOk, backend=$backendOk, frontend=$frontendOk." "AVISO"
        }

        if ($consecutiveLocalFailures -ge 3) {
          throw "Um servico local permaneceu indisponivel e precisa ser recuperado."
        }

        if (Test-PublicApiHealth) {
          $consecutivePublicFailures = 0
          if ($localServicesOk) {
            Set-Status "Lauda App saudavel: PostgreSQL, Redis, backend, frontend e tunnel estao ativos."
          } else {
            Set-Status "API publica responde, mas um servico local esta em recuperacao."
          }
        } else {
          $consecutivePublicFailures++
          Set-Status "API publica temporariamente indisponivel; o tunnel segue monitorado e sera recuperado se cair."
          if ($consecutivePublicFailures -ge 5) {
            Restart-LaudaTunnel
            $consecutivePublicFailures = 0
          }
        }
      }
    } catch {
      Write-Log "Ciclo de inicializacao/monitoramento falhou: $($_.Exception.Message)" "ERRO"
      Write-Log "O supervisor nao sera encerrado; nova tentativa em $RetryDelaySeconds segundos." "AVISO"
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }
} finally {
  if ($hasMutex) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
