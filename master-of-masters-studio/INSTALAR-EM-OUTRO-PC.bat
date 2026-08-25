@echo off
setlocal enabledelayedexpansion
title INSTALADOR UNIVERSAL - Master of Masters Studio Pro (Windows 10 / 11)
color 0E

echo ===============================================================================
echo   [MASTER OF MASTERS STUDIO PRO - INSTALADOR PORTATIL UNIVERSAL]
echo   Suite Completa de Masterizacao DSP, 5 Gems, Vocal God, Mic Locker e Welder
echo ===============================================================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"
echo [*] Pasta de instalacao: %APP_DIR%
echo.

:: 1. VERIFICAR RUNTIME (BUN OU NODE.JS)
echo [1/4] Verificando ambiente de execucao...
where bun >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [!] Bun ou Node.js nao detectados. Instalando Bun automaticamente (5 segundos)...
        powershell -Command "irm bun.sh/install.ps1 | iex"
        set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
    )
)

:: 2. INSTALAR DEPENDENCIAS
echo [2/4] Instalando dependencias de audio e compilador...
where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    call bun install
) else (
    call npm install
)

:: 3. COMPILAR PACOTE DE PRODUCAO
echo.
echo [3/4] Compilando motor DSP e gerando build 64-bit...
where bun >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    call bun run build
) else (
    call npm run build
)

:: 4. CRIAR ATALHOS NA AREA DE TRABALHO
echo.
echo [4/4] Criando Atalho Oficial na sua Area de Trabalho (Desktop)...
powershell -ExecutionPolicy Bypass -File "%APP_DIR%\installer\create-clean-shortcuts.ps1"

echo.
echo ===============================================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo.
echo   O atalho "Master of Masters Studio Pro" foi criado na sua Area de Trabalho.
echo   Voce pode abrir o programa a qualquer momento pelo icone no Desktop.
echo ===============================================================================
echo.

set /p RUN_NOW="Deseja abrir o Master of Masters Studio Pro agora? (S/N): "
if /i "%RUN_NOW%"=="S" (
    start "" "%APP_DIR%\scripts\start-windows.bat"
)

pause
exit /b 0
