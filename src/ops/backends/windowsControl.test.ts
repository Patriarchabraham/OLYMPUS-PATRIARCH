import { describe, expect, it } from 'vitest'
import {
	buildAccessibilityTreeScript,
	buildClickScript,
	buildKeyPressScript,
	buildMoveScript,
	buildScreenshotScript,
	buildScrollScript,
	buildTypeScript,
	comboToSendKeys,
	escapeForSendKeys,
	isWindowsControlAvailable,
} from './windowsControl.js'

describe('ops windowsControl — pure PowerShell script builders', () => {
	it('isWindowsControlAvailable reflects the platform', () => {
		expect(isWindowsControlAvailable()).toBe(process.platform === 'win32')
	})

	it('screenshot script uses CopyFromScreen + base64 PNG output', () => {
		const s = buildScreenshotScript()
		expect(s).toContain('CopyFromScreen')
		expect(s).toContain('ToBase64String')
		expect(s).toContain('System.Drawing')
	})

	it('click script embeds the mouse_event P/Invoke helper + correct flags', () => {
		const left = buildClickScript(120, 340, 'left')
		expect(left).toContain('mouse_event')
		expect(left).toContain('[o.w]::mouse_event(2,0,0,0,0)') // LEFTDOWN 0x0002 → decimal
		expect(left).toContain('120')
		expect(left).toContain('340')
		const right = buildClickScript(10, 20, 'right')
		expect(right).toContain('[o.w]::mouse_event(8,0,0,0,0)') // RIGHTDOWN 0x0008 → decimal
		const dbl = buildClickScript(1, 2, 'double')
		// double click emits two down/up pairs
		expect((dbl.match(/mouse_event\(2,0,0,0,0\)/g) ?? []).length).toBe(2)
	})

	it('move + scroll scripts target the cursor / wheel', () => {
		expect(buildMoveScript(5, 6)).toContain('Cursor')
		const up = buildScrollScript('up', 2)
		expect(up).toContain('0x0800') // WHEEL
		expect(up).toContain('240') // 2 * 120
		expect(buildScrollScript('down', 1)).toContain('-120')
	})

	it('escapeForSendKeys wraps SendKeys metacharacters', () => {
		expect(escapeForSendKeys('a+b')).toBe('a{+}b')
		expect(escapeForSendKeys('(c)')).toBe('{(}c{)}')
		expect(escapeForSendKeys('hi')).toBe('hi')
	})

	it('comboToSendKeys maps modifiers + named keys', () => {
		expect(comboToSendKeys('ctrl+c')).toBe('^c')
		expect(comboToSendKeys('ctrl+shift+s')).toBe('^+s')
		expect(comboToSendKeys('alt+tab')).toBe('%{TAB}')
		expect(comboToSendKeys('enter')).toBe('~')
	})

	it('type + keypress scripts route through SendKeys', () => {
		expect(buildTypeScript('hello')).toContain('SendKeys')
		expect(buildKeyPressScript('ctrl+s')).toContain('^s')
	})

	it('accessibility-tree script loads UIAutomation', () => {
		expect(buildAccessibilityTreeScript()).toContain('UIAutomation')
		expect(buildAccessibilityTreeScript()).toContain('RootElement')
	})
})
