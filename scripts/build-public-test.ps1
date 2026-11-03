$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$candidate = Join-Path $project 'mobile/web-build/public-test-candidate'
$published = Join-Path $project 'mobile/web-build/public-test'
$env:EXPO_PUBLIC_API_URL = 'https://testes.laudaapp.com/api'
$env:EXPO_PUBLIC_APP_ENV = 'staging'
$env:EXPO_NO_DOTENV = '1'
$env:EXPO_OFFLINE = '1'
$env:EXPO_OVERRIDE_METRO_CONFIG = Join-Path $project 'mobile/metro.public-test.config.cjs'
Push-Location $project
try {
  & node node_modules/typescript/bin/tsc
  if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
  Push-Location (Join-Path $project 'mobile')
  try {
    & node node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'Frontend typecheck failed' }
    & node node_modules/expo/bin/cli export --platform web --max-workers 2 --output-dir web-build/public-test-candidate
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
  } finally { Pop-Location }
  & node scripts/validate-frontend-api.cjs --dist mobile/web-build/public-test-candidate --expected-api-url 'https://testes.laudaapp.com/api'
  if ($LASTEXITCODE -ne 0) { throw 'Isolated API validation failed' }
  $sourceHash = (Get-FileHash -LiteralPath (Join-Path $project 'mobile/src/components/songs/VisualChordEditor.web.tsx') -Algorithm SHA256).Hash.ToLowerInvariant()
  $release = @{ environment='staging'; sourceCommit=(& git rev-parse HEAD); feature='visual-chord-editor'; sourceHash=$sourceHash; builtAt=(Get-Date).ToUniversalTime().ToString('o'); apiUrl=$env:EXPO_PUBLIC_API_URL } | ConvertTo-Json
  [IO.File]::WriteAllText((Join-Path $candidate 'release.json'), $release, [Text.UTF8Encoding]::new($false))
  if (Test-Path -LiteralPath $published) {
    $backup = Join-Path $project ('.resilience/public-test-web-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    Copy-Item -LiteralPath $published -Destination $backup -Recurse
  }
  # Publish assets before HTML; keep old hashed assets usable by already-open tabs.
  $files = @(Get-ChildItem -LiteralPath $candidate -Recurse -File)
  $orderedFiles = @($files | Where-Object { $_.Extension -ne '.html' -and $_.Name -ne 'release.json' }) + @($files | Where-Object Extension -eq '.html') + @($files | Where-Object Name -eq 'release.json')
  foreach ($file in $orderedFiles) {
    $relative = $file.FullName.Substring($candidate.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
    $target = Join-Path $published $relative
    New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $target -Force
  }
  Write-Output 'Validated frontend published only to the isolated public test directory.'
} finally { Pop-Location }
