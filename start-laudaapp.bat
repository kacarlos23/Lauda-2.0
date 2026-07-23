@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
set "TUNNEL_NAME=laudaapp-local"
set "TUNNEL_CONFIG=%USERPROFILE%\.cloudflared\laudaapp-local.yml"
set "PUBLIC_API_URL=https://api.laudaapp.com/api"

cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo  Lauda App - inicializacao completa
echo ========================================
echo.

echo [1/5] Validando arquivos e pre-requisitos...
if not exist "scripts\start-project.ps1" (
  echo [ERRO] Arquivo nao encontrado: scripts\start-project.ps1
  goto :failure
)
if not exist "scripts\setup-cloudflare-tunnel.ps1" (
  echo [ERRO] Arquivo nao encontrado: scripts\setup-cloudflare-tunnel.ps1
  goto :failure
)
if not exist "package.json" (
  echo [ERRO] Arquivo nao encontrado: package.json
  goto :failure
)
if not exist "mobile\package.json" (
  echo [ERRO] Arquivo nao encontrado: mobile\package.json
  goto :failure
)
where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] PowerShell nao foi encontrado no PATH.
  goto :failure
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao foi encontrado no PATH.
  goto :failure
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao foi encontrado no PATH.
  goto :failure
)
if not exist "node_modules\ts-node\register\index.js" (
  echo [ERRO] Dependencias do backend nao foram instaladas.
  echo Execute npm install antes de continuar.
  goto :failure
)
if not exist "mobile\node_modules\expo\package.json" (
  echo [ERRO] Dependencias do frontend nao foram instaladas.
  echo Execute npm install dentro da pasta mobile antes de continuar.
  goto :failure
)
where cloudflared.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] cloudflared nao foi encontrado no PATH.
  echo Instale ou adicione o cloudflared ao PATH antes de continuar.
  goto :failure
)

echo [OK] Arquivos, comandos e dependencias validados.

echo.
echo [2/5] Verificando DB, backend e frontend...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-project.ps1" -PublicApiUrl "%PUBLIC_API_URL%" -TrustProxyHops 1 -StaticFrontend -RestartBackend
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao iniciar/verificar o projeto.
  echo Verifique as mensagens acima.
  goto :failure
)

echo.
echo [3/5] Verificando configuracao do Cloudflare Tunnel...
if not exist "%TUNNEL_CONFIG%" (
  echo Config do tunnel nao encontrada:
  echo %TUNNEL_CONFIG%
  echo.
  echo Executando setup do Cloudflare Tunnel...
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-cloudflare-tunnel.ps1"
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao configurar Cloudflare Tunnel.
    goto :failure
  )
)
if not exist "%TUNNEL_CONFIG%" (
  echo [ERRO] A configuracao do tunnel continua ausente: %TUNNEL_CONFIG%
  goto :failure
)
cloudflared tunnel --config "%TUNNEL_CONFIG%" ingress validate
if errorlevel 1 (
  echo [ERRO] A configuracao do Cloudflare Tunnel e invalida.
  goto :failure
)

echo.
echo [4/5] Verificando se o Cloudflare Tunnel ja esta rodando...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$process = Get-CimInstance Win32_Process -Filter \"name = 'cloudflared.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*laudaapp-local*' }; if ($process) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Cloudflare Tunnel nao esta rodando. Iniciando em uma nova janela...
  start "Lauda App - Cloudflare Tunnel" /D "%PROJECT_DIR%" cloudflared.exe tunnel --config "%TUNNEL_CONFIG%" run "%TUNNEL_NAME%"
  if errorlevel 1 (
    echo [ERRO] Nao foi possivel iniciar o Cloudflare Tunnel.
    goto :failure
  )

  powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline = (Get-Date).AddSeconds(15); do { $process = Get-CimInstance Win32_Process -Filter \"name = 'cloudflared.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*laudaapp-local*' }; if ($process) { exit 0 }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline); exit 1"
  if errorlevel 1 (
    echo [ERRO] O processo do Cloudflare Tunnel nao permaneceu em execucao.
    goto :failure
  )
) else (
  echo Cloudflare Tunnel ja esta rodando.
)

echo.
echo [5/5] Validacao final...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $backend = Invoke-RestMethod 'http://localhost:3000/health' -TimeoutSec 5; if ($backend.status -ne 'ok') { throw 'status inesperado' }; Write-Host '[OK] Backend local:' $backend.status } catch { Write-Host '[ERRO] Backend local nao respondeu corretamente:' $_.Exception.Message; exit 1 }; try { $frontend = Invoke-WebRequest 'http://localhost:8081' -UseBasicParsing -Method Get -TimeoutSec 10; Write-Host '[OK] Frontend local HTTP:' $frontend.StatusCode } catch { Write-Host '[ERRO] Frontend local nao respondeu:' $_.Exception.Message; exit 1 }; $deadline = (Get-Date).AddSeconds(45); do { try { $api = Invoke-RestMethod 'https://api.laudaapp.com/health' -TimeoutSec 10; if ($api.status -eq 'ok') { Write-Host '[OK] API publica:' $api.status; exit 0 } } catch {}; Start-Sleep -Seconds 3 } while ((Get-Date) -lt $deadline); Write-Host '[ERRO] API publica nao respondeu dentro do prazo.'; exit 1"
if errorlevel 1 (
  echo.
  echo [ERRO] A validacao final falhou. A inicializacao nao foi concluida.
  goto :failure
)

node "scripts\validate-frontend-api.cjs" --site-url "https://laudaapp.com" --expected-api-url "%PUBLIC_API_URL%" --retries 10 --retry-delay-ms 3000
if errorlevel 1 (
  echo.
  echo [ERRO] O frontend publico nao foi publicado com a API esperada.
  goto :failure
)

echo.
echo ========================================
echo  Inicializacao finalizada
echo ========================================
echo.
echo Acesse:
echo   https://laudaapp.com
echo   https://api.laudaapp.com/health
echo.
echo Para derrubar o acesso publico, feche a janela "Lauda App - Cloudflare Tunnel".
echo.
pause
exit /b 0

:failure
echo.
echo Inicializacao interrompida.
pause
exit /b 1
