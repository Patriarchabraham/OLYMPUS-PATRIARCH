@echo off
setlocal enabledelayedexpansion
title MASTER OF MASTERS STUDIO PRO - Windows 10 e 11
color 0E

echo ===============================================================================
echo   MASTER OF MASTERS STUDIO PRO - SUITE DE MASTERIZACAO DSP
echo ===============================================================================
echo Iniciando servidor e motor de audio local 100%% offline...
echo.

cd /d "%~dp0\.."

:: Libera portas antigas se houver processos presos
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":7777" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Localiza o executavel do Bun embutido ou do sistema
set "BUN_CMD="
if exist "%~dp0..\bin\bun.exe" (
    set "BUN_CMD=%~dp0..\bin\bun.exe"
) else (
    where bun >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "BUN_CMD=bun"
)

:: Inicia o servidor local
if not "!BUN_CMD!"=="" (
    start /b "" "!BUN_CMD!" run preview --port 7777 >nul 2>&1
) else (
    start /b powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 7777
)

timeout /t 2 /nobreak > nul

echo Abrindo aplicativo nativo do Master of Masters Studio...
start msedge --app=http://localhost:7777 || start chrome --app=http://localhost:7777 || start http://localhost:7777

echo.
echo [OK] Master of Masters Studio Pro ativo em http://localhost:7777
echo Pressione qualquer tecla para encerrar.
pause > nul
exit /b 0
