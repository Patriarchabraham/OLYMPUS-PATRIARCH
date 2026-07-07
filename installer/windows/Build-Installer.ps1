<#
.SYNOPSIS
    Stages the Olympuz Coder payload (self-contained: bundled Node + built app)
    ready for Install-Olympuz.ps1, and optionally compiles a single-file NSIS .exe.
.DESCRIPTION
    Steps:
      1. Ensures dist/cli.mjs exists (runs 'npm run build' if missing).
      2. Stages .\payload\Olympuz\{bin,dist,node} + package.json from the repo.
      3. Bundles the local node.exe into payload\Olympuz\node\node.exe
         (so the install needs NO Node on the target machine).
      4. Smoke-tests the staged bundle: <bundled node> olympuz --version.
      5. If -CompileExe and makensis is available, compiles installer.nsi ->
         .\dist-installer\Olympuz-Setup-<version>-x64.exe
.PARAMETER CompileExe
    Also compile a single-file NSIS wizard .exe (requires NSIS / makensis).
.PARAMETER SkipBundleNode
    Do not bundle node.exe (target machines must have Node 22+ installed).
.PARAMETER RepoRoot
    Repo root (auto-detected as two levels above this script if omitted).
.EXAMPLE
    .\Build-Installer.ps1
.EXAMPLE
    .\Build-Installer.ps1 -CompileExe
#>

[CmdletBinding()]
param(
    [switch]$CompileExe,
    [switch]$SkipBundleNode,
    [string]$RepoRoot = ""
)

$ErrorActionPreference = 'Stop'
$App = 'Olympuz'
$Version = '1.0.0'

if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
$PayloadRoot = Join-Path $PSScriptRoot "payload"
$PayloadDir  = Join-Path $PayloadRoot $App

function Step($m){ Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok($m){ Write-Host "[+] $m" -ForegroundColor Green }
function Warn2($m){ Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m){ Write-Host "[x] $m" -ForegroundColor Red; exit 1 }

function Remove-TreeLongPath {
    # Long-path-tolerant delete (npm node_modules nests > 260 chars; PS
    # Remove-Item -Recurse fails on those). Mirror an empty dir over the target
    # with robocopy /MIR, then drop the now-empty shell.
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $true }
    $empty = Join-Path ([System.IO.Path]::GetTempPath()) ("olympuz-empty-$PID")
    New-Item -ItemType Directory -Force -Path $empty | Out-Null
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try {
        & robocopy $empty $Path /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { return $false }
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
        return (-not (Test-Path -LiteralPath $Path))
    } finally {
        $ErrorActionPreference = $prev
        Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "  === $App Coder $Version — Build Installer ===" -ForegroundColor White
Write-Host "  Repo:  $RepoRoot" -ForegroundColor DarkGray
Write-Host ""

# --- 1. dist/cli.mjs ---------------------------------------------------------
$distCli = Join-Path $RepoRoot 'dist\cli.mjs'
if (-not (Test-Path -LiteralPath $distCli)) {
    Step "dist/cli.mjs not found — building (npm run build)..."
    Push-Location $RepoRoot
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { Pop-Location; Die "npm run build failed (exit $LASTEXITCODE)." }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $distCli)) { Die "dist/cli.mjs still missing after build." }
$distSize = [math]::Round((Get-Item -LiteralPath $distCli).Length / 1MB, 1)
Ok "dist/cli.mjs ready ($distSize MB)"

# --- 2. Stage payload --------------------------------------------------------
Step "Staging payload at $PayloadDir ..."
if (Test-Path -LiteralPath $PayloadRoot) {
    Get-ChildItem -LiteralPath $PayloadRoot -Directory | ForEach-Object {
        $cleared = Remove-TreeLongPath -Path $_.FullName
        if (-not $cleared) { Die "Could not clear $($_.FullName) (long paths). Delete .\payload manually and retry." }
    }
}
foreach ($sub in @('bin', 'dist', 'node')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $PayloadDir $sub) | Out-Null
}

# bin/olympuz launcher (.mjs)
$srcLauncher = Join-Path $RepoRoot 'bin\olympuz'
if (-not (Test-Path -LiteralPath $srcLauncher)) { Die "bin\olympuz launcher not found." }
Copy-Item -LiteralPath $srcLauncher -Destination (Join-Path $PayloadDir 'bin\olympuz') -Force

# dist
Copy-Item -LiteralPath $distCli -Destination (Join-Path $PayloadDir 'dist\cli.mjs') -Force

# package.json stub (the launcher reads ../package.json for version in some paths)
$pkgPath = Join-Path $PayloadDir 'package.json'
$pkg = [pscustomobject]@{ name = 'olympuz-coder'; version = $Version; private = $true; type = 'module' }
$pkg | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $pkgPath -Encoding UTF8

# bin\olympuz.cmd -- Windows launcher using the BUNDLED node.exe (so Olympuz
# runs even when Node is not on the target's PATH). Generated INTO THE PAYLOAD
# here so the NSIS wizard (which just File's the payload) produces a COMPLETE
# install identical to Install-Olympuz.ps1. Without it, `olympuz` would not
# resolve on PATH after an NSIS install.
$olympuzCmd = @'
@echo off
REM Olympuz Coder - Windows launcher (uses the bundled Node runtime)
setlocal
set "OLYMPUZ_HOME=%~dp0.."
"%OLYMPUZ_HOME%\node\node.exe" "%~dp0olympuz" %*
'@
Set-Content -LiteralPath (Join-Path $PayloadDir 'bin\olympuz.cmd') -Value $olympuzCmd -Encoding ASCII

# bin\olympuz-doctor.cmd -- dependency auto-detect + auto-download launcher.
$doctorCmd = @'
@echo off
REM Olympuz Coder - dependency doctor (auto-detect + auto-download missing deps)
setlocal
set "OLYMPUZ_HOME=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%OLYMPUZ_HOME%\Check-OlympuzDependencies.ps1" -InstallDir "%OLYMPUZ_HOME%" %*
'@
Set-Content -LiteralPath (Join-Path $PayloadDir 'bin\olympuz-doctor.cmd') -Value $doctorCmd -Encoding ASCII

# Check-OlympuzDependencies.ps1 -- the doctor engine, so `olympuz-doctor` works
# from a fresh install (the NSIS path does not run Install-Olympuz.ps1, which
# would otherwise copy it at install time).
$checkSrc = Join-Path $PSScriptRoot 'Check-OlympuzDependencies.ps1'
if (Test-Path -LiteralPath $checkSrc) {
    Copy-Item -LiteralPath $checkSrc -Destination (Join-Path $PayloadDir 'Check-OlympuzDependencies.ps1') -Force
}
Ok "App files staged"

# --- 3. Bundle node.exe ------------------------------------------------------
if ($SkipBundleNode) {
    Warn2 "-SkipBundleNode: target machines MUST have Node 22+ installed."
} else {
    Step "Bundling node.exe ..."
    $nodeSrc = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeSrc) { Die "node.exe not found on this machine. Install Node, or rerun with -SkipBundleNode." }
    $nodeVer = (& $nodeSrc --version)
    Copy-Item -LiteralPath $nodeSrc -Destination (Join-Path $PayloadDir 'node\node.exe') -Force
    $nodeMB = [math]::Round((Get-Item -LiteralPath (Join-Path $PayloadDir 'node\node.exe')).Length / 1MB, 1)
    Ok "Bundled $nodeVer ($nodeMB MB)"
}

# --- 3b. Bundle runtime node_modules -----------------------------------------
# dist/cli.mjs keeps the CLI_EXTERNALS as bare imports (not bundled into the
# bundle), so a standalone install needs node_modules present. Copy the
# production tree, excluding pure-dev packages dist/cli.mjs never imports.
Step "Bundling runtime node_modules (excluding dev tools)..."
$srcNodeModules = Join-Path $RepoRoot 'node_modules'
$dstNodeModules = Join-Path $PayloadDir 'node_modules'
if (-not (Test-Path -LiteralPath $srcNodeModules)) {
    Die "node_modules not found at $srcNodeModules. Run 'npm install' in the repo first."
}
$excludeDirs = @(
    'typescript','vitest','esbuild','tsx','cross-env','husky','lint-staged','bun-types',
    '@biomejs','@types','@vitest'
) | ForEach-Object { Join-Path $srcNodeModules $_ }
$robocopyArgs = @($srcNodeModules, $dstNodeModules,
    '/E','/MT:8','/NJH','/NJS','/NFL','/NDL','/NP','/XD') + $excludeDirs
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { Die "robocopy failed (exit $LASTEXITCODE) copying node_modules." }
$nmMB = [math]::Round((Get-ChildItem -LiteralPath $dstNodeModules -Recurse -File -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Ok "node_modules bundled ($nmMB MB)"

# --- 3c. Bundle npm + complete external deps to 100% -------------------------
# Bundle npm so the install-time doctor can auto-download any missing dep on the
# target. Then install any CLI_EXTERNALS that are absent from the prod tree
# (e.g. @azure/identity, some @opentelemetry/exporter-* are externalized but not
# direct deps) so the payload ships 100% complete OFFLINE.
if (-not $SkipBundleNode) {
    Step "Bundling npm (so installs can auto-provision deps)..."
    $nodeSrcPath = (Get-Command node -ErrorAction SilentlyContinue).Source
    $nodeRootDir = Split-Path $nodeSrcPath -Parent
    $npmSrcDir   = Join-Path $nodeRootDir 'node_modules\npm'
    $npmDstDir   = Join-Path $PayloadDir 'npm'
    if (Test-Path -LiteralPath $npmSrcDir) {
        & robocopy $npmSrcDir $npmDstDir /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Null
        if ($LASTEXITCODE -ge 8) { Warn2 "robocopy of npm exited $LASTEXITCODE (doctor won't auto-download)." }
        else { Ok "npm bundled" }
    } else {
        Warn2 "npm source not found at $npmSrcDir (doctor won't auto-download)."
    }

    Step "Completing external dependencies to 100%..."
    $cliExternals = @(
        '@opentelemetry/api','@opentelemetry/api-logs','@opentelemetry/core',
        '@opentelemetry/exporter-trace-otlp-grpc','@opentelemetry/exporter-trace-otlp-http','@opentelemetry/exporter-trace-otlp-proto',
        '@opentelemetry/exporter-logs-otlp-http','@opentelemetry/exporter-logs-otlp-proto','@opentelemetry/exporter-logs-otlp-grpc',
        '@opentelemetry/exporter-metrics-otlp-proto','@opentelemetry/exporter-metrics-otlp-grpc','@opentelemetry/exporter-metrics-otlp-http',
        '@opentelemetry/exporter-prometheus','@opentelemetry/resources','@opentelemetry/sdk-trace-base','@opentelemetry/sdk-trace-node',
        '@opentelemetry/sdk-logs','@opentelemetry/sdk-metrics','@opentelemetry/semantic-conventions',
        'sharp','@aws-sdk/client-bedrock','@aws-sdk/client-bedrock-runtime','@aws-sdk/client-sts','@aws-sdk/credential-providers',
        '@azure/identity','google-auth-library','@vscode/ripgrep','@orama/orama','@orama/plugin-data-persistence'
    )
    $missing = @()
    foreach ($pkg in $cliExternals) {
        $pkgJson = Join-Path $dstNodeModules (($pkg -replace '/', '\') + '\package.json')
        if (-not (Test-Path -LiteralPath $pkgJson)) { $missing += $pkg }
    }
    if ($missing.Count -eq 0) {
        Ok "All $($cliExternals.Count) externals already present"
    } else {
        Step "Installing $($missing.Count) missing external(s): $($missing -join ', ')"
        # CRITICAL: install into a TEMP staging tree, then robocopy-merge into
        # the payload. Never run npm directly against payload\node_modules -- npm
        # reconciles node_modules against package.json and would PRUNE the
        # (undeclared) packages we already copied (the minimal stub has no deps).
        $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("olympuz-ext-stage-$PID")
        if (Test-Path -LiteralPath $stage) { Remove-TreeLongPath -Path $stage | Out-Null }
        New-Item -ItemType Directory -Force -Path $stage | Out-Null
        @{ name = 'olympuz-ext-stage'; private = $true; dependencies = @{} } | ConvertTo-Json |
            Set-Content -LiteralPath (Join-Path $stage 'package.json') -Encoding UTF8
        $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & npm install @missing --prefix $stage --no-audit --no-fund --omit=dev 2>&1 |
            ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $npmExit = $LASTEXITCODE
        $ErrorActionPreference = $prev
        $stageNm = Join-Path $stage 'node_modules'
        if ($npmExit -eq 0 -and (Test-Path -LiteralPath $stageNm)) {
            # Add-only merge (robocopy /E does NOT delete extras in the dest).
            & robocopy $stageNm $dstNodeModules /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Null
            if ($LASTEXITCODE -ge 8) { Warn2 "robocopy merge exited $LASTEXITCODE." }
            # Re-check the FULL external set (not just the originally-missing).
            $allOk = $true
            foreach ($pkg in $cliExternals) {
                $pkgJson = Join-Path $dstNodeModules (($pkg -replace '/', '\') + '\package.json')
                if (-not (Test-Path -LiteralPath $pkgJson)) { $allOk = $false; Warn2 "Still missing: $pkg" }
            }
            if ($allOk) { Ok "All $($cliExternals.Count) externals present (100%)" }
        } else {
            Warn2 "npm install exited $npmExit (the install-time doctor will retry)."
        }
        Remove-TreeLongPath -Path $stage | Out-Null
    }
}

# --- 4. Smoke test -----------------------------------------------------------
Step "Smoke-testing staged bundle..."
$nodeExe = Join-Path $PayloadDir 'node\node.exe'
$launcher = Join-Path $PayloadDir 'bin\olympuz'
if (Test-Path -LiteralPath $nodeExe) {
    & $nodeExe $launcher --version 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -eq 0) { Ok "Smoke test passed" } else { Warn2 "Smoke test exit $LASTEXITCODE (review output above)." }
} else {
    Warn2 "Skipped (no bundled node). CLI will use system node on the target."
}

# --- 5. Payload size ---------------------------------------------------------
$totalKB = [math]::Round((Get-ChildItem -LiteralPath $PayloadDir -Recurse -File |
    Measure-Object -Property Length -Sum).Sum / 1MB, 1)
Ok "Payload staged: $PayloadDir ($totalKB MB)"

# --- 6. NSIS .exe (optional) -------------------------------------------------
if ($CompileExe) {
    Step "Locating makensis (NSIS)..."
    $makensis = (Get-Command makensis -ErrorAction SilentlyContinue).Source
    if (-not $makensis) {
        foreach ($cand in @("$env:ProgramFiles\NSIS\makensis.exe", "${env:ProgramFiles(x86)}\NSIS\makensis.exe")) {
            if (Test-Path -LiteralPath $cand) { $makensis = $cand; break }
        }
    }
    if (-not $makensis) {
        Warn2 "makensis not found. Install NSIS to build a single-file .exe wizard:"
        Write-Host "        winget install NSIS.NSIS" -ForegroundColor DarkYellow
        Write-Host "      (or)  choco install nsis -y" -ForegroundColor DarkYellow
        Write-Host "    Then rerun: .\Build-Installer.ps1 -CompileExe" -ForegroundColor DarkGray
    } else {
        Step "Compiling NSIS installer ($makensis)..."
        $outDir = Join-Path $PSScriptRoot 'dist-installer'
        New-Item -ItemType Directory -Force -Path $outDir | Out-Null
        $nsi = Join-Path $PSScriptRoot 'installer.nsi'
        & $makensis /V2 "/DOLYMPUZ_VERSION=$Version" "/DOLYMPUZ_OUTDIR=$outDir" $nsi
        if ($LASTEXITCODE -eq 0) {
            $exe = Join-Path $outDir "Olympuz-Setup-$Version-x64.exe"
            if (Test-Path -LiteralPath $exe) {
                $exeMB = [math]::Round((Get-Item -LiteralPath $exe).Length / 1MB, 1)
                Ok "Built: $exe ($exeMB MB)"
            } else { Warn2 "makensis exited 0 but the .exe was not found in $outDir." }
        } else { Warn2 "makensis failed (exit $LASTEXITCODE)." }
    }
}

# --- 7. Copy installers next to payload so the folder is distributable -------
foreach ($f in @('Install-Olympuz.ps1', 'Uninstall-Olympuz.ps1', 'install.cmd', 'Check-OlympuzDependencies.ps1')) {
    $src = Join-Path $PSScriptRoot $f
    if (Test-Path -LiteralPath $src) {
        Copy-Item -LiteralPath $src -Destination (Join-Path $PayloadRoot $f) -Force
    }
}

Write-Host ""
Ok "Done."
Write-Host "  To install on this machine:    .\Install-Olympuz.ps1" -ForegroundColor White
Write-Host "  To distribute: zip the 'payload' folder (double-click install.cmd)." -ForegroundColor DarkGray
Write-Host ""
