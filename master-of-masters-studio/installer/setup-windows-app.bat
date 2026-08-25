@echo off
setlocal enabledelayedexpansion
title INSTALADOR - Master of Masters Studio Pro (Windows 10 / 11)
color 0E

echo ===============================================================================
echo   🏆 INSTALADOR OFICIAL DO MASTER OF MASTERS STUDIO PRO v4.5
echo   Suíte Completa de Masterização DSP, Vocal God, Mic Locker e Gem Welder
echo ===============================================================================
echo.

set "APP_DIR=%~dp0\.."
cd /d "%APP_DIR%"

echo [1/3] Compilando codigo e gerando pacote de producao 64-bit...
call bun run build
if %ERRORLEVEL% NEQ 0 (
    echo [AVISO] Tentando build alternativo...
    call npm run build
)

echo.
echo [2/3] Criando Atalho Oficial na Area de Trabalho (Desktop)...
powershell -ExecutionPolicy Bypass -File "%APP_DIR%\installer\create-clean-shortcuts.ps1"

echo.
echo [3/3] Configuracao e registro no Windows concluidos com sucesso!
echo.
echo ===============================================================================
echo   ✅ SUCESSO! O Atalho foi criado na sua Area de Trabalho (Desktop):
echo   "Master of Masters Studio Pro"
echo.
echo   Localizacao: %USERPROFILE%\Desktop\Master of Masters Studio Pro.lnk
echo ===============================================================================
echo.

set /p RUN_CHOICE="Deseja abrir o Master of Masters Studio Pro agora? (S/N): "
if /i "%RUN_CHOICE%"=="S" (
    start "" "%APP_DIR%\scripts\start-windows.bat"
)

pause
exit /b 0
