@echo off
REM Olympuz Coder — double-click installer bootstrapper (Windows 10 / 11+)
REM Runs the PowerShell installer with execution policy bypassed for this call only.
setlocal
cd /d "%~dp0"

REM Try Windows PowerShell 5.1 first (present on all Win10/11), fall back to any "powershell".
where powershell.exe >nul 2>nul
if %errorlevel%==0 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Olympuz.ps1" %*
) else (
    echo [x] Windows PowerShell was not found on this system.
    echo     Olympuz requires Windows 10 or newer, which includes PowerShell.
    exit /b 1
)

echo.
echo Done. Press any key to close this window...
pause >nul
