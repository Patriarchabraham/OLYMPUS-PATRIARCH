Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Current directory of script
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
appDir = fso.GetParentFolderName(scriptDir)

' Start the background server on port 7777 hidden
WshShell.Run "cmd /c cd /d """ & appDir & """ && bun run dev --port 7777", 0, False

' Wait 2 seconds for server to boot
WScript.Sleep 2000

' Launch in Native App Window mode
WshShell.Run "msedge --app=http://localhost:7777", 1, False
