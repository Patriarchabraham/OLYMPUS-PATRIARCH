<#
.SYNOPSIS
    Olympuz Coder -- dependency auto-detector and auto-downloader.
.DESCRIPTION
    Scans the Olympuz install folder AND the Windows machine for every
    dependency the program needs, then AUTO-DOWNLOADS the missing SOFTWARE
    dependencies (Playwright + the Chromium browser) using the bundled Node
    runtime + bundled npm. It also verifies the bundled core (probe-imports
    @orama, sharp, @vscode/ripgrep, @opentelemetry, @aws-sdk, @azure/identity,
    google-auth-library), detects system enablers (Microsoft Edge, SAPI
    text-to-speech, audio device), and checks for API credentials. Prints a
    readiness matrix and an overall verdict.

    Runs automatically at the end of Install-Olympuz.ps1, and standalone via
    olympuz-doctor.cmd so users can re-provision anytime.
.PARAMETER InstallDir
    Olympuz install folder. Default: "$env:LOCALAPPDATA\Programs\Olympuz".
.PARAMETER NoDownload
    Detect and report only; do not download anything.
.PARAMETER Silent
    Reduce informational output (the matrix is always printed).
.EXAMPLE
    .\Check-OlympuzDependencies.ps1
.EXAMPLE
    .\Check-OlympuzDependencies.ps1 -NoDownload
.NOTES
    PowerShell 5.1 compatible. Intentionally ASCII-only (no smart quotes or
    em-dashes) so it parses identically with or without a UTF-8 BOM.
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "",
    [switch]$NoDownload,
    [switch]$Silent
)

# Resilient by design: never terminating-error on a native command (node/npm
# write to stderr, which under 'Stop' becomes a NativeCommandError).
$ErrorActionPreference = 'Continue'

if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\Olympuz' }

function Info($m)  { Write-Host "[*] $m" -ForegroundColor Cyan }
function Ok($m)    { Write-Host "[+] $m" -ForegroundColor Green }
function Warn2($m) { Write-Host "[!] $m" -ForegroundColor Yellow }
function Bad($m)   { Write-Host "[x] $m" -ForegroundColor Red }
function Sub($m)   { if (-not $Silent) { Write-Host "    $m" -ForegroundColor DarkGray } }

# A single env var across Process / User / Machine scopes (first hit wins).
function Get-EnvVar($name) {
    foreach ($scope in 'Process','User','Machine') {
        $v = [Environment]::GetEnvironmentVariable($name, $scope)
        if ($v) { return $v }
    }
    return $null
}

$script:rows = New-Object System.Collections.ArrayList
$script:coreBroken = $false
function Add-Row($tier, $name, $status, $detail) {
    [void]$script:rows.Add([pscustomobject]@{
        Tier = $tier; Name = $name; Status = $status; Detail = $detail
    })
}

Write-Host ""
Write-Host "  === Olympuz Coder -- Dependency Readiness Check ===" -ForegroundColor White
Write-Host "  Install: $InstallDir" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path -LiteralPath $InstallDir)) {
    Bad "Install dir not found: $InstallDir"
    exit 1
}

$nodeExe = Join-Path $InstallDir 'node\node.exe'
$distCli = Join-Path $InstallDir 'dist\cli.mjs'

# --- 1. CORE: launcher + bundled runtime + probe-import every external -------
if (-not (Test-Path -LiteralPath $nodeExe)) {
    Add-Row 'Core' 'Node runtime (bundled)' 'FAIL' 'node\node.exe missing'
    $script:coreBroken = $true
} else {
    $nodeVer = (& $nodeExe --version 2>$null)
    Add-Row 'Core' 'Node runtime (bundled)' 'OK' $nodeVer
}
if (-not (Test-Path -LiteralPath $distCli)) {
    Add-Row 'Core' 'App bundle (dist/cli.mjs)' 'FAIL' 'missing'
    $script:coreBroken = $true
} else {
    Add-Row 'Core' 'App bundle (dist/cli.mjs)' 'OK' 'present'
}

if (-not $script:coreBroken) {
    # The full CLI_EXTERNALS list (scripts/externals.ts COMMON_EXTERNALS).
    $cliExternals = @(
        '@opentelemetry/api','@opentelemetry/api-logs','@opentelemetry/core',
        '@opentelemetry/exporter-trace-otlp-grpc','@opentelemetry/exporter-trace-otlp-http','@opentelemetry/exporter-trace-otlp-proto',
        '@opentelemetry/exporter-logs-otlp-http','@opentelemetry/exporter-logs-otlp-proto','@opentelemetry/exporter-logs-otlp-grpc',
        '@opentelemetry/exporter-metrics-otlp-proto','@opentelemetry/exporter-metrics-otlp-grpc','@opentelemetry/exporter-metrics-otlp-http',
        '@opentelemetry/exporter-prometheus','@opentelemetry/resources','@opentelemetry/sdk-trace-base','@opentelemetry/sdk-trace-node',
        '@opentelemetry/sdk-logs','@opentelemetry/sdk-metrics','@opentelemetry/semantic-conventions',
        'sharp','@aws-sdk/client-bedrock','@aws-sdk/client-bedrock-runtime','@aws-sdk/client-sts','@aws-sdk/credential-providers',
        '@azure/identity','google-auth-library','@orama/orama','@orama/plugin-data-persistence'
    )
    $nmDir = Join-Path $InstallDir 'node_modules'
    $present = @(); $absent = @()
    foreach ($pkg in $cliExternals) {
        $pkgJson = Join-Path $nmDir (($pkg -replace '/', '\') + '\package.json')
        if (Test-Path -LiteralPath $pkgJson) { $present += $pkg } else { $absent += $pkg }
    }

    # ripgrep binary is resolved by @vscode/ripgrep at runtime via __dirname;
    # check the platform binary directly (a coding agent needs grep to work).
    $rgExe = Join-Path $nmDir '@vscode\ripgrep\bin\rg.exe'
    if (Test-Path -LiteralPath $rgExe) {
        Add-Row 'Core' '@vscode/ripgrep (rg.exe)' 'OK' 'binary present'
    } else {
        Add-Row 'Core' '@vscode/ripgrep (rg.exe)' 'FAIL' 'binary missing'
        $script:coreBroken = $true
    }

    # Probe-import the physically-present externals (integrity check).
    if ($present.Count -gt 0) {
        Sub "Probe-importing $($present.Count) bundled external(s)..."
        $probePkgs = $present | Where-Object { $_ -ne '@vscode/ripgrep' }
        if ($probePkgs.Count -gt 0) {
            $probePath = Join-Path $InstallDir '.olympuz-deps-probe.mjs'
            $pkgList = ($probePkgs | ForEach-Object { "'$_'" }) -join ','
            $probeBody = @"
const pkgs = [$pkgList];
const out = [];
(async () => {
  for (const p of pkgs) {
    try { await import(p); out.push('OK|' + p); }
    catch (e) { out.push('FAIL|' + p + '|' + String(e && e.message || '').split(String.fromCharCode(10))[0]); }
  }
  console.log(out.join('\n'));
})();
"@
            Set-Content -LiteralPath $probePath -Value $probeBody -Encoding UTF8 -NoNewline
            try { $probeOut = & $nodeExe $probePath 2>$null }
            finally { Remove-Item -LiteralPath $probePath -Force -ErrorAction SilentlyContinue }
            $sawProbe = $false
            foreach ($line in $probeOut) {
                if (-not $line) { continue }
                $sawProbe = $true
                $parts = $line -split '\|', 3
                $stat = $parts[0]; $name = $parts[1]
                $detail = if ($parts.Count -gt 2) { $parts[2] } else { '' }
                if ($stat -eq 'OK') { Add-Row 'Core' $name 'OK' $detail }
                else { Add-Row 'Core' $name 'FAIL' $detail; $script:coreBroken = $true }
            }
            if (-not $sawProbe -and $probePkgs.Count -gt 0) {
                Add-Row 'Core' 'External deps probe' 'FAIL' 'probe produced no output'
                $script:coreBroken = $true
            }
        }
    }

    # Absent externals are LAZY cloud-provider deps (only imported inside a
    # specific provider path, e.g. @azure/identity for Azure). Missing does NOT
    # break core. Auto-install them via the bundled npm for 100% coverage.
    if ($absent.Count -gt 0) {
        $npmCli = Join-Path $InstallDir 'npm\bin\npm-cli.js'
        $canInstall = (-not $NoDownload) -and (Test-Path -LiteralPath $npmCli)
        if ($canInstall) {
            Info "Auto-installing $($absent.Count) missing external(s) for 100% coverage..."
            # CRITICAL: stage into a TEMP tree then robocopy-merge into the
            # install. Never run npm against the install's node_modules directly
            # -- npm reconciles against package.json and would PRUNE the
            # (undeclared) packages already present.
            $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("olympuz-ext-stage-$PID")
            if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
            New-Item -ItemType Directory -Force -Path $stage | Out-Null
            @{ name = 'olympuz-ext-stage'; private = $true; dependencies = @{} } | ConvertTo-Json |
                Set-Content -LiteralPath (Join-Path $stage 'package.json') -Encoding UTF8
            Sub ("node npm-cli.js install " + ($absent -join ' ') + "  (staged)")
            & $nodeExe $npmCli install @absent --prefix $stage --no-audit --no-fund --omit=dev 2>&1 | Out-Host
            $nmExit = $LASTEXITCODE
            $stageNm = Join-Path $stage 'node_modules'
            if ($nmExit -eq 0 -and (Test-Path -LiteralPath $stageNm)) {
                & robocopy $stageNm $nmDir /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Null
                foreach ($pkg in $absent) {
                    $pkgJson = Join-Path $nmDir (($pkg -replace '/', '\') + '\package.json')
                    if (Test-Path -LiteralPath $pkgJson) {
                        Add-Row 'Core' $pkg 'DOWNLOADED' 'installed via bundled npm'
                    } else {
                        Add-Row 'Optional' $pkg 'OPTIONAL' 'lazy provider dep; merge failed'
                    }
                }
            } else {
                foreach ($pkg in $absent) {
                    Add-Row 'Optional' $pkg 'OPTIONAL' "download failed (npm exit $nmExit; offline?)"
                }
            }
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
        } else {
            foreach ($pkg in $absent) {
                $tag = if ($NoDownload) { 'not installed (-NoDownload)' } else { 'lazy provider dep; npm not bundled' }
                Add-Row 'Optional' $pkg 'OPTIONAL' $tag
            }
        }
    }
}

# --- 2. OPTIONAL: Playwright + Chromium browser (auto-download) --------------
$pwDir = Join-Path $InstallDir 'node_modules\playwright'
$pwCoreDir = Join-Path $InstallDir 'node_modules\playwright-core'
$hasPlaywright = (Test-Path -LiteralPath $pwDir) -or (Test-Path -LiteralPath $pwCoreDir)
$pwWasDownloaded = $false
if ($hasPlaywright) {
    Add-Row 'Optional' 'Playwright (npm)' 'OK' 'present in node_modules'
} elseif ($NoDownload) {
    Add-Row 'Optional' 'Playwright (npm)' 'OPTIONAL' 'not installed (-NoDownload)'
} else {
    $npmCli = Join-Path $InstallDir 'npm\bin\npm-cli.js'
    if (-not (Test-Path -LiteralPath $npmCli)) {
        Add-Row 'Optional' 'Playwright (npm)' 'OPTIONAL' 'npm not bundled; cannot auto-download'
    } else {
        Info 'Downloading Playwright (enables Ops browser control)...'
        # CRITICAL: stage into a TEMP tree then robocopy-merge into the install's
        # node_modules. Never run npm directly against the install -- the minimal
        # package.json has no deps, so npm would PRUNE everything already there.
        $stage = Join-Path ([System.IO.Path]::GetTempPath()) ("olympuz-pw-stage-$PID")
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
        New-Item -ItemType Directory -Force -Path $stage | Out-Null
        @{ name = 'olympuz-pw-stage'; private = $true; dependencies = @{} } | ConvertTo-Json |
            Set-Content -LiteralPath (Join-Path $stage 'package.json') -Encoding UTF8
        Sub "node npm-cli.js install playwright (staged)"
        & $nodeExe $npmCli install playwright --prefix $stage --no-audit --no-fund --omit=dev 2>&1 | Out-Host
        $rc = $LASTEXITCODE
        $stageNm = Join-Path $stage 'node_modules'
        if ($rc -eq 0 -and (Test-Path -LiteralPath $stageNm)) {
            & robocopy $stageNm $nmDir /E /MT:8 /NJH /NJS /NFL /NDL /NP | Out-Host
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
            if (Test-Path -LiteralPath $pwDir) {
                Add-Row 'Optional' 'Playwright (npm)' 'DOWNLOADED' 'installed via bundled npm (merged)'
                $hasPlaywright = $true
                $pwWasDownloaded = $true
            } else {
                Add-Row 'Optional' 'Playwright (npm)' 'OPTIONAL' 'installed but merge incomplete'
            }
        } else {
            Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
            Add-Row 'Optional' 'Playwright (npm)' 'OPTIONAL' "download failed (npm exit $rc; offline?)"
        }
    }
}

# Chromium browser (Playwright stores browsers in %LOCALAPPDATA%\ms-playwright)
$pwCache = Join-Path $env:LOCALAPPDATA 'ms-playwright'
function Test-Chromium {
    if (-not (Test-Path -LiteralPath $pwCache)) { return $false }
    return ((Get-ChildItem -LiteralPath $pwCache -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'chromium-*' } | Measure-Object).Count -gt 0)
}
if (Test-Chromium) {
    Add-Row 'Optional' 'Chromium (Playwright browser)' 'OK' 'in ms-playwright cache'
} elseif (-not $hasPlaywright) {
    Add-Row 'Optional' 'Chromium (Playwright browser)' 'OPTIONAL' 'needs Playwright first'
} elseif ($NoDownload) {
    Add-Row 'Optional' 'Chromium (Playwright browser)' 'OPTIONAL' 'not downloaded (-NoDownload)'
} else {
    $pwCli = Join-Path $InstallDir 'node_modules\playwright\cli.js'
    if (-not (Test-Path -LiteralPath $pwCli)) {
        Add-Row 'Optional' 'Chromium (Playwright browser)' 'OPTIONAL' 'playwright cli not found'
    } else {
        Info 'Downloading Chromium (Playwright browser ~170 MB)...'
        Sub "node playwright/cli.js install chromium"
        & $nodeExe $pwCli install chromium 2>&1 | Out-Host
        $brc = $LASTEXITCODE
        if ($brc -eq 0 -and (Test-Chromium)) {
            Add-Row 'Optional' 'Chromium (Playwright browser)' 'DOWNLOADED' 'installed to ms-playwright cache'
            $pwWasDownloaded = $true
        } else {
            Add-Row 'Optional' 'Chromium (Playwright browser)' 'OPTIONAL' "download failed (exit $brc; offline?)"
        }
    }
}

# --- 3. SYSTEM enablers (detect; not installable per-user) ------------------
$edgePaths = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgePaths | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
Add-Row 'System' 'Microsoft Edge (headless PDF)' $(if ($edge) { 'OK' } else { 'MISSING' }) `
    $(if ($edge) { 'found' } else { 'not found (used to render manuals to PDF)' })

$sapiOk = $false
try {
    $voice = New-Object -ComObject SAPI.SpVoice
    $sapiOk = $true
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($voice) | Out-Null
} catch {}
Add-Row 'System' 'SAPI (text-to-speech)' $(if ($sapiOk) { 'OK' } else { 'MISSING' }) `
    $(if ($sapiOk) { 'available' } else { 'unavailable (TTS disabled)' })

$audio = $false
try {
    $audio = ((Get-CimInstance -ClassName Win32_SoundDevice -ErrorAction Stop | Measure-Object).Count -gt 0)
} catch {}
Add-Row 'System' 'Audio device (speech-to-text)' $(if ($audio) { 'OK' } else { 'MISSING' }) `
    $(if ($audio) { 'present' } else { 'none found (STT disabled)' })

# --- 4. CREDENTIALS (detect; can never be auto-downloaded) ------------------
$authToken = Get-EnvVar 'ANTHROPIC_AUTH_TOKEN'
$apiKey    = Get-EnvVar 'ANTHROPIC_API_KEY'
$baseUrl   = Get-EnvVar 'ANTHROPIC_BASE_URL'
$hasAuth   = -not [string]::IsNullOrWhiteSpace($authToken) -or -not [string]::IsNullOrWhiteSpace($apiKey)
Add-Row 'Credential' 'API key / token' $(if ($hasAuth) { 'OK' } else { 'NOT-CONFIGURED' }) `
    $(if ($hasAuth) { 'detected in environment' } else { 'set ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY' })
Add-Row 'Credential' 'API base URL' $(if ($baseUrl) { 'OK' } else { 'OPTIONAL' }) `
    $(if ($baseUrl) { $baseUrl } else { 'defaults to Anthropic; set ANTHROPIC_BASE_URL for a proxy (Z.AI/GLM)' })

# --- 5. Matrix + verdict -----------------------------------------------------
Write-Host ""
Write-Host "===== Readiness matrix =====" -ForegroundColor White
$script:rows | Sort-Object Tier, Name | Format-Table Tier, Name, Status, Detail -AutoSize -Wrap | Out-Host

$coreFails = @($script:rows | Where-Object { $_.Tier -eq 'Core' -and $_.Status -eq 'FAIL' }).Count
Write-Host "-----------------------------------------"
if ($script:coreBroken -or $coreFails -gt 0) {
    Bad "VERDICT: CORE INCOMPLETE ($coreFails core dependency failed). Reinstall Olympuz."
    $exitCode = 1
} elseif (-not $hasAuth) {
    Warn2 "VERDICT: CORE OK -- but no API credentials detected."
    Write-Host "         Set ANTHROPIC_AUTH_TOKEN (or ANTHROPIC_API_KEY) before running." -ForegroundColor Yellow
    if ($baseUrl) { Write-Host "         Base URL detected: $baseUrl" -ForegroundColor DarkGray }
    $exitCode = 0
} else {
    Ok "VERDICT: READY -- 100% of core dependencies present."
    $exitCode = 0
}
if ($pwWasDownloaded) {
    Ok "Provisioned optional deps this run (Ops browser control enabled)."
}
Write-Host ""
exit $exitCode
