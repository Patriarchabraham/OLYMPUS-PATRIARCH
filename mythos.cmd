@echo off
setlocal
REM Mythos Patriarch: OOM prevention — 4GB heap (matches bin/mythos auto-respawn)
if not defined _MYTHOS_HEAP_SET (
  set "_MYTHOS_HEAP_SET=1"
  set "NODE_OPTIONS=--max-old-space-size=4096 %NODE_OPTIONS%"
)
node "%~dp0dist\cli.mjs" %*
endlocal
