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
4. **Bundle the runtime `node_modules`** (production deps with dev tools excluded,
   ~270 MB) — `dist/cli.mjs` keeps its heavy externals (`@orama`, `sharp`,
   `@opentelemetry/*`, AWS/Azure/GCP SDKs, ripgrep) as bare imports, so they
   must ship alongside.
5. **Bundle `npm`** and **complete the external deps to 100%** — installs any
   `CLI_EXTERNALS` that are absent from the prod tree (e.g. `@azure/identity`,
   some `@opentelemetry/exporter-*`) so the payload ships fully offline. The
   bundled npm also lets the installer auto-provision deps on the target.
6. **Smoke-test** the staged bundle (`<bundled node> olympuz --version`).
7. (optional) Compile `Olympuz-Setup-<version>-x64.exe` via NSIS.

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
- `-SkipDeps` — skip the dependency auto-detect/download step (core is still installed).

At the end of install, the **dependency doctor runs automatically**: it detects
what's already on the machine, downloads anything missing (see tiers below), and
prints a readiness matrix. Then **open a NEW terminal** and run `olympuz`.

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
├── node\node.exe                  bundled Node runtime
├── npm\                           bundled npm (lets the doctor auto-provision)
├── node_modules\                  runtime externals + transitive (~270 MB)
├── dist\cli.mjs                   the built app (single bundle)
├── bin\
│   ├── olympuz                    launcher (.mjs, heap-aware)
│   ├── olympuz.cmd                Windows entry — calls the bundled node
│   └── olympuz-doctor.cmd         dependency auto-detect + auto-download
├── Check-OlympuzDependencies.ps1  the doctor engine
├── package.json
└── uninstall.ps1
```

`olympuz.cmd` invokes the **bundled** `node.exe`, so Olympuz runs even when Node
is not on the target's PATH.

---

## Dependency auto-provisioning ("100% before it runs")

`Check-OlympuzDependencies.ps1` (run automatically at the end of install, and
on demand via **`olympuz-doctor`**) scans the install **and** the Windows
machine, classifies every dependency, **auto-downloads the missing software
deps** using the bundled Node + npm, and prints a readiness matrix. Tiers:

| Tier | What | Action |
|---|---|---|
| **Core** | Node runtime, `dist/cli.mjs`, the CLI externals (`@orama`, `sharp`, `@opentelemetry/*`, AWS SDKs, `google-auth-library`, `@vscode/ripgrep`/`rg.exe`) | **Verified** by probe-import. If a lazy provider external (e.g. `@azure/identity`) is absent, it is **auto-installed** via the bundled npm. |
| **Optional** | Playwright + the Chromium browser (enables Ops browser control) | **Auto-downloaded** if missing (~170 MB browser). |
| **System** | Microsoft Edge (headless PDF render), SAPI (text-to-speech), audio device (speech-to-text) | **Detected** and reported (Edge/SAPI ship with Windows 10/11). |
| **Credential** | `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_BASE_URL` for a proxy like Z.AI/GLM) | **Detected** across Process/User/Machine env. Cannot be auto-downloaded — set it yourself to run. |

Verdict: **READY — 100% of core dependencies present** when the core verifies and
credentials are detected. Optional/system are informational; a failed download
(offline target) only warns — the core install is already runnable.

Re-run anytime:

```powershell
olympuz-doctor                 # auto-detect + auto-download missing
olympuz-doctor -NoDownload     # detect + report only, download nothing
```

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
