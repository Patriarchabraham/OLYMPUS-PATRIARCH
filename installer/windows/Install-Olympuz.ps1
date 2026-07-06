<#
.SYNOPSIS
    Olympuz Coder — Windows installer (Windows 10 / 11+, per-user, no admin).
.DESCRIPTION
    Installs a fully self-contained Olympuz Coder (bundled Node + built app) into
    %LOCALAPPDATA%\Programs\Olympuz, adds it to the USER Path, creates Start Menu
    shortcuts, and registers an uninstaller so it shows up in
    "Add or remove programs". No administrator rights required.

    Source of files: a "payload" folder (built by Build-Installer.ps1) located
    next to this script at .\payload\Olympuz, OR override with -PayloadDir.
.PARAMETER InstallDir
    Destination folder. Defaults to "$env:LOCALAPPDATA\Programs\Olympuz".
.PARAMETER PayloadDir
    Source folder containing the staged app (bin\, dist\, node\, package.json).
    Defaults to "$PSScriptRoot\payload\Olympuz".
.PARAMETER Force
    Overwrite an existing installation without prompting.
.PARAMETER Silent
    Suppress informational output.
.EXAMPLE
    .\Install-Olympuz.ps1
.EXAMPLE
    .\Install-Olympuz.ps1 -InstallDir "D:\Olympuz" -Force
.NOTES
    PowerShell 5.1 compatible (Windows 10 ships with 5.1; Windows 11 with 5.1+).
    Author: Patriarch
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "",
    [string]$PayloadDir = "",
    [switch]$Force,
    [switch]$Silent,
    [switch]$SkipDeps
)

$ErrorActionPreference = 'Stop'
$App       = 'Olympuz'
$Publisher = 'Patriarch'
$Version   = '1.0.0'

if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\$App" }
if (-not $PayloadDir) { $PayloadDir = Join-Path $PSScriptRoot "payload\$App" }

function Write-Step($msg)  { if (-not $Silent) { Write-Host "[*] $msg" -ForegroundColor Cyan } }
function Write-Ok($msg)    { if (-not $Silent) { Write-Host "[+] $msg" -ForegroundColor Green } }
function Write-Warn2($msg) { if (-not $Silent) { Write-Host "[!] $msg" -ForegroundColor Yellow } }
function Die($msg)         { Write-Host "[x] $msg" -ForegroundColor Red; exit 1 }

function Remove-TreeLongPath {
    # Removes a directory tree robustly, tolerating paths longer than 260 chars
    # (npm node_modules nests deep; PS Remove-Item -Recurse fails on those).
    # Mirror an EMPTY dir over the target with robocopy /MIR (long-path safe),
    # then drop the now-empty shell.
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $true }
    $empty = Join-Path ([System.IO.Path]::GetTempPath()) ("olympuz-empty-$PID")
    New-Item -ItemType Directory -Force -Path $empty | Out-Null
    try {
        & robocopy $empty $Path /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { return $false }
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
        return (-not (Test-Path -LiteralPath $Path))
    } finally {
        Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not $Silent) {
    Write-Host ""
    Write-Host "  === $App Coder $Version — Windows Installer ===" -ForegroundColor White
    Write-Host "  Per-user install (no administrator required)" -ForegroundColor DarkGray
    Write-Host ""
}

# --- 1. Validate payload -----------------------------------------------------
Write-Step "Locating payload..."
if (-not (Test-Path -LiteralPath $PayloadDir)) {
    Die "Payload folder not found: '$PayloadDir'.
       Run Build-Installer.ps1 first to stage the app, or pass -PayloadDir."
}
$srcNode = Join-Path $PayloadDir "node\node.exe"
$srcDist = Join-Path $PayloadDir "dist\cli.mjs"
$srcLauncher = Join-Path $PayloadDir "bin\olympuz"
foreach ($p in @($srcNode, $srcDist, $srcLauncher)) {
    if (-not (Test-Path -LiteralPath $p)) {
        Die "Payload is incomplete — missing: $p"
    }
}
Write-Ok "Payload OK at $PayloadDir"

# --- 2. Existing install? ----------------------------------------------------
if ((Test-Path -LiteralPath $InstallDir) -and -not $Force) {
    Write-Warn2 "An installation already exists at: $InstallDir"
    $reply = Read-Host "Overwrite? (y/N)"
    if ($reply -notmatch '^[yY]') { Die "Installation cancelled." }
}

# --- 3. Copy files -----------------------------------------------------------
Write-Step "Installing to $InstallDir ..."
if (Test-Path -LiteralPath $InstallDir) {
    $cleared = Remove-TreeLongPath -Path $InstallDir
    if (-not $cleared) {
        Die "Could not clear the existing install at $InstallDir (locked files or long paths). Close Olympuz and retry, or pass a different -InstallDir."
    }
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

foreach ($sub in @('bin', 'dist', 'node')) {
    $dst = Join-Path $InstallDir $sub
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
}

Copy-Item -LiteralPath $srcLauncher -Destination (Join-Path $InstallDir 'bin\olympuz') -Force
Copy-Item -LiteralPath $srcDist    -Destination (Join-Path $InstallDir 'dist\cli.mjs') -Force
Copy-Item -LiteralPath $srcNode    -Destination (Join-Path $InstallDir 'node\node.exe') -Force

# Runtime node_modules (the CLI's external deps are bare-imported, not bundled).
$srcNM = Join-Path $PayloadDir 'node_modules'
if (Test-Path -LiteralPath $srcNM) {
    Write-Step "Copying node_modules (runtime externals)..."
    $dstNM = Join-Path $InstallDir 'node_modules'
    # robocopy is multithreaded and ships with Windows; exit <8 is success.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & robocopy $srcNM $dstNM /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Null
    $rcExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($rcExit -ge 8) { Die "Failed to copy node_modules (robocopy exit $rcExit)." }
    Write-Ok "node_modules copied"
} else {
    Write-Warn2 "No node_modules in payload - the CLI may fail to import its external deps."
}

# Bundled npm -- lets the dependency doctor auto-provision missing deps
# (Playwright, absent externals) on the target with no system Node required.
$srcNpm = Join-Path $PayloadDir 'npm'
if (Test-Path -LiteralPath $srcNpm) {
    Write-Step "Copying npm (for dependency auto-provisioning)..."
    $dstNpm = Join-Path $InstallDir 'npm'
    $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    & robocopy $srcNpm $dstNpm /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Null
    $npmRc = $LASTEXITCODE
    $ErrorActionPreference = $prevEAP
    if ($npmRc -ge 8) { Write-Warn2 "npm copy exited $npmRc (doctor won't auto-download)." }
    else { Write-Ok "npm copied" }
}

# Minimal package.json (used for version display + as a marker)
$pkg = [pscustomobject]@{
    name    = 'olympuz-coder'
    version = $Version
    private = $true
    type    = 'module'
}
$pkg | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $InstallDir 'package.json') -Encoding UTF8

# Windows launcher that uses the BUNDLED node.exe (bin\olympuz.cmd)
$cmd = @'
@echo off
REM Olympuz Coder - Windows launcher (uses the bundled Node runtime)
setlocal
set "OLYMPUZ_HOME=%~dp0.."
"%OLYMPUZ_HOME%\node\node.exe" "%~dp0olympuz" %*
'@
Set-Content -LiteralPath (Join-Path $InstallDir 'bin\olympuz.cmd') -Value $cmd -Encoding ASCII
Write-Ok "Files copied"

# --- 4. Path -----------------------------------------------------------------
Write-Step "Adding to USER Path..."
$binDir = Join-Path $InstallDir 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($null -eq $userPath) { $userPath = '' }
$parts = $userPath.Split(';') | Where-Object { $_ -ne '' }
$present = $false
foreach ($p in $parts) { if ($p -ieq $binDir) { $present = $true; break } }
if ($present) {
    Write-Ok "Path already contains $binDir"
} else {
    $newParts = @($parts) + $binDir
    $newPath = ($newParts -join ';')
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Ok "Added $binDir to the USER Path"
    Write-Warn2 "Open a NEW terminal for 'olympuz' to be on the Path."
}

# --- 5. Shortcuts ------------------------------------------------------------
Write-Step "Creating Start Menu shortcut..."
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$App"
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null
$lnk = Join-Path $startMenu "$App.lnk"
try {
    $wsh = New-Object -ComObject WScript.Shell
    $s = $wsh.CreateShortcut($lnk)
    $s.TargetPath = "$env:SystemRoot\System32\cmd.exe"
    $s.Arguments = '/K olympuz'
    $s.WorkingDirectory = $env:USERPROFILE
    $s.Description = "$App Coder $Version"
    $s.WindowStyle = 1
    $s.Save()
    Write-Ok "Shortcut: $lnk"
} catch {
    Write-Warn2 "Could not create shortcut: $($_.Exception.Message)"
}

# --- 6. Uninstaller ----------------------------------------------------------
Write-Step "Registering uninstaller..."
$uninstPs1 = Join-Path $InstallDir 'uninstall.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Uninstall-Olympuz.ps1') -Destination $uninstPs1 -Force

# Dependency doctor script + olympuz-doctor launcher (so users can re-provision
# anytime: auto-detects what's installed and downloads anything missing).
$checkSrc = Join-Path $PSScriptRoot 'Check-OlympuzDependencies.ps1'
if (Test-Path -LiteralPath $checkSrc) {
    Copy-Item -LiteralPath $checkSrc -Destination (Join-Path $InstallDir 'Check-OlympuzDependencies.ps1') -Force
}
$doctorCmd = @'
@echo off
REM Olympuz Coder - dependency doctor (auto-detect + auto-download missing deps)
setlocal
set "OLYMPUZ_HOME=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%OLYMPUZ_HOME%\Check-OlympuzDependencies.ps1" -InstallDir "%OLYMPUZ_HOME%" %*
'@
Set-Content -LiteralPath (Join-Path $InstallDir 'bin\olympuz-doctor.cmd') -Value $doctorCmd -Encoding ASCII

$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$App"
if (-not (Test-Path $regKey)) { New-Item -Path $regKey -Force | Out-Null }
Set-ItemProperty -Path $regKey -Name 'DisplayName'    -Value "$App Coder" -Type String
Set-ItemProperty -Path $regKey -Name 'DisplayVersion' -Value $Version -Type String
Set-ItemProperty -Path $regKey -Name 'Publisher'      -Value $Publisher -Type String
Set-ItemProperty -Path $regKey -Name 'InstallLocation' -Value $InstallDir -Type String
Set-ItemProperty -Path $regKey -Name 'InstallDate'    -Value (Get-Date -Format 'yyyyMMdd') -Type String
Set-ItemProperty -Path $regKey -Name 'NoModify'  -Value 1 -Type DWord
Set-ItemProperty -Path $regKey -Name 'NoRepair'  -Value 1 -Type DWord
Set-ItemProperty -Path $regKey -Name 'NoRemove'  -Value 0 -Type DWord
$uninstCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$uninstPs1`""
Set-ItemProperty -Path $regKey -Name 'UninstallString' -Value $uninstCmd -Type String
Set-ItemProperty -Path $regKey -Name 'QuietUninstallString' -Value $uninstCmd -Type String
try {
    $kb = [math]::Round((Get-ChildItem -LiteralPath $InstallDir -Recurse -File |
        Measure-Object -Property Length -Sum).Sum / 1KB)
    Set-ItemProperty -Path $regKey -Name 'EstimatedSize' -Value $kb -Type DWord
} catch {}
Write-Ok "Listed in 'Add or remove programs'"

# --- 7. Broadcast WM_SETTINGCHANGE (so Explorer/new shells notice the Path) --
try {
    Add-Type -Namespace Win32 -Name Native -MemberDefinition @"
[System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
"@
    $HWND_BROADCAST = [IntPtr]0xffff
    $WM_SETTINGCHANGE = 0x1A
    $result = [UIntPtr]::Zero
    [void][Win32.Native]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero,
        'Environment', 2, 5000, [ref]$result)
} catch {}

# --- 8. Smoke test -----------------------------------------------------------
Write-Step "Smoke test (bundled node)..."
$nodeExe = Join-Path $InstallDir 'node\node.exe'
# Relax ErrorActionPreference so node's stderr isn't raised as a terminating
# NativeCommandError (a PS 5.1 trap with native executables). Merge stderr so
# any noise stays visible for debugging instead of swallowed.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $nodeExe (Join-Path $InstallDir 'bin\olympuz') '--version' 2>&1 | ForEach-Object { $_ } | Out-Host
$exitCode = $LASTEXITCODE
$ErrorActionPreference = $prevEAP
if ($exitCode -ne 0) {
    Write-Warn2 "Smoke test returned exit code $exitCode (the app may still work in a terminal)."
} else {
    Write-Ok "Smoke test passed"
}

# --- 9. Dependency readiness check + auto-download ---------------------------
# Auto-detects what's installed on this machine and downloads anything missing
# (Playwright + Chromium browser; any absent external dep) so Olympuz has 100%
# of its dependencies before it runs. Non-fatal: a failed download (offline?)
# only warns -- the core install is already complete and runnable.
if ($SkipDeps) {
    Write-Warn2 "-SkipDeps: dependency auto-detect/download skipped."
} else {
    Write-Step "Checking dependencies and auto-downloading anything missing..."
    $checkScript = Join-Path $InstallDir 'Check-OlympuzDependencies.ps1'
    if (Test-Path -LiteralPath $checkScript) {
        $checkArgs = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$checkScript,'-InstallDir',$InstallDir)
        if ($Silent) { $checkArgs += '-Silent' }
        & powershell.exe @checkArgs
        $checkExit = $LASTEXITCODE
        if ($checkExit -ne 0) {
            Write-Warn2 "Dependency check reported issues (exit $checkExit). Core is installed; see the matrix above."
        }
    } else {
        Write-Warn2 "Check-OlympuzDependencies.ps1 not found; skipping dependency check."
    }
}

if (-not $Silent) {
    Write-Host ""
    Write-Ok "Installation complete."
    Write-Host "    Open a NEW terminal and run:  olympuz" -ForegroundColor White
    Write-Host "    Re-check / download deps anytime:  olympuz-doctor" -ForegroundColor White
    Write-Host "    Or use the Start Menu shortcut: $App" -ForegroundColor DarkGray
    Write-Host "    Uninstall from:  Settings > Apps > $App Coder" -ForegroundColor DarkGray
    Write-Host ""
}
exit 0
