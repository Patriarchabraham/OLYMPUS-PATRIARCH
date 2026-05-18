import { execFile } from 'child_process'
import { promisify } from 'util'
import process from 'node:process'

const execFileAsync = promisify(execFile)

function getPlatform(): 'win32' | 'darwin' | 'linux' {
  return process.platform as 'win32' | 'darwin' | 'linux'
}

/**
 * Move mouse to (x, y) and click.
 */
export async function mouseClick(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return clickWindows(x, y, button)
    case 'darwin':
      return clickMac(x, y, button)
    case 'linux':
      return clickLinux(x, y, button)
  }
}

/**
 * Move mouse to (x, y) and double-click.
 */
export async function mouseDoubleClick(x: number, y: number): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return doubleClickWindows(x, y)
    case 'darwin':
      return doubleClickMac(x, y)
    case 'linux':
      return doubleClickLinux(x, y)
  }
}

/**
 * Type a text string at the current cursor position.
 */
export async function typeText(text: string): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return typeWindows(text)
    case 'darwin':
      return typeMac(text)
    case 'linux':
      return typeLinux(text)
  }
}

/**
 * Press a key or key combination (e.g. "ctrl+c", "alt+tab").
 */
export async function pressKey(key: string): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return pressKeyWindows(key)
    case 'darwin':
      return pressKeyMac(key)
    case 'linux':
      return pressKeyLinux(key)
  }
}

/**
 * Scroll at (x, y) with direction and amount.
 */
export async function scroll(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount: number,
): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return scrollWindows(x, y, direction, amount)
    case 'darwin':
      return scrollMac(x, y, direction, amount)
    case 'linux':
      return scrollLinux(x, y, direction, amount)
  }
}

/**
 * Drag from (x1, y1) to (x2, y2).
 */
export async function drag(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<void> {
  const platform = getPlatform()
  switch (platform) {
    case 'win32':
      return dragWindows(x1, y1, x2, y2)
    case 'darwin':
      return dragMac(x1, y1, x2, y2)
    case 'linux':
      return dragLinux(x1, y1, x2, y2)
  }
}

// ========== HELPERS ==========

async function runPS(script: string): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    script,
  ], { timeout: 15000 })
}

// ---- Windows implementations ----

async function clickWindows(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle',
): Promise<void> {
  const mouseDown = button === 'left' ? 'LeftDown' : button === 'right' ? 'RightDown' : 'MiddleDown'
  const mouseUp = button === 'left' ? 'LeftUp' : button === 'right' ? 'RightUp' : 'MiddleUp'
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[Win32]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 50
[Win32]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
[Win32]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
`
  // For right/middle click, override the flags
  const downFlag = mouseDown === 'LeftDown' ? '0x00000002' : mouseDown === 'RightDown' ? '0x00000008' : '0x00000020'
  const upFlag = mouseUp === 'LeftUp' ? '0x00000004' : mouseUp === 'RightUp' ? '0x00000010' : '0x00000040'
  const finalScript = script
    .replace('0x00000002', downFlag)
    .replace('0x00000004', upFlag)
  await runPS(finalScript)
}

async function doubleClickWindows(x: number, y: number): Promise<void> {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[Win32]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 50
[Win32]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
[Win32]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 50
[Win32]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
[Win32]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
`
  await runPS(script)
}

async function typeWindows(text: string): Promise<void> {
  // Escape for PowerShell single-quoted string
  const escaped = text.replace(/'/g, "''")
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
`
  await runPS(script)
}

async function pressKeyWindows(key: string): Promise<void> {
  // Map common key names to SendKeys format
  const keyMap: Record<string, string> = {
    enter: '{ENTER}',
    return: '{ENTER}',
    tab: '{TAB}',
    escape: '{ESC}',
    esc: '{ESC}',
    backspace: '{BACKSPACE}',
    delete: '{DELETE}',
    up: '{UP}',
    down: '{DOWN}',
    left: '{LEFT}',
    right: '{RIGHT}',
    home: '{HOME}',
    end: '{END}',
    pageup: '{PGUP}',
    pagedown: '{PGDN}',
    space: ' ',
    f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}',
    f5: '{F5}', f6: '{F6}', f7: '{F7}', f8: '{F8}',
    f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
  }

  // Handle key combinations with "+"
  const parts = key.split('+').map(k => k.trim().toLowerCase())
  const modifiers: string[] = []
  const keys: string[] = []

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers.push('^')
    else if (part === 'alt') modifiers.push('%')
    else if (part === 'shift') modifiers.push('+')
    else keys.push(keyMap[part] ?? part)
  }

  const sendKeys = modifiers.join('') + keys.join('')
  const escaped = sendKeys.replace(/'/g, "''")
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
`
  await runPS(script)
}

async function scrollWindows(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount: number,
): Promise<void> {
  const delta = direction === 'up' ? amount * 120 : -amount * 120
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[Win32]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 50
[Win32]::mouse_event(0x00000800, 0, 0, ${delta}, [IntPtr]::Zero)
`
  await runPS(script)
}

async function dragWindows(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<void> {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
}
"@
[Win32]::SetCursorPos(${x1}, ${y1})
Start-Sleep -Milliseconds 100
[Win32]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
Start-Sleep -Milliseconds 200
[Win32]::SetCursorPos(${x2}, ${y2})
Start-Sleep -Milliseconds 100
[Win32]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
`
  await runPS(script)
}

// ---- macOS implementations ----

async function runAppleScript(script: string): Promise<void> {
  await execFileAsync('osascript', ['-e', script], { timeout: 15000 })
}

async function clickMac(
  x: number,
  y: number,
  _button: 'left' | 'right' | 'middle',
): Promise<void> {
  // cliclick is the most reliable option. Fall back to AppleScript for left click.
  try {
    const btn = _button === 'right' ? 'rc:' : 'c:'
    await execFileAsync('cliclick', [`${btn}${x},${y}`], { timeout: 10000 })
  } catch {
    // Fallback to AppleScript (only supports left click)
    await runAppleScript(
      `tell application "System Events" to click at {${x}, ${y}}`,
    )
  }
}

async function doubleClickMac(x: number, y: number): Promise<void> {
  try {
    await execFileAsync('cliclick', [`dc:${x},${y}`], { timeout: 10000 })
  } catch {
    await runAppleScript(
      `tell application "System Events" to double click at {${x}, ${y}}`,
    )
  }
}

async function typeMac(text: string): Promise<void> {
  try {
    await execFileAsync('cliclick', [`t:${text}`], { timeout: 15000 })
  } catch {
    // Escape double quotes for AppleScript
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    await runAppleScript(
      `tell application "System Events" to keystroke "${escaped}"`,
    )
  }
}

async function pressKeyMac(key: string): Promise<void> {
  const parts = key.split('+').map(k => k.trim().toLowerCase())
  const modifiers: string[] = []
  const keys: string[] = []

  const keyMap: Record<string, string> = {
    enter: 'return',
    return: 'return',
    tab: 'tab',
    escape: 'escape',
    esc: 'escape',
    backspace: 'delete',
    delete: 'delete',
    up: 'up arrow',
    down: 'down arrow',
    left: 'left arrow',
    right: 'right arrow',
    home: 'home',
    end: 'end',
    space: 'space',
  }

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers.push('control down')
    else if (part === 'alt' || part === 'option') modifiers.push('option down')
    else if (part === 'shift') modifiers.push('shift down')
    else if (part === 'cmd' || part === 'command') modifiers.push('command down')
    else keys.push(keyMap[part] ?? part)
  }

  const keyStr = keys.join(' ')
  const modStr = modifiers.length > 0 ? ` using {${modifiers.map(m => `${m}`).join(', ')}}` : ''
  await runAppleScript(
    `tell application "System Events" to key code ${keyToKeyCode(keys[0] ?? 'return')}${modStr}`,
  )
}

function keyToKeyCode(key: string): number {
  const map: Record<string, number> = {
    return: 36, enter: 36, tab: 48, space: 49,
    delete: 51, escape: 53, 'up arrow': 126, 'down arrow': 125,
    'left arrow': 123, 'right arrow': 124, home: 115, end: 119,
    a: 0, b: 11, c: 8, d: 2, e: 14, f: 3, g: 5, h: 4,
    i: 34, j: 38, k: 40, l: 37, m: 46, n: 45, o: 31, p: 35,
    q: 12, r: 15, s: 1, t: 17, u: 32, v: 9, w: 13, x: 7,
    y: 16, z: 6,
    '1': 18, '2': 19, '3': 20, '4': 21, '5': 23,
    '6': 22, '7': 26, '8': 28, '9': 25, '0': 29,
    f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
    f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
  }
  return map[key.toLowerCase()] ?? 0
}

async function scrollMac(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount: number,
): Promise<void> {
  try {
    const dir = direction === 'up' ? 'scroll-up' : 'scroll-down'
    await execFileAsync('cliclick', [`m:${x},${y}`, `${dir}=${amount}`], {
      timeout: 10000,
    })
  } catch {
    const scrollCmd =
      direction === 'up'
        ? `scroll up ${amount} times at {${x}, ${y}}`
        : `scroll down ${amount} times at {${x}, ${y}}`
    await runAppleScript(
      `tell application "System Events" to ${scrollCmd}`,
    )
  }
}

async function dragMac(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<void> {
  try {
    await execFileAsync('cliclick', [`dd:${x1},${y1}`, `dm:${x2},${y2}`, `du:${x2},${y2}`], {
      timeout: 10000,
    })
  } catch {
    await runAppleScript(`
      tell application "System Events"
        set {x1, y1} to {${x1}, ${y1}}
        set {x2, y2} to {${x2}, ${y2}}
        mouse down at {x1, y1}
        delay 0.2
        mouse move to {x2, y2}
        delay 0.1
        mouse up at {x2, y2}
      end tell
    `)
  }
}

// ---- Linux implementations ----

async function runXdotool(args: string[]): Promise<void> {
  await execFileAsync('xdotool', args, { timeout: 10000, shell: true })
}

async function clickLinux(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle',
): Promise<void> {
  const btn = button === 'left' ? 1 : button === 'right' ? 3 : 2
  try {
    await runXdotool(['mousemove', String(x), String(y), 'click', String(btn)])
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}

async function doubleClickLinux(x: number, y: number): Promise<void> {
  try {
    await runXdotool([
      'mousemove', String(x), String(y),
      'click', '--repeat', '2', '--delay', '100', '1',
    ])
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}

async function typeLinux(text: string): Promise<void> {
  try {
    // Use xdotool type with --clearmodifiers to avoid stuck modifier keys
    await runXdotool(['type', '--clearmodifiers', '--', text])
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}

async function pressKeyLinux(key: string): Promise<void> {
  const parts = key.split('+').map(k => k.trim().toLowerCase())

  // Map common key names to xdotool keys
  const keyMap: Record<string, string> = {
    enter: 'Return',
    return: 'Return',
    tab: 'Tab',
    escape: 'Escape',
    esc: 'Escape',
    backspace: 'BackSpace',
    delete: 'Delete',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
    home: 'Home',
    end: 'End',
    pageup: 'Page_Up',
    pagedown: 'Page_Down',
    space: 'space',
    ctrl: 'ctrl',
    alt: 'alt',
    shift: 'shift',
  }

  const mapped = parts.map(p => keyMap[p] ?? p)
  const keyCombo = mapped.join('+')

  try {
    await runXdotool(['key', keyCombo])
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}

async function scrollLinux(
  x: number,
  y: number,
  direction: 'up' | 'down',
  amount: number,
): Promise<void> {
  // xdotool uses button 4 for scroll up, 5 for scroll down
  const btn = direction === 'up' ? 4 : 5
  try {
    for (let i = 0; i < amount; i++) {
      await runXdotool([
        'mousemove', String(x), String(y),
        'click', String(btn),
      ])
    }
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}

async function dragLinux(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Promise<void> {
  try {
    await runXdotool([
      'mousemove', String(x1), String(y1),
      'mousedown', '1',
    ])
    // Smooth movement in steps
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const cx = Math.round(x1 + (x2 - x1) * (i / steps))
      const cy = Math.round(y1 + (y2 - y1) * (i / steps))
      await runXdotool(['mousemove', String(cx), String(cy)])
    }
    await runXdotool(['mouseup', '1'])
  } catch {
    throw new Error('xdotool not found. Install it with: sudo apt install xdotool')
  }
}
