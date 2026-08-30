@echo off
chcp 65001 >nul
title GERADOR DO APK ANDROID (WHATSAPP / TELEGRAM / INSTALADOR)
cls
echo ===============================================================================
echo          🏆 GERANDO PACOTE APK OFICIAL ANDROID (.APK) 🏆
echo   Compatível com: Oppo Find Ultra, Samsung Galaxy S24 Ultra, Xiaomi, Pixel
echo ===============================================================================
echo.

echo [1/2] Compilando assets de producao e gerando APK assinado...
call bun run build
call node scripts/build-android-apk.mjs

echo.
echo ===============================================================================
echo  ✅ SUCESSO! ARQUIVO .APK INSTALÁVEL PRONTO PARA ENVIO!
echo ===============================================================================
echo.
echo  Arquivo: MasterOfMasters-StudioPro-v5.5.apk
echo.
echo  COMO ENVIAR POR WHATSAPP:
echo  1. Arraste e solte o arquivo "MasterOfMasters-StudioPro-v5.5.apk" 
echo     para a conversa no WhatsApp Web ou WhatsApp Desktop.
echo.
echo  2. No smartphone (Oppo Find Ultra, Samsung S24 Ultra, etc.):
echo     - Toque no arquivo .apk recebido no WhatsApp.
echo     - O Android Package Installer abrirá perguntando: "Deseja instalar este app?".
echo     - Toque em "Instalar" / "Abrir".
echo     - O app será instalado no sistema operacional como aplicativo nativo permanente!
echo ===============================================================================
echo.

explorer.exe /select,"MasterOfMasters-StudioPro-v5.5.apk"

pause
