param([switch]$SkipBuild)
$ErrorActionPreference = "Stop"
$previewProject = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$health = Invoke-RestMethod -Uri "http://127.0.0.1:3010/health" -TimeoutSec 5
if ($health.status -ne "ok") { throw "Inicie primeiro a API local de testes na porta 3010." }
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:3010/api"
$env:EXPO_PUBLIC_THEME_PREVIEW = "1"
$env:EXPO_NO_DOTENV = "1"
$env:EXPO_OFFLINE = "1"
$env:EXPO_OVERRIDE_METRO_CONFIG = Join-Path $previewProject "mobile\metro.theme-preview.config.cjs"
Push-Location (Join-Path $previewProject "mobile")
try {
  if (-not $SkipBuild) {
    & node node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "Verificação de tipos falhou." }
    & node node_modules/expo/bin/cli export --platform web --max-workers 2 --output-dir web-build/theme-preview
    if ($LASTEXITCODE -ne 0) { throw "Build da prévia falhou." }
  }
  & node ../scripts/validate-frontend-api.cjs --dist web-build/theme-preview --expected-api-url "http://127.0.0.1:3010/api"
  if ($LASTEXITCODE -ne 0) { throw "A prévia deve usar exclusivamente a API local de testes." }
  $previewFolder = Join-Path $previewProject "mobile\web-build\theme-preview"
  $previewConfig = Join-Path $previewProject "scripts\worship-test.serve.json"
  $runningPreview = $null
  try { $runningPreview = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8094/login" -TimeoutSec 3 } catch { }
  if ($runningPreview -and $runningPreview.Content -notmatch "lauda_color_mode") {
    throw "A porta 8094 já está em uso por outro serviço. A prévia não será iniciada nessa porta."
  }
  if (-not $runningPreview) {
    Start-Process -FilePath (Get-Command node).Source -ArgumentList @("node_modules/serve/build/main.js", ('"{0}"' -f $previewFolder), "--config", ('"{0}"' -f $previewConfig), "--listen", "tcp://127.0.0.1:8094", "--no-clipboard") -WorkingDirectory (Join-Path $previewProject "mobile") -WindowStyle Hidden -RedirectStandardOutput (Join-Path $previewProject "frontend.theme-preview.out.log") -RedirectStandardError (Join-Path $previewProject "frontend.theme-preview.err.log")
  }
  Write-Output "Prévia navegável: http://127.0.0.1:8094/?theme=dark"
} finally { Pop-Location }
