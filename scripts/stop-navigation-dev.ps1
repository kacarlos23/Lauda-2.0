param()

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ComposeProjectName = "lauda-navigation-dev"
$ProtectedPorts = @(3000, 8081, 5434)
$DevelopmentPorts = @(3010, 8090)

function Get-ProcessLineage {
  param([int]$ProcessId)

  $lineage = @()
  $currentId = $ProcessId
  $visited = @{}
  while ($currentId -and -not $visited.ContainsKey($currentId)) {
    $visited[$currentId] = $true
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $currentId" -ErrorAction SilentlyContinue
    if (-not $process) {
      break
    }
    $lineage += $process
    $currentId = [int]$process.ParentProcessId
  }
  return $lineage
}

foreach ($port in $DevelopmentPorts) {
  if ($port -in $ProtectedPorts) {
    throw "Recusa de seguranca: tentativa de parar porta protegida $port."
  }

  $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $lineage = Get-ProcessLineage -ProcessId $connection.OwningProcess
    $belongsToWorktree = $lineage | Where-Object {
      $_.CommandLine -and $_.CommandLine.IndexOf($ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
    }
    if (-not $belongsToWorktree) {
      throw "A porta $port pertence a um processo fora do worktree isolado; encerramento recusado."
    }
    Stop-Process -Id $connection.OwningProcess -Force
    Write-Host "[OK] Processo da porta $port encerrado."
  }
}

Push-Location $ProjectRoot
try {
  docker compose -p $ComposeProjectName stop postgres
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao parar o PostgreSQL isolado."
  }
} finally {
  Pop-Location
}

Write-Host "[OK] Ambiente isolado parado; o volume de dados foi preservado."
