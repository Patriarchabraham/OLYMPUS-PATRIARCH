@echo off
chcp 65001 >nul
title MASTER OF MASTERS STUDIO PRO - INSTALADOR ANDROID
cls
echo ===============================================================================
echo          🏆 MASTER OF MASTERS STUDIO PRO v5.5 - INSTALADOR ANDROID 🏆
echo   Compatível: Oppo Find X7/X8 Ultra, Samsung Galaxy S24 Ultra, Xiaomi, Pixel
echo ===============================================================================
echo.

:: Detect local IPv4 address
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0.*0.0.0.0 ^| findstr /v "Default"') do (
    set LOCAL_IP=%%a
    goto :ip_found
)
:ip_found

echo [1/3] Compilando versão de produção otimizada para Android...
call bun run build
if %errorlevel% neq 0 (
    echo ❌ Erro ao compilar. Tentando via vite direto...
    call npx vite build
)

echo.
echo [2/3] Servidor Local de Alta Performance Ativado para a Rede Wi-Fi!
echo.
echo ===============================================================================
echo  📲 COMO INSTALAR NO SEU CELULAR ANDROID (OPPO / SAMSUNG S24 / OUTROS):
echo ===============================================================================
echo.
echo  1. Certifique-se de que o celular está conectado na mesma rede Wi-Fi.
echo  2. No navegador do celular (Chrome ou Samsung Internet), abra este endereço:
echo.
echo        👉  http://%LOCAL_IP%:5173  👈
echo        ou: http://localhost:5173
echo.
echo  3. Na tela do estúdio no celular, clique no botão verde no topo:
echo        "📲 INSTALAR NO ANDROID"
echo.
echo  4. O aplicativo será instalado no seu Android com:
echo     - Ícone Dourado de Alta Definição na gaveta de apps
echo     - Execução em Tela Cheia (120Hz/144Hz OLED Snapdragon 8 Gen 3)
echo     - Funcionamento DSP 64-Bit Offline Completo
echo ===============================================================================
echo.
echo [3/3] Iniciando servidor do Studio na porta 5173... Pressione Ctrl+C para encerrar.
echo.

call bun x vite --host 0.0.0.0 --port 5173
pause
