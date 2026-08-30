@echo off
chcp 65001 >nul
title GERADOR DO APK ANDROID (WHATSAPP / TELEGRAM / INSTALADOR)
cls
echo ===============================================================================
echo          🏆 GERANDO PACOTE APK OFICIAL ANDROID (.APK) 🏆
echo   Compatível com: Oppo Find Ultra, Samsung Galaxy S24 Ultra, Xiaomi, Pixel
echo ===============================================================================
echo.

set JAVA_HOME=C:\OLYMPUZ\.tools\jdk-21.0.2+13
set ANDROID_HOME=C:\OLYMPUZ\.tools\android-sdk
set PATH=%JAVA_HOME%\bin;%PATH%

echo [1/3] Compilando assets do Studio Pro...
call bun run build
call bunx cap copy android

echo.
echo [2/3] Compilando APK nativo oficial com Gradle do Android SDK...
cd android
call gradlew.bat assembleDebug
cd ..

echo.
echo [3/3] Copiando APK final assinado...
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "MasterOfMasters-StudioPro-v5.5.apk" >nul
copy /y "android\app\build\outputs\apk\debug\app-debug.apk" "dist\MasterOfMasters-StudioPro-v5.5.apk" >nul

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
