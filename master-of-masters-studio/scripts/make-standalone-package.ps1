# Standalone All-In-One Offline Package & Installer Builder (With Embedded bun.exe)
$distDir = "C:\OLYMPUZ\master-of-masters-studio\dist"
$pkgDir = "C:\OLYMPUZ\master-of-masters-studio\package-standalone"

if (Test-Path $pkgDir) { 
    Remove-Item -Path $pkgDir -Recurse -Force 
}

New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $pkgDir "dist") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $pkgDir "bin") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $pkgDir "scripts") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $pkgDir "installer") -Force | Out-Null

# 1. Copy built production assets (all 20 producers, 17 mics, vocal god, dsp engines)
Copy-Item -Path "$distDir\*" -Destination (Join-Path $pkgDir "dist") -Recurse -Force
Copy-Item -Path "C:\OLYMPUZ\master-of-masters-studio\package.json" -Destination (Join-Path $pkgDir "package.json") -Force
Copy-Item -Path "C:\OLYMPUZ\master-of-masters-studio\scripts\server.ps1" -Destination (Join-Path $pkgDir "scripts\server.ps1") -Force
Copy-Item -Path "C:\OLYMPUZ\master-of-masters-studio\scripts\start-windows.bat" -Destination (Join-Path $pkgDir "scripts\start-windows.bat") -Force
Copy-Item -Path "C:\OLYMPUZ\master-of-masters-studio\installer\create-clean-shortcuts.ps1" -Destination (Join-Path $pkgDir "installer\create-clean-shortcuts.ps1") -Force

# 2. Copy embedded bun.exe binary
$bunExePath = "C:\Users\Patriarch Romana\.bun\bin\bun.exe"
if (Test-Path $bunExePath) {
    Write-Output "[*] Copiando executável nativo do Bun ($bunExePath)..."
    Copy-Item -Path $bunExePath -Destination (Join-Path $pkgDir "bin\bun.exe") -Force
}

# 3. Create Standalone ZIP archive
$zipTarget = "C:\OLYMPUZ\MasterOfMastersStudioPro-AllInOne.zip"
if (Test-Path $zipTarget) { 
    Remove-Item $zipTarget -Force 
}
Write-Output "[*] Compactando pacote All-In-One..."
Compress-Archive -Path "$pkgDir\*" -DestinationPath $zipTarget -CompressionLevel Optimal

$zipSizeMb = [Math]::Round((Get-Item $zipTarget).Length / 1MB, 2)
Write-Output "SUCCESS: Standalone All-In-One ZIP created at: $zipTarget ($zipSizeMb MB)"

# 4. Compile Single-File Executable (.EXE) embedding the All-In-One ZIP payload
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$installerCs = "C:\OLYMPUZ\master-of-masters-studio\scripts\Installer.cs"
$outputExe = "C:\OLYMPUZ\INSTALL MASTER OF MASTERS OFFICIAL.exe"

if (Test-Path $outputExe) {
    Remove-Item $outputExe -Force
}

Write-Output "[*] Compilando executável único $outputExe ..."
& $cscPath /target:exe /out:"$outputExe" "/resource:$zipTarget,payload.zip" /reference:System.IO.Compression.FileSystem.dll /reference:System.IO.Compression.dll "$installerCs"

if ($LASTEXITCODE -eq 0 -and (Test-Path $outputExe)) {
    $exeSizeMb = [Math]::Round((Get-Item $outputExe).Length / 1MB, 2)
    Write-Output "==============================================================================="
    Write-Output "SUCCESS: Single-File All-In-One Installer Compiled!"
    Write-Output "Path: $outputExe"
    Write-Output "Size: $exeSizeMb MB (100% OFFLINE COM BUN.EXE E TODAS AS GALERIAS EMBUTIDAS)"
    Write-Output "==============================================================================="
} else {
    Write-Error "Failed to compile executable installer."
}
