@echo off
setlocal EnableExtensions

set "PROJECT_DIR=%~dp0"
set "SUPERVISOR_SCRIPT=%~dp0scripts\laudaapp-supervisor.ps1"

if not exist "%SUPERVISOR_SCRIPT%" (
  echo [ERRO] Arquivo nao encontrado: %SUPERVISOR_SCRIPT%
  exit /b 1
)

if /I "%~1"=="--foreground" goto :foreground

echo Iniciando o Lauda App em segundo plano...
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','\"%SUPERVISOR_SCRIPT%\"')"

if errorlevel 1 (
  echo [ERRO] Nao foi possivel iniciar o supervisor do Lauda App.
  exit /b 1
)

echo [OK] Supervisor iniciado. Consulte laudaapp-supervisor.log para acompanhar.
exit /b 0

:foreground
cd /d "%PROJECT_DIR%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SUPERVISOR_SCRIPT%"
exit /b %ERRORLEVEL%
