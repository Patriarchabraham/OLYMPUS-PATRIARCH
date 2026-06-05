@echo off
if not defined _OLYMPUZ_HEAP_SET (
    set _OLYMPUZ_HEAP_SET=1
    for /f %%m in ('node -e "const m=Math.floor(require('os').freemem()/1024/1024);process.stdout.write(String(Math.max(1536,Math.min(4096,Math.floor(m*0.5)))))"') do set _HEAP_SIZE=%%m
    set NODE_OPTIONS=--max-old-space-size=%_HEAP_SIZE%
)
node "%~dp0..\dist\cli.mjs" %*
