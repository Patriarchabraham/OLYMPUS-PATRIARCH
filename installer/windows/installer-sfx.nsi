; ===========================================================================
;  Olympuz Coder -- self-extracting installer (Windows 10 / 11+, per-user)
;
;  WHY THIS EXISTS (not a classic File/r wizard):
;  The payload's node_modules has deeply-nested @opentelemetry subtrees whose
;  paths exceed Windows MAX_PATH (260). NSIS's File command opens files via
;  CreateFile (no \\?\ prefix) and ABORTS on those paths -- and would hit the
;  same wall again at install time writing to %LOCALAPPDATA%\...\Olympuz. The
;  long-path-safe copier on Windows is robocopy (used by Install-Olympuz.ps1,
;  the verified installer), and the long-path-safe archiver is 7-Zip.
;
;  So this wrapper bundles only TWO SHALLOW files (7zr.exe + payload.7z -- no
;  deep paths, NSIS can File them fine), then at install:
;    1. 7-Zip extracts the payload to %TEMP%\OlympuzSFX\out  (long-path safe)
;    2. Install-Olympuz.ps1 robocopies it to $INSTDIR         (long-path safe)
;       and sets Path / Start Menu shortcut / uninstall registry / doctor.
;  Produces: Olympuz-Setup-<version>-x64.exe
;
;  Compile:  .\Build-SfxExe.ps1   (stages payload, packs 7z, runs makensis)
; ===========================================================================

!ifndef OLYMPUZ_VERSION
  !define OLYMPUZ_VERSION "1.0.0"
!endif
!ifndef OLYMPUZ_OUTDIR
  !define OLYMPUZ_OUTDIR "dist-installer"
!endif

Unicode true
ManifestDPIAware true
; The wrapper bundles an ALREADY-compressed payload.7z (LZMA/7-Zip) + a tiny
; 7zr.exe -- NSIS re-compressing high-entropy data is pure waste (near-0 gain,
; multi-minute compile on a 6GB box). zlib is fast and the .exe ends up the
; same ~86 MB either way (the 7z stream dominates).
SetCompressor zlib

Name "Olympuz Coder"
OutFile "${OLYMPUZ_OUTDIR}\Olympuz-Setup-${OLYMPUZ_VERSION}-x64.exe"
BrandingText "Olympuz Coder by Patriarch"

InstallDir "$LOCALAPPDATA\Programs\Olympuz"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "InstallLocation"

RequestExecutionLevel user           ; per-user -- no UAC prompt
ShowInstDetails show
ShowUnInstDetails show

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName"     "Olympuz Coder"
VIAddVersionKey "CompanyName"     "Patriarch"
VIAddVersionKey "FileDescription" "Olympuz Coder Installer"
VIAddVersionKey "FileVersion"     "${OLYMPUZ_VERSION}"
VIAddVersionKey "ProductVersion"  "${OLYMPUZ_VERSION}"
VIAddVersionKey "LegalCopyright"  "Patriarch"

!include "MUI2.nsh"
!include "LogicLib.nsh"

; --- MUI pages --------------------------------------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"

; ===========================================================================
Function .onInit
  ; Remember a prior install location if present
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "InstallLocation"
  ${If} $0 != ""
    StrCpy $INSTDIR $0
  ${EndIf}
FunctionEnd

; ===========================================================================
Section "Install" SecCore
  SectionIn RO

  ; --- Lay down the two shallow bootstrap files (NSIS File handles these) ---
  SetOutPath "$TEMP\OlympuzSFX"
  File "7zr.exe"
  File "payload.7z"

  ; --- 1. Extract the payload with 7-Zip (long-path safe) ------------------
  DetailPrint "Extracting payload (7-Zip, long-path safe)..."
  nsExec::ExecToLog '"$TEMP\OlympuzSFX\7zr.exe" x "$TEMP\OlympuzSFX\payload.7z" -y -o"$TEMP\OlympuzSFX\out"'
  Pop $0

  ; --- 2. Run the verified per-user installer (robocopy + Path + shortcut ---
  ;       + uninstall registry + dependency auto-provision). -Force avoids an
  ;       interactive "overwrite?" prompt when reinstalling over an existing
  ;       copy (nsExec cannot answer Read-Host).
  DetailPrint "Installing Olympuz Coder (per-user). Dependencies are auto-detected"
  DetailPrint "and anything missing is auto-downloaded -- watch the log below..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$TEMP\OlympuzSFX\out\Install-Olympuz.ps1" -PayloadDir "$TEMP\OlympuzSFX\out\payload\Olympuz" -InstallDir "$INSTDIR" -Force'
  Pop $0

  ; --- 3. Clean up the temp staging (robocopy /MIR is long-path safe) -------
  DetailPrint "Cleaning up temporary files..."
  CreateDirectory "$TEMP\OlympuzSFX_empty"
  nsExec::ExecToLog 'robocopy "$TEMP\OlympuzSFX_empty" "$TEMP\OlympuzSFX" /MIR /NFL /NDL /NJH /NJS /NP'
  Pop $0
  RMDir /r "$TEMP\OlympuzSFX_empty"
  RMDir /r "$TEMP\OlympuzSFX"
SectionEnd
