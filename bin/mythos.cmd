@echo off
if not defined _MYTHOS_HEAP_SET (
    set _MYTHOS_HEAP_SET=1
    set NODE_OPTIONS=--max-old-space-size=4096
)
node "%~dp0..\dist\cli.mjs" %*
