@echo off
setlocal
REM Olympuz Coder: OOM prevention — 4GB heap (matches bin/olympuz auto-respawn)
if not defined _OLYMPUZ_HEAP_SET (
  set "_OLYMPUZ_HEAP_SET=1"
  set "NODE_OPTIONS=--max-old-space-size=4096 %NODE_OPTIONS%"
)
node "%~dp0dist\cli.mjs" %*
endlocal
