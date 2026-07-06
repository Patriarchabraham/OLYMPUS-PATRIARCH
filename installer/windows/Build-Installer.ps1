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
    Get-ChildItem -LiteralPath $PayloadRoot -Directory | Remove-Item -Recurse -Force
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
foreach ($f in @('Install-Olympuz.ps1', 'Uninstall-Olympuz.ps1', 'install.cmd')) {
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
