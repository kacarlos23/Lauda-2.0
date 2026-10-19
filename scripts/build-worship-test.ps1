param()
$ErrorActionPreference = "Stop"
$projectPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:EXPO_PUBLIC_API_URL = "http://127.0.0.1:3010/api"
$env:EXPO_NO_DOTENV = "1"
$env:EXPO_OFFLINE = "1"
$env:EXPO_OVERRIDE_METRO_CONFIG = Join-Path $projectPath "mobile\metro.worship-test.config.cjs"
Push-Location $projectPath
try {
  & node node_modules/typescript/bin/tsc --outDir test-results/worship-acceptance/backend
  if ($LASTEXITCODE -ne 0) { throw "Build isolado do backend falhou." }
  Push-Location (Join-Path $projectPath "mobile")
  try {
    & node node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw "TypeScript do aplicativo falhou." }
    & node node_modules/expo/bin/cli export --platform web --max-workers 2 --output-dir web-build/worship-test
    if ($LASTEXITCODE -ne 0) { throw "Exportacao web de testes falhou." }
  } finally { Pop-Location }
  & node scripts/validate-frontend-api.cjs --dist mobile/web-build/worship-test --expected-api-url "http://127.0.0.1:3010/api"
  if ($LASTEXITCODE -ne 0) { throw "Build recusado: a API incorporada nao corresponde ao ambiente isolado." }
} finally { Pop-Location }
