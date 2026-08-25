Set oWS = WScript.CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

strDesktop = oWS.SpecialFolders("Desktop")
strAppDir = WScript.Arguments(0)
strVbsLauncher = strAppDir & "\scripts\run-app.vbs"
strShortcutPath = strDesktop & "\🏆 Master of Masters Studio Pro.lnk"

Set oLink = oWS.CreateShortcut(strShortcutPath)
oLink.TargetPath = "wscript.exe"
oLink.Arguments = """" & strVbsLauncher & """"
oLink.WorkingDirectory = strAppDir
oLink.WindowStyle = 1
oLink.Description = "Master of Masters Studio Pro - Suíte de Masterização DSP, Vocal God, Mic Locker e Gem Welder para Windows"
oLink.IconLocation = "%SystemRoot%\System32\shell32.dll,116" ' Gold Star / Trophy Icon in Windows Shell
oLink.Save

' Also create Start Menu Shortcut
strStartMenu = oWS.SpecialFolders("StartMenu") & "\Programs\Master of Masters Studio Pro"
If Not fso.FolderExists(strStartMenu) Then
    fso.CreateFolder(strStartMenu)
End If
strStartShortcut = strStartMenu & "\Master of Masters Studio Pro.lnk"
Set oStartLink = oWS.CreateShortcut(strStartShortcut)
oStartLink.TargetPath = "wscript.exe"
oStartLink.Arguments = """" & strVbsLauncher & """"
oStartLink.WorkingDirectory = strAppDir
oStartLink.WindowStyle = 1
oStartLink.Description = "Master of Masters Studio Pro"
oStartLink.IconLocation = "%SystemRoot%\System32\shell32.dll,116"
oStartLink.Save

WScript.Echo "Atalho criado com sucesso na Area de Trabalho e Menu Iniciar!"
