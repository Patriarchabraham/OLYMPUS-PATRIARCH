@echo off
setlocal enabledelayedexpansion
REM Olympuz Coder: heap sizing to avoid "JavaScript heap out of memory" OOM
REM crashes mid-work. Targets ~55%% of FREE RAM (clamped 768-3072 MB) so V8 stays
REM within physical RAM on low-memory boxes. The conservative ceiling forces V8 to
REM GC incrementally instead of growing past available RAM into swap — on a
REM memory-compressed Windows box (e.g. a 6GB box with <1GB free) over-committing
REM the heap hard-freezes the whole CLI, not just slows it down. The durable fix
REM remains more RAM / larger page file, but this clamp keeps the CLI alive.
REM (cli.tsx also self-respawns up to >=2048MB as a backstop for any launch path.)
if not defined _OLYMPUZ_HEAP_SET (
  set "_OLYMPUZ_HEAP_SET=1"
  set "HEAPMB=768"
  for /f "usebackq delims=" %%i in (`powershell -NoProfile -NoLogo -Command "[int][Math]::Max(768,[Math]::Min(3072,[Math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024*0.55)))" 2^>nul`) do set "HEAPMB=%%i"
  set "NODE_OPTIONS=--max-old-space-size=!HEAPMB! %NODE_OPTIONS%"
)
node "%~dp0dist\cli.mjs" %*
endlocal
