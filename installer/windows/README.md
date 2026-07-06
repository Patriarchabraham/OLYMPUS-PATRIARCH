# Olympuz Coder — Windows Installer (Windows 10 / 11+)

Two installer formats are provided. Both install Olympuz **per-user**
(`%LOCALAPPDATA%\Programs\Olympuz`) with **no administrator rights / no UAC**,
**bundle the Node runtime** (so the target machine needs nothing else), add
`olympuz` to the **USER Path**, create a **Start Menu** shortcut, and register an
**uninstaller** that appears in **Settings → Apps**.

| Format | File | Needs | Best for |
|---|---|---|---|
| **PowerShell installer** (verified, zero-dependency) | `install.cmd` / `Install-Olympuz.ps1` | Nothing (PowerShell 5.1 ships with Win10/11) | Quick install, scripting, CI, USB/zip distribution |
| **NSIS wizard .exe** | `installer.nsi` → `Olympuz-Setup-x.y.z-x64.exe` | NSIS (`makensis`) to **compile** | Classic double-click Next→Next→Install UX |

---

## 1. Build the payload (do this once, on a dev machine)

From this folder (`installer\windows`), in PowerShell:

```powershell
.\Build-Installer.ps1
# add -CompileExe to also build the single-file NSIS wizard (if makensis is installed)
```

`Build-Installer.ps1` will:

1. Ensure `dist\cli.mjs` exists (runs `npm run build` if not).
2. Stage `.\payload\Olympuz\{bin,dist,node}` + `package.json`.
3. **Bundle your local `node.exe`** into `payload\Olympuz\node\node.exe`.
4. **Smoke-test** the staged bundle (`<bundled node> olympuz --version`).
5. (optional) Compile `Olympuz-Setup-<version>-x64.exe` via NSIS.

Options:
- `-SkipBundleNode` — don't bundle Node (the target must have Node 22+).
- `-CompileExe` — also build the NSIS wizard (auto-detected `makensis`; install
  NSIS via `winget install NSIS.NSIS` or `choco install nsis -y` first).

Result: a distributable `payload\` folder (+ optional `dist-installer\*.exe`).

---

## 2a. Install — PowerShell path (zero dependencies)

**End users** — double-click **`install.cmd`** in the distributed `payload` folder,
or from PowerShell:

```powershell
.\Install-Olympuz.ps1
```

Flags:
- `-InstallDir "D:\Olympuz"` — custom destination (default: `%LOCALAPPDATA%\Programs\Olympuz`).
- `-Force` — overwrite without prompting.
- `-Silent` — no prompts/output.

Then **open a NEW terminal** and run `olympuz`.

## 2b. Install — NSIS wizard path

Run the compiled `Olympuz-Setup-<version>-x64.exe` and click through the wizard.

---

## 3. Uninstall

Any of:
- **Settings → Apps → Olympuz Coder → Uninstall** (both formats register here), or
- PowerShell: `.\Uninstall-Olympuz.ps1`, or
- Start Menu → *Uninstall Olympuz* (NSIS format), or
- `"%LOCALAPPDATA%\Programs\Olympuz\uninstall.exe" /S` (NSIS format).

Removes the install folder, the Start Menu shortcut, the USER Path entry, and the
registry uninstall key.

---

## Layout installed

```
%LOCALAPPDATA%\Programs\Olympuz\
├── node\node.exe        bundled Node runtime
├── dist\cli.mjs         the built app (single bundle)
├── bin\
│   ├── olympuz          launcher (.mjs, heap-aware)
│   └── olympuz.cmd      Windows entry — calls the bundled node
├── package.json
└── uninstall.ps1
```

`olympuz.cmd` invokes the **bundled** `node.exe`, so Olympuz runs even when Node
is not on the target's PATH.

---

## How to re-package after a new build

```powershell
# from repo root
npm run build
cd installer\windows
.\Build-Installer.ps1 -CompileExe
```

The `payload\` and `dist-installer\` folders are build artifacts — they are not
meant to be committed (add to `.gitignore` if you wish).
