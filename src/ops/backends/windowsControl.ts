/**
 * Olympuz Ops — Windows desktop-control backend.
 *
 * Real on Windows, no native addon: PowerShell + .NET (System.Drawing for
 * screenshots, System.Windows.Forms Cursor/SendKeys for input, UIAutomation for
 * the accessibility tree). The existing ComputerControlTool targets the
 * Anthropic-internal macOS native modules; this backend makes computer-use
 * actually function on the user's Windows box.
 *
 * Structure for testability: `build*Script` are PURE (return the PowerShell
 * script string); `runPowerShell` is the thin spawn executor; the high-level
 * actions compose them. Tests assert script shape + stub the executor — they
 * never move the real mouse. Off-Windows, every action returns ok:false with a
 * clear reason.
 */
import { spawn } from 'node:child_process'

export interface WindowsControlResult {
	ok: boolean
	output?: string
	imageBase64?: string
	error?: string
}

/** Windows-only backend. */
export function isWindowsControlAvailable(): boolean {
	return process.platform === 'win32'
}

// --- PowerShell script builders (pure) -------------------------------------

const ADD_TYPE_FORMS =
	'Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing'

// C# P/Invoke helper (compiled into namespace `o`, type `w`) for mouse_event.
// Flags: LEFTDOWN=0x0002 LEFTUP=0x0004 RIGHTDOWN=0x0008 RIGHTUP=0x0010 WHEEL=0x0800.
const MOUSE_HELPER = `Add-Type -Language CSharp -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags,int dx,int dy,uint dwData,int dwExtraInfo);' -Name w -Namespace o`

/** Screenshot the primary screen → base64 PNG on stdout. */
export function buildScreenshotScript(): string {
	return `${ADD_TYPE_FORMS}
$b = [System.Drawing.Rectangle]::new(0,0,[System.Windows.Forms.SystemInformation]::VirtualScreen.Width,[System.Windows.Forms.SystemInformation]::VirtualScreen.Height)
$bmp = [System.Drawing.Bitmap]::new($b.Width,$b.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)
$ms = [System.IO.MemoryStream]::new()
$bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)
[Console]::Out.Write([Convert]::ToBase64String($ms.ToArray()))`
}

/** mouse_event flags per button press/release. */
function mouseFlags(button: 'left' | 'right'): { down: number; up: number } {
	return button === 'right' ? { down: 0x0008, up: 0x0010 } : { down: 0x0002, up: 0x0004 }
}

/** Move the cursor to (x,y) and click (left/right/double). */
export function buildClickScript(
	x: number,
	y: number,
	button: 'left' | 'right' | 'double' = 'left',
): string {
	const btn: 'left' | 'right' = button === 'right' ? 'right' : 'left'
	const { down, up } = mouseFlags(btn)
	const moveLine = `[System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x},${y}); Start-Sleep -Milliseconds 40`
	const oneClick = `[o.w]::mouse_event(${down},0,0,0,0); [o.w]::mouse_event(${up},0,0,0,0)`
	const body =
		button === 'double'
			? `${moveLine}; ${oneClick}; Start-Sleep -Milliseconds 60; ${oneClick}`
			: `${moveLine}; ${oneClick}`
	return `${ADD_TYPE_FORMS}; ${MOUSE_HELPER}; ${body}
# button=${button}`
}

/** Move the cursor without clicking. */
export function buildMoveScript(x: number, y: number): string {
	return `${ADD_TYPE_FORMS}; [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(${x},${y})`
}

/** Scroll wheel: delta is positive (up) or negative (down), in multiples of 120 (one notch). */
export function buildScrollScript(direction: 'up' | 'down', amount = 3): string {
	const delta = direction === 'up' ? Math.abs(amount) * 120 : -Math.abs(amount) * 120
	return `${ADD_TYPE_FORMS}; ${MOUSE_HELPER}; [o.w]::mouse_event(0x0800,0,0,${delta},0)`
}

/** Escape text for PowerShell single-quoted + SendKeys metacharacters. */
export function escapeForSendKeys(text: string): string {
	// SendKeys reserves + ^ % ~ ( ) { } [ ]. Wrap each in {}.
	const special = ['+', '^', '%', '~', '(', ')', '{', '}', '[', ']']
	let out = ''
	for (const ch of text) {
		if (special.includes(ch)) out += `{${ch}}`
		else out += ch
	}
	return out
}

/** Type text via SendKeys. */
export function buildTypeScript(text: string): string {
	const escaped = escapeForSendKeys(text).replace(/'/g, "''")
	return `${ADD_TYPE_FORMS}; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')`
}

/** Press a key combo, e.g. "ctrl+c", "alt+tab", "enter". */
export function buildKeyPressScript(combo: string): string {
	const send = comboToSendKeys(combo).replace(/'/g, "''")
	return `${ADD_TYPE_FORMS}; [System.Windows.Forms.SendKeys]::SendWait('${send}')`
}

/** Convert a "ctrl+shift+s" style combo to SendKeys "^+s". */
export function comboToSendKeys(combo: string): string {
	const parts = combo
		.split('+')
		.map((p) => p.trim().toLowerCase())
		.filter(Boolean)
	const map: Record<string, string> = {
		ctrl: '^',
		control: '^',
		shift: '+',
		alt: '%',
		cmd: '^',
		enter: '~',
		return: '~',
		tab: '{TAB}',
		esc: '{ESC}',
		escape: '{ESC}',
		backspace: '{BS}',
		del: '{DEL}',
		delete: '{DEL}',
		up: '{UP}',
		down: '{DOWN}',
		left: '{LEFT}',
		right: '{RIGHT}',
		home: '{HOME}',
		end: '{END}',
		space: ' ',
	}
	let out = ''
	for (let i = 0; i < parts.length; i++) {
		const p = parts[i]!
		if (i < parts.length - 1 && map[p] && map[p]!.length === 1) out += map[p]
		else if (map[p]) out += map[p]
		else out += p.length === 1 ? p : `{${p.toUpperCase()}}`
	}
	return out
}

/** Bounded accessibility tree (top-level windows + their names) via UIAutomation. */
export function buildAccessibilityTreeScript(maxWindows = 50): string {
	return `Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = [System.Windows.Automation.Condition]::TrueCondition
$kids = $root.FindAll([System.Windows.Automation.TreeScope]::Children,$cond)
$i = 0
foreach ($k in $kids) {
  if ($i -ge ${maxWindows}) { break }
  $name = $k.Current.Name
  $cls = $k.Current.ClassName
  if ($name -or $cls) { Write-Output ($i.ToString() + '|' + $name + '|' + $cls) }
  $i++
}`
}

// --- Executor --------------------------------------------------------------

/** Spawn PowerShell (-NoProfile) and return trimmed stdout. Throws on non-zero. */
export async function runPowerShell(script: string, timeoutMs = 15000): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
			stdio: ['ignore', 'pipe', 'pipe'],
		})
		let stdout = ''
		let stderr = ''
		const timer = setTimeout(() => {
			proc.kill()
			reject(new Error('PowerShell timeout'))
		}, timeoutMs)
		proc.stdout.on('data', (c: Buffer) => (stdout += c.toString()))
		proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()))
		proc.on('error', (e) => {
			clearTimeout(timer)
			reject(e)
		})
		proc.on('close', (code) => {
			clearTimeout(timer)
			if (code === 0) resolve(stdout.trim())
			else reject(new Error(`PowerShell exited ${code}: ${stderr.trim().slice(0, 200)}`))
		})
	})
}

// --- High-level actions (compose script + run) -----------------------------

function gate(): WindowsControlResult | null {
	if (!isWindowsControlAvailable()) {
		return { ok: false, error: 'windows control backend is Windows-only' }
	}
	return null
}

export async function screenshot(): Promise<WindowsControlResult> {
	return gate() ?? run('screenshot', buildScreenshotScript())
}

export async function click(
	x: number,
	y: number,
	button: 'left' | 'right' | 'double' = 'left',
): Promise<WindowsControlResult> {
	return gate() ?? run(`click ${button} (${x},${y})`, buildClickScript(x, y, button))
}

export async function move(x: number, y: number): Promise<WindowsControlResult> {
	return gate() ?? run(`move (${x},${y})`, buildMoveScript(x, y))
}

export async function scroll(direction: 'up' | 'down', amount = 3): Promise<WindowsControlResult> {
	return gate() ?? run(`scroll ${direction} ${amount}`, buildScrollScript(direction, amount))
}

export async function typeText(text: string): Promise<WindowsControlResult> {
	return gate() ?? run(`type "${text.slice(0, 40)}"`, buildTypeScript(text))
}

export async function keyPress(combo: string): Promise<WindowsControlResult> {
	return gate() ?? run(`key ${combo}`, buildKeyPressScript(combo))
}

export async function getAccessibilityTree(): Promise<WindowsControlResult> {
	return gate() ?? run('a11y tree', buildAccessibilityTreeScript(), true)
}

async function run(label: string, script: string, isOutput = false): Promise<WindowsControlResult> {
	try {
		const out = await runPowerShell(script)
		if (isOutput) return { ok: true, output: out }
		// screenshot returns base64; everything else returns a short confirmation
		if (label === 'screenshot') return { ok: true, imageBase64: out }
		return { ok: true, output: `${label}: ok` }
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return { ok: false, error: `${label} failed: ${msg}` }
	}
}
