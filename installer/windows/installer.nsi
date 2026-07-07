; ===========================================================================
;  Olympuz Coder -- NSIS single-file installer (Windows 10 / 11+, per-user)
;
;  Compile:  makensis installer.nsi
;          (or)  .\Build-Installer.ps1 -CompileExe
;  Produces: Olympuz-Setup-<version>-x64.exe
;
;  Per-user install (no UAC). Bundles Node + the built app so the target
;  machine needs NOTHING else. Stock NSIS includes only (StrFunc + WordFunc).
;
;  NOTE: The PowerShell installer (Install-Olympuz.ps1) is the verified,
;  zero-dependency path. This .nsi produces the classic wizard .exe when
;  NSIS (makensis) is installed; compile it to verify on your machine.
; ===========================================================================

!ifndef OLYMPUZ_VERSION
  !define OLYMPUZ_VERSION "1.0.0"
!endif
!ifndef OLYMPUZ_OUTDIR
  !define OLYMPUZ_OUTDIR "dist-installer"
!endif

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma

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
!include "StrFunc.nsh"
!include "WordFunc.nsh"
${StrLoc}            ; declare StrLoc (StrFunc requires per-function declaration)

; --- MUI pages --------------------------------------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "PortugueseBR"
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "German"

Var PathCurrent
Var PathNeedle

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
  SetOutPath "$INSTDIR"
  ; The payload (built by Build-Installer.ps1) sits next to this .nsi.
  File /r "payload\Olympuz\*.*"

  ; --- Uninstaller ----------------------------------------------------------
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; --- Start Menu shortcuts -------------------------------------------------
  CreateDirectory "$SMPROGRAMS\Olympuz"
  CreateShortcut  "$SMPROGRAMS\Olympuz\Olympuz.lnk" \
                  "$WINDIR\System32\cmd.exe" "/K olympuz" \
                  "" "" "" "" "" "Olympuz Coder ${OLYMPUZ_VERSION}"
  CreateShortcut  "$SMPROGRAMS\Olympuz\Uninstall Olympuz.lnk" "$INSTDIR\uninstall.exe"

  ; --- USER Path: append $INSTDIR\bin if not already present ----------------
  ReadRegStr $PathCurrent HKCU "Environment" "Path"
  StrCpy $PathNeedle "$INSTDIR\bin"
  ${StrLoc} $1 "$PathCurrent" "$PathNeedle" ">"
  ${If} $1 == ""
    ${If} $PathCurrent == ""
      StrCpy $PathCurrent "$PathNeedle"
    ${Else}
      StrCpy $PathCurrent "$PathCurrent;$PathNeedle"
    ${EndIf}
    WriteRegExpandStr HKCU "Environment" "Path" "$PathCurrent"
    ; Broadcast WM_SETTINGCHANGE so new shells notice
    SendMessage 0xFFFF 0x1A 0 "STR:Environment" /TIMEOUT=5000
  ${EndIf}

  ; --- Add or remove programs entry ----------------------------------------
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "DisplayName"    "Olympuz Coder"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "DisplayVersion" "${OLYMPUZ_VERSION}"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "Publisher"      "Patriarch"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr   HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz" "NoRepair" 1

  ; --- Dependency readiness: auto-detect + auto-download missing deps ---------
  ; Runs the bundled doctor so the install self-completes to 100% (Playwright +
  ; Chromium browser; any absent external) using the bundled Node+npm. Non-fatal:
  ; a failed download (offline target) only warns -- the core install is already
  ; complete and runnable. Mirrors Install-Olympuz.ps1 section 9. A console window
  ; shows the readiness matrix + download progress, then closes on completion.
  DetailPrint "Checking dependencies and auto-downloading anything missing..."
  ExecWait 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Check-OlympuzDependencies.ps1" -InstallDir "$INSTDIR"'
SectionEnd

; ===========================================================================
Section "Uninstall"
  ; --- Files ----------------------------------------------------------------
  RMDir /r "$INSTDIR"

  ; --- Shortcuts ------------------------------------------------------------
  Delete "$SMPROGRAMS\Olympuz\Olympuz.lnk"
  Delete "$SMPROGRAMS\Olympuz\Uninstall Olympuz.lnk"
  RMDir  "$SMPROGRAMS\Olympuz"

  ; --- USER Path: remove the $INSTDIR\bin token -----------------------------
  ReadRegStr $PathCurrent HKCU "Environment" "Path"
  ${WordReplace} "$PathCurrent" "$INSTDIR\bin" "" "+" $0     ; remove token (first occurrence)
  ; Clean a leading ";"
  StrCpy $1 $0 1
  ${If} $1 == ";"
    StrCpy $0 $0 "" 1
  ${EndIf}
  ; Collapse a leftover ";;"
  ${WordReplace} "$0" ";;" ";" "+" $0
  WriteRegExpandStr HKCU "Environment" "Path" "$0"
  SendMessage 0xFFFF 0x1A 0 "STR:Environment" /TIMEOUT=5000

  ; --- Registry uninstall key ----------------------------------------------
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Olympuz"
SectionEnd
