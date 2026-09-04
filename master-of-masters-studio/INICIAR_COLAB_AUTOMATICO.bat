@echo off
title Master of Masters Studio - Autopilot Colab
echo ============================================================
echo   INICIANDO GOOGLE COLAB AUTOMATICO NA GPU T4 GRATUITA...
echo ============================================================
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\colab_autopilot.ps1"
echo.
echo Concluido! Pressione qualquer tecla para fechar esta janela.
pause >nul
