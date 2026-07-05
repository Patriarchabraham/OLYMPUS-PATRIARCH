import { describe, expect, it } from 'vitest'
import { detectOpsIntent, isOpsIntent } from './intent.js'

describe('ops intent — detectOpsIntent', () => {
	it('detects a computer-control request on the PC', () => {
		const i = detectOpsIntent('please control my pc and open notepad')
		expect(i.isOpsRequest).toBe(true)
		expect(i.confidence).toBeGreaterThanOrEqual(0.5)
		expect(i.surface).toBe('computer')
		expect(i.triggers.length).toBeGreaterThan(0)
	})

	it('detects a browser automation request', () => {
		const i = detectOpsIntent('open the browser and find the cheapest flight to Lisbon')
		expect(i.isOpsRequest).toBe(true)
		expect(i.surface).toBe('browser')
	})

	it('detects a vision/read-the-screen request', () => {
		const i = detectOpsIntent('read the screen and tell me what error is showing')
		expect(i.isOpsRequest).toBe(true)
		expect(i.surface).toBe('vision')
	})

	it('detects a voice request', () => {
		const i = detectOpsIntent('listen to what I say and transcribe it')
		expect(i.isOpsRequest).toBe(true)
		expect(i.surface).toBe('voice')
	})

	it('detects an automation / team request', () => {
		const i = detectOpsIntent('automate this with a team of agents')
		expect(i.isOpsRequest).toBe(true)
		expect(['automation', 'computer']).toContain(i.surface)
	})

	it('rejects a clearly non-ops message', () => {
		const i = detectOpsIntent('write a haiku about the ocean')
		expect(i.isOpsRequest).toBe(false)
		expect(i.confidence).toBeLessThan(0.5)
	})

	it('isOpsIntent matches detectOpsIntent', () => {
		expect(isOpsIntent('click the save button')).toBe(true)
		expect(isOpsIntent('what is the meaning of life')).toBe(false)
	})
})
