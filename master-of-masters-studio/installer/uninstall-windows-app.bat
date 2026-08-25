@echo off
title DESINSTALADOR - Master of Masters Studio Pro
color 0C

echo ===============================================================================
echo   Removendo atalhos do Master of Masters Studio Pro...
echo ===============================================================================

del /f /q "%USERPROFILE%\Desktop\Master of Masters Studio Pro.lnk" 2>nul
rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Master of Masters Studio Pro" 2>nul

echo [OK] Atalhos da Area de Trabalho e Menu Iniciar removidos com sucesso.
pause
