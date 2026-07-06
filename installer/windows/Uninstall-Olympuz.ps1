<#
.SYNOPSIS
    Olympuz Coder — Windows uninstaller.
.DESCRIPTION
    Removes the Olympuz install folder, the Start Menu shortcut, the USER Path
    entry, and the registry uninstall key. Registered automatically by
    Install-Olympuz.ps1 so it runs from "Add or remove programs".
.PARAMETER InstallDir
    Install folder. Defaults to "$env:LOCALAPPDATA\Programs\Olympuz".
.PARAMETER Silent
    Suppress prompts/output.
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "",
    [switch]$Silent
)

$ErrorActionPreference = 'SilentlyContinue'
$App = 'Olympuz'
if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\$App" }

function Write-Step($m) { if (-not $Silent) { Write-Host "[*] $m" -ForegroundColor Cyan } }
function Write-Ok($m)   { if (-not $Silent) { Write-Host "[+] $m" -ForegroundColor Green } }
function Write-Warn2($m){ if (-not $Silent) { Write-Host "[!] $m" -ForegroundColor Yellow } }

function Remove-TreeLongPath {
    # Removes a directory tree robustly, tolerating paths longer than 260 chars
    # (npm node_modules nests deep; PS Remove-Item -Recurse fails on those).
    # Strategy: mirror an EMPTY dir over the target with robocopy /MIR (long-path
    # safe -- it purges every file/subdir), then delete the now-empty shell.
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
    if (-not (Test-Path -LiteralPath $InstallDir)) {
        $reply = 'y'
    } else {
        $reply = Read-Host "Uninstall $App from '$InstallDir'? (y/N)"
    }
    if ($reply -notmatch '^[yY]') { Write-Host "Cancelled."; exit 0 }
}

# --- 1. Remove install dir ---------------------------------------------------
if (Test-Path -LiteralPath $InstallDir) {
    Write-Step "Removing $InstallDir ..."
    $removed = Remove-TreeLongPath -Path $InstallDir
    if ($removed) {
        Write-Ok "Install folder removed"
    } else {
        # Fallback: try once more, then warn the user how to finish manually.
        Start-Sleep -Milliseconds 300
        $removed = Remove-TreeLongPath -Path $InstallDir
        if ($removed) { Write-Ok "Install folder removed" }
        else { Write-Warn2 "Some files remain in $InstallDir (locked or long paths). Delete the folder manually." }
    }
} else {
    Write-Warn2 "Install folder not found (already removed?)"
}

# --- 2. Start Menu shortcut --------------------------------------------------
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$App"
if (Test-Path -LiteralPath $startMenu) {
    Remove-Item -LiteralPath $startMenu -Recurse -Force
    Write-Ok "Start Menu entry removed"
}

# --- 3. Path entry -----------------------------------------------------------
$binDir = Join-Path $InstallDir 'bin'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath) {
    $parts = $userPath.Split(';') | Where-Object { $_ -ne '' -and $_ -ine $binDir }
    $newPath = ($parts -join ';')
    if ($newPath -ne $userPath) {
        [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
        Write-Ok "Removed '$binDir' from the USER Path"
    }
}

# --- 4. Registry uninstall key ----------------------------------------------
$regKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$App"
if (Test-Path $regKey) {
    Remove-Item -Path $regKey -Recurse -Force
    Write-Ok "Removed from 'Add or remove programs'"
}

if (-not $Silent) {
    Write-Host ""
    Write-Ok "Uninstall complete."
    Write-Host ""
}
exit 0
