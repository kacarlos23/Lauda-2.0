@echo off
setlocal

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

echo [1/4] Verificando DB, backend e frontend...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-project.ps1" -PublicApiUrl "%PUBLIC_API_URL%" -Production -RestartBackend
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao iniciar/verificar o projeto.
  echo Verifique as mensagens acima.
  pause
  exit /b 1
)

echo.
echo [2/4] Verificando configuracao do Cloudflare Tunnel...
if not exist "%TUNNEL_CONFIG%" (
  echo Config do tunnel nao encontrada:
  echo %TUNNEL_CONFIG%
  echo.
  echo Executando setup do Cloudflare Tunnel...
  powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-cloudflare-tunnel.ps1"
  if errorlevel 1 (
    echo.
    echo [ERRO] Falha ao configurar Cloudflare Tunnel.
    pause
    exit /b 1
  )
)

echo.
echo [3/4] Verificando se o Cloudflare Tunnel ja esta rodando...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$process = Get-CimInstance Win32_Process -Filter \"name = 'cloudflared.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*laudaapp-local*' }; if ($process) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo Cloudflare Tunnel nao esta rodando. Iniciando em uma nova janela...
  start "Lauda App - Cloudflare Tunnel" cloudflared tunnel --config "%TUNNEL_CONFIG%" run "%TUNNEL_NAME%"
) else (
  echo Cloudflare Tunnel ja esta rodando.
)

echo.
echo [4/4] Validacao final...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $backend = Invoke-RestMethod 'http://localhost:3000/health' -TimeoutSec 5; Write-Host '[OK] Backend local:' $backend.status } catch { Write-Host '[ERRO] Backend local nao respondeu'; exit 1 }; try { $frontend = Invoke-WebRequest 'http://localhost:8081' -UseBasicParsing -Method Head -TimeoutSec 5; Write-Host '[OK] Frontend local HTTP:' $frontend.StatusCode } catch { Write-Host '[ERRO] Frontend local nao respondeu'; exit 1 }; try { $api = Invoke-RestMethod 'https://api.laudaapp.com/health' -TimeoutSec 15; Write-Host '[OK] API publica:' $api.status } catch { Write-Host '[AVISO] API publica ainda nao respondeu. O tunnel pode levar alguns segundos para conectar.' }"

echo.
echo ========================================
echo  Inicializacao finalizada
echo ========================================
echo.
echo Acesse:
echo   https://laudaapp.com
echo   https://api.laudaapp.com/health
echo.
echo Se a API publica ainda nao respondeu, aguarde 10 segundos e teste novamente.
echo Para derrubar o acesso publico, feche a janela "Lauda App - Cloudflare Tunnel".
echo.
pause
