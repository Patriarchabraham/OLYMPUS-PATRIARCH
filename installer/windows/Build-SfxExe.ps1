<#
.SYNOPSIS
    Builds the Olympuz Coder self-extracting installer .exe
    (dist-installer\Olympuz-Setup-<version>-x64.exe).
.DESCRIPTION
    The classic NSIS File/r wizard ABORTS on this payload: node_modules has
    deeply-nested @opentelemetry subtrees with paths > Windows MAX_PATH (260),
    and NSIS's File command opens via CreateFile with no \\?\ prefix. This
    script builds a self-extracting .exe instead:

      1. Ensures the payload is staged (calls Build-Installer.ps1 if not).
      2. Fetches portable 7-Zip (7zr.exe) -- long-path safe for compress AND
         extract -- if not already present.
      3. Packs payload.7z from the staged payload + the installer .ps1 scripts.
      4. Compiles installer-sfx.nsi (an NSIS wrapper that bundles ONLY the two
         shallow files 7zr.exe + payload.7z; at install it 7-Zip-extracts the
         payload then runs Install-Olympuz.ps1, which robocopies to the final
         per-user location -- all long-path safe).

    Requires makensis on PATH (e.g. portable NSIS at $env:LOCALAPPDATA\Programs
    \nsis\nsis-3.12). Pass -MakensisPath to override.
.PARAMETER Version
    Version string baked into the .exe name + metadata. Default "1.0.0".
.PARAMETER MakensisPath
    Full path to makensis.exe. If omitted, resolves via Get-Command.
.PARAMETER SkipStage
    Don't (re)stage the payload even if missing -- fail instead.
.EXAMPLE
    .\Build-SfxExe.ps1
.NOTES
    PowerShell 5.1 compatible. ASCII-only.
#>
[CmdletBinding()]
param(
    [string]$Version = "1.0.0",
    [string]$MakensisPath = "",
    [int]$CompressionLevel = 1,
    [switch]$SkipStage
)

$ErrorActionPreference = 'Stop'
$App = 'Olympuz'
$RepoRoot   = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$PayloadDir = Join-Path $PSScriptRoot "payload\$App"
$PayloadRoot = Join-Path $PSScriptRoot 'payload'
$OutDir     = Join-Path $PSScriptRoot 'dist-installer'

function Step($m){ Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[+] $m" -ForegroundColor Green }
function Warn2($m){ Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "[x] $m" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  === $App Coder $Version -- Build self-extracting .exe ===" -ForegroundColor White
Write-Host ""

# --- 1. Payload staged? ------------------------------------------------------
$marker = Join-Path $PayloadDir 'node\node.exe'
if (-not (Test-Path -LiteralPath $marker)) {
    if ($SkipStage) { Die "Payload not staged ($marker missing) and -SkipStage given." }
    Step "Payload not staged -- running Build-Installer.ps1 to stage it..."
    & (Join-Path $PSScriptRoot 'Build-Installer.ps1')
    if ($LASTEXITCODE -ne 0) { Die "Build-Installer.ps1 failed (exit $LASTEXITCODE)." }
    if (-not (Test-Path -LiteralPath $marker)) { Die "Staging finished but $marker still missing." }
} else {
    Ok "Payload already staged at $PayloadDir"
}
$payloadMB = [math]::Round((Get-ChildItem -LiteralPath $PayloadDir -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Ok "Payload size: $payloadMB MB"

# --- 2. Portable 7-Zip (7zr.exe) ---------------------------------------------
$sevenZLocal = Join-Path $env:LOCALAPPDATA "Programs\7z\7zr.exe"
$sevenZHere  = Join-Path $PSScriptRoot '7zr.exe'   # NSIS File "7zr.exe" resolves next to the .nsi
if (-not (Test-Path -LiteralPath $sevenZHere)) {
    if (-not (Test-Path -LiteralPath $sevenZLocal)) {
        Step "Downloading portable 7-Zip (7zr.exe) from 7-zip.org..."
        $szDir = Split-Path $sevenZLocal -Parent
        if (-not (Test-Path -LiteralPath $szDir)) { New-Item -ItemType Directory -Force -Path $szDir | Out-Null }
        $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & curl.exe -L --fail --max-time 120 -A "Mozilla/5.0" -o $sevenZLocal 'https://www.7-zip.org/a/7zr.exe' 2>&1 |
            ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $ErrorActionPreference = $prev
        if (-not (Test-Path -LiteralPath $sevenZLocal)) { Die "Could not download 7zr.exe." }
    }
    Copy-Item -LiteralPath $sevenZLocal -Destination $sevenZHere -Force
}
Ok "7-Zip: $sevenZHere"

# --- 3. Pack payload.7z (7-Zip handles the >260-char paths) ------------------
# Archive layout (paths relative to this script dir):
#   Install-Olympuz.ps1, Uninstall-Olympuz.ps1, install.cmd,
#   Check-OlympuzDependencies.ps1, payload\Olympuz\*
# so after extraction: <out>\Install-Olympuz.ps1 + <out>\payload\Olympuz\...
$archive = Join-Path $PSScriptRoot 'payload.7z'
if (Test-Path -LiteralPath $archive) { [System.IO.File]::Delete($archive) }
Step "Packing payload.7z (7z, -mx=$CompressionLevel) -- faster/low-RAM on this 6GB box..."
# Pack from THIS script dir so 7zr stores paths relative to installer\windows
# (-> Install-Olympuz.ps1 + payload\Olympuz\... at the archive ROOT). Without
# Push-Location, 7zr inherits the caller's CWD and the wrapper's expected
# extraction layout ($TEMP\OlympuzSFX\out\Install-Olympuz.ps1 ...) silently
# breaks at install time. Mirrors the makensis step below.
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
Push-Location $PSScriptRoot
try {
    & $sevenZHere a -t7z "-mx=$CompressionLevel" -mmt=on -r $archive `
        'Install-Olympuz.ps1' 'Uninstall-Olympuz.ps1' 'install.cmd' `
        'Check-OlympuzDependencies.ps1' 'payload' 2>&1 |
        ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    $zrc = $LASTEXITCODE
} finally { Pop-Location; $ErrorActionPreference = $prev }
# 7zr returns 0 = OK, 1 = warning (still usable). >=2 is failure.
if ($zrc -ge 2) { Die "7zr packing failed (exit $zrc)." }

# Verify the archive layout BEFORE compiling the .exe: each root script MUST
# appear at the archive root (last path token == bare filename). A prefixed
# layout (e.g. installer\windows\...) would make the wrapper's nsExec calls
# miss the .ps1 at install time -- fail fast here instead of shipping a dud.
Step "Verifying payload.7z root layout..."
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$listOut = & $sevenZHere l $archive 2>&1
$ErrorActionPreference = $prev
$rootScripts = @('Install-Olympuz.ps1','Uninstall-Olympuz.ps1','install.cmd','Check-OlympuzDependencies.ps1')
foreach ($s in $rootScripts) {
    $atRoot = $false
    foreach ($ln in $listOut) {
        if (("$ln" -split '\s+')[-1] -ceq $s) { $atRoot = $true; break }
    }
    if (-not $atRoot) { Die "payload.7z layout wrong: '$s' is NOT at the archive root -- the .exe wrapper would fail. Fix 7zr CWD and rebuild." }
}
Ok "payload.7z root layout verified (scripts at archive root)"
$arcMB = [math]::Round((Get-Item -LiteralPath $archive).Length / 1MB, 1)
Ok "payload.7z packed ($arcMB MB; 7z exit $zrc)"

# --- 4. Compile the wrapper with makensis ------------------------------------
Step "Locating makensis..."
if (-not $MakensisPath) { $MakensisPath = (Get-Command makensis -ErrorAction SilentlyContinue).Source }
# PATH may not persist across background shells, so also probe the well-known
# portable NSIS install locations before giving up.
if (-not $MakensisPath) {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\nsis\nsis-3.12\makensis.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nsis\nsis-3.11\makensis.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nsis\makensis.exe'),
        (Join-Path $env:ProgramFiles 'NSIS\makensis.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'NSIS\makensis.exe')
    )
    foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { $MakensisPath = $c; break } }
}
if (-not $MakensisPath) { Die "makensis not found. Put portable NSIS on PATH or pass -MakensisPath." }
Ok "makensis: $MakensisPath"
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$nsi = Join-Path $PSScriptRoot 'installer-sfx.nsi'
Step "Compiling $nsi ..."
# makensis resolves File paths relative to THIS script dir.
$prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
Push-Location $PSScriptRoot
try {
    & $MakensisPath /V2 "/DOLYMPUZ_VERSION=$Version" "/DOLYMPUZ_OUTDIR=$OutDir" $nsi 2>&1 |
        ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    $mkrc = $LASTEXITCODE
} finally { Pop-Location; $ErrorActionPreference = $prev }
if ($mkrc -ne 0) { Die "makensis failed (exit $mkrc)." }

$exe = Join-Path $OutDir "Olympuz-Setup-$Version-x64.exe"
if (-not (Test-Path -LiteralPath $exe)) { Die "makensis exited 0 but $exe was not produced." }
$exeMB = [math]::Round((Get-Item -LiteralPath $exe).Length / 1MB, 1)
Ok "Built: $exe ($exeMB MB)"

Write-Host ""
Ok "Done."
Write-Host "  Distribute the single file: Olympuz-Setup-$Version-x64.exe" -ForegroundColor White
Write-Host "  (double-click on Win10/11 -> wizard extracts + installs per-user + auto-provisions deps)" -ForegroundColor DarkGray
Write-Host ""
