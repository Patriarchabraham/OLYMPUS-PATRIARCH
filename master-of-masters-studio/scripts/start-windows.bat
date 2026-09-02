@echo off
setlocal enabledelayedexpansion
title MASTER OF MASTERS STUDIO PRO - Windows 10 e 11
color 0B

echo ===============================================================================
echo   🏆 MASTER OF MASTERS STUDIO PRO - SUITE DE MASTERIZACAO DSP
echo ===============================================================================
echo [1/3] Iniciando motor de audio e servidor local 100%% offline...
echo.

cd /d "%~dp0\.."

:: Libera portas antigas se houver processos presos
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":7777" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Localiza Node ou Bun para rodar o servidor HTTP
set "SERVER_LAUNCHED=0"

where node >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    start /b "" node "%~dp0serve.mjs" >nul 2>&1
    set "SERVER_LAUNCHED=1"
)

if "!SERVER_LAUNCHED!"=="0" (
    where bun >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        start /b "" bun "%~dp0serve.mjs" >nul 2>&1
        set "SERVER_LAUNCHED=1"
    )
)

if "!SERVER_LAUNCHED!"=="0" (
    start /b "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 7777
    set "SERVER_LAUNCHED=1"
)

echo [2/3] Aguardando inicializacao do servidor na porta 7777...

:: Loop de checagem: aguarda a porta 7777 responder
powershell -Command "$tries=0; while($tries -lt 15){ try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:7777' -UseBasicParsing -TimeoutSec 1; if($r.StatusCode -eq 200){ break } } catch { Start-Sleep -Milliseconds 400; $tries++ } }"

echo [3/3] Abrindo janela nativa do Master of Masters Studio Pro...
start msedge --app="http://127.0.0.1:7777/?v=%RANDOM%" --start-maximized 2>nul || start chrome --app="http://127.0.0.1:7777/?v=%RANDOM%" --start-maximized 2>nul || start http://127.0.0.1:7777/?v=%RANDOM%

echo.
echo ===============================================================================
echo   ✅ Master of Masters Studio Pro ATIVO em http://127.0.0.1:7777
echo   (Mantenha esta janela aberta enquanto estiver masterizando)
echo ===============================================================================
echo.
pause > nul
exit /b 0
