import { execFile } from 'child_process'
import { promisify } from 'util'
import process from 'node:process'

const execFileAsync = promisify(execFile)

function getPlatform(): 'win32' | 'darwin' | 'linux' {
  return process.platform as 'win32' | 'darwin' | 'linux'
}

/**
 * Get the accessibility tree of the active window as structured text.
 * Uses platform-specific APIs.
 */
export async function getAccessibilityTree(): Promise<string> {
  const platform = getPlatform()

  switch (platform) {
    case 'win32':
      return getAccessibilityTreeWindows()
    case 'darwin':
      return getAccessibilityTreeMac()
    case 'linux':
      return getAccessibilityTreeLinux()
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

// ---- Windows ----

async function getAccessibilityTreeWindows(): Promise<string> {
  // Use PowerShell with UI Automation to extract the accessibility tree.
  // Outputs a simplified text representation of the active window's controls.
  const psScript = `
Add-Type -AssemblyName UIAutomationClient
$root = [System.Windows.Automation.AutomationElement]::RootElement
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
$activeWindow = $focused
try {
  $activeWindow = $focused.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::ControlTypeProperty)
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::IsKeyboardFocusableProperty, $true)
} catch {}

# Find the foreground window
$fw = $null
try {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ForegroundWin {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@
  $hwnd = [ForegroundWin]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 256
  [ForegroundWin]::GetWindowText($hwnd, $sb, 256) | Out-Null
  $title = $sb.ToString()
  $fw = "Active window: $title"
} catch {
  $fw = "Active window: (unable to determine)"
}

# Get top-level children with basic properties
$children = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
$lines = @($fw)
foreach ($child in $children) {
  try {
    $name = $child.Current.Name
    $ctype = $child.Current.ControlType.ProgrammaticName -replace 'ControlType.', ''
    $cls = $child.Current.ClassName
    $bounds = $child.Current.BoundingRectangle
    $l = "$ctype"
    if ($name) { $l += " name='$name'" }
    if ($cls) { $l += " class='$cls'" }
    $l += " rect=[$($bounds.X),$($bounds.Y),$($bounds.Width),$($bounds.Height)]"
    $lines += "  $l"
  } catch {}
}
$lines -join "\n"
`.trim()

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      psScript,
    ], { timeout: 15000, maxBuffer: 5 * 1024 * 1024, encoding: 'utf8' })
    return stdout.trim()
  } catch (err) {
    return `Error retrieving accessibility tree: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ---- macOS ----

async function getAccessibilityTreeMac(): Promise<string> {
  // Use a swift script to query the Accessibility API.
  // Falls back to AppleScript for a simpler tree.
  const appleScript = `
tell application "System Events"
  set frontApp to name of first application process whose frontmost is true
  tell process frontApp
    set winList to every window
    set output to "Active application: " & frontApp & linefeed
    repeat with w in winList
      set output to output & "Window: " & name of w & linefeed
      try
        set uiElems to every UI element of w
        repeat with elem in uiElems
          try
            set output to output & "  " & (description of elem) & " - " & (name of elem) & " [" & (role of elem) & "]" & linefeed
          end try
        end repeat
      end try
    end repeat
    return output
  end tell
end tell
`

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', appleScript], {
      timeout: 15000,
      maxBuffer: 5 * 1024 * 1024,
      encoding: 'utf8',
    })
    return stdout.trim()
  } catch (err) {
    return `Error retrieving accessibility tree: ${err instanceof Error ? err.message : String(err)}`
  }
}

// ---- Linux ----

async function getAccessibilityTreeLinux(): Promise<string> {
  // Use xdotool + xwininfo to get window info.
  // For a more detailed tree, we could use AT-SPI via Python, but this
  // keeps dependencies minimal.
  try {
    const { stdout: activeWin } = await execFileAsync('xdotool', [
      'getactivewindow',
      'getwindowname',
    ], { timeout: 10000, encoding: 'utf8' })

    const lines = activeWin.trim().split('\n')
    const windowName = lines[1] ?? 'unknown'
    const windowId = lines[0] ?? ''

    // Get window info
    let treeInfo = ''
    try {
      const { stdout } = await execFileAsync('xwininfo', [
        '-tree',
        '-id',
        windowId,
      ], { timeout: 10000, encoding: 'utf8', shell: true })
      treeInfo = stdout.trim()
    } catch {
      treeInfo = '(xwininfo not available)'
    }

    return `Active window: ${windowName} (id: ${windowId})\n\n${treeInfo}`
  } catch (err) {
    return `Error retrieving accessibility tree: ${err instanceof Error ? err.message : String(err)}`
  }
}
