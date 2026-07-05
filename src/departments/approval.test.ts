import { describe, expect, it } from 'vitest'
import { type ApprovalPolicy, buildApprovalCheck, needsApproval } from './approval.js'

describe('departments approval — needsApproval', () => {
	it("'allow' never asks", () => {
		expect(needsApproval('allow', true)).toBe(false)
		expect(needsApproval('allow', false)).toBe(false)
	})

	it("'ask-always' always asks", () => {
		expect(needsApproval('ask-always', false)).toBe(true)
		expect(needsApproval('ask-always', true)).toBe(true)
	})

	it("'ask-destructive' asks only for destructive actions", () => {
		expect(needsApproval('ask-destructive', true)).toBe(true)
		expect(needsApproval('ask-destructive', false)).toBe(false)
	})
})

describe('departments approval — buildApprovalCheck', () => {
	const input = { action: 'post', channel: 'x' }

	it("returns allow for read-only actions under 'ask-destructive'", () => {
		const res = buildApprovalCheck({
			input,
			summary: 'screenshot',
			policy: 'ask-destructive' as ApprovalPolicy,
			destructive: false,
		})
		expect(res.behavior).toBe('allow')
		expect(res.updatedInput).toBe(input)
		expect(res.message).toBeUndefined()
	})

	it("returns ask for destructive actions under 'ask-destructive'", () => {
		const res = buildApprovalCheck({
			input,
			summary: 'mouse click at (120, 340)',
			policy: 'ask-destructive',
			destructive: true,
		})
		expect(res.behavior).toBe('ask')
		expect(res.message).toContain('mouse click')
		expect(res.updatedInput).toBe(input)
	})

	it("returns ask for every action under 'ask-always' (Marketing publish)", () => {
		const res = buildApprovalCheck({
			input,
			summary: 'post to X: "launching Olympuz Coder"',
			policy: 'ask-always',
		})
		expect(res.behavior).toBe('ask')
		expect(res.message).toContain('post to X')
	})

	it("returns allow under 'allow'", () => {
		const res = buildApprovalCheck({ input, summary: 'speak', policy: 'allow' })
		expect(res.behavior).toBe('allow')
	})
})
