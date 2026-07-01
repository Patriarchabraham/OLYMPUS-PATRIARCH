@echo off
setlocal enabledelayedexpansion
REM Olympuz Coder: heap sizing to avoid "JavaScript heap out of memory" OOM
REM crashes mid-work. Targets ~80%% of FREE RAM (clamped 2048-4096 MB) so V8 has
REM enough room for heavy workloads (multi-file builds + dev server + agents).
REM (cli.tsx also self-respawns up to >=2048MB as a backstop for any launch path,
REM so this mainly avoids that respawn.) On low-RAM boxes this will use swap under
REM load (slow) rather than crash — the durable fix is more RAM / larger page file.
if not defined _OLYMPUZ_HEAP_SET (
  set "_OLYMPUZ_HEAP_SET=1"
  set "HEAPMB=2048"
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -NoLogo -Command "[int][Math]::Max(2048,[Math]::Min(4096,[Math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024*0.8)))" 2^>nul`) do set "HEAPMB=%%i"
  set "NODE_OPTIONS=--max-old-space-size=!HEAPMB! %NODE_OPTIONS%"
)
node "%~dp0dist\cli.mjs" %*
endlocal
