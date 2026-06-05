import { execFile } from 'child_process'
import { promisify } from 'util'
import process from 'node:process'

const execFileAsync = promisify(execFile)

/**
 * Detect the current platform.
 */
function getPlatform(): 'win32' | 'darwin' | 'linux' {
  return process.platform as 'win32' | 'darwin' | 'linux'
}

/**
 * Run a command and return its stdout as a Buffer.
 */
async function runCommand(
  cmd: string,
  args: string[],
  options?: { shell?: boolean; timeout?: number },
): Promise<Buffer> {
  const { stdout } = await execFileAsync(cmd, args, {
    shell: options?.shell ?? false,
    timeout: options?.timeout ?? 30000,
    maxBuffer: 50 * 1024 * 1024,
    encoding: 'buffer',
  })
  return stdout
}

/**
 * Capture the entire screen and return a PNG Buffer.
 * Uses platform-specific tools — no native modules required.
 */
export async function captureScreen(): Promise<Buffer> {
  const platform = getPlatform()

  switch (platform) {
    case 'win32':
      return captureScreenWindows()
    case 'darwin':
      return captureScreenMac()
    case 'linux':
      return captureScreenLinux()
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

/**
 * Capture a specific window by its ID/title and return a PNG Buffer.
 */
export async function captureWindow(_windowId?: string): Promise<Buffer> {
  // For simplicity, capture the full screen. Window-specific capture can be
  // added later per platform.
  return captureScreen()
}

// ---- Windows ----

async function captureScreenWindows(): Promise<Buffer> {
  // Use PowerShell with .NET System.Drawing to capture the screen.
  // This avoids needing nircmd or other third-party tools.
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds = $screen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bmp)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$ms.Close()
$graphics.Dispose()
$bmp.Dispose()
[Convert]::ToBase64String($ms.ToArray())
`.trim()

  const stdout = await runCommand('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    psScript,
  ])

  const base64 = stdout.toString('utf8').trim()
  return Buffer.from(base64, 'base64')
}

// ---- macOS ----

async function captureScreenMac(): Promise<Buffer> {
  // screencapture outputs a PNG file. Use a temp path, read, then delete.
  const { tmpdir } = await import('os')
  const { join } = await import('path')
  const { unlinkSync, readFileSync } = await import('fs')
  const tmpPath = join(tmpdir(), `olympuz-screenshot-${Date.now()}.png`)

  try {
    await runCommand('/usr/sbin/screencapture', ['-x', tmpPath])
    const data = readFileSync(tmpPath)
    return data
  } finally {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}

// ---- Linux ----

async function captureScreenLinux(): Promise<Buffer> {
  // Try gnome-screenshot first, fall back to scrot, then import (ImageMagick).
  const { tmpdir } = await import('os')
  const { join } = await import('path')
  const { unlinkSync, readFileSync } = await import('fs')
  const tmpPath = join(tmpdir(), `olympuz-screenshot-${Date.now()}.png`)

  try {
    // Try gnome-screenshot (most common on modern Linux desktops)
    try {
      await runCommand('gnome-screenshot', ['-f', tmpPath], { shell: true })
      return readFileSync(tmpPath)
    } catch { /* fallback */ }

    // Try scrot
    try {
      await runCommand('scrot', [tmpPath], { shell: true })
      return readFileSync(tmpPath)
    } catch { /* fallback */ }

    // Try import (ImageMagick)
    await runCommand('import', ['-window', 'root', tmpPath], { shell: true })
    return readFileSync(tmpPath)
  } finally {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}
