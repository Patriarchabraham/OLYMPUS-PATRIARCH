import { describe, expect, it } from 'vitest'
import {
	applyOpsDirective,
	loadOpsGovernance,
	opsGovernanceNotes,
	parseOpsDirective,
	resolveOpsPolicy,
} from './governance.js'

describe('ops governance — admin hierarchy', () => {
	it('Director override beats domain admin (admin of admins)', () => {
		let gov = loadOpsGovernance()
		gov = applyOpsDirective(gov, 'computer.approvalPolicy=allow')
		gov = applyOpsDirective(gov, 'director.computer.approvalPolicy=ask-destructive')
		expect(resolveOpsPolicy(gov, 'computer', 'approvalPolicy')).toBe('ask-destructive')
	})

	it('parses bool / int / comma-list values', () => {
		expect(parseOpsDirective('computer.allowFileDelete=false')?.value).toBe(false)
		expect(parseOpsDirective('automation.maxSteps=25')?.value).toBe(25)
		expect(parseOpsDirective('browser.scope=gmail.com,github.com')?.value).toEqual([
			'gmail.com',
			'github.com',
		])
	})

	it('rejects an unknown domain', () => {
		expect(parseOpsDirective('bogus.key=value')).toBeNull()
	})

	it('returns undefined for an unresolved policy', () => {
		expect(resolveOpsPolicy(loadOpsGovernance(), 'browser', 'scope')).toBeUndefined()
	})

	it('governance notes surface resolved policies with their origin', () => {
		let gov = loadOpsGovernance()
		gov = applyOpsDirective(gov, 'browser.scope=x.com,linkedin.com')
		gov = applyOpsDirective(gov, 'director.teams.requireApproval=true')
		const notes = opsGovernanceNotes(gov)
		expect(notes.some((n) => n.includes('browser.scope') && n.includes('x.com'))).toBe(true)
		expect(notes.some((n) => n.includes('[director] teams.requireApproval = true'))).toBe(true)
	})
})
