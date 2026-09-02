# Universal Dynamic Windows Shortcut Generator (Works on ANY Drive / Folder / PC)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectDir = Split-Path -Parent $scriptDir

$targetBat = Join-Path $projectDir "scripts\start-windows.bat"
if (-not (Test-Path $targetBat)) {
    $targetBat = Join-Path $projectDir "start-windows.bat"
}

# Remove corrupted or legacy shortcuts
Get-ChildItem -Path "$env:USERPROFILE\Desktop" -Filter "*Master of Masters*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path "C:\Users\Public\Desktop" -Filter "*Master of Masters*" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$wsh = New-Object -ComObject WScript.Shell

# 1. User Desktop Shortcut
$desk1 = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\Master of Masters Studio Pro.lnk")
$desk1.TargetPath = $targetBat
$desk1.WorkingDirectory = $projectDir
$desk1.WindowStyle = 1
$desk1.Description = "Master of Masters Studio Pro DSP Mastering Workstation"
$desk1.IconLocation = "$env:SystemRoot\System32\shell32.dll,116"
$desk1.Save()

# 2. Public Desktop Shortcut (For all users)
try {
    $desk2 = $wsh.CreateShortcut("C:\Users\Public\Desktop\Master of Masters Studio Pro.lnk")
    $desk2.TargetPath = $targetBat
    $desk2.WorkingDirectory = $projectDir
    $desk2.WindowStyle = 1
    $desk2.Description = "Master of Masters Studio Pro DSP Mastering Workstation"
    $desk2.IconLocation = "$env:SystemRoot\System32\shell32.dll,116"
    $desk2.Save()
} catch {
    # Ignore if not running as admin
}

# 3. Windows Start Menu Shortcut
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Master of Masters Studio Pro"
if (-not (Test-Path $startMenu)) {
    New-Item -ItemType Directory -Path $startMenu -Force | Out-Null
}
$start = $wsh.CreateShortcut("$startMenu\Master of Masters Studio Pro.lnk")
$start.TargetPath = $targetBat
$start.WorkingDirectory = $projectDir
$start.WindowStyle = 1
$start.Description = "Master of Masters Studio Pro"
$start.IconLocation = "$env:SystemRoot\System32\shell32.dll,116"
$start.Save()

Write-Output "SUCCESS: Universal Desktop and Start Menu shortcuts created for: $projectDir"
