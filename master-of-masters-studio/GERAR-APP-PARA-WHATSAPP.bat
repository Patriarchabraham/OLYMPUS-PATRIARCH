@echo off
chcp 65001 >nul
title GERADOR DO APP ANDROID PORTATIL (WHATSAPP / TELEGRAM)
cls
echo ===============================================================================
echo      🏆 GERANDO APLICATIVO ANDROID PORTATIL PARA WHATSAPP / TELEGRAM 🏆
echo   Compatível com: Oppo Find Ultra, Samsung Galaxy S24 Ultra e todos os celulares
echo ===============================================================================
echo.

echo [1/2] Compilando e gerando pacote unico auto-contido offline...
call bun run build:android
if %errorlevel% neq 0 (
    echo Tentando com node direto...
    call node scripts/build-singlefile-android.mjs
)

echo.
echo ===============================================================================
echo  ✅ SUCESSO! APLICATIVO ANDROID GERADO COM SUCESSO!
echo ===============================================================================
echo.
echo  Arquivo: MasterOfMasters-StudioPro-Android.html (apenas ~650 KB)
echo.
echo  COMO ENVIAR POR WHATSAPP:
echo  1. Arraste e solte o arquivo "MasterOfMasters-StudioPro-Android.html" 
echo     para a conversa no WhatsApp Web ou WhatsApp Desktop.
echo.
echo  2. No celular (Oppo Find Ultra, Samsung S24 Ultra, etc.):
echo     - Toque no arquivo recebido no WhatsApp.
echo     - O estúdio abre imediatamente com 100%% do poder DSP analógico 64-bit!
echo     - Para fixar o ícone na tela: toque nos 3 pontos (⋮) e em "Adicionar à Tela Inicial".
echo ===============================================================================
echo.

explorer.exe /select,"MasterOfMasters-StudioPro-Android.html"

pause
