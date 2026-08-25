Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = WScript.Arguments(0)
sTargetPath = WScript.Arguments(1)
sWorkingDir = WScript.Arguments(2)
sIconLocation = WScript.Arguments(3)

Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = sTargetPath
oLink.WorkingDirectory = sWorkingDir
oLink.WindowStyle = 1
oLink.Description = "Master of Masters Studio Pro - Ultimate DSP Mastering Suite"
If sIconLocation <> "" Then
    oLink.IconLocation = sIconLocation
End If
oLink.Save
